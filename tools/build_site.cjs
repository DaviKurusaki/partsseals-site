'use strict';
// Só arquivos públicos chegam a dist. A API é empacotada separadamente pela Netlify.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'dist');
if (path.dirname(output) !== root || path.basename(output) !== 'dist') {
  throw new Error('Diretório de publicação fora do projeto.');
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(output, { recursive: true });
for (const name of ['index.html', 'en.html', 'es.html', 'materiais.html', 'style.css', 'script.js', 'robots.txt', 'sitemap.xml', '_redirects', '_headers']) {
  fs.copyFileSync(path.join(root, name), path.join(output, name));
}
for (const name of ['assets', 'css', 'js', 'expedicao']) {
  fs.cpSync(path.join(root, name), path.join(output, name), {
    recursive: true,
    filter: (file) => !path.relative(root, file).split(path.sep).includes('DataSheets'),
  });
}
console.log('Site institucional e /expedicao prontos em dist/.');
