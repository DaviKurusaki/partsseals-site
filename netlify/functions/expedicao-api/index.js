'use strict';
/**
 * Portal de dupla conferência da CHEGADA ao cliente.
 * Saída e despacho continuam no Acabamento do Kuru Nuvem.
 * NF + rastreio já registrado na saída geram somente expedicao_entregas
 * e seu aviso de entrega. As rotas antigas de saída respondem 410.
 *
 * Netlify: SUPABASE_URL, SUPABASE_ANON_KEY e KURU_SEGREDO_SESSAO.
 * O PIN e as permissões são validados aqui; a chave fica só no servidor.
 * SQL 150 grava chegada/auditoria/aviso atomicamente, sem alterar a saída.
 */
const crypto = require('node:crypto');
const { criarExpedicao } = require('./expedicao-consulta.cjs');
const { anexarAviso, criarFilaExpedicaoCelular } = require('./expedicao-aviso.cjs');
const { interpretarNf, rastreioCorreios } = require('./despacho-codigos.js');

const SUPABASE_URL = String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const SUPABASE_KEY = process.env.SUPABASE_ANON_KEY || process.env.SUPABASE_KEY || '';
const SEGREDO = process.env.KURU_SEGREDO_SESSAO || '';
const TABELA_ORDENS = process.env.TABELA_ORDENS || 'banco_ordens_itens';

const PERMISSAO = 'expedicao-celular';
const PERMISSAO_MARCAR = 'expedicao-celular-marcar';
const TENTATIVAS_MAX = 5;
const LIMITE_OPS = 200;
const LIMITE_CARRINHO = 150;

// --- cliente mínimo do PostgREST (mesmo formato de src/main/postgrest.js) ----

