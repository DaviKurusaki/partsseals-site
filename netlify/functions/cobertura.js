'use strict';
// O arquivo de dados só integra o pacote da função, nunca o diretório público.
const dados = require('./cobertura-dados.json');
const SIGLAS = new Set('AC AL AP AM BA CE DF ES GO MA MT MS MG PA PB PR PE PI RJ RN RS RO RR SC SP SE TO'.split(' '));

function preparar(origem) {
  if (!origem || !Array.isArray(origem.ufs)) throw new Error('Fonte de cobertura inválida.');
  const vistas = new Set();
  const ufs = origem.ufs.map(item => {
    const uf = String(item.uf || '').toUpperCase();
    const dataReferencia = String(item.confirmadoEm || '');
    // A evidência fica no controle interno do arquivo, nunca no JSON público.
    const data = new Date(`${dataReferencia}T00:00:00Z`);
    if (!SIGLAS.has(uf) || vistas.has(uf) || !/^\d{4}-\d{2}-\d{2}$/.test(dataReferencia) ||
        !Number.isFinite(data.getTime()) || data.toISOString().slice(0, 10) !== dataReferencia || data.getTime() > Date.now() ||
        !String(item.evidenciaInterna || '').trim()) throw new Error('Cobertura sem comprovação válida.');
    vistas.add(uf);
    return { uf, dataReferencia };
  });
  return { ufs: ufs.sort((a, b) => a.uf.localeCompare(b.uf)), criterio: origem.criterio };
}

exports.handler = async evento => {
  if (evento.httpMethod !== 'GET') return { statusCode: 405, body: '' };
  try {
    const corpo = preparar(dados);
    return { statusCode: 200, headers: { 'Content-Type': 'application/json; charset=utf-8',
      'Cache-Control': 'public, max-age=300, stale-while-revalidate=3600',
      'Access-Control-Allow-Origin': 'https://parts-seals.com.br', 'X-Content-Type-Options': 'nosniff' },
    body: JSON.stringify(corpo) };
  } catch {
    return { statusCode: 503, headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store' },
      body: JSON.stringify({ erro: 'Cobertura indisponível' }) };
  }
};

exports._testes = { preparar };
