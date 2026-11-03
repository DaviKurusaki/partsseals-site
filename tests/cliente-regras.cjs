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

teste('linha do tempo: quatro passos e DESPACHADO como etapa final para todos os métodos', () => {
  const p = R.passos({ etapa: 'em_producao', metodo_entrega: 'Correio' });
  assert.deepEqual(p.map((x) => x.estado), ['feito', 'atual', 'futuro', 'futuro']);
  assert.equal(p[3].nome, 'DESPACHADO');
  assert.ok(p[1].corrente && !p[0].corrente);
  for (const etapa of ['com_transportadora', 'entregue', 'em_rota', 'despachado']) {
    for (const metodo of ['Cliente Retira', 'Correio', 'Transportadora', 'Azul Cargo', 'Entregamos', null]) {
      const e = R.passos({ etapa, metodo_entrega: metodo });
      assert.equal(e.length, 4);
      assert.equal(e[3].nome, 'DESPACHADO');
      assert.ok(e.every((x) => x.estado === 'feito')); assert.ok(e[3].corrente);
    }
  }
  const retirada = R.passos({ etapa: 'aguardando_retirada', metodo_entrega: 'Cliente Retira' });
  assert.deepEqual(retirada.map(x => x.estado), ['feito', 'feito', 'atual', 'futuro']);
  assert.equal(R.passos({ etapa: 'desconhecida' })[0].estado, 'atual');
});

teste('resumo por pedido de compra: produção, retirada e DESPACHADO', () => {
  const r = R.resumo(['recebido', 'em_producao', 'pronto', 'em_rota', 'aguardando_retirada', 'com_transportadora', 'entregue']
    .map((etapa, i) => ({ etapa, pedido_cliente: 'OC-' + i, empresa_id: 1, pedido: String(30000 + i) })));
  assert.deepEqual(r, { producao: 3, retirada: 1, despachado: 3, semOc: 0 });
});

teste('OC repetida em requisições conta uma vez e só é despachada após a última saída', () => {
  const registros = [
    { pedido: '30931', pedido_cliente: ' OC-900 ', empresa_id: 1, etapa: 'entregue', itens: Array(20).fill({ quantidade: 500 }) },
    { pedido: '30932', pedido_cliente: 'oc-900', empresa_id: 1, etapa: 'em_producao', itens: [] },
    { pedido: '30933', pedido_cliente: 'OC-901', empresa_id: 1, etapa: 'entregue' },
    { pedido: '30934', pedido_cliente: 'OC-901', empresa_id: 1, etapa: 'aguardando_retirada' },
    { pedido: '30935', pedido_cliente: 'OC-902', empresa_id: 1, etapa: 'com_transportadora' },
    { pedido: '30935', pedido_cliente: 'OC-902', empresa_id: 1, etapa: 'com_transportadora' },
    { pedido: '30931', pedido_cliente: 'OC-900', empresa_id: 2, etapa: 'entregue' },
    { pedido: '30936', pedido_cliente: null, empresa_id: 1, etapa: 'pronto' },
    { pedido: '30936', pedido_cliente: '', empresa_id: 1, etapa: 'pronto' },
    { pedido: '30937', pedido_cliente: '   ', empresa_id: 1, etapa: 'entregue' },
  ];
  assert.deepEqual(R.resumo(registros), { producao: 1, retirada: 1, despachado: 2, semOc: 2 });
  assert.deepEqual(R.resumo(R.filtrar(registros, { empresa: '2' })), { producao: 0, retirada: 0, despachado: 1, semOc: 0 });
  registros[1].etapa = 'entregue';
  assert.deepEqual(R.resumo(registros), { producao: 0, retirada: 1, despachado: 3, semOc: 2 });
});

teste('busca por nº do pedido ou OC e filtros em aberto/DESPACHADO', () => {
  const ps = [{ pedido: '30001', pedido_cliente: 'OC-778', etapa: 'entregue' }, { pedido: '30002', pedido_cliente: null, etapa: 'pronto' },
    { pedido: '30931', etapa: 'com_transportadora', metodo_entrega: 'Cliente Retira' }, { pedido: '30004', etapa: 'em_rota' },
    { pedido: '30005', etapa: 'aguardando_retirada' }];
  assert.deepEqual(R.filtrar(ps, { busca: 'oc-77' }).map((p) => p.pedido), ['30001']);
  assert.deepEqual(R.filtrar(ps, { busca: '30002' }).map((p) => p.pedido), ['30002']);
  assert.deepEqual(R.filtrar(ps, { filtro: 'aberto' }).map((p) => p.pedido), ['30002', '30005']);
  assert.deepEqual(R.filtrar(ps, { filtro: 'despachado' }).map((p) => p.pedido), ['30001', '30931', '30004']);
  const varias = [{ pedido: '1', empresa_id: 7, etapa: 'entregue' }, { pedido: '2', empresa_id: 9, etapa: 'em_producao' }];
  assert.deepEqual(R.filtrar(varias, { empresa: '9' }).map((p) => p.pedido), ['2']);
  assert.deepEqual(R.filtrar(varias, { empresa: '' }).map((p) => p.pedido), ['1', '2']);
  assert.deepEqual(R.filtrar(varias, { empresa: '7', filtro: 'aberto' }), []);
});

teste('"X de Y itens despachados" conta saída/rota/recebimento sem criar parcial falsa', () => {
  assert.deepEqual(R.progressoItens({ itens: [{ etapa: 'entregue' }, { etapa: 'pronto' }, { etapa: 'com_transportadora' }] }), { despachados: 2, total: 3 });
  assert.equal(R.progressoItens({ itens: [{ etapa: 'entregue' }, { etapa: 'com_transportadora' }, { etapa: 'em_rota' }] }), null);
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
