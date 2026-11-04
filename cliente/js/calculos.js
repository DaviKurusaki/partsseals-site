/* Fórmulas matemáticas e conversões; não decide adequação de vedação. */
(function (global) {
  'use strict';
  function numero(valor) {
    const texto = String(valor).trim();
    if (!/^[+-]?(?:\d+([.,]\d*)?|[.,]\d+)$/.test(texto)) throw new Error('Informe um número válido, por exemplo 50,25.');
    const n = Number(texto.replace(',', '.'));
    if (!Number.isFinite(n) || Math.abs(n) > 1e9) throw new Error('Número fora do intervalo aceito.');
    return n;
  }
  function positivos(maior, menor) {
    const a = numero(maior), b = numero(menor);
    if (a <= 0 || b <= 0) throw new Error('Os dois diâmetros devem ser maiores que zero.');
    if (a <= b) throw new Error('O diâmetro externo deve ser maior que o interno.');
    return [a, b];
  }
  function secaoRadial(externo, interno) {
    const [a, b] = positivos(externo, interno);
    return (a - b) / 2;
  }
  function espacoAlojamento(alojamento, eixo) {
    const [a, b] = positivos(alojamento, eixo);
    return { diametral: a - b, radial: (a - b) / 2 };
  }
  const pressaoPa = { bar: 100000, MPa: 1000000, psi: 6894.757 };
  function converter(valor, de, para) {
    const n = numero(valor);
    if (de === para) return n;
    if ((de === 'mm' || de === 'pol') && (para === 'mm' || para === 'pol')) return de === 'mm' ? n / 25.4 : n * 25.4;
    if (pressaoPa[de] && pressaoPa[para]) return n * pressaoPa[de] / pressaoPa[para];
    if (de === 'C' && para === 'F') return n * 9 / 5 + 32;
    if (de === 'F' && para === 'C') return (n - 32) * 5 / 9;
    throw new Error('Selecione unidades da mesma grandeza.');
  }
  const api = { numero, secaoRadial, espacoAlojamento, converter };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  if (global) global.PSCalculos = api;
})(typeof window !== 'undefined' ? window : null);
