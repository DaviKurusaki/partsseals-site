'use strict';
/**
 * Expedição pelo celular — geografia pura (v0.2.708): distância entre dois
 * pontos, geocodificação de um endereço e a ordem de visita de uma rota.
 *
 * Compartilhado entre a função da Netlify (`site-expedicao/netlify/
 * functions/api.js`, embutido pelo esbuild — mesmo padrão de
 * `expedicao-consulta.cjs`) e o processo principal do Kuru Nuvem
 * (`src/main/*`). Zero dependência: `fetch` já existe nos dois ambientes
 * (Node 18+/Electron 33), e a conta (haversine) é só matemática.
 *
 * **Geocodificação é de graça, via OpenStreetMap/Nominatim** — decisão do
 * usuário. Tem limite de uso (no máximo 1 requisição por segundo, por
 * política do serviço) e exige um identificador da aplicação no cabeçalho
 * — por isso nunca deve rodar em lote apertado; aqui só roda uma vez por
 * endereço (o resultado fica salvo em `clientes_enderecos`), então o limite
 * nunca chega perto de ser um problema na prática.
 */

const RAIO_TERRA_M = 6371000;

/** Distância em metros entre dois pontos (fórmula de haversine). */
function distanciaMetros(lat1, lng1, lat2, lng2) {
  if (![lat1, lng1, lat2, lng2].every((v) => typeof v === 'number' && Number.isFinite(v))) return null;
  const rad = (g) => (g * Math.PI) / 180;
  const dLat = rad(lat2 - lat1);
  const dLng = rad(lng2 - lng1);
  const a = Math.sin(dLat / 2) ** 2
    + Math.cos(rad(lat1)) * Math.cos(rad(lat2)) * Math.sin(dLng / 2) ** 2;
  return RAIO_TERRA_M * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());

/** Monta "Rua X, 100, Bairro, Cidade - UF, CEP" a partir das colunas de
 *  `clientes_enderecos` — a mesma string pra geocodificar e pra exibir. */
function enderecoCompleto({ endereco, bairro, cidade, uf, cep } = {}) {
  const partes = [texto(endereco), texto(bairro), [texto(cidade), texto(uf)].filter(Boolean).join(' - '), texto(cep)]
    .filter(Boolean);
  return partes.join(', ');
}

/**
 * Converte um endereço em `{latitude, longitude}` via Nominatim, ou `null`
 * se não achar/der erro de rede. Nunca lança — geocodificação é sempre
 * best-effort, um endereço que falha continua existindo (só sem cerca).
 */
let filaGeo = Promise.resolve();
let ultimaConsultaGeo = 0;
const cacheGeo = new Map();
async function geocodificar(enderecoTexto) {
  const chave = texto(enderecoTexto);
  if (!chave) return null;
  if (cacheGeo.has(chave)) return cacheGeo.get(chave);
  const consulta = filaGeo.then(async () => {
    const pausa = Math.max(0, 1100 - (Date.now() - ultimaConsultaGeo));
    if (pausa) await new Promise(resolve => setTimeout(resolve, pausa));
    ultimaConsultaGeo = Date.now();
    const ponto = await consultarGeocodigo(chave);
    if (ponto) { if (cacheGeo.size > 100) cacheGeo.clear(); cacheGeo.set(chave, ponto); }
    return ponto;
  });
  filaGeo = consulta.catch(() => null);
  return consulta;
}
async function consultarGeocodigo(enderecoTexto) {
  const q = texto(enderecoTexto);
  if (!q) return null;
  try {
    const url = `https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=br&q=${encodeURIComponent(q)}`;
    const resp = await fetch(url, {
      signal: AbortSignal.timeout(7000),
      headers: {
        // Nominatim exige um identificador de verdade da aplicação, nunca
        // um User-Agent genérico de biblioteca — é política do serviço.
        'User-Agent': 'KuruNuvem-ExpedicaoCelular/1.0 (contato: vendas@parts-seals.com.br)',
        'Accept-Language': 'pt-BR',
      },
    });
    if (!resp.ok) return null;
    const linhas = await resp.json();
    const r = Array.isArray(linhas) ? linhas[0] : null;
    if (!r) return null;
    const latitude = Number(r.lat);
    const longitude = Number(r.lon);
    if (!Number.isFinite(latitude) || !Number.isFinite(longitude)) return null;
    return { latitude, longitude };
  } catch {
    return null;
  }
}

/**
 * Ordem de visita das paradas por "vizinho mais próximo" (guloso): parte de
 * `origem` (a posição do motorista no momento de montar a rota, ou `null`),
 * sempre pula pra parada AINDA NÃO visitada mais perto da última escolhida.
 * Não é o ótimo matemático (isso é um problema NP-difícil de verdade), mas
 * pra até ~15-20 paradas — o tamanho real de uma rota de entrega num dia —
 * o resultado guloso costuma ficar bem perto do melhor roteiro possível,
 * sem precisar de nenhum serviço pago de rotas.
 *
 * Parada sem coordenada (endereço não geocodificado) sempre vai pro FINAL,
 * na ordem em que apareceu — nunca inventa uma posição pra ela.
 */
function ordenarPorProximidade(origem, paradas) {
  const comCoordenada = paradas.filter((p) => Number.isFinite(p.latitude) && Number.isFinite(p.longitude));
  const semCoordenada = paradas.filter((p) => !comCoordenada.includes(p));

  const restantes = [...comCoordenada];
  const ordenadas = [];
  let ponto = origem && Number.isFinite(origem.latitude) && Number.isFinite(origem.longitude) ? origem : null;

  while (restantes.length) {
    let indiceMaisPerto = 0;
    if (ponto) {
      let menorDistancia = Infinity;
      restantes.forEach((p, i) => {
        const d = distanciaMetros(ponto.latitude, ponto.longitude, p.latitude, p.longitude);
        if (d !== null && d < menorDistancia) { menorDistancia = d; indiceMaisPerto = i; }
      });
    }
    const [escolhida] = restantes.splice(indiceMaisPerto, 1);
    ordenadas.push(escolhida);
    ponto = escolhida;
  }

  return [...ordenadas, ...semCoordenada];
}

module.exports = { distanciaMetros, enderecoCompleto, geocodificar, ordenarPorProximidade };
