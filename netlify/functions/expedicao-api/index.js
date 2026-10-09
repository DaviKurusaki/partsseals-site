'use strict';
/**
 * Função da Netlify da expedição pelo celular (v0.2.687).
 *
 *   GET  /api/estado            o interruptor está ligado? (sem login)
 *   POST /api/login   {pin}     confere o PIN e devolve uma sessão até a meia-noite
 *   GET  /api/consulta?t=CODIGO pedido/OP do QR — exige a sessão
 *
 * Variáveis de ambiente (Netlify > Site configuration > Environment variables):
 *   SUPABASE_URL           https://xxxx.supabase.co
 *   SUPABASE_ANON_KEY      a chave anon do projeto (nunca a service_role)
 *   KURU_SEGREDO_SESSAO    uma senha longa qualquer, só da Netlify
 *   TABELA_ORDENS          opcional, padrão banco_ordens_itens
 *
 * Decisões que não são óbvias:
 *  - **A expedição é lida pela MESMA regra do Kuru**, com a cópia
 *    autossuficiente em `expedicao-consulta.cjs` neste diretório. O esbuild
 *    da Netlify embute o arquivo no pacote da função.
 *  - **A sessão não fica em banco nenhum**: é um texto assinado (HMAC) com
 *    id, nome e validade. Sem o segredo, ninguém fabrica uma. Ela vale até a
 *    meia-noite de Brasília; permissão tirada no meio do dia só vale no dia
 *    seguinte.
 *  - **A trava de PIN mora no banco** (`expedicao_celular_tentativas`): a
 *    função não guarda memória entre uma chamada e outra. Mesmo espaçamento
 *    do login do Kuru e do site do BOT.
 *  - **Quem entra**: administrador ou quem tem a permissão
 *    `expedicao-celular`. O PIN mestre não funciona aqui — ele só existe
 *    dentro do app, e não deve sair dele.
 *  - **Interruptor desligado** = a página só mostra o site da Parts, e
 *    login/consulta recusam, mesmo com sessão válida.
 *  - **v0.2.696**: cada item devolve `tipo`/`responsavel`/`grupoEntrega`
 *    (rótulo padronizado do método de entrega — Transportadora/Correio/
 *    Azul Cargo/Cliente Retira/Entregamos/Demais, nunca o texto cru digitado
 *    pelo PCP), e a resposta ganhou `nf`/`rastreio` do PEDIDO inteiro — os
 *    três já existiam calculados em `expedicao-consulta.cjs` e só não
 *    chegavam até aqui.
 *  - **v0.2.697 — "Marcar Expedição" escreve de verdade**
 *    (`POST /api/marcar`): o motorista escaneia, confere o carrinho e
 *    confirma; a função grava em `expedicao_baixas`, exatamente como
 *    Acabamento > Expedição > Dar baixa já faz (mesmas colunas, mesmo
 *    `origem: 'app'`) — só que direto via REST, sem passar pelo processo
 *    principal do Electron. Decisões tiradas com o usuário (6 perguntas):
 *    - **Ação (ENTREGA/COLETA) é sempre automática**, pelo `grupoEntrega`
 *      já cadastrado no Kuru (`acaoDoGrupo`) — nunca escolhida na hora.
 *      "Retirado" vs "Coletado" continua decidido na LEITURA, como sempre
 *      (`eventosDeExpedicao`, `expedicao-consulta.cjs`).
 *    - **`responsavel`/`baixado_por` são sempre o nome de quem está
 *      logado** (`sessao.nome`) — rápido, sem campo pra digitar.
 *    - **Interruptor PRÓPRIO** (`pcp_ajustes`, `sistema`/
 *      `expedicao_celular_baixa`, `ligadoBaixa()`) — a CONSULTA (em
 *      produção) nunca depende dele; só a escrita.
 *    - **Permissão PRÓPRIA** (`expedicao-celular-marcar`, `permissoes-
 *      extras.js`) — quem só tem `expedicao-celular` consulta mas não
 *      marca nada. A sessão HMAC passou a carregar `podeMarcar` (calculado
 *      uma vez, no login) porque não há como reconsultar `app_permissions`
 *      a cada escrita sem o PIN de novo.
 *    - **O espelho em `BaixasExpedicao.json` (no W) fica de fora** —
 *      decisão do usuário: a função não alcança o W, e o Supabase já é a
 *      fonte que a Listagem/Status da OP/Atrasados leem. Um job separado
 *      pode preencher o espelho depois, sem travar esta entrega.
 *    - **Confere "já despachado?" de novo no servidor**, nunca confia só
 *      no carrinho do celular (que pode estar desatualizado) — reusa
 *      `expedicao.consultar()` com os itens pedidos antes de gravar
 *      qualquer coisa, e pula em silêncio quem já tiver baixa.
 *    Auditoria best-effort em `audit_log` (RLS já libera INSERT pra
 *    `anon` nessa tabela, mesmo padrão do resto do projeto) — uma falha
 *    aqui nunca desfaz a baixa, que já foi gravada com sucesso antes.
 */

