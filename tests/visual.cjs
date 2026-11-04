'use strict';
// Executar com Electron instalado no projeto Kuru: electron tests/visual.cjs
const { app, BrowserWindow } = require('electron');
const assert = require('node:assert/strict');
const fs = require('node:fs');
const os = require('node:os');
const path = require('node:path');
const http = require('node:http');
const raiz = path.resolve(__dirname, '..');
const publicos = path.join(raiz, 'dist');
const saida = fs.mkdtempSync(path.join(os.tmpdir(), 'parts-visual-'));
app.setPath('userData', path.join(saida, 'perfil'));
const mime = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json', '.webp': 'image/webp', '.jpg': 'image/jpeg', '.png': 'image/png', '.svg': 'image/svg+xml' };
let modoCobertura = 'vazio';
let modoPedidos = 'vazio';
const servidor = http.createServer(async (req, res) => {
  if (req.url === '/api/cobertura') {
    if (modoCobertura === 'falha') { res.writeHead(503); res.end(); return; }
    if (modoCobertura === 'demo') { res.writeHead(200, { 'Content-Type': 'application/json' });
      res.end(JSON.stringify({ ufs: [{ uf: 'SP', dataReferencia: '2026-01-01' }, { uf: 'DF', dataReferencia: '2026-01-02' }] })); return; }
    const r = await require('../netlify/functions/cobertura.js').handler({ httpMethod: 'GET' });
    res.writeHead(r.statusCode, r.headers); res.end(r.body); return;
  }
  if (req.url === '/cliente/central') {
    res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    res.end(require('../netlify/functions/cliente-api/central-template.cjs').replace('<div id="central" data-central>', '<div id="central" data-central data-user-key="TESTE_LOCAL">')); return;
  }
  if (req.url === '/cliente/api/eu') { res.writeHead(200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify({ ok: true, cadastro: { primeiroNome: 'Cliente DEMO', status: 'aprovado' } })); return; }
  if (req.url.startsWith('/cliente/api/pedidos')) { res.writeHead(modoPedidos === 'falha' ? 502 : 200, { 'Content-Type': 'application/json' });
    res.end(JSON.stringify(modoPedidos === 'falha' ? { ok: false } : { ok: true, pedidos: [], empresas: [] })); return; }
  if (req.url === '/cliente') { res.writeHead(200, { 'Content-Type': 'text/html; charset=utf-8' });
    fs.createReadStream(path.join(publicos, 'cliente/index.html')).pipe(res); return; }
  const relativo = decodeURIComponent(new URL(req.url, 'http://localhost').pathname).replace(/^\/+/, '') || 'index.html';
  const arquivo = path.resolve(publicos, relativo);
  if (!arquivo.startsWith(publicos + path.sep) || !fs.existsSync(arquivo) || fs.statSync(arquivo).isDirectory()) { res.writeHead(404); res.end(); return; }
  res.writeHead(200, { 'Content-Type': (mime[path.extname(arquivo)] || 'application/octet-stream') + '; charset=utf-8' });
  fs.createReadStream(arquivo).pipe(res);
});
let janela;
const esperar = async condicao => { for (let i = 0; i < 100; i++) {
  if (await janela.webContents.executeJavaScript(condicao)) return;
  await new Promise(r => setTimeout(r, 50));
} throw Error(`Tempo esgotado: ${condicao}`); };
const js = codigo => janela.webContents.executeJavaScript(codigo);

