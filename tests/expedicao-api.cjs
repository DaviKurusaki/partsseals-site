'use strict';
/**
 * Testes da expedição pelo celular (v0.2.687, ampliado na v0.2.696 e na
 * v0.2.697 — "Marcar Expedição"), sem Supabase nem Netlify:
 *  - a função da Netlify (netlify/functions/expedicao-api/index.js) contra um
 *    PostgREST simulado em memória (fetch trocado);
 *
 *   node tests/expedicao-api.cjs
 */

const assert = require('node:assert/strict');
const path = require('node:path');

let ok = 0;
const falhas = [];
async function teste(nome, fn) {
  try { await fn(); ok += 1; console.log('  ✓', nome); } catch (err) { falhas.push(nome); console.log('  ✗', nome, '\n   ', err.message); }
}

// --- banco simulado ---------------------------------------------------------------

const banco = {};
function zerarBanco() {
  for (const k of Object.keys(banco)) delete banco[k];
  Object.assign(banco, {
    pcp_ajustes: [
      { tipo: 'sistema', chave: 'expedicao_celular', valor: { ligado: true } },
      { tipo: 'entrega', chave: 'padrao||JSL S.B.O.', valor: 'Correio' },
      { tipo: 'entrega', chave: 'porItem||2026-10-09||29800/2||45122', valor: 'Transportadora' },
    ],
    expedicao_qr_tokens: [
      { token: 'ABCDEFGH23', tipo: 'op', chave: '29800/1', cliente: 'JSL S.B.O.', pedido: '617/26' },
      { token: 'PEDIDO2345', tipo: 'pedido', chave: '29800', cliente: 'JSL S.B.O.', pedido: '617/26' },
    ],
    banco_ordens_itens: [
      { numero_op: '29800/1', cod_item: '44360', descricao: 'ANEL PU 20X30', qntd: '10', pedido: '617/26', cliente: 'JSL S.B.O.', data_entrega: '09/10/2026' },
      { numero_op: '29800/2', cod_item: '45122', descricao: 'GAXETA TEFLON', qntd: '4,0', pedido: '617/26', cliente: 'JSL S.B.O.', data_entrega: '2026-10-09' },
      { numero_op: '29801/1', cod_item: '99999', descricao: 'OUTRO PEDIDO', qntd: '1', pedido: '700', cliente: 'OUTRO', data_entrega: '10/10/2026' },
    ],
    clientes_enderecos: [
      { cliente: 'JSL S.B.O.', cliente_chave: 'JSLSBO', endereco: 'Rua A, 100', bairro: 'Centro', cidade: 'Campinas', uf: 'SP', cep: '13000-000', observacao: 'Portaria 2' },
    ],
    posvenda_contatos: [],
    expedicao_baixas: [
      { requisicao: '29800', pedido: '617/26', cliente: 'JSL S.B.O.', acao: 'COLETA', responsavel: 'JOAO', evento_em: '2026-10-08T14:00:00Z', itens: [{ numero_op: '29800/1', cod_item: '44360' }] },
    ],
    fiscal_pedidos: [],
    fiscal_notas_itens: [],
    fiscal_notas: [],
    expedicao_celular_tentativas: [],
    audit_log: [],
  });
}

const usuarios = {
  '1234': { id: 'u1', nome: 'MOTORISTA', papel: 'operador', permissoes: { 'expedicao-celular': { ver: true } } },
  '5555': { id: 'u2', nome: 'SEM PERMISSAO', papel: 'operador', permissoes: { pcp: { ver: true } } },
  '9999': { id: 'u3', nome: 'ADMIN', papel: 'admin', permissoes: {} },
  '4321': { id: 'u4', nome: 'MOTORISTA QUE MARCA', papel: 'operador', permissoes: { 'expedicao-celular': { ver: true }, 'expedicao-celular-marcar': { ver: true } } },
};

