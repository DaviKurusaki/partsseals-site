'use strict';
const geo = require('./expedicao-geo.cjs');
const regras = require('./expedicao-rota.cjs');
const crypto = require('node:crypto');

function criarRotasApi(c) {
  const { db, lerSessao, ligado, ligadoBaixa, erro, responder, texto, chaveCliente } = c;
  const corpoDe = e => { try { const v = JSON.parse(e.body || '{}'); return v && typeof v === 'object' && !Array.isArray(v) ? v : {}; } catch { return {}; } };
  async function autorizacao(e, escrita = false) {
    const s = lerSessao(e);
    if (!s) return { resposta: erro(401, 'Entre com o seu PIN.', { sessaoExpirada: true }) };
    if (!(await ligado())) return { resposta: erro(403, 'A expedição pelo celular está desligada.', { desligado: true }) };
    if (escrita && !s.podeMarcar) return { resposta: erro(403, 'Seu usuário não tem a permissão Marcar expedição pelo celular.') };
    if (escrita && !(await ligadoBaixa())) return { resposta: erro(403, 'Marcar expedição pelo celular está desligado no Kuru.') };
    return { s };
  }
  async function rotaDoUsuario(id, usuario) {
    const { linhas } = await db.selecionar('expedicao_rotas', { filtros: [{ coluna: 'id', operador: 'igual', valor: id }, { coluna: 'usuario_id', operador: 'igual', valor: usuario }], limite: 1 });
    return linhas[0];
  }
  async function paradasDe(id) {
    const { linhas } = await db.selecionar('expedicao_rotas_paradas', { filtros: [{ coluna: 'rota_id', operador: 'igual', valor: id }], ordem: [{ coluna: 'ordem' }], limite: 150 });
    return linhas.sort((a, b) => a.ordem - b.ordem);
  }
  async function respostaRota(r) {
    const [paradas, { linhas: eventos }] = await Promise.all([paradasDe(r.id), db.selecionar('expedicao_rotas_eventos', { filtros: [{ coluna: 'rota_id', operador: 'igual', valor: r.id }], ordem: [{ coluna: 'criado_em' }], limite: 500 })]);
    return { id: r.id, status: r.status, criadoEm: r.criado_em, concluidaEm: r.concluida_em, empresaEndereco: r.empresa_endereco || regras.EMPRESA_ENDERECO,
      empresaLat: r.origem_lat, empresaLng: r.origem_lng, tempoTotalSeg: r.tempo_total_seg,
      paradas: paradas.map(p => ({ id: p.id, ordem: p.ordem, cliente: p.cliente, clienteChave: p.cliente_chave, destinoChave: p.destino_chave || regras.destinoChave(p.cliente), destinoCliente: p.destino_cliente || p.cliente,
        itens: p.itens || [], enderecoTexto: p.endereco_texto || '', latitude: p.latitude, longitude: p.longitude, status: p.status, chegouEm: p.chegou_em,
        entregueEm: p.entregue_em, divergencia: p.divergencia, checklistMarcado: p.checklist_marcado, entregaAutomatica: p.entrega_automatica,
        justificativa: p.justificativa, confirmadoPorLocalizacao: p.confirmado_por_localizacao, recebidoPor: p.recebido_por })),
      eventos: eventos.map(e => ({ id: e.id, tipo: e.tipo, mensagem: e.mensagem, criadoEm: e.criado_em, vistoEm: e.visto_em, whatsappEnviadoEm: e.whatsapp_enviado_em })) };
  }
  async function origemEmpresa() {
    const chave = { tipo: 'sistema', chave: 'expedicao_rota_empresa' };
    const { linhas } = await db.selecionar('pcp_ajustes', { filtros: Object.entries(chave).map(([coluna, valor]) => ({ coluna, operador: 'igual', valor })), limite: 1 });
    const valor = linhas[0]?.valor || regras.EMPRESA_LOCALIZACAO;
    if (typeof valor.latitude === 'number' && typeof valor.longitude === 'number') return valor;
    const ponto = await geo.geocodificar(valor.endereco || regras.EMPRESA_ENDERECO);
    if (!ponto) throw new Error('Não foi possível localizar a empresa. Confira o endereço ou informe latitude/longitude em expedicao_rota_empresa no Supabase.');
    const atualizado = { ...valor, endereco: valor.endereco || regras.EMPRESA_ENDERECO, ...ponto };
    await db.upsert('pcp_ajustes', { ...chave, valor: atualizado });
    return atualizado;
  }
  async function depoisDasBaixas(baixas) {
    let enfileirados = 0;
    for (const baixa of baixas) {
      if (c.filaExpedicaoCelular && await c.filaExpedicaoCelular.enfileirar(baixa).catch(() => false)) enfileirados++;
    }
    return enfileirados;
  }
  async function criar(e) {
    const auth = await autorizacao(e, true); if (auth.resposta) return auth.resposta;
    const { s } = auth, corpo = corpoDe(e);
    // Abas antigas não enviavam a chave. Sua seleção recebe uma identidade
    // estável no servidor; as novas abas enviam UUID persistido no carrinho.
    const operacao = texto(corpo.operacaoId) || crypto.createHash('sha256').update(JSON.stringify([s.id, (Array.isArray(corpo.itens) ? corpo.itens : []).map(i => `${i.numeroOp}||${i.codItem}`).sort()])).digest('hex');
    if (!/^[A-Za-z0-9-]{16,80}$/.test(operacao)) return erro(400, 'Identificador da saída inválido. Reabra a conferência.');
    const { linhas: anteriores } = await db.selecionar('expedicao_rotas', { filtros: [{ coluna: 'usuario_id', operador: 'igual', valor: s.id }, { coluna: 'operacao_id', operador: 'igual', valor: operacao }], limite: 1 });
    if (anteriores[0]) return responder(200, { ok: true, gravados: 0, repetida: true, rota: await respostaRota(anteriores[0]) });
    const itens = Array.isArray(corpo.itens) ? corpo.itens : [];
    if (!itens.length || itens.length > c.LIMITE_CARRINHO) return erro(400, `Informe de 1 a ${c.LIMITE_CARRINHO} itens.`);
    const pares = new Map();
    for (const i of itens) if (texto(i.numeroOp) && texto(i.codItem)) pares.set(`${texto(i.numeroOp)}||${texto(i.codItem)}`, { numeroOp: texto(i.numeroOp), codItem: texto(i.codItem) });
    if (!pares.size) return erro(400, 'Nenhum item válido pra marcar.');
    const { linhas } = await db.selecionar(c.TABELA_ORDENS, { filtros: [{ coluna: 'numero_op', operador: 'em', valor: [...new Set([...pares.values()].map(i => i.numeroOp))] }], limite: c.LIMITE_CARRINHO + 50 });
    const encontradas = linhas.filter(l => pares.has(`${texto(l.numero_op)}||${texto(l.cod_item)}`));
    const naoEncontrados = [...pares.values()].filter(i => !encontradas.some(l => texto(l.numero_op) === i.numeroOp && texto(l.cod_item) === i.codItem)).map(i => i.numeroOp);
    if (!encontradas.length) return responder(200, { ok: true, gravados: 0, jaDespachados: [], naoEncontrados, rota: null });
    if (naoEncontrados.length) return erro(400, 'Há itens que não estão mais no Banco de Ordens. Remova-os e confira novamente.', { naoEncontrados });
    const metodos = await c.metodosDeEntrega(encontradas);
    const metodoDe = l => c.chavesDeEntrega(l, c.dataIso(l.data_entrega)).map(k => metodos.get(k)).find(Boolean) || '';
    const estado = await c.expedicao.consultar({ numeroOp: encontradas[0]?.numero_op, pedido: encontradas[0]?.pedido, itens: encontradas.map(l => ({ numeroOp: l.numero_op, pedido: l.pedido, codigoItem: l.cod_item, descricao: l.descricao, metodoEntrega: metodoDe(l) })) });
    const jaDespachados = [], pendentes = [];
    encontradas.forEach((l, i) => { if (estado.porItem?.[i]?.concluida) jaDespachados.push(l.numero_op); else pendentes.push({ ...l, metodo_entrega: metodoDe(l) }); });
    if (!pendentes.length) return responder(200, { ok: true, gravados: 0, jaDespachados, naoEncontrados, rota: null });
    const grupos = c.montarGruposDeBaixa(pendentes, s.nome, { baixadoPor: s.nome });
    // Todo item escaneado aqui vira parada da rota, qualquer que seja o
    // método de entrega cadastrado no PCP (Correio/Azul Cargo/Cliente
    // Retira/Transportadora/Entregamos) — v0.2.721, corrigido depois de um
    // caso real do usuário: um cliente marcado "Cliente Retira" tinha sido
    // escaneado pra ENTREGA de verdade (o motorista levou na mão), e a
    // versão anterior (só "Entregamos" virava parada) deixava a entrega de
    // fora da rota sem avisar nada. O cadastro é só o PADRÃO; quem decide o
    // que aconteceu HOJE com ESTE pedido é a pessoa escaneando pra "Entrega"
    // — nunca mais uma leitura do método pra decidir se vira parada.
    const porCliente = new Map();
    for (const l of pendentes) {
      const chave = chaveCliente(l.cliente);
      if (!porCliente.has(chave)) porCliente.set(chave, { cliente: texto(l.cliente), cliente_chave: chave, destino_chave: regras.destinoChave(l.cliente), itens: [] });
      porCliente.get(chave).itens.push({ numeroOp: l.numero_op, codItem: l.cod_item, descricao: l.descricao, pedido: l.pedido, quantidade: l.qntd });
    }
    let plano;
    if (porCliente.size) {
      const { linhas: ativas } = await db.selecionar('expedicao_rotas', { filtros: [{ coluna: 'usuario_id', operador: 'igual', valor: s.id }, { coluna: 'status', operador: 'igual', valor: 'em_andamento' }], limite: 1 });
      if (ativas[0]) return erro(409, 'Conclua ou cancele a rota em andamento antes de iniciar outra viagem.', { rota: await respostaRota(ativas[0]) });
      try {
        if (!process.env.OPENROUTESERVICE_API_KEY) throw new Error('Configure OPENROUTESERVICE_API_KEY na Netlify para calcular a rota gratuita.');
        const origem = await origemEmpresa();
        const destinos = [...new Set([...porCliente.values()].map(p => p.destino_chave))];
        const { linhas: enderecos } = await db.selecionar('clientes_enderecos', { filtros: [{ coluna: 'cliente_chave', operador: 'em', valor: destinos }], limite: 150 });
        for (const destino of destinos) {
          const end = enderecos.find(x => x.cliente_chave === destino);
          if (!end || !geo.enderecoCompleto(end)) throw new Error(`Cadastre o endereço de ${[...porCliente.values()].find(p => p.destino_chave === destino).cliente}${destino === 'JSLSBO' ? ' (destino físico: JSL S.B.O)' : ''} antes de sair.`);
          if (!Number.isFinite(end.latitude) || !Number.isFinite(end.longitude)) {
            const ponto = await geo.geocodificarEndereco(end);
            if (!ponto) throw new Error(`Não foi possível localizar ${end.cliente}. Confira o endereço e suas coordenadas no cadastro.`);
            Object.assign(end, ponto);
            await db.atualizar('clientes_enderecos', { id: end.id }, { ...ponto, geocodificado_ok: true, geocodificado_em: new Date().toISOString() });
          }
        }
        const pontos = [origem, ...destinos.map(d => enderecos.find(x => x.cliente_chave === d))];
        const tempos = await regras.matrizTempos(pontos), circuito = regras.otimizarCircuito(tempos);
        const paradas = circuito.ordem.flatMap(i => [...porCliente.values()].filter(p => p.destino_chave === destinos[i - 1]).map(p => ({ ...p,
          destino_cliente: pontos[i].cliente, endereco_texto: geo.enderecoCompleto(pontos[i]), latitude: pontos[i].latitude, longitude: pontos[i].longitude })));
        plano = { paradas: paradas.map((p, i) => ({ ...p, ordem: i + 1 })), rota: { origem_lat: origem.latitude, origem_lng: origem.longitude, empresa_endereco: origem.endereco, tempo_total_seg: circuito.segundos, tempos, locais_ordem: destinos } };
      } catch (err) { return erro(503, err.message); }
    }
    const avisosLigados = c.prepararAvisosWhatsapp ? await c.prepararAvisosWhatsapp(grupos, pendentes) : false;
    let baixas, rota = null;
    if (plano) {
      const criado = await db.rpc('expedicao_rota_criar', { p_usuario_id: s.id, p_usuario_nome: s.nome, p_operacao_id: operacao, p_baixas: grupos, p_rota: plano.rota, p_paradas: plano.paradas });
      baixas = criado.baixas || [];
      rota = await respostaRota(await rotaDoUsuario(criado.rota_id, s.id));
    } else baixas = await db.inserir('expedicao_baixas', grupos);
    const enfileirados = await depoisDasBaixas(baixas);
    if (baixas.length) await db.inserir('audit_log', baixas.map(b => ({ usuario_id: s.id, usuario_nome: s.nome, modulo: 'expedicao-celular', acao: 'criar', tabela: 'expedicao_baixas', registro_id: String(b.id), depois: b, origem: 'site-expedicao' }))).catch(() => {});
    return responder(200, { ok: true, gravados: baixas.length ? pendentes.length : 0, grupos: baixas.length, jaDespachados, naoEncontrados, rota, modo: 'entrega', whatsapp: { habilitado: avisosLigados, enfileirados } });
  }
  async function atual(e) {
    const auth = await autorizacao(e); if (auth.resposta) return auth.resposta;
    let r;
    if (e.queryStringParameters?.id) r = await rotaDoUsuario(Number(e.queryStringParameters.id), auth.s.id);
    else {
      const { linhas } = await db.selecionar('expedicao_rotas', { filtros: [{ coluna: 'usuario_id', operador: 'igual', valor: auth.s.id }, { coluna: 'status', operador: 'igual', valor: 'em_andamento' }], ordem: [{ coluna: 'id', desc: true }], limite: 1 }); r = linhas[0];
    }
    return responder(200, { ok: true, rota: r ? await respostaRota(r) : null });
  }
  async function transicao(s, r, p, alteracoes, tipo, mensagem) {
    return db.rpc('expedicao_rota_transicao', { p_usuario_id: s.id, p_rota_id: r.id, p_parada_id: p.id, p_revisao: p.revisao || 0, p_alteracoes: alteracoes, p_tipo: tipo, p_mensagem: mensagem });
  }
  async function posicao(e) {
    const auth = await autorizacao(e, true); if (auth.resposta) return auth.resposta;
    const corpo = corpoDe(e), ponto = regras.posicao(corpo);
    const r = await rotaDoUsuario(Number(corpo.rotaId), auth.s.id);
    if (!r) return erro(404, 'Rota não encontrada.');
    if (r.status !== 'em_andamento') return responder(200, { ok: true, rota: await respostaRota(r) });
    const paradas = await paradasDe(r.id), cercas = regras.cercasNaPosicao(paradas, ponto);
    // Cercas sobrepostas exigem a escolha do motorista. A escolha pertence
    // a esta posição; não se reutiliza silenciosamente para o próximo local.
    const ambigua = cercas.length > 1 && !cercas.some(c => c.chave === corpo.cercaChave);
    const agora = Date.now();
    for (const p of paradas.filter(p => p.status !== 'entregue')) {
      const dentro = ponto && !ambigua && cercas.some(c => c.chave === (p.destino_chave || regras.destinoChave(p.cliente)) && (cercas.length <= 1 || c.chave === corpo.cercaChave));
      // Sem posição confiável, quebra a sequência; nunca infere saída.
      const leitura = corpo.reiniciarCerca === true ? { ...p, cerca_dentro: false, cerca_posicao_em: null, cerca_entrou_em: null, cerca_permanencia_ok: false } : p;
      const passo = regras.acompanharCerca(leitura, Boolean(dentro), agora);
      if (ponto && !ambigua && passo.autoEntregar) {
        const entregue = { ...p, status: 'entregue', entregue_em: new Date(agora).toISOString(), entrega_automatica: true, checklist_marcado: false, confirmado_por_localizacao: true, divergencia: null, justificativa: null, recebido_por: null };
        await transicao(auth.s, r, p, entregue, 'sem_checklist', regras.textoEntrega(entregue));
      } else {
        await db.atualizar('expedicao_rotas_paradas', { id: p.id, revisao: p.revisao || 0 }, { ...passo.alteracoes, ...(dentro && p.status === 'pendente' ? { status: 'chegou', chegou_em: new Date(agora).toISOString() } : {}) });
      }
    }
    return responder(200, { ok: true, localizacaoConfirmada: Boolean(ponto), precisaEscolherCerca: ambigua,
      cercas: cercas.map(c => ({ chave: c.chave, nome: c.nome })), rota: await respostaRota(await rotaDoUsuario(r.id, auth.s.id)) });
  }
  async function entregar(e) {
    const auth = await autorizacao(e, true); if (auth.resposta) return auth.resposta;
    const corpo = corpoDe(e), r = await rotaDoUsuario(Number(corpo.rotaId), auth.s.id);
    if (!r || r.status === 'cancelada') return erro(404, 'Rota indisponível.');
    const paradas = await paradasDe(r.id), p = paradas.find(p => p.id === Number(corpo.paradaId));
    if (!p) return erro(404, 'Parada não encontrada.');
    if (p.checklist_marcado) return responder(200, { ok: true, jaConfirmado: true, rota: await respostaRota(r) });
    // Quem recebeu é sempre pedido na confirmação MANUAL (v0.2.724) — nunca
    // na entrega automática da cerca (`posicao()`, acima: ninguém tocou em
    // nada naquele instante pra perguntar). O site já pede isso ANTES de
    // chamar esta rota; a validação aqui é só a rede de segurança de sempre.
    const recebidoPor = texto(corpo.recebidoPor);
    if (recebidoPor.length < 2 || recebidoPor.length > 120) {
      return erro(409, 'Informe o nome de quem recebeu a entrega.', { requerRecebidoPor: true });
    }
    const avaliacao = regras.avaliarEntrega(p, paradas, regras.posicao(corpo), corpo.cercaChave);
    if (avaliacao.precisaEscolherCerca) return erro(409, 'Escolha em qual endereço você está.', avaliacao);
    const justificativa = texto(corpo.justificativa);
    if ((avaliacao.requerConfirmacao && (corpo.confirmarDivergencia !== true || corpo.confirmarCercaChave !== avaliacao.cercaChave)) || (avaliacao.requerJustificativa && (justificativa.length < 5 || justificativa.length > 500))) {
      return erro(409, avaliacao.divergencia ? `Você está na cerca de ${avaliacao.divergencia}, mas marcou ${p.cliente}. Confira as sacolas antes de confirmar.` : 'Localização não confirmada. Informe uma justificativa para marcar a entrega.', avaliacao);
    }
    const entregue = { ...p, status: 'entregue', entregue_em: new Date().toISOString(), checklist_marcado: true, entrega_automatica: false,
      confirmado_por_localizacao: avaliacao.confirmadoPorLocalizacao, divergencia: avaliacao.divergencia, justificativa: avaliacao.requerJustificativa ? justificativa : null,
      recebido_por: recebidoPor };
    const resultado = await transicao(auth.s, r, p, entregue, avaliacao.divergencia ? 'divergencia' : 'entrega', regras.textoEntrega(entregue));
    if (!resultado.alterada) return erro(409, 'Esta entrega foi alterada durante a confirmação. Confira o estado atualizado e tente novamente.', { requerAtualizacao: true, rota: await respostaRota(await rotaDoUsuario(r.id, auth.s.id)) });
    return responder(200, { ok: true, rota: await respostaRota(await rotaDoUsuario(r.id, auth.s.id)) });
  }
  async function corrigir(e) {
    const auth = await autorizacao(e, true); if (auth.resposta) return auth.resposta;
    const corpo = corpoDe(e), r = await rotaDoUsuario(Number(corpo.rotaId), auth.s.id), justificativa = texto(corpo.justificativa);
    if (!r || r.status === 'cancelada') return erro(404, 'Rota indisponível.');
    if (justificativa.length < 5 || justificativa.length > 500) return erro(400, 'Explique a correção (de 5 a 500 caracteres).');
    const p = (await paradasDe(r.id)).find(p => p.id === Number(corpo.paradaId));
    if (!p || p.status !== 'entregue') return erro(409, 'Esta entrega já está pendente.');
    await transicao(auth.s, r, p, { status: 'pendente', entregue_em: null, checklist_marcado: false, entrega_automatica: false, confirmado_por_localizacao: false, divergencia: null, justificativa }, 'correcao', `⚠️ ${p.cliente} — ENTREGA CORRIGIDA, VOLTOU A PENDENTE\nJustificativa: ${justificativa}`);
    return responder(200, { ok: true, rota: await respostaRota(await rotaDoUsuario(r.id, auth.s.id)) });
  }
  async function reordenar(e) {
    const auth = await autorizacao(e, true); if (auth.resposta) return auth.resposta;
    const corpo = corpoDe(e), r = await rotaDoUsuario(Number(corpo.rotaId), auth.s.id);
    if (!r || r.status !== 'em_andamento') return erro(404, 'Rota indisponível.');
    const paradas = await paradasDe(r.id), ids = Array.isArray(corpo.paradaIds) ? corpo.paradaIds.map(Number) : [];
    if (ids.length !== paradas.length || new Set(ids).size !== ids.length || ids.some(id => !paradas.some(p => p.id === id))) return erro(400, 'Lista de paradas inválida.');
    const ordenadas = ids.map(id => paradas.find(p => p.id === id));
    const destinos = [...new Set(ordenadas.map(p => p.destino_chave || regras.destinoChave(p.cliente)))];
    if (ordenadas.some((p, i) => i > 0 && destinos.indexOf(p.destino_chave) < destinos.indexOf(ordenadas[i - 1].destino_chave))) return erro(400, 'Mantenha os clientes do mesmo endereço juntos.');
    const segundos = r.tempos && r.locais_ordem ? Math.round(regras.custoOrdem(destinos.map(d => r.locais_ordem.indexOf(d) + 1), r.tempos)) : null;
    await db.rpc('expedicao_rota_reordenar', { p_usuario_id: auth.s.id, p_rota_id: r.id, p_ids: ids, p_tempo: segundos, p_mensagem: `ROTA REORGANIZADA\n${destinos.map((d, i) => `${i + 1}. ${ordenadas.filter(p => (p.destino_chave || regras.destinoChave(p.cliente)) === d).map(p => p.cliente).join(' / ')}`).join('\n')}\nRetorno à empresa.` });
    return responder(200, { ok: true, rota: await respostaRota(await rotaDoUsuario(r.id, auth.s.id)) });
  }
  async function ciencia(e) {
    const auth = await autorizacao(e); if (auth.resposta) return auth.resposta;
    const corpo = corpoDe(e), r = await rotaDoUsuario(Number(corpo.rotaId), auth.s.id);
    if (!r) return erro(404, 'Rota não encontrada.');
    const ids = Array.isArray(corpo.eventoIds) ? corpo.eventoIds.slice(0, 500) : [];
    for (const id of ids) if (/^[a-f0-9-]{36}$/i.test(String(id))) await db.atualizar('expedicao_rotas_eventos', { id, rota_id: r.id }, { visto_em: new Date().toISOString() });
    return responder(200, { ok: true });
  }
  async function cancelar(e) {
    const auth = await autorizacao(e, true); if (auth.resposta) return auth.resposta;
    const r = await rotaDoUsuario(Number(corpoDe(e).rotaId), auth.s.id);
    if (!r) return erro(404, 'Rota não encontrada.');
    await db.atualizar('expedicao_rotas', { id: r.id }, { status: 'cancelada' });
    return responder(200, { ok: true });
  }
  return { criar, atual, posicao, entregar, corrigir, reordenar, ciencia, cancelar };
}
module.exports = { criarRotasApi };
