'use strict';
/**
 * Regras puras do painel da Área do Cliente (cliente/js/regras.js).
 *
 *   node tests/cliente-regras.cjs
 */
const assert = require('node:assert/strict');
const R = require('../cliente/js/regras.js');

let ok = 0;
const falhas = [];
function teste(nome, fn) { try { fn(); ok += 1; console.log('  ✓', nome); } catch (err) { falhas.push(nome); console.log('  ✗', nome, '\n   ', err.message); } }

console.log('Área do Cliente — regras do painel');

teste('linha do tempo: concluídos, atual e futuros; 4º passo pela etapa ou pelo método', () => {
  const p = R.passos({ etapa: 'em_producao', metodo_entrega: 'Correio' });
  assert.deepEqual(p.map((x) => x.estado), ['feito', 'atual', 'futuro', 'futuro', 'futuro']);
  assert.equal(p[3].nome, 'Na transportadora');
  assert.ok(p[1].corrente && !p[0].corrente);
  assert.equal(R.passos({ etapa: 'pronto', metodo_entrega: 'Cliente Retira' })[3].nome, 'Aguardando retirada');
  assert.equal(R.passos({ etapa: 'pronto', metodo_entrega: 'Entregamos' })[3].nome, 'A caminho');
  assert.equal(R.passos({ etapa: 'em_rota', metodo_entrega: 'Correio' })[3].nome, 'A caminho');
  const e = R.passos({ etapa: 'entregue' });
  assert.ok(e.every((x) => x.estado === 'feito')); assert.ok(e[4].corrente);
  assert.equal(R.passos({ etapa: 'desconhecida' })[0].estado, 'atual');
});

teste('resumo: produção (recebido+em produção+pronto), a caminho e entregues', () => {
  const r = R.resumo([{ etapa: 'recebido' }, { etapa: 'em_producao' }, { etapa: 'pronto' }, { etapa: 'em_rota' },
    { etapa: 'aguardando_retirada' }, { etapa: 'com_transportadora' }, { etapa: 'entregue' }]);
  assert.deepEqual(r, { producao: 3, caminho: 3, entregue: 1 });
});

teste('busca por nº do pedido ou OC e filtros em aberto/entregues', () => {
  const ps = [{ pedido: '30001', pedido_cliente: 'OC-778', etapa: 'entregue' }, { pedido: '30002', pedido_cliente: null, etapa: 'pronto' }];
  assert.deepEqual(R.filtrar(ps, { busca: 'oc-77' }).map((p) => p.pedido), ['30001']);
  assert.deepEqual(R.filtrar(ps, { busca: '30002' }).map((p) => p.pedido), ['30002']);
  assert.deepEqual(R.filtrar(ps, { filtro: 'aberto' }).map((p) => p.pedido), ['30002']);
  assert.deepEqual(R.filtrar(ps, { filtro: 'entregue' }).map((p) => p.pedido), ['30001']);
});

teste('"X de Y itens entregues" só quando os itens estão em etapas diferentes', () => {
  assert.deepEqual(R.progressoItens({ itens: [{ etapa: 'entregue' }, { etapa: 'pronto' }, { etapa: 'entregue' }] }), { entregues: 2, total: 3 });
  assert.equal(R.progressoItens({ itens: [{ etapa: 'pronto' }, { etapa: 'pronto' }] }), null);
  assert.equal(R.progressoItens({ itens: [{ etapa: 'pronto' }] }), null);
  assert.equal(R.progressoItens({ itens: [{ etapa: 'pronto' }, { etapa: 'em_producao' }] }), null);
});

teste('rastreio dos Correios vira link; outro código fica para copiar; PRESENCIAL some', () => {
  const r = R.rastreios({ rastreios: ['oy845516754br', 'BRASPRESS 12345', 'PRESENCIAL', ''] });
  assert.equal(r.length, 2);
  assert.ok(r[0].correios && r[0].link.endsWith('OY845516754BR'));
  assert.ok(!r[1].correios && r[1].link === null);
});

teste('datas: data pura sem fuso e instante no fuso de São Paulo', () => {
  assert.equal(R.dataBr('2026-11-02'), '02/11/2026');
  assert.equal(R.dataBr(null), '');
  assert.equal(R.dataHoraBr('2026-11-03T01:30:00Z'), '02/11 às 22:30');
  assert.equal(R.dataHoraBr('lixo'), '');
});

teste('quantidade brasileira e máscaras de CNPJ e telefone', () => {
  assert.equal(R.quantidade(1500), '1.500');
  assert.equal(R.quantidade(2.5), '2,5');
  assert.equal(R.quantidade(null), '');
  assert.equal(R.mascaraCnpj('11222333000181'), '11.222.333/0001-81');
  assert.equal(R.mascaraTelefone('19983011817'), '(19) 98301-1817');
  assert.equal(R.mascaraTelefone('1936263552'), '(19) 3626-3552');
  assert.ok(R.cnpjValido('11.222.333/0001-81')); assert.ok(!R.cnpjValido('11.222.333/0001-80'));
});

console.log(`\n${ok} ok, ${falhas.length} falha(s).`);
if (falhas.length) process.exit(1);
