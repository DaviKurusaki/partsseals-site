'use strict';
/**
 * Testes da Área do Cliente (netlify/functions/cliente-api), sem Supabase
 * nem Netlify: Auth, RPCs permitidas e Storage simulados em memória.
 *
 *   node tests/cliente-api.cjs
 */

const assert = require('node:assert/strict');
const path = require('node:path');

let ok = 0;
const falhas = [];
async function teste(nome, fn) {
  try { await fn(); ok += 1; console.log('  ✓', nome); } catch (err) { falhas.push(nome); console.log('  ✗', nome, '\n   ', err.message); }
}

const ANON = 'chave-anon-teste', SERVICE = 'chave-service-teste';
const DOC_ID='11111111-1111-4111-8111-111111111111',PDF=Buffer.from('%PDF-1.4\nTESTE PRIVADO');
const DOC={id:DOC_ID,tipo:'pdf',numero:'10727',caminho:DOC_ID+'/pdf.pdf',tamanho:PDF.length,sha256:require('node:crypto').createHash('sha256').update(PDF).digest('hex')};
process.env.SUPABASE_URL = 'https://simulado.supabase.co';
process.env.SUPABASE_ANON_KEY = ANON;
process.env.SUPABASE_SERVICE_ROLE_KEY = SERVICE;

// --- Supabase simulado ----------------------------------------------------------

let seq = 0;
const novoId = () => `00000000-0000-4000-8000-${String(++seq).padStart(12, '0')}`;
const estado = {};
function zerar() {
  Object.assign(estado, {
    usuarios: new Map(), acessos: new Map(), renovacoes: new Map(), cadastros: new Map(),
    chamadas: [], falharRegistrar: null, recuperacoes: [], pedidosChamados: [],
    documentoCorrompido:false,documentosChamados:[],
  });
}
const emitirTokens = (userId, { expirado = false } = {}) => {
  const at = `at-${novoId()}`, rt = `rt-${novoId()}`;
  estado.acessos.set(at, { userId, expirado });
  estado.renovacoes.set(rt, userId);
  return { access_token: at, refresh_token: rt, expires_in: 3600, user: publico(estado.usuarios.get(userId)) };
};
const publico = (u) => ({ id: u.id, email: u.email, identities: [{ id: u.id }], created_at: u.criado });
const json = (status, corpo) => new Response(corpo === undefined ? null : JSON.stringify(corpo), { status, headers: { 'Content-Type': 'application/json' } });
const usuarioPorEmail = (email) => [...estado.usuarios.values()].find((u) => u.email === email);

