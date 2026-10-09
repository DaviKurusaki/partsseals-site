'use strict';
// O domínio das etiquetas antigas permanece disponível, sem hospedar outra API.
const fs = require('node:fs');
const path = require('node:path');
const root = path.resolve(__dirname, '..');
const output = path.resolve(root, 'dist-legado');
if (path.dirname(output) !== root || path.basename(output) !== 'dist-legado') {
  throw new Error('Diretório de publicação fora do projeto.');
}
fs.rmSync(output, { recursive: true, force: true });
fs.mkdirSync(path.join(output, 'public'), { recursive: true });
fs.mkdirSync(path.join(output, 'functions'), { recursive: true });
fs.writeFileSync(path.join(output, 'public', '_redirects'),
  '/api/* https://parts-seals-links.netlify.app/.netlify/functions/expedicao-api/:splat 200!\n' +
  '/* https://parts-seals.com.br/expedicao/:splat 301!\n');
fs.writeFileSync(path.join(output, 'public', '_headers'),
  '/*\n  X-Robots-Tag: noindex, nofollow\n  X-Content-Type-Options: nosniff\n');
fs.writeFileSync(path.join(output, 'netlify.toml'),
  '[build]\n  publish = "public"\n  functions = "functions"\n' +
  '[build.processing]\n  skip_processing = true\n');
console.log('Redirecionador das etiquetas antigas pronto em dist-legado/.');
