'use strict';

// Regras compartilhadas pelo portal, API e fila de avisos do Kuru.
const { distanciaMetros } = require('./expedicao-geo.cjs');
const RAIO_CERCA_M = 100;
const PERMANENCIA_MS = 120000;
const MAX_INTERVALO_MS = 90000;
const MAX_PRECISAO_M = 75;
const EMPRESA_ENDERECO = "R. José Adhemar Petrini, 60, Jardim Cedros, Santa Bárbara d'Oeste - SP, 13457-174";
// Ponto da empresa no link de localização do seu site institucional:
// https://maps.app.goo.gl/HVTqCcVqPfvNhY1S6 (não o centro da visualização @).
const EMPRESA_LOCALIZACAO = { endereco: EMPRESA_ENDERECO, latitude: -22.7794043, longitude: -47.3701747 };
const chaveCliente = v => String(v || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const destinoChave = cliente => chaveCliente(cliente) === 'JSLCAMPINAS' ? 'JSLSBO' : chaveCliente(cliente);
function coordenada(v, limite) {
  if (v === null || v === undefined || v === '' || typeof v === 'boolean') return null;
  const n = Number(v);
  return Number.isFinite(n) && Math.abs(n) <= limite ? n : null;
}
function posicao(corpo) {
  const latitude = coordenada(corpo.lat, 90), longitude = coordenada(corpo.lng, 180);
  const precisao = coordenada(corpo.precisao, 100000);
  if (latitude === null || longitude === null || (precisao !== null && (precisao < 0 || precisao > MAX_PRECISAO_M))) return null;
  return { latitude, longitude };
}
function locais(paradas) {
  const mapa = new Map();
  for (const p of paradas) {
    const chave = p.destino_chave || destinoChave(p.cliente);
    if (!mapa.has(chave)) mapa.set(chave, { chave, nome: p.destino_cliente || p.cliente, latitude: p.latitude, longitude: p.longitude, paradas: [] });
    mapa.get(chave).paradas.push(p);
  }
  return [...mapa.values()];
}
function cercasNaPosicao(paradas, ponto) {
  if (!ponto) return [];
  return locais(paradas).filter(p => {
    const d = distanciaMetros(ponto.latitude, ponto.longitude, p.latitude, p.longitude);
    return d !== null && d <= RAIO_CERCA_M;
  });
}
function avaliarEntrega(parada, paradas, ponto, cercaChave) {
  const cercas = cercasNaPosicao(paradas, ponto);
  const opcoes = cercas.map(c => ({ chave: c.chave, nome: c.nome }));
  if (cercas.length > 1 && !cercas.some(c => c.chave === cercaChave)) return { precisaEscolherCerca: true, cercas: opcoes };
  const cerca = cercas.find(c => c.chave === cercaChave) || cercas[0];
  const propria = parada.destino_chave || destinoChave(parada.cliente);
  const divergencia = cerca && cerca.chave !== propria ? cerca.nome : null;
  return { cercas: opcoes, divergencia, confirmadoPorLocalizacao: Boolean(cerca), cercaChave: cerca?.chave || null, cercaNome: cerca?.nome || null, requerJustificativa: !cerca || Boolean(divergencia), requerConfirmacao: Boolean(divergencia) };
}
function acompanharCerca(parada, dentro, agora) {
  const ultima = Date.parse(parada.cerca_posicao_em || '');
  const continuo = Number.isFinite(ultima) && agora - ultima >= 0 && agora - ultima <= MAX_INTERVALO_MS;
  if (dentro) {
    const inicio = parada.cerca_dentro && continuo ? Date.parse(parada.cerca_entrou_em || '') : agora;
    const desde = Number.isFinite(inicio) ? inicio : agora;
    return { autoEntregar: false, alteracoes: { cerca_dentro: true, cerca_entrou_em: new Date(desde).toISOString(), cerca_posicao_em: new Date(agora).toISOString(), cerca_permanencia_ok: agora - desde >= PERMANENCIA_MS } };
  }
  return { autoEntregar: Boolean(parada.cerca_dentro && continuo && parada.cerca_permanencia_ok), alteracoes: { cerca_dentro: false, cerca_entrou_em: null, cerca_permanencia_ok: false, cerca_posicao_em: new Date(agora).toISOString() } };
}
function textoEntrega(p) {
  const cliente = String(p.cliente || '').trim();
  if (p.entrega_automatica && !p.checklist_marcado) return `${cliente} ENTREGUE PORÉM SEM CHECKLIST MARCADO\nSaída da cerca de ${p.destino_cliente || cliente} após pelo menos 2 minutos.`;
  if (p.divergencia) return `⚠️ ${cliente} MARCADO COMO ENTREGUE NA CERCA DE ${p.divergencia}\nPossível entrega das sacolas no cliente errado. Confira.\nJustificativa: ${p.justificativa}`;
  if (p.confirmado_por_localizacao) return `${cliente} ENTREGUE NA CERCA DE ${p.destino_cliente || cliente}`;
  return `${cliente} ENTREGUE — LOCALIZAÇÃO NÃO CONFIRMADA\nJustificativa: ${p.justificativa}`;
}

// Circuito dirigido: inclui a volta à empresa. Exato até 12 destinos;
// acima disso usa múltiplos inícios e melhoria local, com tempos pelas ruas.
function custoOrdem(ordem, matriz) {
  const caminho = [0, ...ordem, 0];
  return caminho.slice(1).reduce((s, p, i) => s + matriz[caminho[i]][p], 0);
}
function otimizarCircuito(matriz) {
  const n = matriz.length - 1;
  if (n < 1) return { ordem: [], segundos: 0 };
  if (matriz.some(l => !Array.isArray(l) || l.length !== n + 1 || l.some(v => typeof v !== 'number' || !Number.isFinite(v) || v < 0))) throw new Error('Não foi possível calcular todos os trechos pelas ruas. Confira os endereços.');
  let ordem;
  if (n <= 12) {
    const total = 1 << n, dp = Array.from({ length: total }, () => new Float64Array(n).fill(Infinity));
    const anterior = Array.from({ length: total }, () => new Int16Array(n).fill(-1));
    for (let j = 0; j < n; j++) dp[1 << j][j] = matriz[0][j + 1];
    for (let m = 1; m < total; m++) for (let j = 0; j < n; j++) if (m & (1 << j)) {
      for (let k = 0; k < n; k++) if (!(m & (1 << k))) {
        const novo = m | (1 << k), c = dp[m][j] + matriz[j + 1][k + 1];
        if (c < dp[novo][k]) { dp[novo][k] = c; anterior[novo][k] = j; }
      }
    }
    let fim = 0;
    for (let j = 1; j < n; j++) if (dp[total - 1][j] + matriz[j + 1][0] < dp[total - 1][fim] + matriz[fim + 1][0]) fim = j;
    ordem = []; let m = total - 1;
    while (fim >= 0) { ordem.unshift(fim + 1); const antigo = fim; fim = anterior[m][fim]; m ^= 1 << antigo; }
  } else {
    let melhor = Infinity;
    for (let inicio = 1; inicio <= n; inicio++) {
      let lista = [inicio]; const faltam = new Set(Array.from({ length: n }, (_, i) => i + 1).filter(i => i !== inicio));
      while (faltam.size) { const atual = lista.at(-1); const proxima = [...faltam].sort((a, b) => matriz[atual][a] - matriz[atual][b])[0]; lista.push(proxima); faltam.delete(proxima); }
      let custo = custoOrdem(lista, matriz);
      for (let rodada = 0; rodada < 8; rodada++) {
        let mudou = false;
        for (let a = 0; a < n - 1; a++) for (let b = a + 1; b < n; b++) {
          const candidata = [...lista.slice(0, a), ...lista.slice(a, b + 1).reverse(), ...lista.slice(b + 1)], c = custoOrdem(candidata, matriz);
          if (c < custo) { lista = candidata; custo = c; mudou = true; }
        }
        if (!mudou) break;
      }
      if (custo < melhor) { melhor = custo; ordem = lista; }
    }
  }
  return { ordem, segundos: Math.round(custoOrdem(ordem, matriz)) };
}
async function matrizTempos(pontos, chave = process.env.OPENROUTESERVICE_API_KEY) {
  if (!chave) throw new Error('Configure OPENROUTESERVICE_API_KEY na Netlify para calcular a rota gratuita.');
  if (pontos.length > 50) throw new Error('No máximo 49 endereços diferentes por viagem.');
  const resposta = await fetch('https://api.heigit.org/openrouteservice/v2/matrix/driving-car', {
    method: 'POST', headers: { Authorization: chave, 'Content-Type': 'application/json' },
    body: JSON.stringify({ locations: pontos.map(p => [p.longitude, p.latitude]), metrics: ['duration'] }),
    signal: AbortSignal.timeout(15000),
  });
  if (!resposta.ok) throw new Error('Não foi possível calcular a rota gratuita. Confira a chave e a cota do openrouteservice e tente novamente.');
  const dados = await resposta.json();
  otimizarCircuito(dados.durations || []); // valida trechos inacessíveis/null
  if (dados.durations?.length !== pontos.length) throw new Error('O serviço de rotas retornou uma matriz incompleta.');
  return dados.durations;
}
module.exports = { RAIO_CERCA_M, PERMANENCIA_MS, MAX_INTERVALO_MS, MAX_PRECISAO_M, EMPRESA_ENDERECO, EMPRESA_LOCALIZACAO, chaveCliente, destinoChave, coordenada, posicao, locais, cercasNaPosicao, avaliarEntrega, acompanharCerca, textoEntrega, custoOrdem, otimizarCircuito, matrizTempos };