global.fetch = async (url, opcoes = {}) => {
  const u = new URL(url), metodo = opcoes.method || 'GET', h = opcoes.headers || {};
  const corpo = opcoes.body ? JSON.parse(opcoes.body) : null;
  estado.chamadas.push({ caminho: u.pathname, metodo, apikey: h.apikey, auth: h.Authorization });
  const bearer = String(h.Authorization || '').replace(/^Bearer /, '');
  if(u.pathname.startsWith('/storage/v1/object/')) {
    assert.equal(h.apikey,SERVICE);
    assert.equal(u.pathname,'/storage/v1/object/site-notas-clientes/'+DOC.caminho);
    return new Response(estado.documentoCorrompido?Buffer.from('ADULTERADO'):PDF);
  }

  if (u.pathname === '/auth/v1/signup') {
    const existente = usuarioPorEmail(corpo.email);
    if (existente?.confirmado) return json(200, { id: novoId(), email: corpo.email, identities: [] });
    if (existente) return json(200, publico(existente));
    const user = { id: novoId(), email: corpo.email, senha: corpo.password, confirmado: false, criado: new Date().toISOString() };
    estado.usuarios.set(user.id, user);
    return json(200, publico(user));
  }
  if (u.pathname === '/auth/v1/token') {
    if (u.searchParams.get('grant_type') === 'password') {
      const user = usuarioPorEmail(corpo.email);
      if (!user || user.senha !== corpo.password) return json(400, { error_code: 'invalid_credentials', msg: 'Invalid login credentials' });
      if (!user.confirmado) return json(400, { error_code: 'email_not_confirmed', msg: 'Email not confirmed' });
      return json(200, emitirTokens(user.id));
    }
    const userId = estado.renovacoes.get(corpo.refresh_token);
    if (!userId) return json(400, { error_code: 'refresh_token_not_found', msg: 'Invalid Refresh Token' });
    estado.renovacoes.delete(corpo.refresh_token);
    return json(200, emitirTokens(userId));
  }
  if (u.pathname === '/auth/v1/user') {
    const t = estado.acessos.get(bearer);
    if (!t || t.expirado) return json(401, { error_code: 'bad_jwt', msg: 'invalid JWT' });
    if (metodo === 'PUT') { estado.usuarios.get(t.userId).senha = corpo.password; return json(200, publico(estado.usuarios.get(t.userId))); }
    return json(200, publico(estado.usuarios.get(t.userId)));
  }
  if (u.pathname === '/auth/v1/logout') { estado.acessos.delete(bearer); return json(204); }
  if (u.pathname === '/auth/v1/recover') { estado.recuperacoes.push(corpo.email); return json(200, {}); }
  if (u.pathname.startsWith('/auth/v1/admin/users/')) {
    const id = u.pathname.split('/').at(-1);
    if (!estado.usuarios.delete(id)) return json(404, { msg: 'User not found' });
    return json(200, {});
  }
  if (u.pathname.startsWith('/rest/v1/rpc/')) {
    if (h.apikey !== SERVICE) return json(401, { code: '42501', message: 'permission denied' });
    const nome = u.pathname.split('/').at(-1);
    if(nome==='site_cliente_documentos' || nome==='site_cliente_documento') {
      estado.documentosChamados.push(corpo);
      const permitido=estado.cadastros.get(corpo.p_auth_user_id)?.status==='aprovado';
      return json(200,nome==='site_cliente_documentos' ? (permitido && corpo.p_empresa_id==='1'?[DOC]:[]) : (permitido && corpo.p_id===DOC_ID?DOC:null));
    }
    if (nome === 'site_cliente_buscar_empresa') return json(200, [{ nome: 'ACME', razao_social: 'ACME LTDA', cnpj: '11222333000181', email: 'nao-devolver@example.com' }]);
    if (nome === 'site_cliente_registrar') {
      if (estado.falharRegistrar) return json(400, { code: estado.falharRegistrar, message: 'falha simulada' });
      if ([...estado.cadastros.values()].some((c) => c.email === corpo.p_email)) return json(409, { code: '23505', message: 'Este e-mail já está cadastrado.' });
      if (!estado.usuarios.has(corpo.p_auth_user_id)) return json(409, { code: '23503', message: 'fk' });
      if (estado.cadastros.has(corpo.p_auth_user_id)) return json(409, { code: '23505', message: 'Este login já tem um cadastro.' });
      estado.cadastros.set(corpo.p_auth_user_id, { status: 'pendente', email: corpo.p_email, nome: corpo.p_nome_completo, empresa: corpo.p_empresa, parametros: corpo });
      return json(200, { id: 'x', status: 'pendente' });
    }
    if (nome === 'site_cliente_meu_cadastro') {
      const c = estado.cadastros.get(corpo.p_auth_user_id);
      return json(200, c ? { nome: c.nome, status: c.status, empresa: c.empresa, cliente_kuru_id: c.status === 'aprovado' ? 1 : null } : null);
    }
    if (nome === 'site_cliente_registrar_acesso') { const c = estado.cadastros.get(corpo.p_auth_user_id); if (c) c.acessos = (c.acessos || 0) + 1; return json(200); }
    if (nome === 'site_cliente_meus_pedidos') {
      estado.pedidosChamados.push(corpo);
      const c = estado.cadastros.get(corpo.p_auth_user_id);
      if (c?.status !== 'aprovado') return json(200, { pedidos: [], empresas: [] });
      return json(200, { pedidos: [{ pedido: '30001', empresa_id: 1, empresa: 'ACME', etapa: 'em_producao', itens: [] }],
        empresas: [{ id: 1, nome: 'ACME', cnpj: '11222333000181' }, { id: 2, nome: 'BETA' }] });
    }
    return json(404, { code: 'PGRST202', message: 'função inexistente' });
  }
  throw new Error(`chamada inesperada: ${metodo} ${u.pathname}`);
};

