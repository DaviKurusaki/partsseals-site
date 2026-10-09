'use strict';
/**
 * Expedição de uma OP, consultada exclusivamente no Supabase.
 *
 * Sem dependência de Electron nem de módulo do Node: roda no processo
 * principal (src/main/expedicao.js) e na função da Netlify
 * (site-expedicao/netlify/functions/api.js).
 *
 * Os arquivos do W são responsabilidade do importador. Separar os dois lados
 * permite abrir a Listagem em qualquer computador, mesmo sem a unidade mapeada.
 *
 * **Três fontes desde v0.2.363, não duas**: `expedicao_baixas` (Acabamento
 * > Expedição), `fiscal_pedidos` (planilha "banco Pedidos.xlsx") e
 * `fiscal_notas`/`fiscal_notas_itens` (Fiscal > NF, o cadastro novo do
 * Kuru — pedido do usuário: "as NFs que estão no app, se eu gerar follow
 * up delas, vai ter os dados de rastreio?"). Uma NF cadastrada do zero no
 * Fiscal > NF (nunca existiu em `fiscal_pedidos`) só aparece pro resto do
 * app através desta terceira fonte — sem ela, Follow Up/Status da
 * OP/Atrasados/BOT nunca veriam rastreio nenhum de uma NF só cadastrada
 * por lá. As três entram no MESMO array de eventos e são ordenadas juntas
 * por `quando` — a mais recente vence, não importa a origem.
 */

/**
 * Recebe o cliente do banco de fora (qualquer objeto com `selecionar(tabela,
 * opcoes)` no formato de `postgrest.js`). O processo principal passa o
 * `postgrest.js`; a página de expedição pelo celular (Netlify, pasta
 * site-expedicao/) passa um cliente próprio — assim as duas leem a expedição
 * com a MESMA regra, nunca com uma cópia.
 */
