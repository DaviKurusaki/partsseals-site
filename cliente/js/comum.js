/*
 * Área do Cliente — utilidades comuns das páginas: chamada à API, escape de
 * HTML e contato do comercial (o mesmo número do js/script.js).
 */
(function () {
  "use strict";

  var WHATSAPP_COMERCIAL = "5519983011817";
  var MENSAGEM_COMERCIAL = "Olá! Vim pelo site da Parts Seals e gostaria de solicitar um orçamento.";

  function escapar(v) {
    return String(v === null || v === undefined ? "" : v)
      .replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;").replace(/'/g, "&#39;");
  }

  /** Chama /cliente/api/<rota>. Devolve { status, dados }; erro de rede vira exceção. */
  function api(metodo, rota, corpo) {
    var opcoes = { method: metodo, credentials: "same-origin", headers: { Accept: "application/json" } };
    if (metodo === "POST") {
      opcoes.headers["Content-Type"] = "application/json";
      opcoes.headers["X-Cliente"] = "1";
      opcoes.body = JSON.stringify(corpo || {});
    }
    return fetch("/cliente/api/" + rota, opcoes).then(function (r) {
      return r.json().catch(function () { return {}; }).then(function (dados) { return { status: r.status, dados: dados }; });
    });
  }

  function linkComercial(mensagem) {
    return "https://wa.me/" + WHATSAPP_COMERCIAL + "?text=" + encodeURIComponent(mensagem || MENSAGEM_COMERCIAL);
  }

  /** Mostra/oculta a mensagem de um campo e marca aria-invalid. */
  function erroCampo(form, nome, mensagem) {
    var campo = form.elements[nome];
    var caixa = form.querySelector('[data-erro="' + nome + '"]');
    if (campo && campo.setAttribute) campo.setAttribute("aria-invalid", mensagem ? "true" : "false");
    if (caixa) { caixa.textContent = mensagem || ""; caixa.hidden = !mensagem; }
  }

  function aviso(elemento, tipo, mensagem) {
    if (!elemento) return;
    elemento.className = "cli-aviso cli-aviso--" + tipo;
    elemento.textContent = mensagem;
    elemento.hidden = !mensagem;
    if (mensagem) elemento.focus && elemento.focus();
  }

  window.PSCliente = {
    api: api, escapar: escapar, linkComercial: linkComercial, erroCampo: erroCampo, aviso: aviso,
    WHATSAPP_COMERCIAL: WHATSAPP_COMERCIAL, MENSAGEM_COMERCIAL: MENSAGEM_COMERCIAL,
    FALHA_REDE: "Não conseguimos falar com o servidor. Confira sua internet e tente de novo.",
  };
})();
