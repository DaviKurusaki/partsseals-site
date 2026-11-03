/* Mesma interpretação usada pelo Acabamento: chave de acesso ou número da NF. */
(function (raiz) {
  'use strict';
  function interpretarNf(valor) {
    const digitos = String(valor || '').trim().replace(/[\s.\-]/g, '');
    if (!/^\d{1,9}$|^\d{44}$/.test(digitos)) return null;
    if (digitos.length === 44) {
      let soma = 0;
      for (let i = 42; i >= 0; i--) soma += Number(digitos[i]) * (2 + (42 - i) % 8);
      const resto = soma % 11;
      if (Number(digitos[43]) !== (resto < 2 ? 0 : 11 - resto)) return null;
      if (Number(digitos.slice(25, 34)) === 0) return null;
      return { numero: String(Number(digitos.slice(25, 34))), codigo: digitos };
    }
    return Number(digitos) > 0 ? { numero: String(Number(digitos)), codigo: digitos } : null;
  }
  function rastreioCorreios(valor) {
    const codigo = String(valor || '').replace(/\s/g, '').toUpperCase();
    return /^[A-Z]{2}\d{9}[A-Z]{2}$/.test(codigo) ? codigo : null;
  }
  const api = { interpretarNf, rastreioCorreios };
  if (typeof module !== 'undefined' && module.exports) module.exports = api;
  else raiz.DespachoCodigos = api;
})(globalThis);
