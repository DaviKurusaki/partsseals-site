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
let falharFila = false;
let falharConfirmacaoFila = false;
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
      // Já com lat/long — a partir da v0.2.721, "Marcar Expedição" (modo
      // "entrega") sempre tenta montar a rota, qualquer que seja o método
      // cadastrado; sem coordenada, cairia na geocodificação, que este
      // arquivo não simula (nominatim.openstreetmap.org não é mockado aqui).
      { id: 1, cliente: 'JSL S.B.O.', cliente_chave: 'JSLSBO', endereco: 'Rua A, 100', bairro: 'Centro', cidade: 'Campinas', uf: 'SP', cep: '13000-000', observacao: 'Portaria 2', latitude: -22.9, longitude: -47.06 },
    ],
    posvenda_contatos: [],
    expedicao_baixas: [
      { requisicao: '29800', pedido: '617/26', cliente: 'JSL S.B.O.', acao: 'COLETA', responsavel: 'JOAO', evento_em: '2026-10-08T14:00:00Z', itens: [{ numero_op: '29800/1', cod_item: '44360' }] },
    ],
    fiscal_pedidos: [],
    fiscal_notas_itens: [],
    fiscal_notas: [],
    expedicao_entregas: [],
    expedicao_celular_tentativas: [],
    audit_log: [],
    pcp_avisos_whatsapp: [],
    expedicao_rotas: [],
    expedicao_rotas_paradas: [],
    expedicao_rotas_eventos: [],
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
      const caminho = col.replace(/->>/g, '->').split('->');
      const campo = caminho.reduce((obj, key) => obj?.[key], l);
      const v = campo == null ? '' : String(campo);
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
  if (u.hostname === 'api.heigit.org') {
    const n = JSON.parse(opcoes.body).locations.length;
    return { ok: true, json: async () => ({ durations: Array.from({ length: n }, (_, i) => Array.from({ length: n }, (_, j) => Math.abs(i - j) * 100)) }) };
  }
  const caminho = decodeURIComponent(u.pathname.replace('/rest/v1/', ''));
  const metodo = opcoes.method || 'GET';
  const resposta = (status, corpo) => ({ ok: status < 300, status, text: async () => (corpo === undefined ? '' : JSON.stringify(corpo)) });
  if (caminho === 'rpc/app_login') {
    const u2 = usuarios[JSON.parse(opcoes.body).p_pin];
    return resposta(200, u2 ? [u2] : []);
  }
  if (caminho === 'rpc/expedicao_rota_criar') {
    const dados = JSON.parse(opcoes.body), rota = { id: 1, usuario_id: dados.p_usuario_id, usuario_nome: dados.p_usuario_nome, operacao_id: dados.p_operacao_id, status: 'em_andamento', ...dados.p_rota };
    banco.expedicao_rotas.push(rota);
    const baixas = dados.p_baixas.map((b, i) => ({ id: banco.expedicao_baixas.length+i+1, ...b }));
    banco.expedicao_baixas.push(...baixas);
    banco.expedicao_rotas_paradas.push(...dados.p_paradas.map((p,i)=>({id:i+1,rota_id:rota.id,status:'pendente',revisao:0,...p})));
    return resposta(200,{rota_id:rota.id,repetida:false,baixas});
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
    if (caminho === 'pcp_avisos_whatsapp') {
      if (falharFila) return resposta(503, { message: 'Fila indisponível no teste', code: 'REDE' });
      if (lista.some(reg => tabela.some(l => String(l.id) === String(reg.id)))) return resposta(409, {message:'Chave duplicada',code:'23505'});
    }
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
    const criadas = lista.map((reg) => { const linha = { id: ++proximoId, ...(caminho === 'pcp_avisos_whatsapp' ? {status:'pendente'} : {}), ...reg }; tabela.push(linha); return linha; });
    return resposta(201, prefer.includes('return=representation') ? criadas : undefined);
  }
  if (metodo === 'PATCH') {
    if (falharConfirmacaoFila && caminho === 'expedicao_baixas') return resposta(503, {message:'Confirmação indisponível',code:'REDE'});
    const corpo = JSON.parse(opcoes.body);
    const atualizadas = filtrar(tabela, params);
    for (const linha of atualizadas) Object.assign(linha, corpo);
    return resposta(200, atualizadas);
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
// "Marcar Expedição" (modo "entrega") sempre tenta montar a viagem agora —
// precisa da chave, mesmo nos testes que não são sobre rota nenhuma.
process.env.OPENROUTESERVICE_API_KEY = 'chave-simulada-testes';
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

  await teste('QR de OP: somente o item escaneado, sem outras OPs do pedido', async () => {
    const r = await chamar('consulta', { sessao, query: { t: 'abcdefgh23' } });
    assert.equal(r.status, 200, r.erro);
    assert.equal(r.tipo, 'op');
    assert.equal(r.destaque, '29800/1');
    assert.deepEqual(r.itens.map((i) => i.numeroOp), ['29800/1']);
    assert.equal(r.resumo.total, 1);
    assert.equal(r.resumo.despachados, 1);
    assert.equal(r.endereco.cidade, 'Campinas');
    const [primeiro] = r.itens;
    assert.equal(primeiro.despachado, true);
    assert.equal(primeiro.situacao, 'Coletado');
    assert.equal(primeiro.despachoEm, '2026-10-08T14:00:00Z');
    assert.equal(primeiro.previsao, '2026-10-09');
    assert.equal(primeiro.metodoEntrega, 'Correio', 'padrão do cliente');
  });

  await teste('QR de OP inexistente não retorna as outras OPs da requisição', async () => {
    banco.expedicao_qr_tokens.push({ token: 'AUSENTE123', tipo: 'op', chave: '29800/9', cliente: 'JSL S.B.O.', pedido: '617/26' });
    const r = await chamar('consulta', { sessao, query: { t: 'AUSENTE123' } });
    assert.equal(r.status, 404);
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
    const pedido = await chamar('consulta', { sessao, query: { t: 'PEDIDO2345' } });
    const segundo = pedido.itens.find((i) => i.numeroOp === '29800/2');
    assert.equal(segundo.despachado, true);
    assert.equal(segundo.tipo, 'despachado');
    assert.equal(segundo.responsavel, 'CARLOS');
    assert.equal(segundo.grupoEntrega, 'Transportadora', 'método "Transportadora" vira o rótulo padronizado');
  });

  await teste('QR de pedido: sem destaque, só as OPs daquela requisição', async () => {
    const r = await chamar('consulta', { sessao, query: { t: 'PEDIDO2345' } });
    assert.equal(r.status, 200, r.erro);
    assert.equal(r.destaque, null);
    assert.deepEqual(r.itens.map((i) => i.numeroOp), ['29800/1', '29800/2']);
    assert.equal(r.resumo.total, 2);
    assert.ok(!r.itens.some((i) => i.numeroOp === '29801/1'));
  });

  await teste('cliente sem endereço volta null', async () => {
    // Isolado: guarda e devolve o fixture — sem isso, zerar o array aqui
    // vazava pro resto do arquivo, e JSL S.B.O. ficava sem endereço nenhum
    // pros testes de "Marcar Expedição"/WhatsApp logo abaixo.
    const original = banco.clientes_enderecos;
    banco.clientes_enderecos = [];
    const r = await chamar('consulta', { sessao, query: { t: 'PEDIDO2345' } });
    assert.equal(r.endereco, null);
    banco.clientes_enderecos = original;
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

  // Saída retirada do portal: inclusive versões antigas em cache são recusadas.
  console.log('Dupla conferência: separação da saída');
  await teste('rotas antigas não criam baixa, despacho ou viagem', async () => {
    zerarBanco();const antes=JSON.stringify(banco);
    for(const rota of ['marcar','despachar','rotas','rotas/posicao','rotas/entregar','rotas/corrigir']) {
      const r=await chamar(rota,{metodo:'POST',corpo:{modo:'balcao',itens:[{numeroOp:'29800/2',codItem:'45122'}]}});
      assert.equal(r.status,410,rota);
    }
    assert.equal(JSON.stringify(banco),antes);
  });
  await teste('chegada exige PIN e permissão de confirmar entrega', async () => {
    zerarBanco();
    assert.equal((await chamar('confirmar-entrega',{metodo:'POST',corpo:{}})).status,401);
    const consulta=await chamar('login',{metodo:'POST',corpo:{pin:'1234'}});
    assert.equal((await chamar('confirmar-entrega',{metodo:'POST',sessao:consulta.sessao,corpo:{}})).status,403);
  });

  console.log(`\n${ok} ok, ${falhas.length} falha(s)`);
  process.exit(falhas.length ? 1 : 0);
}
principal();
