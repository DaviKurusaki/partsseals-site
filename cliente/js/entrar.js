/* Área do Cliente — entrar e "esqueci minha senha". */
(function () {
  "use strict";
  var C = window.PSCliente;
  var aviso = document.querySelector("[data-aviso]");
  var cartaoEntrar = document.querySelector("[data-entrar]");
  var cartaoEsqueci = document.querySelector("[data-esqueci]");

  // Volta do link do e-mail (confirmação de cadastro). O token vem no fragmento
  // da URL: só lemos o tipo/erro e limpamos a barra de endereço.
  var hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  if (location.hash) history.replaceState(null, "", location.pathname);
  if (hash.get("error_code") || hash.get("error")) {
    C.aviso(aviso, "erro", "Este link expirou ou já foi usado. Entre com seu e-mail e senha; se precisar, peça um novo link em \"Esqueci minha senha\".");
  } else if (hash.get("type") === "signup" || hash.get("type") === "email") {
    C.aviso(aviso, "ok", "E-mail confirmado! Agora é só entrar. Se o seu acesso ainda estiver em análise, avisamos pelo WhatsApp quando for liberado.");
  }

  // Já tem sessão? Vai direto para o painel.
  C.api("GET", "eu").then(function (r) { if (r.status === 200) location.replace("/cliente"); }).catch(function () {});

  var form = document.querySelector("[data-form-entrar]");
  var botao = document.querySelector("[data-enviar]");
  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = form.elements.email.value.trim(), senha = form.elements.senha.value;
    if (!email || !senha) { C.aviso(aviso, "erro", "Informe e-mail e senha."); return; }
    botao.disabled = true; botao.textContent = "Entrando…";
    C.api("POST", "entrar", { email: email, senha: senha }).then(function (r) {
      if (r.dados && r.dados.ok) { location.replace("/cliente"); return; }
      C.aviso(aviso, "erro", (r.dados && r.dados.erro) || "Não conseguimos entrar agora. Tente de novo.");
      form.elements.senha.value = "";
    }).catch(function () { C.aviso(aviso, "erro", C.FALHA_REDE); })
      .then(function () { botao.disabled = false; botao.textContent = "Entrar"; });
  });

  function mostrar(esqueci) {
    cartaoEntrar.hidden = esqueci; cartaoEsqueci.hidden = !esqueci;
    (esqueci ? cartaoEsqueci.querySelector("input") : form.elements.email).focus();
  }
  document.querySelector("[data-abrir-esqueci]").addEventListener("click", function () {
    document.querySelector("#emailEsqueci").value = form.elements.email.value.trim();
    mostrar(true);
  });
  document.querySelector("[data-voltar]").addEventListener("click", function () { mostrar(false); });

  var formEsqueci = document.querySelector("[data-form-esqueci]");
  var avisoEsqueci = document.querySelector("[data-aviso-esqueci]");
  var botaoEsqueci = document.querySelector("[data-enviar-esqueci]");
  formEsqueci.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var email = formEsqueci.elements.email.value.trim();
    if (!email) { C.aviso(avisoEsqueci, "erro", "Informe seu e-mail."); return; }
    botaoEsqueci.disabled = true;
    C.api("POST", "esqueci-senha", { email: email }).then(function (r) {
      C.aviso(avisoEsqueci, "ok", (r.dados && r.dados.mensagem) || "Se este e-mail estiver cadastrado, você vai receber um link.");
    }).catch(function () { C.aviso(avisoEsqueci, "erro", C.FALHA_REDE); })
      .then(function () { botaoEsqueci.disabled = false; });
  });
})();
