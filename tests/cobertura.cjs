'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const raiz = path.resolve(__dirname, '..');
const malha = JSON.parse(fs.readFileSync(path.join(raiz, 'assets/brasil-ufs.json'), 'utf8'));
const api = require('../netlify/functions/cobertura.js');

assert.equal(malha.ufs.length, 27);
assert.equal(new Set(malha.ufs.map(u => u.uf)).size, 27);
assert.equal(malha.ufs.find(u => u.uf === 'DF').nome, 'Distrito Federal');
assert.deepEqual(new Set(malha.ufs.map(u => u.regiao)), new Set(['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul']));
assert(malha.ufs.every(u => /^M/.test(u.d) && /Z$/.test(u.d)));

const aprovado = api._testes.preparar({ criterio: 'teste', ufs: [
  { uf: 'SP', confirmadoEm: '2026-01-20', evidenciaInterna: 'DEMO-INTERNAL-1' },
  { uf: 'DF', confirmadoEm: '2026-02-20', evidenciaInterna: 'DEMO-INTERNAL-2' },
] });
assert.equal(aprovado.ufs.length, 2);
assert.deepEqual(aprovado.ufs.map(u => u.uf), ['DF', 'SP']);
assert(!JSON.stringify(aprovado).includes('DEMO-INTERNAL'));
assert.throws(() => api._testes.preparar({ ufs: [{ uf: 'SP', confirmadoEm: '2026-01-20' }] }));
assert.throws(() => api._testes.preparar({ ufs: [{ uf: 'XX', confirmadoEm: '2026-01-20', evidenciaInterna: 'DEMO' }] }));
assert.throws(() => api._testes.preparar({ ufs: [{ uf: 'SP', confirmadoEm: '2026-02-30', evidenciaInterna: 'DEMO' }] }));

api.handler({ httpMethod: 'GET' }).then(r => {
  assert.equal(r.statusCode, 200);
  assert.deepEqual(JSON.parse(r.body).ufs, []);
  assert(!/evidenciaInterna|cliente|pedido|endereco|valor/.test(r.body));
  console.log('OK: 27 UFs, regiões, contagem, fonte vazia e resposta pública mínima.');
}).catch(e => { console.error(e); process.exitCode = 1; });
