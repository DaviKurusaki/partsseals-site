/* Usa o cadastro de empresas sem alterar a aprovação do acesso ao site. */
(function () {
  "use strict";
  var C = window.PSCliente, R = window.PSRegras;
  var empresa = document.querySelector("#empresa"), cnpj = document.querySelector("#cnpj");
  var menu = document.querySelector("#empresas-sugestoes"), ajuda = document.querySelector("[data-empresa-ajuda]");
  if (!empresa || !cnpj || !menu || !ajuda) return;
  var caixa = empresa.parentElement, opcoes = [], ativo = -1, revisao = 0, timer;
  var chave = function (v) { return String(v || "").normalize("NFD").replace(/[\u0300-\u036f]/g, "").toUpperCase().replace(/[^A-Z0-9]/g, ""); };
  function fechar() {
    menu.hidden = true; empresa.setAttribute("aria-expanded", "false");
    empresa.removeAttribute("aria-activedescendant"); caixa.classList.remove("cli-cadastro-empresa--aberta");
    ativo = -1;
  }
  function aplicar(e, lado) {
    revisao += 1; clearTimeout(timer);
    empresa.value = e.nome; cnpj.value = R.mascaraCnpj(e.cnpj);
    C.erroCampo(empresa.form, "empresa", ""); C.erroCampo(empresa.form, "cnpj", "");
    ajuda.textContent = lado === "cnpj" ? "Empresa preenchida pelo CNPJ." : "CNPJ preenchido pela empresa selecionada.";
    fechar();
  }
  function realcar(i) {
    ativo = i;
    menu.querySelectorAll("[role=option]").forEach(function (el, n) {
      el.setAttribute("aria-selected", String(n === ativo));
      el.classList.toggle("cli-seletor__opcao--ativa", n === ativo);
    });
    if (i >= 0) empresa.setAttribute("aria-activedescendant", "empresa-sugestao-" + i);
  }
  function sugerir(lista) {
    opcoes = lista; ativo = -1;
    menu.innerHTML = lista.map(function (e, i) {
      return '<div class="cli-seletor__opcao" role="option" aria-selected="false" id="empresa-sugestao-' + i + '" data-empresa-opcao="' + i + '">' +
        '<span class="cli-empresa-sugestao"><strong>' + C.escapar(e.nome) + '</strong><small>' + C.escapar(R.mascaraCnpj(e.cnpj)) + '</small></span></div>';
    }).join("");
    menu.hidden = !lista.length;
    empresa.setAttribute("aria-expanded", String(!!lista.length));
    caixa.classList.toggle("cli-cadastro-empresa--aberta", !!lista.length);
  }
  function buscar(lado) {
    clearTimeout(timer); var atual = ++revisao;
    var nome = empresa.value.trim(), documento = R.digitos(cnpj.value);
    fechar(); ajuda.textContent = "";
    if (lado === "cnpj" ? !R.cnpjValido(documento) : chave(nome).length < 3) return;
    timer = setTimeout(function () {
      ajuda.textContent = "Buscando empresa…";
      var rota = "empresas?" + (lado === "cnpj" ? "cnpj=" + documento : "nome=" + encodeURIComponent(nome));
      C.api("GET", rota).then(function (r) {
        if (atual !== revisao || empresa.value.trim() !== nome || R.digitos(cnpj.value) !== documento) return;
        if (!r.dados || !r.dados.ok) throw new Error("consulta");
        var lista = (r.dados.empresas || []).filter(function (e) { return e.nome && R.cnpjValido(e.cnpj); });
        if (lado === "cnpj") {
          if (lista.length === 1 && R.digitos(lista[0].cnpj) === documento) aplicar(lista[0], lado);
          else ajuda.textContent = "CNPJ não encontrado no cadastro de empresas. Você pode preencher o nome manualmente.";
          return;
        }
        var exatas = lista.filter(function (e) { return chave(e.nome) === chave(nome) || chave(e.razao_social) === chave(nome); });
        if (exatas.length === 1) { aplicar(exatas[0], lado); return; }
        if (document.activeElement === empresa) sugerir(lista);
        ajuda.textContent = lista.length ? "Selecione a empresa para preencher o CNPJ." : "Empresa não encontrada. Você pode preencher os dados manualmente.";
      }).catch(function () {
        if (atual !== revisao) return;
        ajuda.textContent = "Não foi possível consultar agora. Você pode preencher os dados manualmente.";
      });
    }, 350);
  }
  empresa.addEventListener("input", function () { buscar("nome"); });
  cnpj.addEventListener("input", function () { buscar("cnpj"); });
  empresa.addEventListener("keydown", function (ev) {
    if (ev.key === "Escape") { fechar(); return; }
    if (ev.key === "Tab") { fechar(); return; }
    if (menu.hidden || !opcoes.length) return;
    if (ev.key === "ArrowDown" || ev.key === "ArrowUp") {
      ev.preventDefault(); realcar(Math.max(0, Math.min(opcoes.length - 1, ativo + (ev.key === "ArrowDown" ? 1 : -1))));
    } else if (ev.key === "Enter" && ativo >= 0) { ev.preventDefault(); aplicar(opcoes[ativo], "nome"); }
  });
  menu.addEventListener("mousedown", function (ev) { ev.preventDefault(); });
  menu.addEventListener("pointerdown", function (ev) { ev.preventDefault(); });
  menu.addEventListener("click", function (ev) {
    var item = ev.target.closest("[data-empresa-opcao]");
    if (item) { aplicar(opcoes[Number(item.dataset.empresaOpcao)], "nome"); empresa.focus(); }
  });
  document.addEventListener("pointerdown", function (ev) { if (!caixa.contains(ev.target)) fechar(); });
  empresa.addEventListener("blur", function () { fechar(); });
})();
