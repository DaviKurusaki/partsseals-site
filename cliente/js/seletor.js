/* Seletores da Área do Cliente: contraste próprio, mouse e teclado iguais
 * em qualquer sistema, sem depender das cores do menu nativo do navegador. */
(function () {
  "use strict";
  var esc = window.PSCliente.escapar;
  var seta = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 9 6 6 6-6"/></svg>';
  var check = '<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m5 12 4 4L19 6"/></svg>';

  function montar(caixa, config) {
    var opcoes = config.opcoes.map(function (o) { return { valor: String(o.valor), nome: String(o.nome) }; });
    var selecionado = Math.max(0, opcoes.findIndex(function (o) { return o.valor === String(config.valor); }));
    var ativo = selecionado, aberto = false, prefixo = "", ultimaLetra = 0;
    var id = config.id;
    caixa.classList.add("cli-seletor");
    caixa.innerHTML = '<span class="cli-seletor__rotulo" id="' + id + '-rotulo">' + esc(config.rotulo) + '</span>' +
      '<button type="button" class="cli-seletor__botao" role="combobox" aria-haspopup="listbox" aria-expanded="false"' +
      ' aria-labelledby="' + id + '-rotulo ' + id + '-valor" aria-controls="' + id + '-opcoes">' +
      '<span id="' + id + '-valor"></span>' + seta + '</button>' +
      '<div class="cli-seletor__opcoes" role="listbox" id="' + id + '-opcoes" aria-labelledby="' + id + '-rotulo" hidden>' +
      opcoes.map(function (o, i) {
        return '<div class="cli-seletor__opcao" role="option" id="' + id + '-opcao-' + i + '" data-opcao="' + i +
          '" aria-selected="false"><span>' + esc(o.nome) + '</span>' + check + '</div>';
      }).join("") + '</div>';
    var botao = caixa.querySelector("[role=combobox]");
    var menu = caixa.querySelector("[role=listbox]");
    var valor = caixa.querySelector("#" + id + "-valor");
    var itens = Array.from(menu.querySelectorAll("[role=option]"));

    function desenhar() {
      valor.textContent = opcoes[selecionado].nome;
      botao.setAttribute("aria-expanded", String(aberto));
      caixa.classList.toggle("cli-seletor--aberto", aberto);
      menu.hidden = !aberto;
      itens.forEach(function (item, i) {
        item.setAttribute("aria-selected", String(i === selecionado));
        item.classList.toggle("cli-seletor__opcao--ativa", i === ativo);
      });
      if (aberto) {
        botao.setAttribute("aria-activedescendant", itens[ativo].id);
        if (itens[ativo].scrollIntoView) itens[ativo].scrollIntoView({ block: "nearest" });
      } else botao.removeAttribute("aria-activedescendant");
    }
    function fechar() { aberto = false; prefixo = ""; desenhar(); }
    function abrir() {
      document.dispatchEvent(new CustomEvent("ps:seletor-abrir", { detail: id }));
      aberto = true; ativo = selecionado; desenhar();
    }
    function escolher(i) {
      var mudou = selecionado !== i;
      selecionado = i; ativo = i; fechar(); botao.focus();
      if (mudou) config.aoMudar(opcoes[i].valor);
    }
    function teclado(ev) {
      if (ev.key === "Escape") {
        if (aberto) { ev.preventDefault(); fechar(); }
        return;
      }
      if (ev.key === "Tab") { fechar(); return; }
      if (["ArrowDown", "ArrowUp", "Home", "End", "Enter", " "].indexOf(ev.key) >= 0) {
        ev.preventDefault();
        if (!aberto) { abrir(); if (ev.key === "End") ativo = opcoes.length - 1; if (ev.key === "Home") ativo = 0; }
        else if (ev.key === "Enter" || ev.key === " ") { escolher(ativo); return; }
        else if (ev.key === "Home") ativo = 0;
        else if (ev.key === "End") ativo = opcoes.length - 1;
        else ativo = Math.max(0, Math.min(opcoes.length - 1, ativo + (ev.key === "ArrowDown" ? 1 : -1)));
        desenhar(); return;
      }
      if (ev.key.length === 1 && !ev.ctrlKey && !ev.metaKey && !ev.altKey) {
        ev.preventDefault();
        if (!aberto) abrir();
        var agora = Date.now();
        prefixo = agora - ultimaLetra > 700 ? ev.key : prefixo + ev.key; ultimaLetra = agora;
        var texto = function (v) { return v.normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase(); };
        var achado = opcoes.findIndex(function (o) { return texto(o.nome).indexOf(texto(prefixo)) === 0; });
        if (achado >= 0) ativo = achado;
        desenhar();
      }
    }
    function fora(ev) { if (!caixa.contains(ev.target)) fechar(); }
    function outro(ev) { if (ev.detail !== id) fechar(); }
    botao.addEventListener("click", function () { if (aberto) fechar(); else abrir(); });
    botao.addEventListener("keydown", teclado);
    caixa.addEventListener("focusout", function (ev) { if (!caixa.contains(ev.relatedTarget)) fechar(); });
    menu.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
    menu.addEventListener("click", function (ev) {
      var item = ev.target.closest("[data-opcao]");
      if (item) escolher(Number(item.dataset.opcao));
    });
    document.addEventListener("pointerdown", fora);
    document.addEventListener("ps:seletor-abrir", outro);
    desenhar();
    return {
      destruir: function () {
        document.removeEventListener("pointerdown", fora);
        document.removeEventListener("ps:seletor-abrir", outro);
        caixa.replaceChildren();
      },
    };
  }
  window.PSSeletor = { montar: montar };
})();
