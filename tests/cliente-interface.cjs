'use strict';
// Teste de DOM sem navegador gráfico, rede, conta real ou dependência de produção.
// Instale happy-dom fora do projeto e aponte PS_HAPPY_DOM para lib/index.js.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const { pathToFileURL } = require('node:url');
const raiz = path.join(__dirname, '..');
const ler = (arquivo) => fs.readFileSync(path.join(raiz, arquivo), 'utf8');
const janelas = [];
let verificacoes = 0;
const ok = (condicao, mensagem) => { assert(condicao, mensagem); verificacoes++; console.log('ok ' + mensagem); };
const aguardar = async () => { for (let i = 0; i < 8; i++) await new Promise(setImmediate); };

async function testar() {
  const { Window } = await import(pathToFileURL(process.env.PS_HAPPY_DOM || require.resolve('happy-dom')).href);
  function janela(url = 'https://parts-seals.com.br/cliente') {
    const w = new Window({ url, settings: { enableJavaScriptEvaluation: true,
      disableJavaScriptFileLoading: true, disableCSSFileLoading: true,
      suppressInsecureJavaScriptEnvironmentWarning: true } });
    janelas.push(w);
    return w;
  }
  async function painel({ status = 'aprovado', hash = '', pedidos } = {}) {
    const w = janela('https://parts-seals.com.br/cliente' + hash), chamadas = [];
    w.document.write(ler('cliente/index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''));
    w.fetch = async (url) => {
      const rota = String(url).split('/api/')[1]; chamadas.push(rota);
      const dados = rota === 'eu' ? { ok: true, cadastro: { status, primeiroNome: 'Davi' } } : await (pedidos ? pedidos(rota) : dadosPedidos());
      return { status: 200, json: async () => dados };
    };
    for (const arquivo of ['regras', 'comum', 'seletor', 'painel']) w.eval(ler('cliente/js/' + arquivo + '.js'));
    await aguardar();
    return { w, d: w.document, chamadas };
  }
  const dadosPedidos = () => ({ ok: true, empresas: [
    { id: 1, nome: 'PARTS SEALS' }, { id: 2, nome: 'RPSEALS' }, { id: 3, nome: 'USINA ÁGUA & <TESTE>' }],
  pedidos: [
    { pedido: '30931', pedido_cliente: 'OC-777', empresa_id: 2, empresa: 'RPSEALS', etapa: 'com_transportadora', metodo_entrega: 'Cliente Retira',
      nfs: ['10727'], itens: [{ descricao: 'PEÇA', etapa: 'com_transportadora', quantidade: 1 }] },
    { pedido: '30932', pedido_cliente: 'OC-888', empresa_id: 1, empresa: 'PARTS SEALS', etapa: 'em_producao', itens: [] },
  ] });
  const alterarRota = async (w, hash) => {
    w.history.replaceState(null, '', '/cliente' + hash);
    w.dispatchEvent(new w.HashChangeEvent('hashchange'));
    await aguardar();
  };
  const tecla = (w, elemento, key) => elemento.dispatchEvent(new w.KeyboardEvent('keydown', { key, bubbles: true, cancelable: true }));

  const { w, d, chamadas } = await painel();
  ok(d.querySelector('.cli-hub a').textContent.includes('Status do meu pedido'), 'entrada aprovada abre o hub com a primeira ferramenta');
  ok(chamadas.join() === 'eu' && !d.querySelector('[data-lista]'), 'hub não dispara consulta pesada de pedidos');
  await alterarRota(w, '#pedidos');
  ok(d.querySelector('h1').textContent === 'Status do meu pedido' && d.querySelectorAll('.cli-pedido').length === 2,
    'ferramenta abre a consulta existente com as duas empresas');
  ok(d.querySelectorAll('[role=combobox]').length === 2 && !d.querySelector('select'), 'empresa e período usam os novos seletores');
  ok(d.querySelector('.cli-numero--producao strong').textContent === '1' &&
    d.querySelector('.cli-numero--despachado strong').textContent === '1' && d.querySelector('[data-resumo-nota]').textContent.includes('pedido de compra (OC)'),
    'KPIs identificam pedidos de compra e mostram uma OC em cada situação');
  ok(d.querySelector('.cli-pedido').textContent.includes('Despachado') && !d.querySelector('.cli-pedido').textContent.includes('Na transportadora'),
    'pedido 30931 continua com a saída unificada em Despachado');
  ok(d.querySelector('.cli-pedido__num').textContent === 'Pedido OC-777' && !d.querySelector('[data-lista]').textContent.includes('30931'),
    'cartão mostra o número de compra do cliente e oculta a requisição interna');
  let empresa = d.querySelector('[aria-controls=empresa-opcoes]');
  empresa.click();
  ok(empresa.getAttribute('aria-expanded') === 'true' && !d.querySelector('#empresa-opcoes').hidden, 'seletor abre com aria e opções visíveis');
  tecla(w, empresa, 'ArrowDown'); tecla(w, empresa, 'ArrowDown'); tecla(w, empresa, 'Enter');
  ok(d.querySelector('#empresa-valor').textContent === 'RPSEALS' && d.querySelectorAll('.cli-pedido').length === 1,
    'setas e Enter selecionam a empresa e filtram os pedidos');
  empresa.click(); tecla(w, empresa, 'End'); tecla(w, empresa, 'Escape');
  ok(d.querySelector('#empresa-valor').textContent === 'RPSEALS' && d.querySelector('#empresa-opcoes').hidden,
    'Escape fecha sem aplicar a opção apenas destacada');
  empresa.click();
  const periodo = d.querySelector('[aria-controls=periodo-opcoes]'); periodo.click();
  ok(d.querySelector('#empresa-opcoes').hidden && !d.querySelector('#periodo-opcoes').hidden, 'abrir um seletor fecha o outro');
  tecla(w, periodo, 'Home'); tecla(w, periodo, 'Enter'); await aguardar();
  ok(chamadas.at(-1) === 'pedidos?dias=90' && d.querySelector('#empresa-valor').textContent === 'RPSEALS',
    'trocar período consulta os dias certos e preserva a empresa');
  empresa = d.querySelector('[aria-controls=empresa-opcoes]');
  empresa.click(); tecla(w, empresa, 'u'); tecla(w, empresa, 'Enter');
  ok(d.querySelector('#empresa-valor').textContent === 'USINA ÁGUA & <TESTE>' && !d.querySelector('#empresa-opcoes teste'),
    'digitação encontra opção e nomes especiais são tratados como texto');
  ok(d.querySelector('[data-lista]').textContent.includes('nos últimos 90 dias') &&
    d.querySelector('[data-lista]').textContent.includes('Amplie o período'), 'empresa sem pedidos mostra o período e orienta consultar o histórico');
  empresa.click(); d.body.dispatchEvent(new w.PointerEvent('pointerdown', { bubbles: true }));
  ok(d.querySelector('#empresa-opcoes').hidden, 'clique fora fecha o painel');
  empresa.click(); tecla(w, empresa, 'Tab');
  ok(d.querySelector('#empresa-opcoes').hidden, 'Tab fecha e permite seguir para o próximo campo');
  const empresaAtual = d.querySelector('#empresa-valor').textContent;
  await alterarRota(w, '#inicio');
  ok(d.querySelector('.cli-hub') && !d.querySelector('[role=combobox]'), 'retorno abre o hub e desmonta seletores');
  await alterarRota(w, '#pedidos');
  ok(d.querySelector('#empresa-valor').textContent === empresaAtual && d.querySelector('#periodo-valor').textContent === 'Últimos 90 dias',
    'reabrir a ferramenta preserva os filtros da sessão');
  const diretos = await painel({ hash: '#pedidos' });
  ok(diretos.d.querySelector('[data-lista]'), 'link direto para pedidos continua disponível após validar o cadastro');
  for (const status of ['pendente', 'bloqueado', 'recusado']) {
    const protegido = await painel({ status, hash: '#pedidos' });
    ok(!protegido.d.querySelector('.cli-hub') && !protegido.d.querySelector('[data-lista]') && protegido.chamadas.join() === 'eu',
      'perfil ' + status + ' não abre ferramentas nem consulta pedidos');
  }
  let resolver;
  const atrasado = await painel({ pedidos: () => new Promise(r => { resolver = r; }) });
  await alterarRota(atrasado.w, '#pedidos');
  await alterarRota(atrasado.w, '#inicio');
  resolver(dadosPedidos()); await aguardar();
  ok(atrasado.d.querySelector('.cli-hub') && !atrasado.d.querySelector('[data-lista]'), 'resposta atrasada não sobrescreve o hub');

  const agrupado = await painel({ hash: '#pedidos', pedidos: () => ({ ...dadosPedidos(), pedidos: [
    { pedido: '1', pedido_cliente: 'OC-1', empresa_id: 1, etapa: 'entregue', itens: Array(15).fill({ etapa: 'entregue' }) },
    { pedido: '2', pedido_cliente: 'OC-1', empresa_id: 1, etapa: 'em_producao', itens: [] },
    { pedido: '3', pedido_cliente: null, empresa_id: 1, etapa: 'pronto', itens: [] },
  ] }) });
  ok(agrupado.d.querySelector('.cli-numero--producao strong').textContent === '1' &&
    agrupado.d.querySelector('.cli-numero--despachado strong').textContent === '0' &&
    agrupado.d.querySelector('[data-resumo-nota]').textContent.includes('1 requisição sem OC'),
    'quinze itens e duas requisições da mesma OC não multiplicam o KPI; ausência de OC fica indicada');

  const identificacao = await painel({ hash: '#pedidos', pedidos: () => ({ ...dadosPedidos(), pedidos: [
    { pedido: '28227', pedido_cliente: '6292', empresa_id: 1, etapa: 'pronto', data_pedido: '2026-06-23', itens: [] },
    { pedido: '28228', pedido_cliente: null, empresa_id: 1, etapa: 'pronto', itens: [] },
    { pedido: '28229', pedido_cliente: '006292', empresa_id: 1, etapa: 'pronto', itens: [] },
    { pedido: '30914', pedido_cliente: '30914(P.I)', empresa_id: 1, etapa: 'recebido', itens: [] },
  ] }) });
  assert.deepEqual(Array.from(identificacao.d.querySelectorAll('.cli-pedido__num'), e => e.textContent),
    ['Pedido 6292', 'Pedido sem número informado', 'Pedido 006292', 'Pedido 30914(P.I)']);
  ok(!/28227|28228|28229|Sua OC:/.test(identificacao.d.querySelector('[data-lista]').textContent),
    'caso do print mostra Pedido 6292; ausência não recorre ao número interno e zeros iniciais são preservados');
  ok(identificacao.d.querySelectorAll('.cli-pedido__num')[3].textContent === 'Pedido 30914(P.I)',
    'número preenchido da coluna PEDIDO mantém (P.I) mesmo quando contém o mesmo número da requisição');

  const historico = await painel({ hash: '#pedidos', pedidos: rota => ({ ok: true,
    empresas: [{ id: 309, nome: 'USINA SERTÃOZINHO' }], pedidos: rota === 'pedidos?dias=365' ? [
      { pedido: '25003', pedido_cliente: 'OC-MARCO', empresa_id: 309, etapa: 'entregue', data_prevista: '2026-03-03', itens: [] },
    ] : [] }) });
  ok(historico.d.querySelector('[data-lista]').textContent.includes('nos últimos 6 meses'), 'histórico fora dos seis meses deixa o período explícito');
  const periodoHistorico = historico.d.querySelector('[aria-controls=periodo-opcoes]');
  periodoHistorico.click(); tecla(historico.w, periodoHistorico, 'Home');
  tecla(historico.w, periodoHistorico, 'ArrowDown'); tecla(historico.w, periodoHistorico, 'ArrowDown');
  tecla(historico.w, periodoHistorico, 'Enter'); await aguardar();
  ok(historico.d.querySelectorAll('.cli-pedido').length === 1 && historico.d.querySelector('.cli-numero--despachado strong').textContent === '1',
    'último ano mostra o pedido antigo e conta sua OC despachada');
  historico.d.querySelector('[data-filtro=aberto]').click();
  ok(historico.d.querySelector('[data-lista]').textContent.includes('Todos ou Despachado') &&
    historico.d.querySelector('.cli-numero--despachado strong').textContent === '1', 'filtro em aberto explica por que o pedido antigo despachado não está na lista');

  for (const campanha of ['setembro-amarelo', 'outubro-rosa', 'novembro-azul', 'natal']) {
    const c = janela('https://parts-seals.com.br/cliente?campanha=' + campanha);
    c.document.write(ler('cliente/index.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g, ''));
    c.eval(ler('js/campaign.js'));
    c.document.dispatchEvent(new c.Event('DOMContentLoaded')); await aguardar();
    ok(c.document.documentElement.dataset.campaign === campanha && !c.document.querySelector('.campaign-badge'),
      campanha + ' aplica o tema compartilhado sem cobrir a ferramenta com selo');
    const logo = c.document.querySelector('.cli-marca img').getAttribute('src');
    ok(fs.existsSync(path.join(raiz, logo)), campanha + ' usa uma logo existente');
    if (campanha !== 'natal') ok(logo.includes('/campanhas/' + campanha + '/'), campanha + ' recolore a logo');
  }
  const natal = janela('https://parts-seals.com.br/?campanha=natal');
  natal.document.write('<html lang="pt-BR"><head></head><body><img src="/assets/logo-header-white.png"></body></html>');
  natal.eval(ler('js/campaign.js')); natal.document.dispatchEvent(new natal.Event('DOMContentLoaded')); await aguardar();
  ok(natal.document.querySelector('.campaign-badge').textContent.includes('Boas festas') && !natal.document.querySelector('.campaign-badge a'),
    'site principal também tem Natal, sem link inexistente');
  const automatico = janela();
  automatico.document.write('<html><head></head><body class="cli-corpo"></body></html>');
  automatico.Date = class extends Date { constructor(...args) { super(...(args.length ? args : ['2026-12-03T12:00:00-03:00'])); } };
  automatico.eval(ler('js/campaign.js'));
  ok(automatico.document.documentElement.dataset.campaign === 'natal', 'dezembro ativa Natal automaticamente');
  console.log('\nOK: ' + verificacoes + ' verificações de hub, seletores, permissões e campanhas.');
}
testar().catch(e => { console.error(e); process.exitCode = 1; }).finally(async () => {
  for (const w of janelas) await w.happyDOM.close();
});
