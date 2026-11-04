'use strict';
/**
 * Área do Cliente (parts-seals.com.br/cliente) — função da Netlify.
 *
 *   POST /cliente/api/cadastro       cria o login (Supabase Auth) + o cadastro pendente
 *   POST /cliente/api/entrar         e-mail + senha → cookies de sessão
 *   POST /cliente/api/sair           encerra a sessão
 *   POST /cliente/api/esqueci-senha  manda o link de nova senha (resposta sempre igual)
 *   POST /cliente/api/nova-senha     troca a senha com o token do link do e-mail
 *   GET  /cliente/api/eu             cadastro e status (pendente/aprovado/...)
 *   GET  /cliente/api/pedidos?dias=  pedidos de todas as empresas liberadas ao
 *                                    contato aprovado (até 730 dias)
 *
 * Decisões que não são óbvias:
 *  - **Duas chaves, cada uma no seu lugar.** A anon só fala com o Supabase
 *    Auth (supabase-auth.cjs). A service_role só chama as funções permitidas
 *    site_cliente_* e apaga usuário órfão (supabase-servico.cjs, lista
 *    fixa). Nenhuma tabela é lida direto.
 *  - **O id do usuário vem sempre do TOKEN**, validado em /auth/v1/user.
 *    Qualquer id que o navegador mandar é ignorado.
 *  - **Sessão em cookies HttpOnly** (Path=/cliente, SameSite=Lax). Token
 *    vencido é renovado aqui com o refresh_token, sem o cliente perceber.
 *  - **POST exige o cabeçalho X-Cliente**: formulário de outro site não
 *    consegue mandar cabeçalho próprio, então isso fecha CSRF junto com o
 *    SameSite=Lax.
 *  - **Cadastro que falha no meio não deixa login órfão**: se o registro no
 *    banco falhar, confere se esse login já tinha cadastro (meu_cadastro);
 *    só apaga do Auth quando não tinha — nunca apaga a conta de quem já
 *    estava cadastrado e só clicou duas vezes.
 *  - **Logs sem dado pessoal**: só rota e código do erro.
 */

const auth = require('./supabase-auth.cjs');
const servico = require('./supabase-servico.cjs');
const { validarCadastro, emailValido, texto, digitos, cnpjValido } = require('./validacao.cjs');

const BASE = String(process.env.SITE_CLIENTE_URL || 'https://parts-seals.com.br/cliente').replace(/\/+$/, '');
const COOKIE_ACESSO = 'ps_cli_at';
const COOKIE_RENOVACAO = 'ps_cli_rt';
const COOKIE_ULTIMO_ACESSO = 'ps_cli_ua';
const RENOVACAO_SEGUNDOS = 30 * 24 * 3600;
const INTERVALO_ACESSO_MS = 3600 * 1000;
const TEMPO_MINIMO_MS = 3000;
const DIAS_PADRAO = 180;
const DIAS_MAXIMO = 730;

const MSG_NEUTRA_EMAIL = 'Se este e-mail já tiver cadastro, use Entrar ou Esqueci minha senha.';
const MSG_CADASTRO_OK = 'Recebemos seu cadastro! Confirme seu e-mail pelo link que enviamos. Nossa equipe vai conferir e liberar seu acesso, e você recebe um aviso no WhatsApp.';
const MSG_RECUPERAR = 'Se este e-mail estiver cadastrado, você vai receber um link para criar uma nova senha. Confira também a caixa de spam.';
const MSG_FALHA = 'Não conseguimos concluir agora. Tente de novo em alguns instantes.';

// --- respostas e cookies -------------------------------------------------------

function responder(status, corpo, cookies = []) {
  const r = {
    statusCode: status,
    headers: { 'Content-Type': 'application/json; charset=utf-8', 'Cache-Control': 'no-store', 'X-Robots-Tag': 'noindex, nofollow', 'X-Content-Type-Options': 'nosniff' },
    body: JSON.stringify(corpo),
  };
  if (cookies.length) r.multiValueHeaders = { 'Set-Cookie': cookies };
  return r;
}
const erro = (status, mensagem, extra = {}, cookies = []) => responder(status, { ok: false, erro: mensagem, ...extra }, cookies);

