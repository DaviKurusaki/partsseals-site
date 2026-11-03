/* Área do Cliente — página de cadastro. As mesmas regras são conferidas no servidor. */
(function () {
  "use strict";
  var R = window.PSRegras, C = window.PSCliente;
  var form = document.querySelector("[data-form]");
  var aviso = document.querySelector("[data-aviso]");
  var botao = document.querySelector("[data-enviar]");
  var inicio = Date.now();

  form.querySelectorAll("[data-mascara]").forEach(function (campo) {
    campo.addEventListener("input", function () {
      campo.value = campo.dataset.mascara === "cnpj" ? R.mascaraCnpj(campo.value) : R.mascaraTelefone(campo.value);
    });
  });

  function idade(nascimento) {
    var m = /^(\d{4})-(\d{2})-(\d{2})$/.exec(nascimento || "");
    if (!m) return NaN;
    var h = new Date();
    return h.getFullYear() - Number(m[1]) - ((h.getMonth() + 1 < Number(m[2]) || (h.getMonth() + 1 === Number(m[2]) && h.getDate() < Number(m[3]))) ? 1 : 0);
  }

  function validar(d) {
    var e = {};
    if (d.nome.split(/\s+/).filter(function (p) { return p.length >= 2; }).length < 2) e.nome = "Informe nome e sobrenome.";
    var i = idade(d.nascimento);
    if (!(i >= 16 && i <= 100)) e.nascimento = "Confira a data de nascimento.";
    if (!/^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(d.email)) e.email = "Informe um e-mail válido.";
    if (!/^\d{10,11}$/.test(R.digitos(d.whatsapp))) e.whatsapp = "Informe o WhatsApp com DDD.";
    if (d.empresa.length < 2) e.empresa = "Informe o nome da empresa.";
    if (!R.cnpjValido(d.cnpj)) e.cnpj = "CNPJ inválido. Confira os números.";
    if (d.senha.length < 8) e.senha = "A senha precisa ter pelo menos 8 caracteres.";
    if (d.confirmacao !== d.senha) e.confirmacao = "As senhas não conferem.";
    if (!d.lgpd) e.lgpd = "É preciso aceitar a Política de Privacidade.";
    return e;
  }

  function mostrarErros(erros) {
    ["nome", "nascimento", "email", "whatsapp", "empresa", "cnpj", "senha", "confirmacao", "lgpd"].forEach(function (n) { C.erroCampo(form, n, erros[n]); });
    var primeiro = Object.keys(erros)[0];
    if (primeiro && form.elements[primeiro]) form.elements[primeiro].focus();
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    C.aviso(aviso, "erro", "");
    var f = form.elements;
    var d = {
      nome: f.nome.value.trim().replace(/\s+/g, " "), nascimento: f.nascimento.value, email: f.email.value.trim().toLowerCase(),
      whatsapp: R.digitos(f.whatsapp.value), empresa: f.empresa.value.trim(), cnpj: R.digitos(f.cnpj.value), cargo: f.cargo.value.trim(),
      senha: f.senha.value, confirmacao: f.confirmacao.value, lgpd: f.lgpd.checked, comunicacoes: f.comunicacoes.checked,
      site: f.site.value, tempo: Date.now() - inicio,
    };
    var erros = validar(d);
    mostrarErros(erros);
    if (Object.keys(erros).length) return;
    botao.disabled = true; botao.textContent = "Enviando…";
    C.api("POST", "cadastro", d).then(function (r) {
      if (r.dados && r.dados.ok) {
        document.querySelector("[data-formulario]").hidden = true;
        var sucesso = document.querySelector("[data-sucesso]");
        sucesso.querySelector("[data-sucesso-texto]").textContent = r.dados.mensagem;
        if (r.dados.neutro) sucesso.querySelector("h1").textContent = "Confira seu acesso";
        sucesso.hidden = false; sucesso.focus();
        return;
      }
      if (r.dados && r.dados.erros) mostrarErros(r.dados.erros);
      C.aviso(aviso, "erro", (r.dados && r.dados.erro) || "Não conseguimos enviar agora. Tente de novo.");
    }).catch(function () { C.aviso(aviso, "erro", C.FALHA_REDE); })
      .then(function () { botao.disabled = false; botao.textContent = "Criar meu acesso"; });
  });
})();