function desaspar(v) { return decodeURIComponent(v).replace(/^"(.*)"$/, '$1').replace(/\\"/g, '"'); }
function filtrar(linhas, params) {
  return linhas.filter((l) => {
    for (const [col, expr] of params) {
      if (['select', 'limit', 'order', 'offset'].includes(col)) continue;
      const v = l[col] == null ? '' : String(l[col]);
      if (expr.startsWith('eq.')) { if (v !== decodeURIComponent(expr.slice(3))) return false; }
      else if (expr.startsWith('in.(')) {
        const lista = decodeURIComponent(expr).slice(4, -1).match(/"(?:[^"\\]|\\.)*"|[^,]+/g).map(desaspar);
        if (!lista.includes(v)) return false;
      } else if (expr.startsWith('ilike.')) {
        const padrao = decodeURIComponent(expr.slice(6));
        const re = new RegExp('^' + padrao.split('*').map((p) => p.replace(/[.+?^${}()|[\]\\]/g, '\\$&')).join('.*') + '$', 'i');
        if (!re.test(v)) return false;
      } else throw new Error('operador nao simulado: ' + expr);
    }
    return true;
  });
}

global.fetch = async (url, opcoes = {}) => {
  const u = new URL(url);
  const caminho = decodeURIComponent(u.pathname.replace('/rest/v1/', ''));
  const metodo = opcoes.method || 'GET';
  const resposta = (status, corpo) => ({ ok: status < 300, status, text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)) });
  if (caminho === 'rpc/app_login') {
    const u2 = usuarios[JSON.parse(opcoes.body).p_pin];
    return resposta(200, u2 ? [u2] : []);
  }
  const params = [...new URLSearchParams(u.search.replace(/\+/g, '%2B'))].map(([k, v]) => [k, encodeURIComponent(v)]);
  const tabela = banco[caminho];
  if (!tabela) return resposta(404, { message: `tabela ${caminho} nao existe` });
  if (metodo === 'GET') {
    const sel = filtrar(tabela, params);
    const offset = Number(u.searchParams.get('offset') || 0), limite = Number(u.searchParams.get('limit') || sel.length);
    return resposta(200, sel.slice(offset, offset + limite));
  }
  if (metodo === 'POST') {
    const prefer = String(opcoes.headers?.Prefer || '');
    const corpo = JSON.parse(opcoes.body);
    const lista = Array.isArray(corpo) ? corpo : [corpo];
    if (prefer.includes('merge-duplicates')) {
      // upsert por `chave` (pcp_ajustes, expedicao_celular_tentativas) — o
      // único uso de `db.upsert()` neste arquivo.
      for (const reg of lista) {
        const i = tabela.findIndex((l) => l.chave === reg.chave);
        if (i >= 0) tabela[i] = { ...tabela[i], ...reg }; else tabela.push(reg);
      }
      return resposta(201);
    }
    // `db.inserir()` — sempre linha nova, com `id` autoincrementado, mesmo
    // contrato de uma tabela `identity` de verdade.
    let proximoId = tabela.reduce((m, l) => Math.max(m, Number(l.id) || 0), 0);
    const criadas = lista.map((reg) => { const linha = { id: ++proximoId, ...reg }; tabela.push(linha); return linha; });
    return resposta(201, prefer.includes('return=representation') ? criadas : undefined);
  }
  if (metodo === 'DELETE') {
    const fora = new Set(filtrar(tabela, params));
    banco[caminho] = tabela.filter((l) => !fora.has(l));
    return resposta(204);
  }
  throw new Error('metodo nao simulado');
};

process.env.SUPABASE_URL = 'https://simulado.supabase.co';
process.env.SUPABASE_ANON_KEY = 'anon';
process.env.KURU_SEGREDO_SESSAO = 'segredo-de-teste';
const api = require(path.join(__dirname, '..', 'netlify', 'functions', 'expedicao-api', 'index.js'));

const chamar = (rota, { metodo = 'GET', corpo, sessao, query, ip = '10.0.0.1' } = {}) => api.handler({
  path: `/.netlify/functions/expedicao-api/${rota}`, httpMethod: metodo,
  body: corpo ? JSON.stringify(corpo) : undefined,
  queryStringParameters: query || {},
  headers: { 'x-nf-client-connection-ip': ip, ...(sessao ? { authorization: `Bearer ${sessao}` } : {}) },
}).then((r) => ({ status: r.statusCode, ...JSON.parse(r.body) }));

