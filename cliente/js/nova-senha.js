/* Área do Cliente — nova senha pelo link do e-mail. O token vem no fragmento
 * da URL (#access_token=...&type=recovery): é lido uma vez, guardado só na
 * memória da página e a barra de endereço é limpa. */
(function () {
  "use strict";
  var C = window.PSCliente;
  var aviso = document.querySelector("[data-aviso]");
  var form = document.querySelector("[data-form]");
  var botao = document.querySelector("[data-enviar]");

  var hash = new URLSearchParams(location.hash.replace(/^#/, ""));
  var token = hash.get("type") === "recovery" ? hash.get("access_token") : null;
  if (location.hash) history.replaceState(null, "", location.pathname);

  if (!token) {
    form.hidden = true;
    C.aviso(aviso, "erro", hash.get("error_code") || hash.get("error")
      ? "Este link expirou ou já foi usado. Peça um novo em \"Esqueci minha senha\" na página Entrar."
      : "Abra esta página pelo link que enviamos para o seu e-mail.");
    return;
  }

  form.addEventListener("submit", function (ev) {
    ev.preventDefault();
    var senha = form.elements.senha.value, confirmacao = form.elements.confirmacao.value;
    if (senha.length < 8) { C.aviso(aviso, "erro", "A senha precisa ter pelo menos 8 caracteres."); return; }
    if (senha !== confirmacao) { C.aviso(aviso, "erro", "As senhas não conferem."); return; }
    botao.disabled = true;
    C.api("POST", "nova-senha", { token: token, senha: senha }).then(function (r) {
      if (r.dados && r.dados.ok) {
        token = null; form.hidden = true;
        C.aviso(aviso, "ok", r.dados.mensagem || "Senha alterada! Agora é só entrar.");
        return;
      }
      C.aviso(aviso, "erro", (r.dados && r.dados.erro) || "Não conseguimos salvar agora. Tente de novo.");
    }).catch(function () { C.aviso(aviso, "erro", C.FALHA_REDE); })
      .then(function () { botao.disabled = false; });
  });
})();