(async () => {
  await app.whenReady();
  await new Promise(resolve => servidor.listen(0, '127.0.0.1', resolve));
  const origem = `http://127.0.0.1:${servidor.address().port}`;
  janela = new BrowserWindow({ show: false, width: 1440, height: 900, webPreferences: { sandbox: false, backgroundThrottling: false } });
  const erros = []; janela.webContents.on('console-message', (_e, nivel, mensagem) => { if (nivel === 3) erros.push(mensagem); });
  await janela.loadURL(origem + '/');
  await js("document.querySelectorAll('.reveal').forEach(el=>el.style.transition='none')");
  await esperar("document.querySelector('.hero-media img')?.naturalWidth>0");
  fs.writeFileSync(path.join(saida, 'imagens-hero-1440.png'), (await janela.webContents.capturePage()).toPNG());
  janela.setSize(390, 900); await janela.loadURL(origem + '/');
  await js("document.querySelectorAll('.reveal').forEach(el=>el.style.transition='none')");
  await esperar("document.querySelector('.hero-media img')?.naturalWidth>0");
  await esperar("document.querySelector('.hero-copy.is-visible')!==null");
  await new Promise(r => setTimeout(r, 600));
  assert.equal(await js("getComputedStyle(document.querySelector('[data-menu]')).opacity"), '0');
  fs.writeFileSync(path.join(saida, 'imagens-hero-390.png'), (await janela.webContents.capturePage()).toPNG());
  janela.setSize(1440, 900); await janela.loadURL(origem + '/');
  await js("document.querySelectorAll('.reveal').forEach(el=>el.style.transition='none')");
  await js("document.documentElement.style.scrollBehavior='auto';document.querySelector('.product-card').scrollIntoView({block:'center'})");
  await esperar("Array.from(document.querySelectorAll('.product-card img')).every(i=>i.complete&&i.naturalWidth>0)");
  await js("Promise.all(Array.from(document.querySelectorAll('.product-card img')).map(i=>i.decode()))");
  await esperar("document.querySelector('.product-card.is-visible')!==null && Math.abs(document.querySelector('.product-card').getBoundingClientRect().top)<800");
  await new Promise(r => setTimeout(r, 600));
  fs.writeFileSync(path.join(saida, 'imagens-produtos-1440.png'), (await janela.webContents.capturePage()).toPNG());
  await js("document.querySelector('.consult-section').scrollIntoView({block:'start'})");
  await esperar("document.querySelector('.consult-image img')?.naturalWidth>0");
  await js("document.querySelector('.consult-image img').decode()");
  await esperar("document.querySelector('.consult-image.is-visible')!==null && Math.abs(document.querySelector('.consult-image').getBoundingClientRect().top)<800");
  await new Promise(r => setTimeout(r, 600));
  fs.writeFileSync(path.join(saida, 'imagens-consultoria-1440.png'), (await janela.webContents.capturePage()).toPNG());
  await esperar("document.querySelectorAll('.cobertura-estado').length===27");
  assert.equal(await js("document.querySelector('[data-contador]').textContent.includes('Cobertura em atualização')"), true);
  await js("document.querySelector('[data-modo=regiao]').click();document.querySelector('#buscaUf').value='SP';document.querySelector('#buscaUf').dispatchEvent(new Event('input',{bubbles:true}));");
  assert.equal(await js("document.querySelectorAll('.cobertura-lista button').length"), 1);
  await js("document.querySelector('.cobertura-lista button').click()");
  assert.equal(await js("document.querySelector('[data-detalhe]').textContent.includes('São Paulo')"), true);
  await js("{const p=document.querySelector('.cobertura-estado[data-uf=DF]');p.focus();p.dispatchEvent(new KeyboardEvent('keydown',{key:'Enter',bubbles:true}))}");
  assert.equal(await js("document.querySelector('[data-detalhe]').textContent.includes('Distrito Federal')"), true);
  await js("document.querySelector('#brasil').scrollIntoView({block:'start'})");
  for (const largura of [360, 390, 768, 1024, 1440]) {
    janela.setSize(largura, 900); await new Promise(r => setTimeout(r, 100));
    const transborda = await js('document.documentElement.scrollWidth > innerWidth + 1');
    assert.equal(transborda, false, `home transborda em ${largura}px`);
    if (largura === 390 || largura === 1440) fs.writeFileSync(path.join(saida, `home-${largura}.png`), (await janela.webContents.capturePage()).toPNG());
  }
  modoCobertura = 'demo'; await janela.loadURL(origem + '/');
  await esperar("document.querySelectorAll('.cobertura-estado.atendido').length===2");
  assert.equal(await js("document.querySelector('[data-contador]').textContent.includes('2 UFs')"), true);
  for (const largura of [390, 1440]) { janela.setSize(largura, 900); await new Promise(r => setTimeout(r, 80));
    assert.equal(await js('document.documentElement.scrollWidth > innerWidth + 1'), false, `contagem com dados transborda em ${largura}px`); }
  await janela.loadURL(origem + '/en.html'); await esperar("document.querySelectorAll('.cobertura-estado').length===27");
  await js("document.querySelector('[data-modo=regiao]').click()");
  assert.equal(await js("document.querySelector('[data-regioes]').textContent.includes('North')"), true);
  await janela.loadURL(origem + '/es.html'); await esperar("document.querySelectorAll('.cobertura-estado').length===27");
  await js("document.querySelector('[data-modo=regiao]').click()");
  assert.equal(await js("document.querySelector('[data-regioes]').textContent.includes('Sur')"), true);
  modoCobertura = 'falha'; await janela.loadURL(origem + '/');
  await esperar("document.querySelector('[data-cobertura] [role=alert]')!==null");
  assert.equal(await js("document.querySelector('h1')!==null && document.querySelector('#contato')!==null"), true);
  await janela.loadURL(origem + '/cliente');
  await esperar("document.querySelector('[data-consulta-em]')?.textContent.includes('Consulta realizada')");
  assert.equal(await js("document.querySelectorAll('.cli-resumo .cli-numero').length"), 3);
  assert.equal(await js("document.querySelector('.cli-dashboard a[href=\"/cliente/central\"]')!==null"), true);
  janela.setSize(390, 900); await new Promise(r => setTimeout(r, 100));
  assert.equal(await js('document.documentElement.scrollWidth > innerWidth + 1'), false, 'dashboard transborda em 390px');
  fs.writeFileSync(path.join(saida, 'dashboard-390.png'), (await janela.webContents.capturePage()).toPNG());
  modoPedidos = 'falha'; await janela.loadURL(origem + '/cliente');
  await esperar("document.querySelector('[data-resumo]')?.textContent.includes('indisponível')");
  modoPedidos = 'vazio';
  await janela.loadURL(origem + '/cliente/central');
  await esperar("document.querySelectorAll('.tec-card').length===10");
  await js("location.hash='c2'"); await esperar("document.querySelector('[data-form=c2]')!==null");
  await js("{const f=document.querySelector('[data-form=c2]');f.elements.externo.value='60';f.elements.interno.value='50';f.requestSubmit()}");
  assert.equal(await js("document.querySelector('[data-resultado]').textContent.includes('5 mm')"), true);
  await js("document.querySelector('[data-optin]').click();document.querySelector('[data-salvar]').click();location.hash='c10'");
  await esperar("document.querySelector('.tec-historico-item')!==null");
  assert.equal(await js("document.querySelector('.tec-historico-item').textContent.includes('5 mm')"), true);
  await js("document.querySelector('[data-reabrir]').click()");
  await esperar("document.querySelector('[data-form=c2]')?.elements.externo.value==='60'");
  await js("location.hash='c10'"); await esperar("document.querySelector('[data-limpar-historico]')!==null");
  await js("document.querySelector('[data-limpar-historico]').click();location.hash='c3'");
  await esperar("document.querySelector('[data-form=c3]')!==null");
  await js("{const f=document.querySelector('[data-form=c3]');f.elements.valor.value='25,4';f.requestSubmit()}");
  assert.equal(await js("document.querySelector('[data-resultado]').textContent.includes('1 pol')"), true);
  await js("location.hash='c4'"); await esperar("document.querySelector('[data-material-a]')?.options.length>=10");
  await js("document.querySelector('[data-comparar]').click()");
  assert.equal(await js("document.querySelectorAll('.tec-comparacao-grid article').length"), 2);
  await js("location.hash='c5'"); await esperar("document.querySelector('[data-form=c5]')!==null");
  await js("{const f=document.querySelector('[data-form=c5]');f.elements.material.value='PTFE';f.elements.fluido.value='óleo';f.requestSubmit()}");
  assert.equal(await js("document.querySelector('[data-resultado]').textContent.includes('Sem dados suficientes')"), true);
  await js("location.hash='c6'"); await esperar("document.querySelector('[data-guia]')!==null");
  await js("document.querySelector('[data-passo-proximo]').click()");
  assert.equal(await js("document.querySelector('[data-passo-contador]').textContent"), 'Passo 2 de 4');
  await js("location.hash='c7'"); await esperar("document.querySelector('[data-form=c7]')!==null");
  await js("document.querySelector('[data-form=c7]').requestSubmit()");
  assert.equal(await js("document.querySelector('[data-resultado]').textContent.includes('sem indicação de perfil')"), true);
  await js("location.hash='c8'"); await esperar("document.querySelectorAll('[data-faq] details').length===6");
  await js("location.hash='c9'"); await esperar("document.querySelectorAll('.tec-visuais li').length>=10");
  await js("location.hash='c3'"); await esperar("document.querySelector('[data-form=c3]')!==null");
  for (const largura of [360, 390, 768, 1024, 1440]) {
    janela.setSize(largura, 900); await new Promise(r => setTimeout(r, 100));
    assert.equal(await js('document.documentElement.scrollWidth > innerWidth + 1'), false, `central transborda em ${largura}px`);
    if (largura === 390 || largura === 1440) fs.writeFileSync(path.join(saida, `central-${largura}.png`), (await janela.webContents.capturePage()).toPNG());
  }
  assert.deepEqual(erros, []);
  console.log(`OK: mapa, busca, estados vazios, 5 larguras, 10 ferramentas, cálculo, histórico. Capturas: ${saida}`);
  servidor.close(); janela.destroy(); app.exit(0);
})().catch(e => { console.error(e.stack); servidor.close(); janela?.destroy(); app.exit(1); });
