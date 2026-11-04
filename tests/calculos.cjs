'use strict';
const assert = require('node:assert/strict');
const c = require('../cliente/js/calculos.js');
const perto = (real, esperado, erro = 1e-6) => assert(Math.abs(real - esperado) < erro, `${real} != ${esperado}`);
perto(c.secaoRadial('60', '50'), 5);
perto(c.secaoRadial('60,25', '50.25'), 5);
perto(c.espacoAlojamento('60', '50').diametral, 10);
perto(c.espacoAlojamento('60', '50').radial, 5);
for (const [a, b] of [['0', '1'], ['-1', '2'], ['50', '60'], ['50', '50'], ['abc', '20'], ['1e99', '2']]) {
  assert.throws(() => c.secaoRadial(a, b));
}
perto(c.converter('25,4', 'mm', 'pol'), 1);
perto(c.converter('1', 'pol', 'mm'), 25.4);
perto(c.converter('10', 'bar', 'MPa'), 1);
perto(c.converter('1', 'MPa', 'bar'), 10);
perto(c.converter('1', 'psi', 'bar'), 0.06894757);
perto(c.converter('0', 'C', 'F'), 32);
perto(c.converter('212', 'F', 'C'), 100);
assert.throws(() => c.converter('1', 'mm', 'bar'));
assert.throws(() => c.converter('Infinity', 'mm', 'pol'));
console.log('OK: seção, alojamento, conversões bidirecionais, decimal e entradas inválidas.');