const cookie = (nome, valor, maxAge) =>
  `${nome}=${encodeURIComponent(valor)}; Path=/cliente; HttpOnly; Secure; SameSite=Lax; Max-Age=${Math.max(0, Math.floor(maxAge))}`;
const apagarCookie = (nome) => `${nome}=; Path=/cliente; HttpOnly; Secure; SameSite=Lax; Max-Age=0`;
const limparSessao = () => [COOKIE_ACESSO, COOKIE_RENOVACAO, COOKIE_ULTIMO_ACESSO].map(apagarCookie);
const cookiesDaSessao = (s) => [
  cookie(COOKIE_ACESSO, s.access_token, Number(s.expires_in) || 3600),
  cookie(COOKIE_RENOVACAO, s.refresh_token, RENOVACAO_SEGUNDOS),
];

function lerCookies(evento) {
  const h = evento.headers || {};
  const bruto = h.cookie || h.Cookie || '';
  const mapa = {};
  for (const parte of String(bruto).split(';')) {
    const i = parte.indexOf('=');
    if (i < 0) continue;
    const nome = parte.slice(0, i).trim();
    try { mapa[nome] = decodeURIComponent(parte.slice(i + 1).trim()); } catch { /* cookie inválido: ignora */ }
  }
  return mapa;
}

function lerCorpo(evento) {
  try { return JSON.parse(evento.body || '{}') || {}; } catch { return null; }
}

const log = (rota, err) => console.error(`[cliente-api] ${rota}:`, err?.codigo || err?.status || err?.name || 'erro');

// --- sessão ----------------------------------------------------------------------

/** Usuário do token (renovando se precisar). null = sem sessão válida. */
async function sessao(evento) {
  const c = lerCookies(evento);
  if (c[COOKIE_ACESSO]) {
    try { return { usuario: await auth.usuario(c[COOKIE_ACESSO]), token: c[COOKIE_ACESSO], cookies: [], ultimoAcesso: Number(c[COOKIE_ULTIMO_ACESSO]) || 0 }; }
    catch (err) { if (![401, 403].includes(err.status)) throw err; }
  }
  if (c[COOKIE_RENOVACAO]) {
    try {
      const nova = await auth.renovar(c[COOKIE_RENOVACAO]);
      const usuario = await auth.usuario(nova.access_token);
      return { usuario, token: nova.access_token, cookies: cookiesDaSessao(nova), ultimoAcesso: Number(c[COOKIE_ULTIMO_ACESSO]) || 0 };
    } catch (err) { if (![400, 401, 403].includes(err.status)) throw err; }
  }
  return null;
}

const semSessao = () => erro(401, 'Sua sessão terminou. Entre de novo.', { sessaoExpirada: true }, limparSessao());

// --- rotas -----------------------------------------------------------------------