const api = require(path.join(__dirname, '../netlify/functions/cliente-api/index.js'));
const servico = require(path.join(__dirname, '../netlify/functions/cliente-api/supabase-servico.cjs'));

// --- navegador simulado (cookie jar) ------------------------------------------------

function navegador() {
  const jar = new Map();
  return {
    jar,
    async chamar(metodo, rota, { corpo, query, cabecalhos = {} } = {}) {
      const r = await api.handler({
        path: `/cliente/api/${rota}`, httpMethod: metodo, queryStringParameters: query || {},
        headers: { cookie: [...jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; '), ...(metodo === 'POST' ? { 'x-cliente': '1' } : {}), ...cabecalhos },
        body: corpo === undefined ? undefined : JSON.stringify(corpo),
      });
      for (const c of r.multiValueHeaders?.['Set-Cookie'] || []) {
        const [par, ...attrs] = c.split(';');
        const [k, ...v] = par.split('=');
        assert.match(c, /HttpOnly/); assert.match(c, /Secure/); assert.match(c, /SameSite=Lax/); assert.match(c, /Path=\/cliente/);
        if (attrs.some((a) => a.trim() === 'Max-Age=0')) jar.delete(k); else jar.set(k, decodeURIComponent(v.join('=')));
      }
      return { status: r.statusCode, corpo: r.isBase64Encoded ? Buffer.from(r.body,'base64') : JSON.parse(r.body), headers: r.headers };
    },
  };
}

const CNPJ = '11.222.333/0001-81';
const valido = (extra = {}) => ({ nome: 'Maria da Silva', nascimento: '1990-05-10', email: 'maria@acme.com.br', whatsapp: '(11) 98888-7777',
  empresa: 'Acme', cnpj: CNPJ, cargo: 'Compras', senha: 'senhaforte1', confirmacao: 'senhaforte1', lgpd: true, comunicacoes: true, tempo: 8000, site: '', ...extra });
const confirmar = (email) => { usuarioPorEmail(email).confirmado = true; };
const definirStatus = (email, status) => { estado.cadastros.get(usuarioPorEmail(email).id).status = status; };
async function entrarComo(email) { const b = navegador(); const r = await b.chamar('POST', 'entrar', { corpo: { email, senha: 'senhaforte1' } }); assert.equal(r.status, 200); return b; }

(async () => {
  console.log('Área do Cliente — API');

  await teste('busca de empresa antes do login devolve somente nome e CNPJ', async () => {
    zerar();
    const r = await navegador().chamar('GET', 'empresas', { query: { nome: 'ACME' } });
    assert.equal(r.status, 200);
    assert.deepEqual(r.corpo.empresas, [{ nome: 'ACME', razao_social: 'ACME LTDA', cnpj: '11222333000181' }]);
    assert.equal((await navegador().chamar('GET', 'empresas', { query: { cnpj: CNPJ } })).status, 200);
    assert.equal((await navegador().chamar('GET', 'empresas', { query: { nome: 'a' } })).status, 400);
    assert.equal((await navegador().chamar('GET', 'empresas', { query: { cnpj: '123' } })).status, 400);
  });

  await teste('cadastro válido cria login e cadastro pendente, com só dígitos e aceite LGPD', async () => {
    zerar();
    const r = await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    assert.equal(r.status, 200); assert.equal(r.corpo.mensagem, api._testes.MSG_CADASTRO_OK);
    const c = [...estado.cadastros.values()][0];
    assert.equal(c.parametros.p_cnpj, '11222333000181'); assert.equal(c.parametros.p_whatsapp, '11988887777');
    assert.equal(c.parametros.p_consentimento_lgpd, true); assert.equal(c.parametros.p_aceita_comunicacoes, true);
    assert.equal(c.status, 'pendente');
  });

  await teste('inválidos: CNPJ, idade, e-mail, sem LGPD, nome de uma palavra, senha curta e confirmação diferente', async () => {
    zerar();
    const b = navegador();
    const casos = [[{ cnpj: '11.222.333/0001-80' }, 'cnpj'], [{ nascimento: '2015-01-01' }, 'nascimento'], [{ nascimento: '1900-01-01' }, 'nascimento'],
      [{ nascimento: '1990-02-31' }, 'nascimento'], [{ email: 'maria@' }, 'email'], [{ lgpd: false }, 'lgpd'], [{ nome: 'Maria' }, 'nome'],
      [{ senha: '1234567', confirmacao: '1234567' }, 'senha'], [{ confirmacao: 'outra' }, 'confirmacao'], [{ whatsapp: '98888-7777' }, 'whatsapp']];
    for (const [extra, campo] of casos) {
      const r = await b.chamar('POST', 'cadastro', { corpo: valido(extra) });
      assert.equal(r.status, 400, campo); assert.ok(r.corpo.erros[campo], `erro em ${campo}`);
    }
    assert.equal(estado.usuarios.size, 0); assert.equal(estado.cadastros.size, 0);
  });

  await teste('honeypot e envio rápido demais não criam nada', async () => {
    zerar();
    const b = navegador();
    assert.equal((await b.chamar('POST', 'cadastro', { corpo: valido({ site: 'http://spam' }) })).status, 200);
    assert.equal((await b.chamar('POST', 'cadastro', { corpo: valido({ tempo: 500 }) })).status, 400);
    assert.equal(estado.usuarios.size, 0);
  });

  await teste('e-mail repetido devolve a mensagem neutra e não deixa login órfão nem apaga a conta existente', async () => {
    zerar();
    const b = navegador();
    await b.chamar('POST', 'cadastro', { corpo: valido() });
    const r1 = await b.chamar('POST', 'cadastro', { corpo: valido() }); // ainda não confirmado: Auth devolve o mesmo usuário
    assert.equal(r1.corpo.mensagem, api._testes.MSG_NEUTRA_EMAIL);
    assert.equal(estado.usuarios.size, 1); assert.equal(estado.cadastros.size, 1);
    confirmar('maria@acme.com.br');
    const r2 = await b.chamar('POST', 'cadastro', { corpo: valido() }); // confirmado: usuário falso
    assert.equal(r2.corpo.mensagem, api._testes.MSG_NEUTRA_EMAIL);
    assert.equal(estado.usuarios.size, 1); assert.equal(estado.cadastros.size, 1);
    assert.ok(!estado.chamadas.some((c) => c.caminho.startsWith('/auth/v1/admin/')), 'nunca apagou ninguém');
    // E-mail no banco do site, mas login novo no Auth (23505): o login novo é apagado.
    estado.cadastros.set('fantasma', { email: 'novo@acme.com.br', status: 'pendente' });
    const r3 = await b.chamar('POST', 'cadastro', { corpo: valido({ email: 'novo@acme.com.br' }) });
    assert.equal(r3.corpo.mensagem, api._testes.MSG_NEUTRA_EMAIL);
    assert.ok(!usuarioPorEmail('novo@acme.com.br'), 'login órfão apagado');
  });

  await teste('registrar falhou → o login criado no Auth é apagado', async () => {
    zerar(); estado.falharRegistrar = 'XX000';
    const r = await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    assert.equal(r.status, 502); assert.equal(estado.usuarios.size, 0);
    zerar(); estado.falharRegistrar = '22023';
    const r2 = await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    assert.equal(r2.status, 400); assert.equal(estado.usuarios.size, 0);
  });

  await teste('e-mail não confirmado não entra; senha errada dá mensagem neutra', async () => {
    zerar();
    const b = navegador();
    await b.chamar('POST', 'cadastro', { corpo: valido() });
    const r = await b.chamar('POST', 'entrar', { corpo: { email: 'maria@acme.com.br', senha: 'senhaforte1' } });
    assert.equal(r.status, 403); assert.ok(r.corpo.naoConfirmado);
    confirmar('maria@acme.com.br');
    const r2 = await b.chamar('POST', 'entrar', { corpo: { email: 'maria@acme.com.br', senha: 'errada123' } });
    assert.equal(r2.status, 401); assert.equal(r2.corpo.erro, 'E-mail ou senha incorretos.');
    assert.equal(b.jar.size, 0);
  });

  for (const status of ['pendente', 'recusado', 'bloqueado']) {
    await teste(`${status}: /eu devolve o status e nenhum pedido`, async () => {
      zerar();
      await navegador().chamar('POST', 'cadastro', { corpo: valido() });
      confirmar('maria@acme.com.br'); definirStatus('maria@acme.com.br', status);
      const b = await entrarComo('maria@acme.com.br');
      const eu = await b.chamar('GET', 'eu');
      assert.equal(eu.corpo.cadastro.status, status); assert.equal(eu.corpo.cadastro.primeiroNome, 'Maria');
      assert.ok(!('cliente_kuru_id' in eu.corpo.cadastro));
      const p = await b.chamar('GET', 'pedidos');
      assert.deepEqual(p.corpo.pedidos, []);
    });
  }

  await teste('aprovado: pedidos com o id do TOKEN, mesmo mandando outro id na query e no corpo', async () => {
    zerar();
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    confirmar('maria@acme.com.br'); definirStatus('maria@acme.com.br', 'aprovado');
    const b = await entrarComo('maria@acme.com.br');
    const p = await b.chamar('GET', 'pedidos', { query: { dias: '90', p_auth_user_id: 'outro-id', auth_user_id: 'outro-id' } });
    assert.equal(p.corpo.pedidos.length, 1);
    assert.equal(p.corpo.pedidos[0].empresa, 'ACME');
    assert.deepEqual(p.corpo.empresas, [{ id: 1, nome: 'ACME' }, { id: 2, nome: 'BETA' }], 'empresas liberadas só com id e nome');
    assert.equal(estado.pedidosChamados.at(-1).p_auth_user_id, usuarioPorEmail('maria@acme.com.br').id);
    assert.equal(estado.pedidosChamados.at(-1).p_dias, 90);
  });

  await teste('Central Técnica: página servida só para sessão aprovada', async () => {
    zerar();
    const pagina = async b => api.handler({ path: '/cliente/central', httpMethod: 'GET',
      headers: { cookie: b ? [...b.jar].map(([k, v]) => `${k}=${encodeURIComponent(v)}`).join('; ') : '' } });
    assert.equal((await pagina()).statusCode, 302);
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    confirmar('maria@acme.com.br');
    const b = await entrarComo('maria@acme.com.br');
    assert.equal((await pagina(b)).statusCode, 403);
    definirStatus('maria@acme.com.br', 'aprovado');
    const r = await pagina(b);
    assert.equal(r.statusCode, 200);
    assert.match(r.body, /Central Técnica/);
    assert.match(r.headers['Cache-Control'], /no-store/);
    assert(!r.body.includes('maria@acme.com.br'));
  });

  await teste('p_dias acima de 730 é limitado; inválido usa 180', async () => {
    zerar();
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    confirmar('maria@acme.com.br'); definirStatus('maria@acme.com.br', 'aprovado');
    const b = await entrarComo('maria@acme.com.br');
    assert.equal((await b.chamar('GET', 'pedidos', { query: { dias: '5000' } })).corpo.dias, 730);
    assert.equal(estado.pedidosChamados.at(-1).p_dias, 730);
    assert.equal((await b.chamar('GET', 'pedidos', { query: { dias: 'abc' } })).corpo.dias, 180);
    assert.equal((await b.chamar('GET', 'pedidos', { query: { dias: '-3' } })).corpo.dias, 1);
  });

  await teste('cookie inválido ou vencido sem refresh = 401 e cookies limpos', async () => {
    zerar();
    const b = navegador();
    b.jar.set('ps_cli_at', 'token-falso');
    const r = await b.chamar('GET', 'eu');
    assert.equal(r.status, 401); assert.ok(r.corpo.sessaoExpirada); assert.equal(b.jar.size, 0);
    assert.equal((await navegador().chamar('GET', 'pedidos')).status, 401);
  });

  await teste('vencido com refresh válido renova sozinho e regrava os cookies', async () => {
    zerar();
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    confirmar('maria@acme.com.br'); definirStatus('maria@acme.com.br', 'aprovado');
    const b = await entrarComo('maria@acme.com.br');
    const antigo = b.jar.get('ps_cli_at');
    estado.acessos.get(antigo).expirado = true;
    const r = await b.chamar('GET', 'pedidos');
    assert.equal(r.status, 200); assert.equal(r.corpo.pedidos.length, 1);
    assert.notEqual(b.jar.get('ps_cli_at'), antigo, 'access_token novo gravado');
    assert.ok(estado.renovacoes.has(b.jar.get('ps_cli_rt')), 'refresh_token novo gravado');
  });

  await teste('último acesso: no máximo uma gravação por hora', async () => {
    zerar();
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    confirmar('maria@acme.com.br');
    const b = await entrarComo('maria@acme.com.br');
    await b.chamar('GET', 'eu'); await b.chamar('GET', 'eu'); await b.chamar('GET', 'eu');
    assert.equal(estado.cadastros.get(usuarioPorEmail('maria@acme.com.br').id).acessos, 1);
  });

  await teste('esqueci a senha: resposta igual exista ou não o e-mail', async () => {
    zerar();
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    const a = await navegador().chamar('POST', 'esqueci-senha', { corpo: { email: 'maria@acme.com.br' } });
    const n = await navegador().chamar('POST', 'esqueci-senha', { corpo: { email: 'ninguem@x.com' } });
    const i = await navegador().chamar('POST', 'esqueci-senha', { corpo: { email: 'lixo' } });
    assert.deepEqual(a.corpo, n.corpo); assert.deepEqual(a.corpo, i.corpo); assert.equal(a.status, n.status);
  });

  await teste('nova senha com o token do link; token inválido avisa que expirou', async () => {
    zerar();
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    confirmar('maria@acme.com.br');
    const tok = emitirTokens(usuarioPorEmail('maria@acme.com.br').id).access_token;
    const r = await navegador().chamar('POST', 'nova-senha', { corpo: { token: tok, senha: 'outrasenha9' } });
    assert.equal(r.status, 200); assert.equal(usuarioPorEmail('maria@acme.com.br').senha, 'outrasenha9');
    const r2 = await navegador().chamar('POST', 'nova-senha', { corpo: { token: 'vencido', senha: 'outrasenha9' } });
    assert.equal(r2.status, 400); assert.match(r2.corpo.erro, /expirou/);
  });

  await teste('sair encerra no Auth e limpa os cookies', async () => {
    zerar();
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    confirmar('maria@acme.com.br');
    const b = await entrarComo('maria@acme.com.br');
    await b.chamar('POST', 'sair');
    assert.equal(b.jar.size, 0); assert.equal((await b.chamar('GET', 'eu')).status, 401);
  });

  await teste('POST sem o cabeçalho X-Cliente é recusado (CSRF)', async () => {
    zerar();
    const r = await api.handler({ path: '/cliente/api/entrar', httpMethod: 'POST', headers: {}, body: '{}' });
    assert.equal(r.statusCode, 403);
  });

  await teste('a service_role só chama operações permitidas; o Auth usa a anon', async () => {
    const permitidos = /^\/rest\/v1\/rpc\/site_cliente_(registrar|meu_cadastro|registrar_acesso|meus_pedidos|buscar_empresa|documentos|documento)$|^\/auth\/v1\/admin\/users\//;
    // Junta as chamadas de um fluxo inteiro, incluindo órfão apagado.
    zerar(); estado.falharRegistrar = 'XX000';
    await navegador().chamar('POST', 'cadastro', { corpo: valido() });
    const todas = [...estado.chamadas];
    zerar();
    await navegador().chamar('POST', 'cadastro', { corpo: valido() }); confirmar('maria@acme.com.br'); definirStatus('maria@acme.com.br', 'aprovado');
    const b = await entrarComo('maria@acme.com.br');
    await b.chamar('GET', 'eu'); await b.chamar('GET', 'pedidos'); await b.chamar('POST', 'esqueci-senha', { corpo: { email: 'maria@acme.com.br' } }); await b.chamar('POST', 'sair');
    todas.push(...estado.chamadas);
    assert.ok(todas.some((c) => c.caminho.startsWith('/auth/v1/admin/')), 'o fluxo testou a exclusão de órfão');
    for (const c of todas) {
      if (c.apikey === SERVICE || String(c.auth).includes(SERVICE)) assert.match(c.caminho, permitidos, `service_role em ${c.caminho}`);
      if (c.caminho.startsWith('/auth/v1/') && !c.caminho.startsWith('/auth/v1/admin/')) assert.equal(c.apikey, ANON, `Auth sem anon em ${c.caminho}`);
    }
    await assert.rejects(servico.rpc('app_login', {}), /não permitida/);
    await assert.rejects(servico.rpc('site_kuru_listar', {}), /não permitida/);
  });

  await teste('documentos exigem sessão; empresa e usuário são conferidos antes de buscar o arquivo', async () => {
    zerar();const anon=navegador();
    assert.equal((await anon.chamar('GET','documentos',{query:{empresa:'1',nf:'10727'}})).status,401);
    assert.equal((await anon.chamar('GET','arquivo',{query:{id:DOC_ID}})).status,401);
    await anon.chamar('POST','cadastro',{corpo:valido()});confirmar('maria@acme.com.br');
    const b=await entrarComo('maria@acme.com.br');
    assert.equal((await b.chamar('GET','arquivo',{query:{id:DOC_ID}})).status,404);
    assert(!estado.chamadas.some(c=>c.caminho.startsWith('/storage/')));
    definirStatus('maria@acme.com.br','aprovado');
    const lista=await b.chamar('GET','documentos',{query:{empresa:'1',nf:'10727',auth_user_id:'injetado'}});
    assert.deepEqual(lista.corpo.documentos,[{id:DOC_ID,tipo:'pdf',numero:'10727'}]);
    assert.equal(estado.documentosChamados.at(-1).p_auth_user_id,usuarioPorEmail('maria@acme.com.br').id);
    assert.equal((await b.chamar('GET','documentos',{query:{empresa:'2',nf:'10727'}})).corpo.documentos.length,0);
    assert.equal((await b.chamar('GET','arquivo',{query:{id:'../../qualquer'}})).status,404);
    const arquivo=await b.chamar('GET','arquivo',{query:{id:DOC_ID}});
    assert.deepEqual(arquivo.corpo,PDF);assert.equal(arquivo.headers['Content-Type'],'application/pdf');
    assert.equal(arquivo.headers['Cache-Control'],'private, no-store');assert.match(arquivo.headers['Content-Disposition'],/inline; filename="pdf-NF-10727.pdf"/);
    definirStatus('maria@acme.com.br','bloqueado');
    const antes=estado.chamadas.filter(c=>c.caminho.startsWith('/storage/')).length;
    assert.equal((await b.chamar('GET','arquivo',{query:{id:DOC_ID}})).status,404);
    assert.equal(estado.chamadas.filter(c=>c.caminho.startsWith('/storage/')).length,antes);
  });
  await teste('download com hash divergente é recusado, sem devolver bytes ao cliente', async () => {
    zerar();await navegador().chamar('POST','cadastro',{corpo:valido()});confirmar('maria@acme.com.br');definirStatus('maria@acme.com.br','aprovado');
    const b=await entrarComo('maria@acme.com.br');estado.documentoCorrompido=true;
    const r=await b.chamar('GET','arquivo',{query:{id:DOC_ID}});
    assert.equal(r.status,502);assert(!Buffer.isBuffer(r.corpo));
    await assert.rejects(servico.baixarDocumento({...DOC,caminho:'../../outro-bucket'}),/inválido/);
  });

  await teste('a expedição não importa nem lê a service_role', async () => {
    const fs = require('node:fs');
    const pasta = path.join(__dirname, '../netlify/functions/expedicao-api');
    for (const f of fs.readdirSync(pasta)) {
      const src = fs.readFileSync(path.join(pasta, f), 'utf8');
      assert.ok(!/SERVICE_ROLE|supabase-servico/.test(src), `${f} não pode usar a service_role`);
    }
  });

  await teste('respostas da API são no-store e noindex', async () => {
    zerar();
    const r = await navegador().chamar('GET', 'eu');
    assert.equal(r.headers['Cache-Control'], 'no-store'); assert.match(r.headers['X-Robots-Tag'], /noindex/);
  });

  console.log(`\n${ok} ok, ${falhas.length} falha(s).`);
  if (falhas.length) process.exit(1);
})();