async function principal() {
  console.log('Função da Netlify');
  zerarBanco();

  await teste('estado diz se está ligado', async () => {
    assert.equal((await chamar('estado')).ligado, true);
    banco.pcp_ajustes[0].valor.ligado = false;
    assert.equal((await chamar('estado')).ligado, false);
  });

  await teste('desligado recusa login', async () => {
    const r = await chamar('login', { metodo: 'POST', corpo: { pin: '1234' } });
    assert.equal(r.status, 403);
    assert.equal(r.desligado, true);
    banco.pcp_ajustes[0].valor.ligado = true;
  });

  let sessao;
  await teste('PIN certo com permissão entra', async () => {
    const r = await chamar('login', { metodo: 'POST', corpo: { pin: '1234' } });
    assert.equal(r.status, 200);
    assert.equal(r.nome, 'MOTORISTA');
    sessao = r.sessao;
  });

  await teste('PIN sem a permissão é recusado', async () => {
    const r = await chamar('login', { metodo: 'POST', corpo: { pin: '5555' } });
    assert.equal(r.status, 403);
    assert.match(r.erro, /Expedição pelo celular/);
  });

  await teste('admin entra sem a permissão marcada', async () => {
    assert.equal((await chamar('login', { metodo: 'POST', corpo: { pin: '9999' } })).status, 200);
  });

  await teste('cinco erros travam o IP; outro IP continua', async () => {
    for (let i = 0; i < 5; i += 1) {
      assert.equal((await chamar('login', { metodo: 'POST', corpo: { pin: '0000' }, ip: '9.9.9.9' })).status, 401);
    }
    const travado = await chamar('login', { metodo: 'POST', corpo: { pin: '1234' }, ip: '9.9.9.9' });
    assert.equal(travado.status, 429);
    assert.equal((await chamar('login', { metodo: 'POST', corpo: { pin: '1234' }, ip: '8.8.8.8' })).status, 200);
  });

  await teste('consulta sem sessão pede o PIN', async () => {
    const r = await chamar('consulta', { query: { t: 'ABCDEFGH23' } });
    assert.equal(r.status, 401);
    assert.equal(r.sessaoExpirada, true);
  });

  await teste('sessão adulterada é recusada', async () => {
    const [conteudo] = sessao.split('.');
    const r = await chamar('consulta', { sessao: `${conteudo}.xxxx`, query: { t: 'ABCDEFGH23' } });
    assert.equal(r.status, 401);
  });

  await teste('QR de OP: item em destaque + o pedido inteiro', async () => {
    const r = await chamar('consulta', { sessao, query: { t: 'abcdefgh23' } });
    assert.equal(r.status, 200, r.erro);
    assert.equal(r.tipo, 'op');
    assert.equal(r.destaque, '29800/1');
    assert.deepEqual(r.itens.map((i) => i.numeroOp), ['29800/1', '29800/2']);
    assert.equal(r.resumo.total, 2);
    assert.equal(r.resumo.despachados, 1);
    assert.equal(r.endereco.cidade, 'Campinas');
    const [primeiro, segundo] = r.itens;
    assert.equal(primeiro.despachado, true);
    assert.equal(primeiro.situacao, 'Coletado');
    assert.equal(primeiro.despachoEm, '2026-10-08T14:00:00Z');
    assert.equal(primeiro.previsao, '2026-10-09');
    assert.equal(primeiro.metodoEntrega, 'Correio', 'padrão do cliente');
    assert.equal(segundo.despachado, false);
    assert.equal(segundo.metodoEntrega, 'Transportadora', 'exceção do item vence o padrão');
    assert.equal(segundo.descricao, '45122 - GAXETA TEFLON');
  });

  await teste('item despachado via Fiscal expõe tipo/responsável/grupo de entrega, e NF/rastreio são do pedido inteiro', async () => {
    banco.fiscal_pedidos.push({
      requisicao: '29800', pedido: '617/26', cliente: 'JSL S.B.O.',
      produto: '45122 GAXETA TEFLON', status: 'DESPACHADO',
      nf: '10528', rastreio: 'BR123456789BR',
      baixado_por: 'CARLOS', evento_em: '2026-10-09T10:00:00Z',
    });
    const r = await chamar('consulta', { sessao, query: { t: 'ABCDEFGH23' } });
    assert.equal(r.status, 200, r.erro);
    assert.equal(r.nf, '10528', 'NF do pedido inteiro, não só do item que despachou');
    assert.equal(r.rastreio, 'BR123456789BR');
    const primeiro = r.itens.find((i) => i.numeroOp === '29800/1');
    assert.equal(primeiro.tipo, 'coletado');
    assert.equal(primeiro.responsavel, 'JOAO');
    assert.equal(primeiro.grupoEntrega, 'Correio', 'método "Correio" vira o rótulo padronizado');
    const segundo = r.itens.find((i) => i.numeroOp === '29800/2');
    assert.equal(segundo.despachado, true);
    assert.equal(segundo.tipo, 'despachado');
    assert.equal(segundo.responsavel, 'CARLOS');
    assert.equal(segundo.grupoEntrega, 'Transportadora', 'método "Transportadora" vira o rótulo padronizado');
  });

  await teste('QR de pedido: sem destaque, só as OPs daquela requisição', async () => {
    const r = await chamar('consulta', { sessao, query: { t: 'PEDIDO2345' } });
    assert.equal(r.status, 200, r.erro);
    assert.equal(r.destaque, null);
    assert.equal(r.itens.length, 2);
    assert.ok(!r.itens.some((i) => i.numeroOp === '29801/1'));
  });

  await teste('cliente sem endereço volta null', async () => {
    banco.clientes_enderecos = [];
    const r = await chamar('consulta', { sessao, query: { t: 'PEDIDO2345' } });
    assert.equal(r.endereco, null);
  });

  await teste('código desconhecido avisa', async () => {
    assert.equal((await chamar('consulta', { sessao, query: { t: 'NAOEXISTE9' } })).status, 404);
  });

  await teste('desligar no meio do dia bloqueia a consulta', async () => {
    banco.pcp_ajustes[0].valor.ligado = false;
    const r = await chamar('consulta', { sessao, query: { t: 'ABCDEFGH23' } });
    assert.equal(r.status, 403);
    banco.pcp_ajustes[0].valor.ligado = true;
  });

  await teste('datas do Excel', async () => {
    const { dataIso } = api._testes;
    assert.equal(dataIso('09/10/2026'), '2026-10-09');
    assert.equal(dataIso('9/1/26'), '2026-01-09');
    assert.equal(dataIso('2026-10-09T00:00:00'), '2026-10-09');
    assert.equal(dataIso('46304'), '2026-10-09');
    assert.equal(dataIso(''), '');
  });

  await teste('sessão vale até a meia-noite de Brasília', async () => {
    const fim = new Date(api._testes.proximaMeiaNoiteMs());
    assert.equal(fim.getUTCHours(), 3);
    assert.ok(fim.getTime() > Date.now() && fim.getTime() - Date.now() <= 24 * 3600 * 1000);
  });

  // --- "Marcar Expedição" (v0.2.697) --------------------------------------------------
  console.log('Marcar Expedição (POST /api/marcar)');

  await teste('acaoDoGrupo: só "Entregamos" vira ENTREGA, todo o resto é COLETA', () => {
    const { acaoDoGrupo } = api._testes;
    assert.equal(acaoDoGrupo('Entregamos'), 'ENTREGA');
    for (const g of ['Transportadora', 'Correio', 'Azul Cargo', 'Cliente Retira', 'Demais', '']) {
      assert.equal(acaoDoGrupo(g), 'COLETA', g);
    }
  });

  await teste('montarGruposDeBaixa: uma linha por (cliente, pedido, ação) — nunca por item', () => {
    const { montarGruposDeBaixa } = api._testes;
    const linhas = [
      { numero_op: '100/1', cod_item: 'A', pedido: '1', cliente: 'X', metodo_entrega: 'Correio' },
      { numero_op: '100/2', cod_item: 'B', pedido: '1', cliente: 'X', metodo_entrega: 'Transportadora' }, // mesma (X,1,COLETA) do de cima
      { numero_op: '100/3', cod_item: 'C', pedido: '1', cliente: 'X', metodo_entrega: 'Entregamos' }, // mesmo pedido, ação DIFERENTE
      { numero_op: '200/1', cod_item: 'D', pedido: '2', cliente: 'Y', metodo_entrega: 'Correio' }, // cliente diferente
    ];
    const grupos = montarGruposDeBaixa(linhas, 'FULANO');
    assert.equal(grupos.length, 3, 'X/pedido1/COLETA, X/pedido1/ENTREGA e Y/pedido2/COLETA');
    const coleta1 = grupos.find((g) => g.cliente === 'X' && g.acao === 'COLETA');
    assert.equal(coleta1.itens.length, 2, 'A e B, mesmo vindo de métodos diferentes, ambos viram COLETA');
    assert.deepEqual(coleta1.itens, [{ numero_op: '100/1', cod_item: 'A' }, { numero_op: '100/2', cod_item: 'B' }]);
    const entrega1 = grupos.find((g) => g.cliente === 'X' && g.acao === 'ENTREGA');
    assert.equal(entrega1.itens.length, 1);
    assert.equal(entrega1.itens[0].cod_item, 'C');
    assert.equal(entrega1.requisicao, '100', 'requisição é a base da OP do primeiro item do grupo');
    for (const g of grupos) {
      assert.equal(g.responsavel, 'FULANO');
      assert.equal(g.baixado_por, 'FULANO');
      assert.equal(g.origem, 'app');
      assert.ok(g.evento_em, 'evento_em sempre preenchido');
    }
  });

  // OPs NOVAS, nunca tocadas pelos testes anteriores — reusar 29800/1 ou
  // 29800/2 aqui pegaria o histórico que os testes de cima já deixaram
  // neles (29800/1 já tem uma baixa no fixture inicial; 29800/2 já ganhou
  // um "DESPACHADO" via fiscal_pedidos no teste "item despachado via
  // Fiscal", lá em cima) — os testes desta seção precisam de um estado
  // conhecido, isolado do resto do arquivo.
  banco.banco_ordens_itens.push(
    { numero_op: '50100/1', cod_item: '77001', descricao: 'PECA TESTE MARCAR 1', qntd: '5', pedido: '900/26', cliente: 'JSL S.B.O.', data_entrega: '2026-10-09' },
    { numero_op: '50100/2', cod_item: '77002', descricao: 'PECA TESTE MARCAR 2', qntd: '3', pedido: '900/26', cliente: 'JSL S.B.O.', data_entrega: '2026-10-09' },
  );
  banco.expedicao_baixas.push({
    requisicao: '50100', pedido: '900/26', cliente: 'JSL S.B.O.', acao: 'COLETA', responsavel: 'ALGUEM',
    evento_em: '2026-10-08T09:00:00Z', itens: [{ numero_op: '50100/1', cod_item: '77001' }],
  });

  let sessaoMarca;
  await teste('login de quem PODE marcar carrega a permissão certa', async () => {
    const r = await chamar('login', { metodo: 'POST', corpo: { pin: '4321' } });
    assert.equal(r.status, 200);
    assert.equal(r.podeMarcar, true);
    sessaoMarca = r.sessao;
  });

  await teste('/api/marcar sem sessão pede PIN', async () => {
    const r = await chamar('marcar', { metodo: 'POST', corpo: { itens: [{ numeroOp: '29800/1', codItem: '44360' }] } });
    assert.equal(r.status, 401);
    assert.equal(r.sessaoExpirada, true);
  });

  await teste('/api/marcar recusa com o interruptor de marcar desligado — mesmo pra quem TEM a permissão', async () => {
    // Isolado: usa a sessão que JÁ tem "expedicao-celular-marcar", pra provar
    // que é o interruptor (ainda não ligado no fixture) que está barrando,
    // não a permissão.
    const r = await chamar('marcar', { sessao: sessaoMarca, metodo: 'POST', corpo: { itens: [{ numeroOp: '50100/2', codItem: '77002' }] } });
    assert.equal(r.status, 403);
    assert.match(r.erro, /desligado/);
  });

  await teste('/api/marcar recusa quem não tem a permissão de marcar (só "ver"), com o interruptor já ligado', async () => {
    banco.pcp_ajustes.push({ tipo: 'sistema', chave: 'expedicao_celular_baixa', valor: { ligado: true } });
    const r = await chamar('marcar', { sessao, metodo: 'POST', corpo: { itens: [{ numeroOp: '50100/1', codItem: '77001' }] } });
    assert.equal(r.status, 403);
    assert.match(r.erro, /Marcar expedição/);
  });

  await teste('/api/marcar grava — item já despachado é pulado, não vira baixa de novo', async () => {
    const antes = banco.expedicao_baixas.length;
    const r = await chamar('marcar', {
      sessao: sessaoMarca, metodo: 'POST',
      corpo: { itens: [{ numeroOp: '50100/1', codItem: '77001' }, { numeroOp: '50100/2', codItem: '77002' }] },
    });
    assert.equal(r.status, 200, r.erro);
    assert.equal(r.gravados, 1, 'só o 77002 — o 77001 já tinha baixa no fixture');
    assert.deepEqual(r.jaDespachados, ['50100/1']);
    assert.equal(r.naoEncontrados.length, 0);
    assert.equal(banco.expedicao_baixas.length, antes + 1, 'uma linha nova só, não duas');
    const nova = banco.expedicao_baixas.at(-1);
    assert.equal(nova.cliente, 'JSL S.B.O.');
    assert.equal(nova.acao, 'COLETA', 'sem ajuste de entrega cadastrado pra este item, grupoEntrega() devolve vazio — e só "Entregamos" vira ENTREGA');
    assert.equal(nova.responsavel, 'MOTORISTA QUE MARCA');
    assert.equal(nova.baixado_por, 'MOTORISTA QUE MARCA');
    assert.equal(nova.origem, 'app');
    assert.deepEqual(nova.itens, [{ numero_op: '50100/2', cod_item: '77002' }]);
    assert.ok(nova.id, 'id devolvido pelo insert');
  });

  await teste('/api/marcar audita a baixa em audit_log, best-effort', async () => {
    const linha = banco.audit_log.find((a) => a.tabela === 'expedicao_baixas' && a.registro_id === String(banco.expedicao_baixas.at(-1).id));
    assert.ok(linha, 'achou a linha de auditoria da baixa que acabou de gravar');
    assert.equal(linha.usuario_nome, 'MOTORISTA QUE MARCA');
    assert.equal(linha.modulo, 'expedicao-celular');
    assert.equal(linha.acao, 'criar');
    assert.equal(linha.origem, 'site-expedicao');
  });

  await teste('/api/marcar: item sem OP correspondente no Banco de Ordens entra em naoEncontrados', async () => {
    const r = await chamar('marcar', {
      sessao: sessaoMarca, metodo: 'POST', corpo: { itens: [{ numeroOp: '99999/9', codItem: 'XXXXX' }] },
    });
    assert.equal(r.status, 200, r.erro);
    assert.equal(r.gravados, 0);
    assert.deepEqual(r.naoEncontrados, ['99999/9']);
  });

  await teste('/api/marcar recusa corpo vazio e carrinho grande demais', async () => {
    const vazio = await chamar('marcar', { sessao: sessaoMarca, metodo: 'POST', corpo: { itens: [] } });
    assert.equal(vazio.status, 400);
    const demais = await chamar('marcar', {
      sessao: sessaoMarca, metodo: 'POST',
      corpo: { itens: Array.from({ length: 151 }, (_, i) => ({ numeroOp: `1/${i}`, codItem: 'X' })) },
    });
    assert.equal(demais.status, 400);
    assert.match(demais.erro, /150/);
  });

  await teste('cadastro de clientes exige sessão, inclui contatos e remove variantes de pontuação', async () => {
    assert.equal((await chamar('clientes')).status, 401);
    banco.posvenda_contatos.push({ cliente: 'Cliente só no pós-venda' });
    banco.banco_ordens_itens.push({ cliente: 'JSL SBO', numero_op: '60111/1', cod_item: '123' });
    const r = await chamar('clientes', { sessao: sessaoMarca });
    assert.equal(r.status, 200, r.erro);
    assert(r.clientes.includes('Cliente só no pós-venda'));
    assert.equal(r.clientes.filter(n => n.replace(/[^a-z0-9]/gi, '').toUpperCase() === 'JSLSBO').length, 1);
  });

  const itensColeta = [{ numeroOp: '60100/1', codItem: '88001' }];
  banco.banco_ordens_itens.push(
    { numero_op: '60100/1', cod_item: '88001', cliente: 'JSL S.B.O.', pedido: '901/26', qntd: '2' },
    { numero_op: '60100/2', cod_item: '88001', cliente: 'JSL S.B.O.', pedido: '901/26', qntd: '2' },
    { numero_op: '60200/1', cod_item: '88002', cliente: 'JSL S.B.O.', pedido: '902/26', qntd: '3' },
  );
  const balcao = corpo => chamar('marcar', { metodo: 'POST', sessao: sessaoMarca,
    corpo: { modo: 'balcao', cliente: 'JSL SBO', retirante: 'MARIA CLIENTE', itens: itensColeta, ...corpo } });
  await teste('balcão: os dois nomes obrigatórios são validados no servidor', async () => {
    const antes = banco.expedicao_baixas.length;
    for (const corpo of [{retirante:''}, {retirante:'   '}, {cliente:''}, {cliente:'   '}, {retirante:'A'.repeat(161)}]) {
      assert.equal((await balcao(corpo)).status, 400);
    }
    assert.equal(banco.expedicao_baixas.length, antes);
  });
  await teste('balcão: etiqueta de outro cliente bloqueia o lote inteiro', async () => {
    const r = await balcao({ itens: [...itensColeta, {numeroOp:'29801/1',codItem:'99999'}] });
    assert.equal(r.status, 400);
    assert.match(r.erro, /outro cliente/);
  });
  await teste('balcão: vários pedidos, retirante separado do operador, COLETADO e data/hora', async () => {
    banco.pcp_ajustes.push({tipo:'entrega', chave:'padrao||JSL S.B.O.',valor:'Entregamos'});
    const antes = banco.expedicao_baixas.length;
    const r = await balcao({ itens: [...itensColeta, {numeroOp:'60200/1',codItem:'88002'}] });
    assert.equal(r.status, 200, r.erro);
    assert.equal(r.gravados, 2);
    const novas = banco.expedicao_baixas.slice(antes);
    assert.equal(novas.length, 2);
    for (const baixa of novas) {
      assert.equal(baixa.acao, 'COLETA'); assert.equal(baixa.responsavel, 'MARIA CLIENTE');
      assert.equal(baixa.baixado_por, 'MOTORISTA QUE MARCA');
      assert.equal(baixa.itens[0].modo, 'balcao'); assert.equal(baixa.evento_em, r.eventoEm);
    }
    assert.equal(r.responsavel, 'MARIA CLIENTE');
    const { criarExpedicao } = require('../netlify/functions/expedicao-api/expedicao-consulta.cjs');
    const dbConsulta = { selecionar: async (t, opcoes) => ({
      linhas: (banco[t] || []).filter(l => opcoes.filtros.every(f => f.valor.includes(l[f.coluna])))
    }) };
    const consulta = await criarExpedicao(dbConsulta).consultar({
      numeroOp:'60100/1', pedido:'901/26', metodoEntrega:'Cliente Retira',
      itens:[{numeroOp:'60100/1',codigoItem:'88001'}, {numeroOp:'60100/2',codigoItem:'88001'}]
    });
    assert.equal(consulta.porItem[0].rotulo, 'Coletado');
    assert.equal(consulta.porItem[0].responsavel, 'MARIA CLIENTE');
    assert.equal(consulta.porItem[1].concluida, false, 'mesmo código em outra OP continua pendente');
    assert.equal((await balcao({})).gravados, 0, 'repetir a coleta não duplica');
  });

  console.log(`\n${ok} ok, ${falhas.length} falha(s)`);
  process.exit(falhas.length ? 1 : 0);
}
principal();