const crypto = require('node:crypto');
const { criarExpedicao } = require('./expedicao-consulta.cjs');
const { anexarAviso, criarFilaExpedicaoCelular } = require('./expedicao-aviso.cjs');

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
  async inserir(tabela, registro) {
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

/** Ação é sempre decidida pelo grupo de entrega já cadastrado no Kuru,
 *  nunca escolhida na hora pelo motorista (confirmado com o usuário: menos
 *  toque, confia no cadastro do PCP). "Entregamos" é a única entrega
 *  NOSSA (motoboy/veículo próprio) — vira 'ENTREGA'; todo o resto
 *  (Transportadora/Correio/Azul Cargo/Cliente Retira/Demais) é uma
 *  retirada feita por alguém de fora, vira 'COLETA'. A distinção
 *  "Retirado" vs "Coletado" continua sendo decidida depois, NA LEITURA,
 *  pelo texto do método de entrega (`eventosDeExpedicao`,
 *  `expedicao-consulta.cjs`) — gravar 'COLETA' aqui pros dois casos é
 *  exatamente o que aquela função já espera. */
function acaoDoGrupo(grupo) {
  return grupo === 'Entregamos' ? 'ENTREGA' : 'COLETA';
}

/** Agrupa itens já resolvidos (precisam de `numero_op`/`cod_item`/`pedido`/
 *  `cliente`/`metodo_entrega`) em linhas prontas pra INSERT em
 *  `expedicao_baixas` — uma linha por (cliente, pedido, ação), nunca uma
 *  por item: é o mesmo grão que Acabamento > Expedição > Dar baixa já usa
 *  (`montarBlocosPorPedido`, `acabamento-expedicao.js`). Um pedido com um
 *  item saindo de Transportadora e outro saindo com entrega própria vira
 *  DUAS linhas, porque `acao` é uma coluna por LINHA, não por item. */
function montarGruposDeBaixa(linhas, responsavel, { modo = 'entrega', baixadoPor = responsavel } = {}) {
  const grupos = new Map();
  const agora = new Date().toISOString();
  for (const l of linhas) {
    const acao = modo === 'balcao' ? 'COLETA' : acaoDoGrupo(grupoEntrega(l.metodo_entrega));
    const chave = `${l.cliente}||${l.pedido}||${acao}||${baseDaOp(l.numero_op)}`;
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
  if (requisicao) {
    consultas.push(db.selecionar(TABELA_ORDENS, {
      colunas, filtros: [{ coluna: 'numero_op', operador: 'comeca', valor: `${requisicao}/` }], limite: LIMITE_OPS,
    }));
  }
  if (alvo.tipo === 'op') {
    consultas.push(db.selecionar(TABELA_ORDENS, {
      colunas, filtros: [{ coluna: 'numero_op', operador: 'igual', valor: alvo.chave }], limite: 20,
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
      tipo: exp.concluida ? (exp.tipo || null) : null,
      situacao: exp.concluida ? exp.rotulo : 'Ainda não despachado',
      responsavel: exp.concluida ? texto(exp.responsavel) : '',
      despachoEm: exp.concluida ? exp.quando : null,
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

/**
 * POST /api/marcar  { itens: [{numeroOp, codItem}, ...] }
 *
 * Grava a baixa de expedição de verdade, direto em `expedicao_baixas` —
 * mesmas colunas e mesmos valores que Acabamento > Expedição > Dar baixa já
 * grava (ver cabeçalho do arquivo). O cliente manda só `numeroOp`/`codItem`
 * por item (nunca cliente/pedido/método — o servidor relê tudo fresco do
 * Banco de Ordens, nunca confia em dado que passou pela rede e pode estar
 * velho ou adulterado).
 */
async function rotaMarcar(evento) {
  const sessao = lerSessao(evento);
  if (!sessao) return erro(401, 'Entre com o seu PIN.', { sessaoExpirada: true });
  if (!(await ligado())) return erro(403, 'A expedição pelo celular está desligada no Kuru.', { desligado: true });
  if (!(await ligadoBaixa())) {
    return erro(403, 'Marcar expedição pelo celular ainda está desligado no Kuru. Peça pra um administrador ligar em PCP > Tabula > Etiquetas > Expedição.');
  }
  if (!sessao.podeMarcar) {
    return erro(403, 'Seu usuário pode consultar, mas não tem a permissão "Expedição pelo celular · Marcar expedição". Peça pra um administrador liberar em Configurações › Usuários e permissões.');
  }

  let corpo = {};
  try { corpo = JSON.parse(evento.body || '{}'); } catch { /* corpo inválido */ }
  const modo = corpo.modo || 'entrega';
  if (!['entrega', 'balcao'].includes(modo)) return erro(400, 'Método de expedição inválido. Escolha Entrega ou Coleta no balcão.');
  const retirante = texto(corpo.retirante);
  const clienteColeta = texto(corpo.cliente);
  if (modo === 'balcao' && (!retirante || !clienteColeta || retirante.length > 160 || clienteColeta.length > 160)) {
    return erro(400, 'Preencha o nome de quem está retirando e o nome do cliente (até 160 caracteres).');
  }
  const pedidos = Array.isArray(corpo.itens) ? corpo.itens : [];
  if (!pedidos.length) return erro(400, 'Nenhum item pra marcar.');
  if (pedidos.length > LIMITE_CARRINHO) return erro(400, `No máximo ${LIMITE_CARRINHO} itens de cada vez.`);

  const pares = [];
  const vistos = new Set();
  for (const it of pedidos) {
    const numeroOp = texto(it?.numeroOp);
    const codItem = texto(it?.codItem);
    if (!numeroOp || !codItem) continue;
    const chave = `${numeroOp}||${codItem}`;
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    pares.push({ numeroOp, codItem });
  }
  if (!pares.length) return erro(400, 'Nenhum item válido pra marcar.');

  const numerosOp = [...new Set(pares.map((p) => p.numeroOp))];
  const colunas = ['numero_op', 'cod_item', 'descricao', 'qntd', 'pedido', 'cliente', 'data_entrega'];
  const { linhas } = await db.selecionar(TABELA_ORDENS, {
    colunas, filtros: [{ coluna: 'numero_op', operador: 'em', valor: numerosOp }], limite: LIMITE_CARRINHO + 50,
  });
  const porChave = new Map(linhas.map((l) => [`${texto(l.numero_op)}||${texto(l.cod_item)}`, l]));

  const encontradas = [];
  const naoEncontrados = [];
  for (const p of pares) {
    const linha = porChave.get(`${p.numeroOp}||${p.codItem}`);
    if (linha) encontradas.push(linha); else naoEncontrados.push(p.numeroOp);
  }
  if (!encontradas.length) return responder(200, { ok: true, gravados: 0, grupos: 0, jaDespachados: [], naoEncontrados });
  if (modo === 'balcao' && encontradas.some(l => chaveCliente(l.cliente) !== chaveCliente(clienteColeta))) {
    return erro(400, 'Há uma etiqueta de outro cliente. Confira o nome do cliente e as etiquetas antes de finalizar a coleta.');
  }

  // Confere "já despachado?" DE NOVO aqui, nunca confiando só no carrinho do
  // celular — ele pode estar com um pedido aberto desde minutos atrás, e
  // outra pessoa (ou outro celular) já pode ter marcado o mesmo item.
  const metodos = await metodosDeEntrega(encontradas);
  const metodoDe = (l) => chavesDeEntrega(l, dataIso(l.data_entrega)).map((c) => metodos.get(c)).find(Boolean) || '';
  const resultadoExpedicao = await expedicao.consultar({
    numeroOp: encontradas[0].numero_op, pedido: encontradas[0].pedido,
    itens: encontradas.map((l) => ({ numeroOp: l.numero_op, pedido: l.pedido, codigoItem: l.cod_item, descricao: l.descricao })),
  });

  const pendentes = [];
  const jaDespachados = [];
  encontradas.forEach((l, i) => {
    const exp = resultadoExpedicao.porItem?.[i] || {};
    if (exp.concluida) jaDespachados.push(texto(l.numero_op));
    else pendentes.push({ ...l, metodo_entrega: metodoDe(l) });
  });
  if (!pendentes.length) return responder(200, { ok: true, gravados: 0, grupos: 0, jaDespachados, naoEncontrados });

  const grupos = montarGruposDeBaixa(pendentes, modo === 'balcao' ? retirante : sessao.nome,
    { modo, baixadoPor: sessao.nome });
  const avisosLigados = await prepararAvisosWhatsapp(grupos, pendentes);
  const criadas = await db.inserir('expedicao_baixas', grupos);
  let avisosEnfileirados = 0;
  for (const baixa of criadas) {
    try { if (await filaExpedicaoCelular.enfileirar(baixa)) avisosEnfileirados++; }
    catch (err) { console.warn('[expedicao-whatsapp] aviso salvo com a baixa; o Kuru retomará:', err.codigo || 'rede'); }
  }

  // Auditoria best-effort — a baixa já está gravada; uma falha aqui nunca a
  // desfaz, só deixa de registrar quem fez (RLS já libera INSERT pra anon
  // em audit_log, mesmo padrão do resto do projeto).
  if (criadas.length) {
    db.inserir('audit_log', criadas.map((g) => ({
      usuario_id: sessao.id, usuario_nome: sessao.nome, modulo: 'expedicao-celular', acao: 'criar',
      tabela: 'expedicao_baixas', registro_id: String(g.id), depois: g, origem: 'site-expedicao',
    }))).catch((err) => console.error('[expedicao] auditoria falhou', err));
  }

  return responder(200, {
    ok: true, gravados: pendentes.length, grupos: criadas.length, jaDespachados, naoEncontrados,
    modo, responsavel: grupos[0]?.responsavel, eventoEm: grupos[0]?.evento_em,
    whatsapp: { habilitado: avisosLigados, enfileirados: avisosEnfileirados },
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

exports.handler = async (evento) => {
  if (!SUPABASE_URL || !SUPABASE_KEY || !SEGREDO) {
    return erro(500, 'O site ainda não foi configurado: faltam as variáveis SUPABASE_URL, SUPABASE_ANON_KEY e KURU_SEGREDO_SESSAO na Netlify.');
  }
  const rota = texto(evento.path).split('/').filter(Boolean).pop();
  try {
    if (rota === 'estado' && evento.httpMethod === 'GET') {
      return responder(200, { ok: true, ligado: await ligado(), ligadoBaixa: await ligadoBaixa() });
    }
    if (rota === 'login' && evento.httpMethod === 'POST') return await rotaLogin(evento);
    if (rota === 'consulta' && evento.httpMethod === 'GET') return await rotaConsulta(evento);
    if (rota === 'marcar' && evento.httpMethod === 'POST') return await rotaMarcar(evento);
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
  grupoEntrega, acaoDoGrupo, montarGruposDeBaixa,
  recuperarAvisosWhatsapp: filaExpedicaoCelular.recuperar,
};
