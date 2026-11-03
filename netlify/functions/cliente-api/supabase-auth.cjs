'use strict';
/**
 * Supabase Auth com a chave ANON (nunca a service_role): cadastro, entrada,
 * renovação, usuário atual, saída, recuperação e troca de senha.
 *
 * Variáveis: SUPABASE_URL, SUPABASE_ANON_KEY.
 */

class ErroAuth extends Error {
  constructor(mensagem, { status = null, codigo = null } = {}) { super(mensagem); this.status = status; this.codigo = codigo; }
}

const url = () => String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const chave = () => process.env.SUPABASE_ANON_KEY || '';
const configurado = () => Boolean(url() && chave());

async function chamar(caminho, { metodo = 'POST', corpo, token } = {}) {
  const resposta = await fetch(`${url()}/auth/v1/${caminho}`, {
    method: metodo,
    headers: { apikey: chave(), Authorization: `Bearer ${token || chave()}`, 'Content-Type': 'application/json' },
    body: corpo === undefined ? undefined : JSON.stringify(corpo),
  });
  const texto = await resposta.text();
  let json = null;
  try { json = texto ? JSON.parse(texto) : null; } catch { json = null; }
  if (!resposta.ok) {
    throw new ErroAuth(json?.msg || json?.message || json?.error_description || `Auth respondeu ${resposta.status}`,
      { status: resposta.status, codigo: json?.error_code || json?.code || json?.error || null });
  }
  return json;
}

const comRedirect = (caminho, redirect) => (redirect ? `${caminho}?redirect_to=${encodeURIComponent(redirect)}` : caminho);

module.exports = {
  ErroAuth,
  configurado,
  /** Com confirmação de e-mail ligada, devolve o usuário SEM sessão. E-mail já
   *  confirmado devolve um usuário "falso" com identities vazio (o Supabase
   *  faz isso para não revelar quem existe). */
  cadastrar: (email, senha, redirect) => chamar(comRedirect('signup', redirect), { corpo: { email, password: senha } }),
  entrar: (email, senha) => chamar('token?grant_type=password', { corpo: { email, password: senha } }),
  renovar: (refreshToken) => chamar('token?grant_type=refresh_token', { corpo: { refresh_token: refreshToken } }),
  usuario: (accessToken) => chamar('user', { metodo: 'GET', token: accessToken }),
  sair: (accessToken) => chamar('logout', { token: accessToken }),
  recuperar: (email, redirect) => chamar(comRedirect('recover', redirect), { corpo: { email } }),
  trocarSenha: (accessToken, senha) => chamar('user', { metodo: 'PUT', token: accessToken, corpo: { password: senha } }),
};
