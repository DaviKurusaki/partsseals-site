'use strict';
// Reproduz o asset estático do mapa a partir das malhas e localidades oficiais.
const fs = require('node:fs');
const path = require('node:path');

const MALHA = 'https://servicodados.ibge.gov.br/api/v3/malhas/paises/BR?formato=application/vnd.geo%2Bjson&intrarregiao=UF&qualidade=minima';
const LOCALIDADES = 'https://servicodados.ibge.gov.br/api/v1/localidades/estados';

async function json(url) {
  const resposta = await fetch(url, { signal: AbortSignal.timeout(30000) });
  if (!resposta.ok) throw new Error(`IBGE respondeu ${resposta.status}`);
  return resposta.json();
}

function aneis(geometria) {
  return geometria.type === 'Polygon' ? geometria.coordinates : geometria.coordinates.flat();
}

async function gerar() {
  const [malha, localidades] = await Promise.all([json(MALHA), json(LOCALIDADES)]);
  if (malha.features?.length !== 27 || localidades.length !== 27) throw new Error('IBGE não devolveu 27 UFs.');
  const pontos = malha.features.flatMap(f => aneis(f.geometry).flat());
  const minX = Math.min(...pontos.map(p => p[0]));
  const maxX = Math.max(...pontos.map(p => p[0]));
  const minY = Math.min(...pontos.map(p => p[1]));
  const maxY = Math.max(...pontos.map(p => p[1]));
  const escala = Math.min(680 / (maxX - minX), 650 / (maxY - minY));
  const x = v => ((v - minX) * escala + 10).toFixed(1);
  const y = v => ((maxY - v) * escala + 10).toFixed(1);
  const porCodigo = new Map(localidades.map(uf => [String(uf.id), uf]));
  const ufs = malha.features.map(f => {
    const uf = porCodigo.get(f.properties.codarea);
    if (!uf) throw new Error(`UF desconhecida: ${f.properties.codarea}`);
    const d = aneis(f.geometry).map(anel => anel.map((p, i) => `${i ? 'L' : 'M'}${x(p[0])} ${y(p[1])}`).join('') + 'Z').join('');
    return { uf: uf.sigla, nome: uf.nome, regiao: uf.regiao.nome, d };
  }).sort((a, b) => a.nome.localeCompare(b.nome, 'pt-BR'));
  if (new Set(ufs.map(u => u.uf)).size !== 27) throw new Error('Malha com UFs repetidas.');
  const saida = { fonte: 'IBGE API de Malhas v3 e Localidades v1', urlMalha: MALHA, urlLocalidades: LOCALIDADES,
    geradoEm: new Date().toISOString().slice(0, 10), viewBox: `0 0 ${Math.ceil((maxX-minX)*escala+20)} ${Math.ceil((maxY-minY)*escala+20)}`, ufs };
  fs.writeFileSync(path.join(__dirname, '../assets/brasil-ufs.json'), JSON.stringify(saida) + '\n');
  console.log(`Mapa IBGE: ${ufs.length} UFs; ${Math.round(JSON.stringify(saida).length / 1024)} KiB.`);
}

gerar().catch(e => { console.error(e.message); process.exitCode = 1; });