async function rotaCadastro(evento) {
  const c = lerCorpo(evento);
  if (!c) return erro(400, 'Dados inválidos.');
  // Robô: campo escondido preenchido. Responde como sucesso, sem fazer nada.
  if (texto(c.site)) return responder(200, { ok: true, mensagem: MSG_CADASTRO_OK });
  if (!(Number(c.tempo) >= TEMPO_MINIMO_MS)) return erro(400, 'Confira os dados e envie de novo.');
  const { dados, erros } = validarCadastro(c);
  if (erros) return erro(400, 'Confira os campos destacados.', { erros });

  let criado;
  try { criado = await auth.cadastrar(dados.email, dados.senha, `${BASE}/entrar`); }
  catch (err) {
    if (err.status === 429) return erro(429, 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.');
    if (err.codigo === 'weak_password') return erro(400, 'Confira os campos destacados.', { erros: { senha: 'Escolha uma senha mais forte (misture letras e números).' } });
    if (err.status === 422 || /already|registered|exists/i.test(err.message)) return responder(200, { ok: true, neutro: true, mensagem: MSG_NEUTRA_EMAIL });
    log('cadastro/auth', err);
    return erro(502, MSG_FALHA);
  }
  const usuario = criado?.user || criado;
  // E-mail já confirmado: o Supabase devolve um usuário "falso", sem identidades.
  if (!usuario?.id || (Array.isArray(usuario.identities) && usuario.identities.length === 0)) {
    return responder(200, { ok: true, neutro: true, mensagem: MSG_NEUTRA_EMAIL });
  }

  try {
    await servico.rpc('site_cliente_registrar', {
      p_auth_user_id: usuario.id, p_nome_completo: dados.nome, p_data_nascimento: dados.nascimento,
      p_email: dados.email, p_whatsapp: dados.whatsapp, p_empresa: dados.empresa, p_cnpj: dados.cnpj,
      p_cargo: dados.cargo || null, p_aceita_comunicacoes: dados.aceitaComunicacoes, p_consentimento_lgpd: true,
    });
  } catch (err) {
    log('cadastro/registrar', err);
    // Só apaga quando o banco CONFIRMA que esse login não tem cadastro; se a
    // conferência falhar, prefere deixar um login sem cadastro a arriscar
    // apagar a conta de quem já estava cadastrado.
    let jaTinha = null, conferido = false;
    try { jaTinha = await servico.rpc('site_cliente_meu_cadastro', { p_auth_user_id: usuario.id }); conferido = true; }
    catch (e) { log('cadastro/conferir', e); }
    if (conferido && !jaTinha) {
      try { await servico.apagarUsuario(usuario.id); } catch (e) { log('cadastro/apagar-orfao', e); }
    }
    if (jaTinha || err.codigo === '23505') return responder(200, { ok: true, neutro: true, mensagem: MSG_NEUTRA_EMAIL });
    if (err.codigo === '22023') return erro(400, err.message);
    return erro(502, MSG_FALHA);
  }
  return responder(200, { ok: true, mensagem: MSG_CADASTRO_OK });
}

async function rotaEntrar(evento) {
  const c = lerCorpo(evento);
  if (!c) return erro(400, 'Dados inválidos.');
  const email = texto(c.email).toLowerCase();
  if (!emailValido(email) || typeof c.senha !== 'string' || !c.senha) return erro(400, 'Informe e-mail e senha.');
  try {
    const s = await auth.entrar(email, c.senha);
    return responder(200, { ok: true }, cookiesDaSessao(s));
  } catch (err) {
    if (err.codigo === 'email_not_confirmed' || /not confirmed/i.test(err.message)) {
      return erro(403, 'Confirme seu e-mail pelo link que enviamos antes de entrar. Confira também a caixa de spam.', { naoConfirmado: true });
    }
    if (err.status === 429) return erro(429, 'Muitas tentativas seguidas. Espere alguns minutos e tente de novo.');
    if (err.status === 400 || err.status === 401) return erro(401, 'E-mail ou senha incorretos.');
    log('entrar', err);
    return erro(502, MSG_FALHA);
  }
}

async function rotaSair(evento) {
  const token = lerCookies(evento)[COOKIE_ACESSO];
  if (token) { try { await auth.sair(token); } catch (err) { if (![401, 403].includes(err.status)) log('sair', err); } }
  return responder(200, { ok: true }, limparSessao());
}

async function rotaEsqueci(evento) {
  const c = lerCorpo(evento) || {};
  const email = texto(c.email).toLowerCase();
  if (emailValido(email)) {
    try { await auth.recuperar(email, `${BASE}/nova-senha`); }
    catch (err) { log('esqueci-senha', err); }
  }
  // Sempre a mesma resposta: não revela se o e-mail existe.
  return responder(200, { ok: true, mensagem: MSG_RECUPERAR });
}

async function rotaNovaSenha(evento) {
  const c = lerCorpo(evento);
  if (!c || !texto(c.token)) return erro(400, 'Abra esta página pelo link que enviamos por e-mail.');
  if (typeof c.senha !== 'string' || c.senha.length < 8) return erro(400, 'A senha precisa ter pelo menos 8 caracteres.');
  if (c.senha.length > 72) return erro(400, 'Use uma senha de até 72 caracteres.');
  try {
    await auth.trocarSenha(texto(c.token), c.senha);
    return responder(200, { ok: true, mensagem: 'Senha alterada! Agora é só entrar com a senha nova.' }, limparSessao());
  } catch (err) {
    if (err.codigo === 'same_password') return erro(400, 'Escolha uma senha diferente da anterior.');
    if (err.codigo === 'weak_password') return erro(400, 'Escolha uma senha mais forte (misture letras e números).');
    if (err.status === 401 || err.status === 403) return erro(400, 'O link expirou ou já foi usado. Peça um novo em "Esqueci minha senha".');
    log('nova-senha', err);
    return erro(502, MSG_FALHA);
  }
}

async function rotaEu(evento) {
  const s = await sessao(evento);
  if (!s) return semSessao();
  const cadastro = await servico.rpc('site_cliente_meu_cadastro', { p_auth_user_id: s.usuario.id });
  const cookies = [...s.cookies];
  // Último acesso: no máximo uma gravação por hora por sessão.
  if (cadastro && Date.now() - s.ultimoAcesso > INTERVALO_ACESSO_MS) {
    try {
      await servico.rpc('site_cliente_registrar_acesso', { p_auth_user_id: s.usuario.id });
      cookies.push(cookie(COOKIE_ULTIMO_ACESSO, String(Date.now()), RENOVACAO_SEGUNDOS));
    } catch (err) { log('eu/acesso', err); }
  }
  const nome = texto(cadastro?.nome);
  return responder(200, {
    ok: true,
    cadastro: cadastro ? { nome, primeiroNome: nome.split(' ')[0] || '', status: cadastro.status, empresa: texto(cadastro.empresa) } : null,
  }, cookies);
}

async function rotaPedidos(evento) {
  const s = await sessao(evento);
  if (!s) return semSessao();
  const pedido = Number.parseInt((evento.queryStringParameters || {}).dias, 10);
  const dias = Number.isFinite(pedido) ? Math.min(DIAS_MAXIMO, Math.max(1, pedido)) : DIAS_PADRAO;
  const r = await servico.rpc('site_cliente_meus_pedidos', { p_auth_user_id: s.usuario.id, p_dias: dias });
  // `empresas` (sql/142 do Kuru): todas as empresas liberadas ao contato,
  // mesmo as sem pedido no período — o painel monta o filtro com elas.
  const empresas = (Array.isArray(r?.empresas) ? r.empresas : [])
    .filter((e) => e && e.id != null).map((e) => ({ id: e.id, nome: texto(e.nome) }));
  return responder(200, { ok: true, dias, empresas, pedidos: Array.isArray(r?.pedidos) ? r.pedidos : [] }, s.cookies);
}

async function rotaEmpresas(evento) {
  const q = evento.queryStringParameters || {};
  const nome = texto(q.nome), cnpj = digitos(q.cnpj);
  if (nome.length > 150 || (cnpj ? !cnpjValido(cnpj) : nome.replace(/[^\p{L}\p{N}]/gu, '').length < 3)) {
    return erro(400, 'Digite pelo menos 3 letras do nome ou um CNPJ completo e válido.');
  }
  const r = await servico.rpc('site_cliente_buscar_empresa', { p_nome: cnpj ? null : nome, p_cnpj: cnpj || null });
  const empresas = (Array.isArray(r) ? r : []).slice(0, 8).filter(e => cnpjValido(e?.cnpj)).map(e => ({
    nome: texto(e.nome).slice(0, 150), razao_social: texto(e.razao_social).slice(0, 200), cnpj: digitos(e.cnpj),
  }));
  return responder(200, { ok: true, empresas });
}

const ROTAS = {
  'POST cadastro': rotaCadastro, 'POST entrar': rotaEntrar, 'POST sair': rotaSair,
  'POST esqueci-senha': rotaEsqueci, 'POST nova-senha': rotaNovaSenha,
  'GET eu': rotaEu, 'GET pedidos': rotaPedidos, 'GET empresas': rotaEmpresas,
  'GET documentos': rotaDocumentos, 'GET arquivo': rotaArquivo,
};

async function rotaDocumentos(evento) {
  const s=await sessao(evento);
  if(!s) return semSessao();
  const q=evento.queryStringParameters || {};
  if(!/^[1-9]\d{0,14}$/.test(q.empresa || '') || !/^\d{1,9}$/.test(q.nf || '')) return erro(400,'Nota inválida.',{},s.cookies);
  const documentos=await servico.rpc('site_cliente_documentos',{p_auth_user_id:s.usuario.id,p_empresa_id:q.empresa,p_numero:String(Number(q.nf))});
  return responder(200,{ok:true,documentos:(Array.isArray(documentos)?documentos:[]).map(d=>({id:d.id,tipo:d.tipo,numero:d.numero}))},s.cookies);
}
async function rotaArquivo(evento) {
  const s=await sessao(evento);
  if(!s) return semSessao();
  const id=(evento.queryStringParameters || {}).id;
  if(!/^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i.test(id || '')) return erro(404,'Documento indisponível.',{},s.cookies);
  // Repete a autorização a cada abertura: bloquear o contato ou remover a
  // empresa corta imediatamente o acesso, mesmo com um link já conhecido.
  const d=await servico.rpc('site_cliente_documento',{p_auth_user_id:s.usuario.id,p_id:id});
  if(!d || !['pdf','xml','boleto'].includes(d.tipo) || !/^\d{1,9}$/.test(d.numero)) return erro(404,'Documento indisponível.',{},s.cookies);
  const bytes=await servico.baixarDocumento(d),xml=d.tipo==='xml';
  const r={statusCode:200,isBase64Encoded:true,body:bytes.toString('base64'),headers:{
    'Content-Type':xml?'application/xml':'application/pdf',
    'Content-Disposition':`${xml?'attachment':'inline'}; filename="${d.tipo}-NF-${d.numero}.${xml?'xml':'pdf'}"`,
    'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff','X-Robots-Tag':'noindex, nofollow',
    'Content-Security-Policy':"default-src 'none'; sandbox",
  }};
  if(s.cookies.length) r.multiValueHeaders={'Set-Cookie':s.cookies};
  return r;
}

exports.handler = async (evento) => {
  if (!auth.configurado() || !servico.configurado()) {
    console.error('[cliente-api] faltam variáveis: SUPABASE_URL, SUPABASE_ANON_KEY e SUPABASE_SERVICE_ROLE_KEY');
    return erro(500, 'A Área do Cliente ainda não foi configurada. Fale com a Parts Seals.');
  }
  const rota = texto(evento.path).split('/').filter(Boolean).at(-1);
  const fn = ROTAS[`${evento.httpMethod} ${rota}`];
  if (!fn) return erro(404, 'Caminho desconhecido.');
  if (evento.httpMethod === 'POST') {
    const h = evento.headers || {};
    if (texto(h['x-cliente'] || h['X-Cliente']) !== '1') return erro(403, 'Requisição recusada.');
  }
  try { return await fn(evento); }
  catch (err) {
    log(rota, err);
    return erro(502, MSG_FALHA);
  }
};

// Exposto só para os testes (tests/cliente-api.cjs).
exports._testes = { lerCookies, cookie, DIAS_MAXIMO, MSG_NEUTRA_EMAIL, MSG_CADASTRO_OK, MSG_RECUPERAR };