function valorFiltro(v) {
  return '"' + String(v ?? '').replace(/\\/g, '\\\\').replace(/"/g, '\\"') + '"';
}
const OPERADORES = {
  igual: (c, v) => `${c}=eq.${encodeURIComponent(v)}`,
  comeca: (c, v) => `${c}=ilike.${encodeURIComponent(v + '*')}`,
  maior: (c, v) => `${c}=gt.${encodeURIComponent(v)}`,
  em: (c, v) => `${c}=in.(${(Array.isArray(v) ? v : String(v).split(','))
    .map((x) => encodeURIComponent(valorFiltro(String(x).trim()))).join(',')})`,
};

class ErroBanco extends Error {
  constructor(mensagem, codigo) { super(mensagem); this.codigo = codigo; }
}

async function chamarBanco(caminho, { metodo = 'GET', corpo, prefer } = {}) {
  const resposta = await fetch(`${SUPABASE_URL}/rest/v1/${caminho}`, {
    method: metodo,
    headers: {
      apikey: SUPABASE_KEY,
      Authorization: `Bearer ${SUPABASE_KEY}`,
      'Content-Type': 'application/json',
      ...(prefer ? { Prefer: prefer } : {}),
    },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const textoResposta = await resposta.text();
  const json = textoResposta ? JSON.parse(textoResposta) : null;
  if (!resposta.ok) throw new ErroBanco(json?.message || `Banco respondeu ${resposta.status}`, json?.code);
  return json;
}

const db = {
  async selecionar(tabela, { colunas = [], filtros = [], ordem = [], limite = 1000, offset = 0 } = {}) {
    const partes = ['select=' + (colunas.length ? colunas.map(encodeURIComponent).join(',') : '*')];
    for (const f of filtros) {
      const op = OPERADORES[f.operador];
      if (!op || f.valor === '' || f.valor == null || (Array.isArray(f.valor) && !f.valor.length)) continue;
      partes.push(op(f.coluna, f.valor));
    }
    if (ordem.length) partes.push('order=' + ordem.map((o) => `${o.coluna}.${o.desc ? 'desc' : 'asc'}`).join(','));
    partes.push(`limit=${limite}`);
    if (offset) partes.push(`offset=${offset}`);
    const linhas = await chamarBanco(`${encodeURIComponent(tabela)}?${partes.join('&')}`);
    return { linhas: Array.isArray(linhas) ? linhas : [] };
  },
  async upsert(tabela, registro) {
    return chamarBanco(encodeURIComponent(tabela), { metodo: 'POST', corpo: registro, prefer: 'resolution=merge-duplicates,return=minimal' });
  },
  /** INSERT de verdade (nunca upsert) — devolve as linhas criadas (com
   *  `id`), porque `registrarBaixa` precisa do `id` pra auditoria e o
   *  carrinho precisa saber quantos grupos viraram linha. Aceita um
   *  objeto só ou um array (bulk insert, uma chamada só). */
  async inserir(tabela, registro, { retornar = true } = {}) {
    // audit_log libera INSERT mas não SELECT: pedir RETURNING ali dá 42501.
    if (!retornar) {
      await chamarBanco(encodeURIComponent(tabela), { metodo: 'POST', corpo: registro, prefer: 'return=minimal' });
      return [];
    }
    const resultado = await chamarBanco(encodeURIComponent(tabela), { metodo: 'POST', corpo: registro, prefer: 'return=representation' });
    return Array.isArray(resultado) ? resultado : (resultado ? [resultado] : []);
  },
  async atualizar(tabela, chave, alteracoes) {
    const filtros = Object.entries(chave).map(([coluna, valor]) => OPERADORES.igual(coluna, valor)).join('&');
    if (!filtros) throw new Error('Atualização sem chave.');
    return chamarBanco(`${encodeURIComponent(tabela)}?${filtros}`, { metodo: 'PATCH', corpo: alteracoes, prefer: 'return=representation' });
  },
  async excluir(tabela, coluna, valor) {
    return chamarBanco(`${encodeURIComponent(tabela)}?${OPERADORES.igual(coluna, valor)}`, { metodo: 'DELETE' });
  },
  async rpc(funcao, argumentos) {
    return chamarBanco(`rpc/${encodeURIComponent(funcao)}`, { metodo: 'POST', corpo: argumentos });
  },
};

const expedicao = criarExpedicao(db);
const filaExpedicaoCelular = criarFilaExpedicaoCelular(db);

// --- utilidades ----------------------------------------------------------------

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
/** Mesma chave do Kuru (tabula-etiquetas-expedicao.js e Pós-venda). */
const chaveCliente = (nome) => texto(nome).normalize('NFD').replace(/[̀-ͯ]/g, '').toUpperCase().replace(/[^A-Z0-9]/g, '');
const baseDaOp = (op) => texto(op).match(/^\d{3,}/)?.[0] || '';

function responder(status, corpo) {
  return {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' },
    body: JSON.stringify(corpo),
  };
}
const erro = (status, mensagem, extra = {}) => responder(status, { ok: false, erro: mensagem, ...extra });

/** `data_entrega` vem do Excel: "dd/mm/aaaa", "dd/mm/aa", ISO ou número
 *  serial. Devolve AAAA-MM-DD ou ''. */
function dataIso(valor) {
  const v = texto(valor);
  if (!v) return '';
  let m = v.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (m) return `${m[1]}-${m[2]}-${m[3]}`;
  m = v.match(/^(\d{1,2})\/(\d{1,2})\/(\d{2,4})/);
  if (m) {
    const ano = m[3].length === 2 ? `20${m[3]}` : m[3];
    return `${ano}-${m[2].padStart(2, '0')}-${m[1].padStart(2, '0')}`;
  }
  const n = Number(v.replace(',', '.'));
  if (Number.isFinite(n) && n > 20000 && n < 80000) {
    const d = new Date(Date.UTC(1899, 11, 30) + Math.floor(n) * 86400000);
    return d.toISOString().slice(0, 10);
  }
  return '';
}

function agoraEmBrasilia() {
  // Brasília é UTC-3 o ano todo desde 2019 (sem horário de verão).
  return new Date(Date.now() - 3 * 3600 * 1000);
}
function proximaMeiaNoiteMs() {
  const b = agoraEmBrasilia();
  return Date.UTC(b.getUTCFullYear(), b.getUTCMonth(), b.getUTCDate() + 1, 3, 0, 0);
}

function ipDe(evento) {
  const h = evento.headers || {};
  return texto(h['x-nf-client-connection-ip'] || String(h['x-forwarded-for'] || '').split(',')[0] || 'desconhecido');
}

// --- sessão assinada ------------------------------------------------------------

const b64 = (s) => Buffer.from(s).toString('base64url');
function assinar(conteudo) {
  return crypto.createHmac('sha256', SEGREDO).update(conteudo).digest('base64url');
}
function criarSessao(usuario, podeMarcar = false) {
  // `podeMarcar` é calculado UMA VEZ, no login, e viaja dentro do HMAC —
  // não há como reconsultar app_permissions a cada escrita sem pedir o PIN
  // de novo. Permissão tirada no meio do dia só vale a partir do próximo
  // login (mesma limitação, documentada, que já vale pra `papel`/`nome`).
  const conteudo = b64(JSON.stringify({ id: usuario.id, nome: usuario.nome, podeMarcar: Boolean(podeMarcar), exp: proximaMeiaNoiteMs() }));
  return `${conteudo}.${assinar(conteudo)}`;
}
function lerSessao(evento) {
  const h = evento.headers || {};
  const bruto = texto(h.authorization || h.Authorization).replace(/^Bearer\s+/i, '');
  const [conteudo, assinatura] = bruto.split('.');
  if (!conteudo || !assinatura) return null;
  const esperada = assinar(conteudo);
  if (esperada.length !== assinatura.length
    || !crypto.timingSafeEqual(Buffer.from(esperada), Buffer.from(assinatura))) return null;
  try {
    const sessao = JSON.parse(Buffer.from(conteudo, 'base64url').toString('utf8'));
    return sessao.exp > Date.now() ? sessao : null;
  } catch { return null; }
}

// --- interruptor e trava de PIN ---------------------------------------------------

async function ligado() {
  const { linhas } = await db.selecionar('pcp_ajustes', {
    colunas: ['valor'],
    filtros: [
      { coluna: 'tipo', operador: 'igual', valor: 'sistema' },
      { coluna: 'chave', operador: 'igual', valor: 'expedicao_celular' },
    ],
    limite: 1,
  });
  return Boolean(linhas[0]?.valor?.ligado);
}

/** Interruptor PRÓPRIO da escrita (marcar expedição), separado do de cima —
 *  a consulta (já em produção) nunca depende dele. PCP > Tabula > Etiquetas
 *  > Expedição, só admin. */
async function ligadoBaixa() {
  const { linhas } = await db.selecionar('pcp_ajustes', {
    colunas: ['valor'],
    filtros: [
      { coluna: 'tipo', operador: 'igual', valor: 'sistema' },
      { coluna: 'chave', operador: 'igual', valor: 'expedicao_celular_baixa' },
    ],
    limite: 1,
  });
  return Boolean(linhas[0]?.valor?.ligado);
}

const chaveTentativa = (ip) => crypto.createHash('sha256').update(`expedicao|${ip}`).digest('hex').slice(0, 40);

async function segundosBloqueado(chave) {
  const { linhas } = await db.selecionar('expedicao_celular_tentativas', {
    colunas: ['falhas', 'bloqueado_ate'], filtros: [{ coluna: 'chave', operador: 'igual', valor: chave }], limite: 1,
  });
  const registro = linhas[0];
  const ate = registro?.bloqueado_ate ? new Date(registro.bloqueado_ate).getTime() : 0;
  return { falhas: registro?.falhas || 0, segundos: ate > Date.now() ? Math.ceil((ate - Date.now()) / 1000) : 0 };
}

async function registrarFalha(chave, falhasAntes) {
  const falhas = falhasAntes + 1;
  const espera = falhas >= TENTATIVAS_MAX ? Math.min(300, 15 * (2 ** (falhas - TENTATIVAS_MAX))) : 0;
  await db.upsert('expedicao_celular_tentativas', {
    chave, falhas,
    bloqueado_ate: espera ? new Date(Date.now() + espera * 1000).toISOString() : null,
    atualizado_em: new Date().toISOString(),
  });
}

// --- rotas ---------------------------------------------------------------------------

async function rotaLogin(evento) {
  if (!(await ligado())) return erro(403, 'A expedição pelo celular está desligada no Kuru.', { desligado: true });
  let pin = '';
  try { pin = texto(JSON.parse(evento.body || '{}').pin); } catch { /* corpo inválido */ }
  if (!/^\d{3,12}$/.test(pin)) return erro(400, 'Digite o PIN só com números.');

  const chave = chaveTentativa(ipDe(evento));
  const trava = await segundosBloqueado(chave);
  if (trava.segundos) return erro(429, `Muitas tentativas erradas. Aguarde ${trava.segundos}s e tente de novo.`);

  const linhas = await db.rpc('app_login', { p_pin: pin });
  const usuario = Array.isArray(linhas) ? linhas[0] : null;
  if (!usuario) {
    await registrarFalha(chave, trava.falhas);
    return erro(401, 'PIN incorreto.');
  }
  const pode = usuario.papel === 'admin' || Boolean(usuario.permissoes?.[PERMISSAO]?.ver);
  if (!pode) {
    return erro(403, 'Seu usuário não tem a permissão "Expedição pelo celular". Peça pra um administrador liberar em Configurações › Usuários e permissões.');
  }
  await db.excluir('expedicao_celular_tentativas', 'chave', chave).catch(() => {});
  const podeMarcar = usuario.papel === 'admin' || Boolean(usuario.permissoes?.[PERMISSAO_MARCAR]?.ver);
  return responder(200, {
    ok: true, sessao: criarSessao(usuario, podeMarcar), nome: usuario.nome, expira: proximaMeiaNoiteMs(), podeMarcar,
  });
}

/** Método de entrega com a MESMA cascata da Listagem (itens-do-dia.js,
 *  `resolverEntrega`): item > pedido > dia > padrão do cliente. O "dia" é a
 *  data de entrega da ordem — é nele que a Listagem mostra a linha. */
function chavesDeEntrega(linha, diaIso) {
  const cliente = texto(linha.cliente);
  const item = `${texto(linha.numero_op)}||${texto(linha.cod_item) || texto(linha.descricao)}`;
  return [
    `porItem||${diaIso}||${item}`,
    `porPedido||${diaIso}||${cliente}||${texto(linha.pedido)}`,
    `dia||${diaIso}||${cliente}`,
    `padrao||${cliente}`,
  ];
}
const valorDoAjuste = (v) => texto(typeof v === 'object' && v !== null ? (v.valor ?? '') : v);

/** Mesma classificação de `GRUPOS_ENTREGA`/`grupoDeEntrega`
 *  (src/renderer/js/modules/pcp/itens-do-dia.js) — duplicada aqui de
 *  propósito: a função da Netlify não importa módulo nenhum do renderer. O
 *  "método de entrega" é texto livre digitado pelo PCP ("Transportadora
 *  Braspress", "retira no balcão"...); isso devolve um rótulo limpo e
 *  consistente ("Transportadora", "Correio"...) pra tela do motorista, em
 *  vez do texto cru. "Demais" é o fundo do funil — sempre bate em algo. */
const semAcento = (v) => texto(v).normalize('NFD').replace(/[̀-ͯ]/g, '');
const GRUPOS_ENTREGA = [
  { rotulo: 'Transportadora', combina: /TRANSPORTAD/ },
  { rotulo: 'Correio', combina: /CORREIO|SEDEX|\bPAC\b/ },
  { rotulo: 'Azul Cargo', combina: /AZUL/ },
  { rotulo: 'Cliente Retira', combina: /RETIRA|BALCAO/ },
  { rotulo: 'Entregamos', combina: /ENTREGAMOS|ENTREGA PROPRIA|MOTOBOY|NOSSA ENTREGA/ },
  { rotulo: 'Demais', combina: null },
];
function grupoEntrega(metodo) {
  const m = semAcento(metodo).toUpperCase();
  if (!m) return '';
  return (GRUPOS_ENTREGA.find((g) => !g.combina || g.combina.test(m)) || {}).rotulo || '';
}

/** Agrupa itens já resolvidos (precisam de `numero_op`/`cod_item`/`pedido`/
 *  `cliente`) em linhas prontas pra INSERT em `expedicao_baixas` — uma
 *  linha por (cliente, pedido), nunca uma por item: é o mesmo grão que
 *  Acabamento > Expedição > Dar baixa já usa (`montarBlocosPorPedido`,
 *  `acabamento-expedicao.js`).
 *
 *  **`acao` NÃO vem mais do método de entrega cadastrado no PCP**
 *  (v0.2.721, corrigindo a decisão original de v0.2.697 — "nunca escolhida
 *  na hora pelo motorista" — depois de um caso real do usuário: "tem caso
 *  de cliente retira, correio, ou até mesmo azul cargo que nós
 *  entregamos"). O cadastro é só o PADRÃO do cliente, não o que aconteceu
 *  HOJE com ESTE pedido — confiar nele gravava "Coletado" numa entrega
 *  física de verdade. Quem decide agora é só o `modo` que o motorista
 *  escolheu ao abrir "Expedir": **"Coleta no balcão" é sempre COLETA,
 *  qualquer outro modo (a opção "Entrega") é sempre ENTREGA** — um único
 *  valor pra toda a chamada, nunca por item. A distinção "Retirado" vs
 *  "Coletado" continua decidida depois, NA LEITURA, pelo texto do método
 *  de entrega (`eventosDeExpedicao`, `expedicao-consulta.cjs`), que já
 *  esperava 'COLETA' pros dois casos. */
function montarGruposDeBaixa(linhas, responsavel, { modo = 'entrega', baixadoPor = responsavel } = {}) {
  const grupos = new Map();
  const agora = new Date().toISOString();
  const acao = modo === 'balcao' ? 'COLETA' : 'ENTREGA';
  for (const l of linhas) {
    const chave = `${l.cliente}||${l.pedido}||${baseDaOp(l.numero_op)}`;
    if (!grupos.has(chave)) {
      grupos.set(chave, {
        requisicao: baseDaOp(l.numero_op) || texto(l.pedido),
        pedido: texto(l.pedido),
        cliente: texto(l.cliente),
        acao,
        responsavel,
        baixado_por: baixadoPor,
        evento_em: agora,
        origem: 'app',
        itens: [],
      });
    }
    grupos.get(chave).itens.push({ numero_op: texto(l.numero_op), cod_item: texto(l.cod_item),
      ...(modo === 'balcao' ? { modo: 'balcao' } : {}) });
  }
  return [...grupos.values()];
}

async function metodosDeEntrega(linhas) {
  const chaves = [...new Set(linhas.flatMap((l) => chavesDeEntrega(l, dataIso(l.data_entrega))))];
  if (!chaves.length) return new Map();
  const { linhas: ajustes } = await db.selecionar('pcp_ajustes', {
    colunas: ['chave', 'valor'],
    filtros: [{ coluna: 'tipo', operador: 'igual', valor: 'entrega' }, { coluna: 'chave', operador: 'em', valor: chaves }],
    limite: 1000,
  });
  return new Map(ajustes.map((a) => [a.chave, valorDoAjuste(a.valor)]));
}

async function prepararAvisosWhatsapp(grupos, pendentes) {
  const { linhas: ajustes } = await db.selecionar('pcp_ajustes', {
    colunas: ['valor'], filtros: [
      { coluna: 'tipo', operador: 'igual', valor: 'sistema' },
      { coluna: 'chave', operador: 'igual', valor: 'avisos_whatsapp' },
    ], limite: 1,
  });
  if (!ajustes[0]?.valor?.ligado) return false;

  const chaveItem = l => `${texto(l.numero_op)}||${texto(l.cod_item)}`;
  const selecionados = new Set(pendentes.map(chaveItem));
  const porChave = new Map(pendentes.map(l => [chaveItem(l), l]));
  const pedidos = new Map();
  for (const grupo of grupos) {
    const chave = `${chaveCliente(grupo.cliente)}||${grupo.pedido}||${grupo.requisicao}`;
    if (!pedidos.has(chave)) {
      const todas = new Map();
      for (let offset = 0; ; offset += 1000) {
        const { linhas } = await db.selecionar(TABELA_ORDENS, {
          colunas: ['numero_op', 'cod_item', 'descricao', 'qntd', 'pedido', 'cliente'],
          filtros: [{ coluna: 'numero_op', operador: 'comeca', valor: grupo.requisicao + '/' }],
          ordem: [{ coluna: 'numero_op' }, { coluna: 'cod_item' }], limite: 1000, offset,
        });
        for (const l of linhas) {
          if (chaveCliente(l.cliente) === chaveCliente(grupo.cliente) && texto(l.pedido) === grupo.pedido) todas.set(chaveItem(l), l);
        }
        if (linhas.length < 1000) break;
      }
      // Inclui as linhas já relidas para a baixa, mesmo em uma OP sem barra.
      for (const l of pendentes) {
        if (chaveCliente(l.cliente) === chaveCliente(grupo.cliente) && texto(l.pedido) === grupo.pedido && baseDaOp(l.numero_op) === grupo.requisicao) todas.set(chaveItem(l), l);
      }
      const linhas = [...todas.values()];
      const estado = await expedicao.consultar({ numeroOp: linhas[0]?.numero_op, pedido: grupo.pedido,
        itens: linhas.map(l => ({ numeroOp: l.numero_op, pedido: l.pedido, codigoItem: l.cod_item, descricao: l.descricao })),
      });
      const entregues = linhas.filter((l, i) => selecionados.has(chaveItem(l)) || estado.porItem?.[i]?.concluida).length;
      pedidos.set(chave, { total: linhas.length, entregues, badge: entregues === linhas.length ? 'Finalizado' : 'Parcial' });
    }
    anexarAviso(grupo, {
      pedido: grupo.pedido, requisicao: grupo.requisicao, acao: grupo.acao,
      responsavel: grupo.responsavel, evento_em: grupo.evento_em, realizado_por: grupo.baixado_por,
      ...pedidos.get(chave),
      itens: grupo.itens.map(item => {
        const linha = porChave.get(chaveItem(item));
        return { numero_op: item.numero_op, cod_item: item.cod_item, quantidade: linha?.qntd ?? '', descricao: texto(linha?.descricao) };
      }),
    });
  }
  return true;
}

async function rotaConsulta(evento) {
  const sessao = lerSessao(evento);
  if (!sessao) return erro(401, 'Entre com o seu PIN.', { sessaoExpirada: true });
  if (!(await ligado())) return erro(403, 'A expedição pelo celular está desligada no Kuru.', { desligado: true });

  const token = texto(evento.queryStringParameters?.t).toUpperCase();
  if (!/^[A-Z0-9]{6,20}$/.test(token)) return erro(400, 'Este QR não é de uma etiqueta da Parts Seals.');
  const { linhas: tokens } = await db.selecionar('expedicao_qr_tokens', {
    colunas: ['tipo', 'chave', 'cliente', 'pedido'], filtros: [{ coluna: 'token', operador: 'igual', valor: token }], limite: 1,
  });
  const alvo = tokens[0];
  if (!alvo) return erro(404, 'Etiqueta não encontrada. Ela pode ser de antes da expedição pelo celular.');

  const requisicao = alvo.tipo === 'op' ? baseDaOp(alvo.chave) : texto(alvo.chave);
  const colunas = ['numero_op', 'cod_item', 'descricao', 'qntd', 'pedido', 'cliente', 'data_entrega'];
  const consultas = [];
  if (alvo.tipo === 'op') {
    // Etiqueta de item consulta somente a OP exata, inclusive na entrega.
    consultas.push(db.selecionar(TABELA_ORDENS, {
      colunas, filtros: [{ coluna: 'numero_op', operador: 'igual', valor: alvo.chave }], limite: 20,
    }));
  } else if (requisicao) {
    // Somente a etiqueta de Pedido Fechado consulta toda a requisição.
    consultas.push(db.selecionar(TABELA_ORDENS, {
      colunas, filtros: [{ coluna: 'numero_op', operador: 'comeca', valor: `${requisicao}/` }], limite: LIMITE_OPS,
    }));
  }
  const vistos = new Set();
  const linhas = (await Promise.all(consultas)).flatMap((r) => r.linhas).filter((l) => {
    const k = `${texto(l.numero_op)}||${texto(l.cod_item)}||${texto(l.descricao)}`;
    if (vistos.has(k)) return false;
    vistos.add(k);
    return true;
  }).sort((a, b) => texto(a.numero_op).localeCompare(texto(b.numero_op), 'pt-BR', { numeric: true }));
  if (!linhas.length) return erro(404, 'As ordens desta etiqueta não estão mais no Banco de Ordens.');

  const cliente = texto(alvo.cliente) || texto(linhas[0].cliente);
  const metodos = await metodosDeEntrega(linhas);
  const metodoDe = (l) => chavesDeEntrega(l, dataIso(l.data_entrega)).map((c) => metodos.get(c)).find(Boolean) || '';

  const [resultadoExpedicao, enderecos] = await Promise.all([
    expedicao.consultar({
      numeroOp: linhas[0].numero_op, pedido: linhas[0].pedido,
      itens: linhas.map((l) => ({
        numeroOp: l.numero_op, pedido: l.pedido, codigoItem: l.cod_item, descricao: l.descricao, metodoEntrega: metodoDe(l),
      })),
    }),
    db.selecionar('clientes_enderecos', {
      colunas: ['cliente', 'endereco', 'bairro', 'cidade', 'uf', 'cep', 'observacao'],
      filtros: [{ coluna: 'cliente_chave', operador: 'igual', valor: chaveCliente(cliente) }], limite: 1,
    }).catch(() => ({ linhas: [] })),
  ]);

  const itens = linhas.map((l, i) => {
    const exp = resultadoExpedicao.porItem?.[i] || {};
    const metodo = metodoDe(l);
    return {
      numeroOp: texto(l.numero_op),
      codItem: texto(l.cod_item),
      descricao: [texto(l.cod_item), texto(l.descricao)].filter(Boolean).join(' - '),
      quantidade: texto(l.qntd),
      pedido: texto(l.pedido),
      previsao: dataIso(l.data_entrega),
      metodoEntrega: metodo,
      grupoEntrega: grupoEntrega(metodo),
      despachado: Boolean(exp.concluida),
      entregaConfirmada: Boolean(exp.entregaConfirmada),
      entregueEm: exp.entrega?.quando || null,
      motoristaEntrega: exp.entrega?.responsavel || '',
      tipo: exp.concluida ? (exp.tipo || null) : null,
      situacao: exp.concluida ? exp.rotulo : 'Ainda não despachado',
      responsavel: exp.concluida ? texto(exp.responsavel) : '',
      despachoEm: exp.saida?.quando || (exp.concluida ? exp.quando : null),
    };
  });

  return responder(200, {
    ok: true,
    tipo: alvo.tipo,
    destaque: alvo.tipo === 'op' ? texto(alvo.chave) : null,
    requisicao,
    cliente,
    pedido: texto(alvo.pedido) || texto(linhas[0].pedido),
    // NF/rastreio são do PEDIDO inteiro, não por item (o usuário confirmou:
    // "é pra ser todos os itens do mesmo pedido na mesma NF e no mesmo
    // Rastreio") — vêm do resultado de topo, que olha a requisição sem
    // filtrar por item nenhum. Aparecem assim que existir NF emitida, mesmo
    // antes do despacho: é informação útil por si só pro motorista/cliente.
    nf: texto(resultadoExpedicao.nf),
    rastreio: texto(resultadoExpedicao.rastreio),
    endereco: enderecos.linhas[0] || null,
    itens,
    resumo: { total: itens.length, despachados: itens.filter((i) => i.despachado).length },
    operador: sessao.nome,
  });
}

async function rotaClientes(evento) {
  if (!lerSessao(evento)) return erro(401, 'Entre com o seu PIN.', { sessaoExpirada: true });
  if (!(await ligado())) return erro(403, 'A expedição pelo celular está desligada no Kuru.', { desligado: true });
  const nomes = new Map();
  const { linhas: contatos } = await db.selecionar('posvenda_contatos', { colunas: ['cliente'], limite: 1000 });
  for (const c of contatos) if (chaveCliente(c.cliente)) nomes.set(chaveCliente(c.cliente), texto(c.cliente));
  for (let offset = 0; offset < 100000; offset += 1000) {
    const { linhas } = await db.selecionar(TABELA_ORDENS, { colunas: ['cliente'], ordem: [{ coluna: 'cliente' }, { coluna: 'numero_op' }, { coluna: 'cod_item' }], limite: 1000, offset });
    for (const linha of linhas) {
      const nome = texto(linha.cliente), chave = chaveCliente(nome);
      if (chave && !nomes.has(chave)) nomes.set(chave, nome);
    }
    if (linhas.length < 1000) return responder(200, { ok: true, clientes: [...nomes.values()].sort((a,b) => a.localeCompare(b, 'pt-BR')) });
  }
  return erro(503, 'Não foi possível carregar todo o cadastro. Tente novamente.');
}

async function acessoConferencia(evento) {
  const sessao = lerSessao(evento);
  if (!sessao) return { resposta: erro(401, 'Entre com o seu PIN.', { sessaoExpirada: true }) };
  if (!sessao.podeMarcar) return { resposta: erro(403, 'Seu usuário precisa da permissão para confirmar a entrega pelo celular.') };
  if (!(await ligado()) || !(await ligadoBaixa())) return { resposta: erro(403, 'A consulta e a confirmação pelo celular precisam estar ligadas no Kuru.') };
  return { sessao };
}

async function notaDaConferencia(codigo) {
  const nfLida = interpretarNf(codigo);
  if (!nfLida) throw new ErroBanco('Código de NF inválido. Escaneie novamente a chave de acesso de 44 dígitos ou informe o número da nota.', 'DESPACHO');
  const { linhas } = await db.selecionar('fiscal_notas', {
    filtros: [{ coluna: 'numero_nf', operador: 'em', valor: Array.from({ length: 10 - nfLida.numero.length }, (_, i) => nfLida.numero.padStart(nfLida.numero.length + i, '0')) }], limite: 10,
  });
  const correspondentes = linhas.filter(n => /^\d+$/.test(texto(n.numero_nf)) && Number(n.numero_nf) === Number(nfLida.numero));
  if (correspondentes.length !== 1) throw new ErroBanco(correspondentes.length
    ? `Há mais de um cadastro da NF ${nfLida.numero}. Confira os números no Fiscal.`
    : `NF ${nfLida.numero} não cadastrada. Confira o cadastro no Fiscal do Kuru.`, 'DESPACHO');
  const nf = correspondentes[0];
  if (nf.cancelada || nf.sem_nf) throw new ErroBanco(`NF ${nf.numero_nf} cancelada ou sem número fiscal. Confira no Fiscal.`, 'DESPACHO');
  const itens = [];
  for (let offset = 0; ; offset += 500) {
    const pagina = await db.selecionar('fiscal_notas_itens', {
      filtros: [{ coluna: 'nf_id', operador: 'igual', valor: nf.id }],
      ordem: [{ coluna: 'id' }], limite: 500, offset,
    });
    itens.push(...pagina.linhas);
    if (pagina.linhas.length < 500) break;
  }
  const saidos = itens.filter(i => ['DESPACHADO','COLETADO'].includes(i.status) && rastreioCorreios(i.rastreio));
  if (!saidos.length) throw new ErroBanco(`NF ${nf.numero_nf} sem saída registrada com rastreio. Confira no Acabamento do Kuru; o site só confirma a chegada ao cliente.`, 'DESPACHO');
  return { id: nf.id, numero: nf.numero_nf, cliente: nf.cliente, codigo: nfLida.codigo,
    quantidade: saidos.length, rastreios: [...new Set(saidos.map(i => rastreioCorreios(i.rastreio)))],
    pedidos: [...new Set(saidos.map(i => texto(i.pedido) || texto(i.numero_op).split('/')[0]))] };
}

async function rotaConferencia(evento, consultar) {
  const acesso = await acessoConferencia(evento);
  if (acesso.resposta) return acesso.resposta;
  let dados;
  try { dados = JSON.parse(evento.body || '{}'); } catch { return erro(400, 'Dados inválidos. Escaneie novamente.'); }
  try {
    if (consultar) {
      const nota = await notaDaConferencia(dados.codigo);
      return responder(200, { ok: true, nota });
    }
    const rastreio = rastreioCorreios(dados.rastreio);
    if (!rastreio || !Array.isArray(dados.codigos) || !dados.codigos.length || dados.codigos.length > 100) {
      return erro(400, 'Bipe de 1 a 100 notas e um rastreio dos Correios (duas letras, nove números e duas letras).');
    }
    const notas = [];
    for (const codigo of dados.codigos) notas.push(await notaDaConferencia(codigo));
    if (new Set(notas.map(n => String(n.id))).size !== notas.length) return erro(400, 'Há notas repetidas na lista. Remova a duplicada.');
    const resultado = await db.rpc('expedicao_confirmar_entrega', {
      p_nfs: notas.map(n => n.id), p_rastreio: rastreio, p_usuario_id: acesso.sessao.id, p_usuario_nome: acesso.sessao.nome,
    });
    return responder(200, resultado);
  } catch (err) {
    if (err.codigo === 'PGRST202' || err.codigo === '42883') return erro(503, 'Para ativar a dupla conferência, execute sql/150_expedicao_dupla_conferencia.sql no Supabase (disponível em Configurações > Banco do Kuru).');
    if (err.codigo === 'DESPACHO' || err.codigo === 'P0001') return erro(409, err.message);
    throw err;
  }
}

async function rotaEntregas(evento) {
  const sessao = lerSessao(evento);
  if (!sessao) return erro(401, 'Entre com o seu PIN.', { sessaoExpirada: true });
  if (!(await ligado())) return erro(403, 'A consulta pelo celular está desligada no Kuru.');
  const parametros = evento.queryStringParameters || {};
  const offset = Math.max(0, Math.min(1000000, Number(parametros.offset) || 0));
  try {
    const r = await db.selecionar('expedicao_entregas', {
      ordem: [{ coluna: 'entregue_em', desc: true }, { coluna: 'id', desc: true }], limite: 100, offset,
    });
    return responder(200, { ok: true, entregas: r.linhas, mais: r.linhas.length === 100 });
  } catch (err) {
    if (['PGRST205','42P01'].includes(err.codigo)) return erro(503, 'Ative o controle executando sql/150_expedicao_dupla_conferencia.sql no Supabase.');
    throw err;
  }
}


exports.handler = async (evento) => {
  if (!SUPABASE_URL || !SUPABASE_KEY || !SEGREDO) {
    return erro(500, 'O site ainda não foi configurado: faltam as variáveis SUPABASE_URL, SUPABASE_ANON_KEY e KURU_SEGREDO_SESSAO na Netlify.');
  }
  const partes = texto(evento.path).split('/').filter(Boolean);
  const rota = partes.at(-1), penultima = partes.at(-2);
  try {
    if (rota === 'estado' && evento.httpMethod === 'GET') {
      return responder(200, { ok: true, ligado: await ligado(), ligadoBaixa: await ligadoBaixa() });
    }
    if (rota === 'login' && evento.httpMethod === 'POST') return await rotaLogin(evento);
    if (rota === 'consulta' && evento.httpMethod === 'GET') return await rotaConsulta(evento);
    if (penultima === 'conferencia' && rota === 'nota' && evento.httpMethod === 'POST') return await rotaConferencia(evento, true);
    if (rota === 'confirmar-entrega' && evento.httpMethod === 'POST') return await rotaConferencia(evento, false);
    if (rota === 'entregas' && evento.httpMethod === 'GET') return await rotaEntregas(evento);
    // Inclui navegadores que ainda estejam com a versão antiga em cache.
    if (['marcar','despachar','rotas'].includes(rota) || ['rotas','despacho'].includes(penultima)) {
      return erro(410, 'A saída é registrada no Acabamento do Kuru Nuvem. Atualize o site e use Dupla conferência somente na chegada ao cliente.');
    }
    if (rota === 'clientes' && evento.httpMethod === 'GET') return await rotaClientes(evento);
    return erro(404, 'Caminho desconhecido.');
  } catch (err) {
    console.error('[expedicao]', err);
    return erro(502, 'Não foi possível falar com o banco agora. Tente de novo em instantes.');
  }
};

// Exposto só pros testes (tests/expedicao-api.cjs).
exports._testes = {
  dataIso, chaveCliente, chavesDeEntrega, valorDoAjuste, criarSessao, lerSessao, proximaMeiaNoiteMs,
  grupoEntrega, montarGruposDeBaixa,
  RAIO_CERCA_M: 100, MINUTOS_ATRASO: 10,
  recuperarAvisosWhatsapp: filaExpedicaoCelular.recuperar,
};
