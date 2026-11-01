'use strict';
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.join(root, 'dist');
const pages = ['index.html', 'en.html', 'es.html', 'materiais.html', 'politica-de-privacidade.html', 'privacy.html', 'privacidad.html'];
for (const name of [...pages, '404.html', 'expedicao/index.html']) {
  const html = fs.readFileSync(path.join(output, name), 'utf8');
  for (const match of html.matchAll(/<(?:script|img|link)\b[^>]*?\b(?:src|href)="([^"]+)"/g)) {
    const url = new URL(match[1], `https://parts-seals.com.br/${name}`);
    if (url.origin !== 'https://parts-seals.com.br') continue;
    const local = decodeURIComponent(url.pathname) === '/' ? 'index.html' : decodeURIComponent(url.pathname).slice(1);
    assert(fs.existsSync(path.join(output, local)), `${name}: recurso ausente ${url.pathname}`);
  }
  if (name !== 'expedicao/index.html') {
    assert(/<script src="\/?js\/analytics\.js" defer><\/script>/.test(html), `${name}: falta js/analytics.js`);
    assert(/script-src 'self' https:\/\/www\.googletagmanager\.com/.test(html), `${name}: CSP sem o Google Analytics`);
  } else {
    assert(!html.includes('analytics'), 'A expedição não deve ser medida');
  }
  if (pages.includes(name)) {
    assert.match(html, /rel="canonical" href="https:\/\/parts-seals\.com\.br\//);
    assert(!/noindex/.test(html), `${name}: página pública não deve receber noindex`);
  } else if (name === '404.html') {
    assert.match(html, /name="robots" content="noindex"/);
  } else {
    assert.match(html, /name="robots" content="noindex, nofollow"/);
  }
}
const manifest = JSON.parse(fs.readFileSync(path.join(output, 'expedicao/manifest.webmanifest')));
assert.equal(manifest.start_url, '/expedicao/');
assert.equal(manifest.scope, '/expedicao/');
for (const icon of manifest.icons) assert(fs.existsSync(path.join(output, icon.src.slice(1))));
const siteManifest = JSON.parse(fs.readFileSync(path.join(output, 'site.webmanifest')));
for (const icon of siteManifest.icons) assert(fs.existsSync(path.join(output, icon.src.slice(1))), `Ícone ausente ${icon.src}`);
for (const name of ['favicon.ico', '.well-known/security.txt']) {
  assert(fs.existsSync(path.join(output, name)), `Arquivo público ausente: ${name}`);
}
for (const forbidden of ['netlify', 'src', 'tests', 'tools', '.git', '.env', 'assets/DataSheets', 'readme.md']) {
  assert(!fs.existsSync(path.join(output, forbidden)), `Arquivo de trabalho publicado: ${forbidden}`);
}
const sitemap = fs.readFileSync(path.join(output, 'sitemap.xml'), 'utf8');
assert(!sitemap.includes('/expedicao'), 'Área operacional fora do sitemap');
assert.equal([...sitemap.matchAll(/<loc>/g)].length, pages.length);
console.log('OK: recursos públicos, canonical, sitemap, escopo do app e isolamento dos arquivos do servidor.');
