'use strict';
/** Validação do cadastro da Área do Cliente (no servidor; a página repete
 *  as mesmas regras só para avisar antes de enviar). */

const texto = (v) => (v === null || v === undefined ? '' : String(v).trim());
const digitos = (v) => texto(v).replace(/\D/g, '');

function cnpjValido(valor) {
  const d = digitos(valor);
  if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
  const dv = (base, pesos) => {
    const soma = pesos.reduce((s, p, i) => s + Number(base[i]) * p, 0);
    const resto = soma % 11;
    return resto < 2 ? 0 : 11 - resto;
  };
  const p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
  return dv(d, p1) === Number(d[12]) && dv(d, [6, ...p1]) === Number(d[13]);
}

const emailValido = (v) => /^[^@\s]+@[^@\s]+\.[^@\s]{2,}$/.test(texto(v)) && texto(v).length <= 254;

/** Idade em anos completos num dia de referência (AAAA-MM-DD). */
function idadeEm(nascimentoIso, hojeIso) {
  const [a, m, d] = nascimentoIso.split('-').map(Number), [ha, hm, hd] = hojeIso.split('-').map(Number);
  return ha - a - (hm < m || (hm === m && hd < d) ? 1 : 0);
}

/** Data real (31/02 não passa). Aceita AAAA-MM-DD. */
function dataReal(v) {
  const m = texto(v).match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return null;
  const dt = new Date(Date.UTC(+m[1], +m[2] - 1, +m[3]));
  return dt.getUTCFullYear() === +m[1] && dt.getUTCMonth() === +m[2] - 1 && dt.getUTCDate() === +m[3] ? `${m[1]}-${m[2]}-${m[3]}` : null;
}

/** Hoje em São Paulo (UTC-3 o ano todo desde 2019). */
const hojeSaoPaulo = (agora = Date.now()) => new Date(agora - 3 * 3600 * 1000).toISOString().slice(0, 10);

/**
 * Devolve { dados } normalizados ou { erros: {campo: mensagem} }.
 * Nomes de campo iguais aos do formulário da página.
 */
function validarCadastro(c = {}, agora = Date.now()) {
  const erros = {};
  const nome = texto(c.nome).replace(/\s+/g, ' ');
  if (nome.split(' ').filter((p) => p.length >= 2).length < 2 || nome.length > 150) erros.nome = 'Informe nome e sobrenome.';
  const nascimento = dataReal(c.nascimento);
  if (!nascimento) erros.nascimento = 'Informe uma data de nascimento válida.';
  else {
    const idade = idadeEm(nascimento, hojeSaoPaulo(agora));
    if (idade < 16 || idade > 100) erros.nascimento = 'Confira a data de nascimento.';
  }
  const email = texto(c.email).toLowerCase();
  if (!emailValido(email)) erros.email = 'Informe um e-mail válido.';
  const whatsapp = digitos(c.whatsapp);
  if (!/^\d{10,11}$/.test(whatsapp)) erros.whatsapp = 'Informe o WhatsApp com DDD.';
  const empresa = texto(c.empresa);
  if (empresa.length < 2 || empresa.length > 150) erros.empresa = 'Informe o nome da empresa.';
  const cnpj = digitos(c.cnpj);
  if (!cnpjValido(cnpj)) erros.cnpj = 'CNPJ inválido. Confira os números.';
  const cargo = texto(c.cargo).slice(0, 80);
  const senha = typeof c.senha === 'string' ? c.senha : '';
  if (senha.length < 8) erros.senha = 'A senha precisa ter pelo menos 8 caracteres.';
  else if (senha.length > 72) erros.senha = 'Use uma senha de até 72 caracteres.';
  if (c.confirmacao !== undefined && c.confirmacao !== senha) erros.confirmacao = 'As senhas não conferem.';
  if (c.lgpd !== true) erros.lgpd = 'É preciso aceitar a Política de Privacidade.';
  if (Object.keys(erros).length) return { erros };
  return { dados: { nome, nascimento, email, whatsapp, empresa, cnpj, cargo, senha, aceitaComunicacoes: c.comunicacoes === true } };
}

module.exports = { validarCadastro, cnpjValido, emailValido, dataReal, idadeEm, hojeSaoPaulo, texto, digitos };