function criarExpedicao(db) {

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
const semAcento = (v) => texto(v).normalize('NFD').replace(/[\u0300-\u036f]/g, '');
const chave = (v) => semAcento(v).toUpperCase().replace(/[^A-Z0-9]/g, '');
const numeroBase = (v) => texto(v).match(/\d{3,}/)?.[0] || '';

/**
 * "requisicao", em fiscal_pedidos/expedicao_baixas, NAO e sempre derivada do
 * numero da OP -- descoberto com a FERVEC (pedidos 3891/3897, presos na
 * Expedicao do Acabamento mesmo ja despachados pelo Fiscal). O importador do
 * Fiscal grava ali a parte numerica do PEDIDO da planilha, e esse PEDIDO so
 * coincide com o numero da OP quando vem no formato "NNNNN(PV)"; pedido "de
 * verdade" do cliente (ex.: 3891, 20470) e um numero numa faixa propria,
 * sem nenhuma relacao com a OP interna que o PCP abriu pra ele. As duas
 * tabelas concordam entre si (uma tem requisicao, a outra requisicao e
 * pedido, sempre iguais) -- so o numero da OP que nao bate.
 * Por isso toda consulta de expedicao testa as DUAS chaves possiveis: a
 * derivada da OP (numeroOp) e a derivada do pedido do cliente
 * (pedido, quando informado e diferente). Uma bate por OP; a outra, pela
 * grande maioria dos pedidos reais. itemBate/itemDaConsulta continuam
 * exigindo o codigo do item pra confirmar a peca certa -- a chave extra so
 * amplia o que e candidato a checar, nunca decide sozinha.
 */
function chavesRequisicao(numeroOp, pedido) {
  return [...new Set([numeroBase(numeroOp), numeroBase(pedido)].filter(Boolean))];
}

/** Valores CRUS de numero_op/pedido (não a base numérica de `chavesRequisicao`)
 *  de `consulta` + `consulta.itens[]` — `fiscal_notas_itens` (v0.2.363) não
 *  tem coluna `requisicao` como as outras duas fontes, então casa direto
 *  por `numero_op`/`pedido` (o mesmo texto que já veio de `banco_ordens_itens`
 *  pros três), não por base numérica. */
function valoresRaw(consulta = {}) {
  const numerosOp = new Set();
  const pedidos = new Set();
  const add = (numeroOp, pedido) => {
    if (texto(numeroOp)) numerosOp.add(texto(numeroOp));
    if (texto(pedido)) pedidos.add(texto(pedido));
  };
  add(consulta.numeroOp, consulta.pedido);
  if (Array.isArray(consulta.itens)) for (const item of consulta.itens) add(item?.numeroOp, item?.pedido);
  return { numerosOp: [...numerosOp], pedidos: [...pedidos] };
}

/** O código é o primeiro campo tanto em `PRODUTO` do Fiscal ("1207 ARRUELA…")
 * quanto nos itens da baixa de Expedição (normalmente apenas "1207").
 *
 * `expedicao_baixas.itens`, desde v0.2.303, pode trazer objetos
 * `{numero_op, cod_item}` (Acabamento > Expedição passou a gravar a OP de
 * cada item, não só o código solto — um pedido pode ter várias OPs). Aceita
 * as duas formas: string solta (as ~630 entradas de antes, sistema externo
 * incluído) e objeto — sem isso, `texto(objeto)` viraria "[object Object]" e
 * nenhum item bateria nunca mais. */
const codigoInicial = (v) => {
  const bruto = (v && typeof v === 'object') ? (v.cod_item ?? '') : v;
  return chave(texto(bruto).match(/^\s*([^\s]+)/)?.[1]);
};

function itemDaConsulta(consulta = {}) {
  const codigo = chave(consulta.codigoItem) || codigoInicial(consulta.descricao);
  return codigo ? { codigo, numeroOp: texto(consulta.numeroOp) } : null;
}

function itemBate(valor, item) {
  if (!item) return true;
  // Etiquetas iguais em OPs distintas não representam a mesma retirada.
  if (valor && typeof valor === 'object' && texto(valor.numero_op) && item.numeroOp
    && texto(valor.numero_op) !== item.numeroOp) return false;
  return codigoInicial(valor) === item.codigo;
}

function filtrarPorItem(expedicoes, fiscal, fiscalNotas, consulta = {}) {
  const item = itemDaConsulta(consulta);
  if (!item) return { expedicoes, fiscal, fiscalNotas };
  return {
    // Uma baixa sem a lista de itens não prova que esta OP participou dela.
    // Isso é importante nos pedidos liberados parcialmente.
    expedicoes: expedicoes.filter((linha) => Array.isArray(linha.itens)
      && linha.itens.some((valor) => itemBate(valor, item))),
    fiscal: fiscal.filter((linha) => itemBate(linha.produto, item)),
    // `cod_item` já vem separado (não embutido em PRODUTO) — sem ele (linha
    // antiga, importada antes de v0.2.363 popular esse campo), a linha não
    // casa com item nenhum específico, mesma regra de "sem código
    // reconhecível" das outras duas fontes.
    fiscalNotas: fiscalNotas.filter((linha) => itemBate(linha.cod_item, item)),
  };
}

function porQuando(a, b) {
  return (new Date(a.quando || 0).getTime() || 0) - (new Date(b.quando || 0).getTime() || 0);
}

/** `requisicoes` é um array — normalmente as duas chaves de `chavesRequisicao()`. */
async function lerFonte(tabela, requisicoes, colunas) {
  try {
    const r = await db.selecionar(tabela, {
      colunas,
      filtros: [{ coluna: 'requisicao', operador: 'em', valor: requisicoes }],
      limite: 1000,
      cacheMs: 30000,
    });
    return { ok: true, linhas: r.linhas, erro: null };
  } catch (err) {
    return { ok: false, linhas: [], erro: err?.message || 'Nao foi possivel consultar a tabela.' };
  }
}

const COLUNAS_FISCAL_NOTAS_ITENS = ['id', 'nf_id', 'numero_op', 'cod_item', 'pedido', 'descricao', 'status', 'rastreio', 'data_despache', 'atualizado_em'];

/**
 * Terceira fonte (v0.2.363, pedido do usuário — "as NFs que estão no app,
 * se eu gerar follow up delas, vai ter os dados de rastreio?"): NFs
 * cadastradas em Fiscal > NF (`fiscal_notas`/`fiscal_notas_itens`) que
 * ainda não existem em `fiscal_pedidos` (a planilha) — cadastro do zero,
 * não importado dali. Sem coluna `requisicao`, casa por `numero_op`/
 * `pedido` CRUS (`valoresRaw()`), não por base numérica — os dois vêm do
 * mesmo `banco_ordens_itens` que alimenta as outras duas fontes.
 */
async function lerFonteFiscalNotas(numerosOp, pedidos) {
  if (!numerosOp.length && !pedidos.length) return { ok: true, linhas: [], erro: null };
  try {
    const [porOp, porPedido] = await Promise.all([
      numerosOp.length
        ? db.selecionar('fiscal_notas_itens', {
          colunas: COLUNAS_FISCAL_NOTAS_ITENS,
          filtros: [{ coluna: 'numero_op', operador: 'em', valor: numerosOp }],
          limite: 1000, cacheMs: 30000,
        })
        : { linhas: [] },
      pedidos.length
        ? db.selecionar('fiscal_notas_itens', {
          colunas: COLUNAS_FISCAL_NOTAS_ITENS,
          filtros: [{ coluna: 'pedido', operador: 'em', valor: pedidos }],
          limite: 1000, cacheMs: 30000,
        })
        : { linhas: [] },
    ]);
    const porId = new Map();
    for (const l of [...porOp.linhas, ...porPedido.linhas]) porId.set(l.id, l);
    const linhas = [...porId.values()];
    if (!linhas.length) return { ok: true, linhas: [], erro: null };

    const nfIds = [...new Set(linhas.map((l) => l.nf_id))];
    const { linhas: nfs } = await db.selecionar('fiscal_notas', {
      colunas: ['id', 'numero_nf', 'cliente'],
      filtros: [{ coluna: 'id', operador: 'em', valor: nfIds }],
      limite: 500, cacheMs: 30000,
    });
    const nfPorId = new Map(nfs.map((n) => [n.id, n]));
    return {
      ok: true,
      linhas: linhas.map((l) => ({
        ...l, nf: nfPorId.get(l.nf_id)?.numero_nf || '', cliente: nfPorId.get(l.nf_id)?.cliente || '',
      })),
      erro: null,
    };
  } catch (err) {
    return { ok: false, linhas: [], erro: err?.message || 'Nao foi possivel consultar o cadastro do Fiscal.' };
  }
}

function eventosDeExpedicao(linhas, metodoEntrega) {
  const retirada = /RETIR|BALCAO/.test(chave(metodoEntrega));
  return linhas.map((r) => {
    const entrega = chave(r.acao) === 'ENTREGA';
    const balcao = Array.isArray(r.itens) && r.itens.some(i => i?.modo === 'balcao');
    const tipo = balcao ? 'coletado' : entrega ? 'entregue' : (retirada ? 'retirado' : 'coletado');
    return {
      origem: 'expedicoes', tipo,
      rotulo: balcao ? 'Coletado' : entrega ? 'Entregue' : retirada ? 'Retirado' : 'Coletado',
      concluida: true,
      quando: r.evento_em || null,
      responsavel: texto(r.responsavel || r.baixado_por),
      pedido: texto(r.pedido), cliente: texto(r.cliente),
      nf: '', rastreio: '', itens: Array.isArray(r.itens) ? r.itens : [],
    };
  });
}

function eventosDoFiscal(linhas, metodoEntrega) {
  const retirada = /RETIR|BALCAO/.test(chave(metodoEntrega));
  const grupos = new Map();
  for (const r of linhas) {
    const status = chave(r.status);
    if (!['FATURADO', 'DESPACHADO', 'COLETADO'].includes(status)) continue;
    const id = [status, texto(r.evento_em), texto(r.nf), texto(r.rastreio), texto(r.pedido)].join('||');
    if (!grupos.has(id)) grupos.set(id, { ...r, linhas: 0, produtos: [] });
    const grupo = grupos.get(id);
    grupo.linhas++;
    if (texto(r.produto)) grupo.produtos.push(texto(r.produto));
  }

  return [...grupos.values()].map((r) => {
    const status = chave(r.status);
    const tipo = status === 'DESPACHADO' ? 'despachado'
      : status === 'COLETADO' ? (retirada ? 'retirado' : 'coletado') : 'faturado';
    return {
      origem: 'fiscal', tipo,
      rotulo: tipo === 'despachado' ? 'Despachado'
        : tipo === 'retirado' ? 'Retirado' : tipo === 'coletado' ? 'Coletado' : 'NF emitida',
      concluida: tipo !== 'faturado',
      quando: r.evento_em || null,
      responsavel: texto(r.baixado_por), pedido: texto(r.pedido), cliente: texto(r.cliente),
      nf: texto(r.nf), rastreio: texto(r.rastreio), linhas: r.linhas, itens: r.produtos,
    };
  });
}

/** Mesma leitura de `eventosDoFiscal`, sobre `fiscal_notas_itens` — só
 *  DESPACHADO/COLETADO viram evento concluído; FATURADO entra como evento
 *  não-concluído (mesmo papel de "NF emitida" que `fiscal_pedidos` já tem),
 *  nunca é ignorado — é o que deixa `rotulo`/`quando` mostrarem "aguardando
 *  despacho" em vez de "aguardando expedição" quando já existe NF no Kuru. */
function eventosDoFiscalNotas(linhas, metodoEntrega) {
  const retirada = /RETIR|BALCAO/.test(chave(metodoEntrega));
  return linhas.map((r) => {
    const status = chave(r.status);
    if (!['FATURADO', 'DESPACHADO', 'COLETADO'].includes(status)) return null;
    const tipo = status === 'DESPACHADO' ? 'despachado'
      : status === 'COLETADO' ? (retirada ? 'retirado' : 'coletado') : 'faturado';
    return {
      origem: 'fiscal_notas', tipo,
      rotulo: tipo === 'despachado' ? 'Despachado'
        : tipo === 'retirado' ? 'Retirado' : tipo === 'coletado' ? 'Coletado' : 'NF emitida',
      concluida: tipo !== 'faturado',
      quando: r.data_despache || r.atualizado_em || null,
      responsavel: '', pedido: texto(r.pedido), cliente: texto(r.cliente),
      nf: texto(r.nf), rastreio: texto(r.rastreio), itens: [texto(r.descricao)],
    };
  }).filter(Boolean);
}

function montarResultado(expedicoes, fiscal, fiscalNotas, consulta = {}, fontes = {}) {
  const filtradas = filtrarPorItem(expedicoes, fiscal, fiscalNotas, consulta);
  const eventos = [
    ...eventosDeExpedicao(filtradas.expedicoes, consulta.metodoEntrega),
    ...eventosDoFiscal(filtradas.fiscal, consulta.metodoEntrega),
    ...eventosDoFiscalNotas(filtradas.fiscalNotas, consulta.metodoEntrega),
  ].sort(porQuando);

  const concluidos = eventos.filter((e) => e.concluida);
  const atual = concluidos.at(-1) || eventos.at(-1) || null;
  return {
    eventos,
    concluida: concluidos.length > 0,
    // `tipo`/`responsavel`/`nf`/`rastreio` já eram calculados por evento (ver
    // `eventosDe*` acima) e sempre ficaram presos aqui dentro — a Expedição
    // pelo Celular (site-expedicao) precisa deles pra montar a frase completa
    // ("Despachado via Transportadora, coletado por X") e mostrar NF/rastreio.
    // Aditivo: nenhum chamador existente lê estes quatro campos.
    tipo: atual?.tipo || null,
    rotulo: atual?.rotulo || 'Aguardando expedição',
    quando: atual?.quando || null,
    responsavel: atual?.responsavel || '',
    nf: atual?.nf || '',
    rastreio: atual?.rastreio || '',
    fontes,
  };
}

async function consultar(consulta = {}) {
  // `consulta.itens` pode trazer itens de requisições DIFERENTES da do
  // topo — achado no Follow Up (v0.2.322): ali `itens` é toda a lista de um
  // CLIENTE, que normalmente atravessa vários pedidos, não `numeroOp`/`pedido`
  // do topo (só o item[0]). Sem juntar as chaves de cada item, o filtro SQL
  // abaixo só buscava a requisição do primeiro item, e todo o resto do
  // cliente saía de `porItem` sem NENHUM evento — nunca achava NF, rastreio
  // ou data de despache, mesmo já lançados no Fiscal/Expedição. Os outros
  // dois chamadores de `itens` (Busca de Ordens: ficha em lote, ordem em
  // lote) sempre passam itens da MESMA requisição do topo — a união fica
  // idêntica ao que já era, sem custo nem mudança de comportamento pra eles.
  const chavesItens = Array.isArray(consulta.itens)
    ? consulta.itens.flatMap((item) => chavesRequisicao(item?.numeroOp, item?.pedido))
    : [];
  const requisicoes = [...new Set([...chavesRequisicao(consulta.numeroOp, consulta.pedido), ...chavesItens])];
  if (!requisicoes.length) throw new Error('Numero da OP invalido para consultar a expedicao.');

  const { numerosOp, pedidos } = valoresRaw(consulta);

  const [expedicoes, fiscal, fiscalNotas] = await Promise.all([
    lerFonte('expedicao_baixas', requisicoes,
      ['pedido', 'cliente', 'acao', 'responsavel', 'baixado_por', 'evento_em', 'itens']),
    lerFonte('fiscal_pedidos', requisicoes,
      ['produto', 'pedido', 'cliente', 'status', 'nf', 'rastreio', 'baixado_por', 'evento_em']),
    lerFonteFiscalNotas(numerosOp, pedidos),
  ]);
  const fontes = {
    expedicoes: { ok: expedicoes.ok, erro: expedicoes.erro },
    fiscal: { ok: fiscal.ok, erro: fiscal.erro },
    fiscalNotas: { ok: fiscalNotas.ok, erro: fiscalNotas.erro },
  };
  const resultado = montarResultado(expedicoes.linhas, fiscal.linhas, fiscalNotas.linhas, consulta, fontes);

  // A Busca por requisição lê as fontes uma vez, mas recebe um resultado
  // independente para cada linha. A posição é preservada para também suportar
  // bases em que uma mesma OP tenha mais de um item.
  if (Array.isArray(consulta.itens)) {
    resultado.porItem = consulta.itens.map((item) => montarResultado(
      expedicoes.linhas, fiscal.linhas, fiscalNotas.linhas,
      { ...item, metodoEntrega: item.metodoEntrega || consulta.metodoEntrega },
      fontes,
    ));
  }
  return resultado;
}

/**
 * OPs que já saíram da fábrica. É usada pela Listagem para não chamar de
 * atrasada uma OP que só ficou sem as baixas intermediárias, e pela
 * Expedição do Acabamento (`removerJaExpedidos`) para tirar sozinha do
 * rascunho o que já saiu. A consulta é feita em lotes (por requisição) para
 * continuar rápida mesmo em dias com muitas pendências.
 *
 * **Filtra por item dentro da requisição** (v0.2.265) — antes o retorno era só
 * a requisição (o pedido inteiro), e uma OP com `cod_item` diferente da que
 * saiu já vinha "concluída" junto: um pedido com duas OPs (ex.: `29409/1` e
 * `29409/2`, itens diferentes) despachado **parcialmente** — só a `/1` — fazia
 * a `/2` sumir de Atrasados mesmo ainda em produção, porque as duas
 * compartilham a mesma requisição `29409`. `itemBate`/`itemDaConsulta` são os
 * mesmos que já filtram a ficha da Busca de Ordens (`consultar()` acima);
 * aqui só passam a rodar em lote. Item sem `codigoItem` nem `descricao`
 * reconhecível mantém o comportamento antigo pra aquela OP (a requisição
 * inteira já basta) — não há como filtrar o que não se consegue identificar.
 *
 * **Cada item entra sob as duas chaves de `chavesRequisicao()`** (v0.2.298) —
 * a derivada da OP e a derivada do `pedido`, quando informado e diferente.
 * Um item pode ficar "pendurado" em duas requisições da mesma leitura em
 * lote; é inofensivo (o `Set` de concluídas absorve a duplicata) e é o que
 * corrige a FERVEC (pedidos 3891/3897): o Fiscal grava ali o pedido do
 * cliente, não o número da OP, e sem a segunda chave o item nunca encontrava
 * a própria baixa.
 *
 * **Terceira fonte desde v0.2.484: `fiscal_notas_itens`** (Fiscal > NF, o
 * cadastro nativo do Kuru) — até aqui só `consultar()` (a ficha) lia essa
 * fonte; esta função (o "segundo portão" de Atrasados e da limpeza da
 * Expedição do Acabamento) nunca tinha aprendido, e uma NF cadastrada e
 * marcada Despachado/Coletado direto no Fiscal > NF (sem nunca ter passado
 * pela planilha `fiscal_pedidos`) nunca saía do rascunho de Expedição
 * sozinha. Sem coluna `requisicao`, casa por `numero_op`/`pedido` CRUS
 * (mesma técnica de `valoresRaw()`/`lerFonteFiscalNotas()` em `consultar()`),
 * não pela base numérica de `chavesRequisicao()`.
 */
function aplicarFiscalNotasConcluidas(linhas, porChaveRaw, coluna, concluidas, exigirItem, quandoPorOp) {
  const porValor = new Map();
  for (const linha of linhas) {
    if (!['DESPACHADO', 'COLETADO'].includes(chave(linha.status))) continue;
    const valor = texto(linha[coluna]);
    if (!valor) continue;
    if (!porValor.has(valor)) porValor.set(valor, []);
    porValor.get(valor).push(linha);
  }
  for (const [valor, itensDoGrupo] of porChaveRaw) {
    const linhasDoGrupo = porValor.get(valor);
    if (!linhasDoGrupo?.length) continue;
    for (const item of itensDoGrupo) {
      const alvo = itemDaConsulta(item);
      const casadas = alvo ? linhasDoGrupo.filter((linha) => itemBate(linha.cod_item, alvo)) : (exigirItem ? [] : linhasDoGrupo);
      if (!casadas.length) continue;
      concluidas.add(String(item.numeroOp));
      if (quandoPorOp) {
        for (const linha of casadas) marcarSaida(quandoPorOp, item.numeroOp, linha.data_despache || linha.atualizado_em);
      }
    }
  }
}

/**
 * Guarda a saída MAIS ANTIGA de cada OP.
 *
 * "Saiu da fábrica" é um instante, e o que interessa é o primeiro: é quando a
 * peça parou de ocupar um setor. Um segundo evento depois (uma nota emitida
 * dias após a coleta, por exemplo) não faz a ordem ter saído mais tarde.
 */
function marcarSaida(mapa, numeroOp, quando) {
  const iso = texto(quando);
  if (!iso) return;
  const ms = new Date(iso).getTime();
  if (!Number.isFinite(ms)) return;
  const op = String(numeroOp);
  const atual = mapa.get(op);
  if (!atual || ms < atual.ms) mapa.set(op, { ms, iso });
}

/**
 * Quais das OPs pedidas já saíram da fábrica — e, com `comDatas`, QUANDO.
 *
 * A data existe pro Painel de Atraso (v0.2.536): sem ela, uma ordem que saiu
 * sem baixa de Acabamento fica com o relógio correndo até hoje e joga esse
 * tempo todo no setor onde parou de ser registrada. Medido na base real: 22
 * ordens assim jogavam 705 dias no Acabamento sozinhas.
 *
 * `quandoPorOp` é ADITIVO — quem já chamava isto (o "segundo portão" de
 * Atrasados, a limpeza do badge da Expedição) continua lendo só `numerosOp`.
 */
async function requisicoesConcluidas(itens = [], { exigirItem = false, comDatas = false } = {}) {
  const quandoPorOp = comDatas ? new Map() : null;
  const porRequisicao = new Map();
  const porRawOp = new Map();
  const porRawPedido = new Map();
  for (const item of itens) {
    for (const requisicao of chavesRequisicao(item?.numeroOp, item?.pedido)) {
      if (!porRequisicao.has(requisicao)) porRequisicao.set(requisicao, []);
      porRequisicao.get(requisicao).push(item);
    }
    const opRaw = texto(item?.numeroOp);
    const pedidoRaw = texto(item?.pedido);
    if (opRaw) {
      if (!porRawOp.has(opRaw)) porRawOp.set(opRaw, []);
      porRawOp.get(opRaw).push(item);
    }
    if (pedidoRaw) {
      if (!porRawPedido.has(pedidoRaw)) porRawPedido.set(pedidoRaw, []);
      porRawPedido.get(pedidoRaw).push(item);
    }
  }
  const requisicoes = [...porRequisicao.keys()];
  const concluidas = new Set();
  const falhas = {};

  for (let inicio = 0; inicio < requisicoes.length; inicio += 150) {
    const lote = requisicoes.slice(inicio, inicio + 150);
    const [expedicoes, fiscal] = await Promise.all([
      db.selecionar('expedicao_baixas', {
        colunas: comDatas ? ['requisicao', 'itens', 'evento_em'] : ['requisicao', 'itens'],
        filtros: [{ coluna: 'requisicao', operador: 'em', valor: lote }],
        limite: 5000,
        cacheMs: 30000,
      }).catch((err) => { falhas.expedicoes = err?.message || 'Falha ao consultar expedições.'; return { linhas: [] }; }),
      db.selecionar('fiscal_pedidos', {
        colunas: comDatas ? ['requisicao', 'status', 'produto', 'evento_em'] : ['requisicao', 'status', 'produto'],
        filtros: [{ coluna: 'requisicao', operador: 'em', valor: lote }],
        limite: 5000,
        cacheMs: 30000,
      }).catch((err) => { falhas.fiscal = err?.message || 'Falha ao consultar o Fiscal.'; return { linhas: [] }; }),
    ]);

    const expPorRequisicao = new Map();
    for (const linha of expedicoes.linhas) {
      const requisicao = numeroBase(linha.requisicao);
      if (!expPorRequisicao.has(requisicao)) expPorRequisicao.set(requisicao, []);
      expPorRequisicao.get(requisicao).push(linha);
    }
    const fiscalPorRequisicao = new Map();
    for (const linha of fiscal.linhas) {
      if (!['DESPACHADO', 'COLETADO'].includes(chave(linha.status))) continue;
      const requisicao = numeroBase(linha.requisicao);
      if (!fiscalPorRequisicao.has(requisicao)) fiscalPorRequisicao.set(requisicao, []);
      fiscalPorRequisicao.get(requisicao).push(linha);
    }

    for (const requisicao of lote) {
      const exp = expPorRequisicao.get(requisicao) || [];
      const fisc = fiscalPorRequisicao.get(requisicao) || [];
      if (!exp.length && !fisc.length) continue;
      for (const item of porRequisicao.get(requisicao) || []) {
        const alvo = itemDaConsulta(item);
        // Sem item identificavel, o padrao (`exigirItem: false`, usado pelo
        // "segundo portao" de Atrasados) da a requisicao inteira como prova —
        // e o comportamento de sempre, mantido pra nao mudar quem ja confia
        // nisso. `exigirItem: true` (Expedicao, badge/limpeza por item) e
        // deliberadamente mais rigoroso: sem codigo pra comparar, NAO afirma
        // que aquele item especifico saiu — um pedido com 3 itens e so 1
        // despachado nao pode marcar os outros 2 como despachados tambem so
        // porque a requisicao teve ALGUM evento.
        const expCasadas = alvo
          ? exp.filter((linha) => Array.isArray(linha.itens) && linha.itens.some((valor) => itemBate(valor, alvo)))
          : (exigirItem ? [] : exp);
        const fiscCasadas = alvo
          ? fisc.filter((linha) => itemBate(linha.produto, alvo))
          : (exigirItem ? [] : fisc);
        if (!expCasadas.length && !fiscCasadas.length) continue;
        concluidas.add(String(item.numeroOp));
        if (quandoPorOp) {
          for (const linha of [...expCasadas, ...fiscCasadas]) marcarSaida(quandoPorOp, item.numeroOp, linha.evento_em);
        }
      }
    }
  }

  const rawOps = [...porRawOp.keys()];
  for (let inicio = 0; inicio < rawOps.length; inicio += 150) {
    const lote = rawOps.slice(inicio, inicio + 150);
    const { linhas } = await db.selecionar('fiscal_notas_itens', {
      colunas: comDatas ? ['numero_op', 'cod_item', 'status', 'data_despache', 'atualizado_em'] : ['numero_op', 'cod_item', 'status'],
      filtros: [{ coluna: 'numero_op', operador: 'em', valor: lote }],
      limite: 5000,
      cacheMs: 30000,
    }).catch((err) => { falhas.fiscalNotas = err?.message || 'Falha ao consultar o cadastro do Fiscal.'; return { linhas: [] }; });
    aplicarFiscalNotasConcluidas(linhas, porRawOp, 'numero_op', concluidas, exigirItem, quandoPorOp);
  }
  const rawPedidos = [...porRawPedido.keys()];
  for (let inicio = 0; inicio < rawPedidos.length; inicio += 150) {
    const lote = rawPedidos.slice(inicio, inicio + 150);
    const { linhas } = await db.selecionar('fiscal_notas_itens', {
      colunas: comDatas ? ['pedido', 'cod_item', 'status', 'data_despache', 'atualizado_em'] : ['pedido', 'cod_item', 'status'],
      filtros: [{ coluna: 'pedido', operador: 'em', valor: lote }],
      limite: 5000,
      cacheMs: 30000,
    }).catch((err) => { falhas.fiscalNotas = err?.message || 'Falha ao consultar o cadastro do Fiscal.'; return { linhas: [] }; });
    aplicarFiscalNotasConcluidas(linhas, porRawPedido, 'pedido', concluidas, exigirItem, quandoPorOp);
  }

  return {
    numerosOp: [...concluidas],
    falhas,
    ...(quandoPorOp ? { quandoPorOp: Object.fromEntries([...quandoPorOp].map(([op, v]) => [op, v.iso])) } : {}),
  };
}

return { consultar, requisicoesConcluidas, chavesRequisicao };
}

module.exports = { criarExpedicao, chavesRequisicao: criarExpedicao(null).chavesRequisicao };
