'use strict';
/**
 * ÚNICO lugar do site que usa a chave service_role.
 *
 * Essa chave ignora todas as regras do banco. Por isso este módulo só sabe
 * fazer duas coisas, e nada mais:
 *   1. chamar as 4 funções da Área do Cliente (lista fixa abaixo);
 *   2. apagar um usuário do Supabase Auth que ficou órfão num cadastro que
 *      falhou no meio (admin API).
 * Qualquer outro nome de função é recusado antes de sair da Netlify. A
 * expedição (expedicao-api) nunca importa este arquivo e segue com a anon.
 *
 * Variáveis (Netlify, contexto Functions): SUPABASE_URL e
 * SUPABASE_SERVICE_ROLE_KEY.
 */

const FUNCOES_PERMITIDAS = Object.freeze([
  'site_cliente_registrar',
  'site_cliente_meu_cadastro',
  'site_cliente_registrar_acesso',
  'site_cliente_meus_pedidos',
]);

class ErroServico extends Error {
  constructor(mensagem, { codigo = null, status = null } = {}) { super(mensagem); this.codigo = codigo; this.status = status; }
}

const url = () => String(process.env.SUPABASE_URL || '').replace(/\/+$/, '');
const chave = () => process.env.SUPABASE_SERVICE_ROLE_KEY || '';
const configurado = () => Boolean(url() && chave());

function cabecalhos() {
  return { apikey: chave(), Authorization: `Bearer ${chave()}`, 'Content-Type': 'application/json' };
}

async function lerJson(resposta) {
  const texto = await resposta.text();
  if (!texto) return null;
  try { return JSON.parse(texto); } catch { return null; }
}

/** Chama uma das 4 funções permitidas. Devolve o JSON da função. */
async function rpc(nome, parametros = {}) {
  if (!FUNCOES_PERMITIDAS.includes(nome)) throw new ErroServico(`Função não permitida: ${nome}`, { codigo: 'FUNCAO_NAO_PERMITIDA' });
  if (!configurado()) throw new ErroServico('Serviço do banco não configurado.', { codigo: 'SEM_CONFIG' });
  const resposta = await fetch(`${url()}/rest/v1/rpc/${nome}`, {
    method: 'POST', headers: cabecalhos(), body: JSON.stringify(parametros),
  });
  const json = await lerJson(resposta);
  if (!resposta.ok) throw new ErroServico(json?.message || `Banco respondeu ${resposta.status}`, { codigo: json?.code || null, status: resposta.status });
  return json;
}

/** Apaga um usuário do Auth (só para órfão de cadastro que falhou). 404 = já não existe. */
async function apagarUsuario(id) {
  if (!/^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(String(id || ''))) {
    throw new ErroServico('Usuário inválido.', { codigo: 'ID_INVALIDO' });
  }
  if (!configurado()) throw new ErroServico('Serviço do banco não configurado.', { codigo: 'SEM_CONFIG' });
  const resposta = await fetch(`${url()}/auth/v1/admin/users/${id}`, { method: 'DELETE', headers: cabecalhos() });
  if (!resposta.ok && resposta.status !== 404) throw new ErroServico(`Auth respondeu ${resposta.status}`, { status: resposta.status });
  return true;
}

module.exports = { rpc, apagarUsuario, configurado, FUNCOES_PERMITIDAS, ErroServico };
