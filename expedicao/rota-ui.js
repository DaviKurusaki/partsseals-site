'use strict';
// Interface de entrega usada também pelo portal /expedicao do site principal.
window.criarTelaEntrega = function(c) {
  const { $, esc, ico, api, mostrar, mostrarInicio, aviso, vibrar, ajustarFaixa, confirmarEstilizado } = c;
  let rota = null, timer = null, pingando = false, ocupada = false, dialogAtivo = null, alertando = false;
  let cercaEscolhida = '', cercaOpcoes = '', ultimaPosicao = null;
  let visibilidadeRev = 0, visibilidadeRegistrada = 0;
  const vistos = new Set();
  const cienciaPendente = new Set();
  let registrandoCiencia = false;
  const linkMaps = p => `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(Number.isFinite(p.latitude) && Number.isFinite(p.longitude) ? `${p.latitude},${p.longitude}` : p.enderecoTexto || p.empresaEndereco)}&travelmode=driving`;
  function obterPosicao() {
    return new Promise(resolve => {
      if (!navigator.geolocation || document.hidden) return resolve(null);
      navigator.geolocation.getCurrentPosition(p => resolve({ lat: p.coords.latitude, lng: p.coords.longitude, precisao: p.coords.accuracy }), () => resolve(null), { enableHighAccuracy: true, timeout: 6000, maximumAge: 0 });
    });
  }
  function grupos() {
    const m = new Map();
    for (const p of rota.paradas) { if (!m.has(p.destinoChave)) m.set(p.destinoChave, { chave: p.destinoChave, nome: p.destinoCliente, paradas: [] }); m.get(p.destinoChave).paradas.push(p); }
    return [...m.values()];
  }
  function formulario({ titulo, texto, conteudo = '', justificar = false, confirmar = 'Confirmar', obrigatorio = false }) {
    return new Promise(resolve => {
      const dialog = document.createElement('dialog'); dialog.className = 'entrega-dialogo';
      if (obrigatorio) dialog.setAttribute('role', 'alertdialog');
      dialog.setAttribute('aria-labelledby', 'entregaDialogoTitulo');
      dialog.innerHTML = `<form><h2 id="entregaDialogoTitulo">${esc(titulo)}</h2><p>${esc(texto)}</p>${conteudo}
        ${justificar ? '<label for="entregaJustificativa">Justificativa</label><textarea id="entregaJustificativa" name="justificativa" required minlength="5" maxlength="500" rows="3" placeholder="Explique o que aconteceu"></textarea>' : ''}
        <p class="erro-dialogo" role="alert"></p><div class="modal-botoes"><button class="btn forte" id="entregaDialogoConfirmar" type="submit">${esc(confirmar)}</button>
        ${obrigatorio ? '' : '<button class="btn" type="button" id="entregaDialogoCancelar">Cancelar</button>'}</div></form>`;
      document.body.append(dialog); dialogAtivo = dialog;
      const concluir = valor => { dialog.close(); dialog.remove(); dialogAtivo = null; resolve(valor); };
      dialog.querySelector('form').addEventListener('submit', ev => { ev.preventDefault(); concluir(Object.fromEntries(new FormData(ev.target))); });
      dialog.querySelector('#entregaDialogoCancelar')?.addEventListener('click', () => concluir(null));
      dialog.addEventListener('cancel', ev => { ev.preventDefault(); if (!obrigatorio) concluir(null); });
      dialog.showModal(); dialog.querySelector('textarea, input, button')?.focus();
    });
  }
  function desenhar() {
    if (!rota) return;
    const entregues = rota.paradas.filter(p => p.status === 'entregue').length;
    const locais = grupos();
    $('telaRota').innerHTML = `<div class="boas-vindas" data-hero><small>Minha entrega</small><h1>${entregues} de ${rota.paradas.length} clientes entregues</h1></div>
      <div class="nota"><span>Saída e retorno: <b>${esc(rota.empresaEndereco)}</b><br>${Number.isFinite(rota.tempoTotalSeg) ? `Percurso estimado: ${Math.ceil(rota.tempoTotalSeg / 60)} min, incluindo a volta.` : ''}</span></div>
      <p class="ajuda-rota">Mantenha esta página visível, com internet e localização permitida. Ao usar o Maps, volte ao site para acompanhar a cerca e confirmar a entrega.</p>
      <div id="rotaBanner" role="status"></div>
      ${rota.status === 'concluida' ? '<div class="nota lida"><span>Entregas concluídas. Os registros sem checklist continuam destacados abaixo.</span></div>' : ''}
      <div class="lista">${locais.map((g, i) => `<article class="cartao parada-rota"><div class="item-cabeca"><div><div class="rotulo">PARADA ${i + 1}</div><h2>${esc(g.nome)}</h2><p>${esc(g.paradas[0].enderecoTexto)}</p></div></div>
        ${g.paradas.map(p => `<div class="entrega-cliente"><b>${esc(p.cliente)}</b><p>${p.itens.map(i => `${esc(i.numeroOp)} · ${esc(i.descricao || '')}`).join('<br>')}</p>
          <button class="btn ${p.checklistMarcado ? 'check-marcado' : 'forte'}" type="button" role="checkbox" aria-checked="${Boolean(p.checklistMarcado)}" data-entregar="${p.id}" ${p.checklistMarcado ? 'disabled' : ''}>${ico('check')}${p.checklistMarcado ? 'Checklist marcado' : 'Conferi e entreguei'}</button>
          ${p.status === 'entregue' ? `<p class="${p.entregaAutomatica || p.divergencia ? 'entrega-aviso' : ''}">${p.entregaAutomatica ? 'Entregue automaticamente, sem checklist' : p.divergencia ? `Confirmado na cerca de ${esc(p.divergencia)} — confira as sacolas` : p.confirmadoPorLocalizacao ? `Entregue na cerca de ${esc(p.destinoCliente)}` : 'Entregue — localização não confirmada'}</p><button class="btn" type="button" data-corrigir="${p.id}">Corrigir entrega</button>` : ''}
          ${p.justificativa ? `<p>Justificativa: ${esc(p.justificativa)}</p>` : ''}</div>`).join('')}
        <a class="btn" href="${esc(linkMaps(g.paradas[0]))}" target="_blank" rel="noopener">${ico('mapa')}Abrir destino no Google Maps</a></article>`).join('')}</div>
      <div class="cartao parada-rota"><h2>Retorno à empresa</h2><p>${esc(rota.empresaEndereco)}</p><a class="btn" href="${esc(linkMaps({ latitude: rota.empresaLat, longitude: rota.empresaLng, empresaEndereco: rota.empresaEndereco }))}" target="_blank" rel="noopener">${ico('mapa')}Voltar pelo Google Maps</a></div>
      <p class="ajuda-rota">Tempos estimados por openrouteservice · © colaboradores do OpenStreetMap.</p>
      ${rota.status === 'em_andamento' ? '<button class="btn" id="btnReordenarRota" type="button">Reorganizar paradas</button>' : ''}
      <details class="historico-entrega"><summary>Histórico de avisos (${(rota.eventos || []).length})</summary>${(rota.eventos || []).map(e => `<div><time>${esc(new Date(e.criadoEm).toLocaleString('pt-BR'))}</time><p>${esc(e.mensagem).replace(/\n/g, '<br>')}</p><small>${e.whatsappEnviadoEm ? 'Enviado ao grupo' : 'Aguardando envio pelo Kuru'}</small></div>`).join('') || '<p>Nenhum aviso ainda.</p>'}</details>
      ${rota.status === 'em_andamento' ? '<button class="btn" id="btnCancelarRota" type="button">Cancelar acompanhamento</button>' : ''}
      <button class="btn" id="btnInicioRota" type="button">Voltar ao início</button>`;
    $('telaRota').querySelectorAll('[data-entregar]').forEach(b => b.addEventListener('click', () => entregar(Number(b.dataset.entregar))));
    $('telaRota').querySelectorAll('[data-corrigir]').forEach(b => b.addEventListener('click', () => corrigir(Number(b.dataset.corrigir))));
    $('btnReordenarRota')?.addEventListener('click', reordenar);
    $('btnCancelarRota')?.addEventListener('click', cancelar);
    $('btnInicioRota').addEventListener('click', () => mostrarInicio({ historico: false }));
    ajustarFaixa();
  }
  async function avisarEventos() {
    if (alertando || dialogAtivo || !rota || !$('sobreposicao').hidden || document.hidden) return;
    alertando = true;
    try {
      const eventos = (rota.eventos || []).filter(e => !e.vistoEm && !vistos.has(e.id));
      if (!eventos.length) return;
      vibrar([100, 60, 100]);
      await formulario({ titulo: 'Avisos da entrega', texto: eventos.map(e => e.mensagem).join('\n\n'), confirmar: 'Entendi', obrigatorio: true });
      eventos.forEach(e => { vistos.add(e.id); cienciaPendente.add(e.id); });
    } finally { alertando = false; registrarCiencia(); }
  }
  async function registrarCiencia() {
    if (registrandoCiencia || !rota || !cienciaPendente.size) return;
    registrandoCiencia = true;
    const ids = [...cienciaPendente];
    try {
      const r = await api('rotas/ciencia', { method: 'POST', body: JSON.stringify({ rotaId: rota.id, eventoIds: ids }) }).catch(() => null);
      if (r?.ok) ids.forEach(id => cienciaPendente.delete(id));
    } finally { registrandoCiencia = false; }
  }
  function aplicar(nova) {
    if (!nova) return;
    rota = nova;
    try { sessionStorage.setItem('kuru-ultima-rota', String(rota.id)); } catch {}
    desenhar();
    if (rota.status === 'em_andamento') iniciar(); else parar();
    avisarEventos();
  }
  function abrir(nova, { historico = true } = {}) { rota = nova; mostrar('telaRota', { historico }); aplicar(nova); }
  function parar() { if (timer) clearInterval(timer); timer = null; }
  function iniciar() { if (!timer) { timer = setInterval(ping, 15000); setTimeout(ping, 0); } }
  async function ping() {
    if (pingando || ocupada || !rota || document.hidden) return;
    pingando = true;
    try {
      registrarCiencia();
      if (rota.status !== 'em_andamento') { await avisarEventos(); return; }
      const revisaoVisibilidade = visibilidadeRev;
      ultimaPosicao = await obterPosicao();
      const r = await api('rotas/posicao', { method: 'POST', body: JSON.stringify({ rotaId: rota.id, ...(ultimaPosicao || {}), cercaChave: cercaEscolhida, reiniciarCerca: revisaoVisibilidade > visibilidadeRegistrada }) }).catch(() => null);
      if (!r?.ok) { if ($('rotaBanner')) $('rotaBanner').textContent = r?.erro || 'Sem comunicação. Confira a internet para acompanhar as cercas.'; return; }
      visibilidadeRegistrada = Math.max(visibilidadeRegistrada, revisaoVisibilidade);
      aplicar(r.rota);
      const banner = $('rotaBanner');
      if (banner) banner.innerHTML = !r.localizacaoConfirmada ? '<div class="banner-rota atraso">Localização não confirmada. Ative o GPS e permita a localização precisa.</div>' : r.cercas?.length ? `<div class="banner-rota ok">Na cerca de ${r.cercas.map(c => esc(c.nome)).join(' / ')}. Confira os clientes antes de marcar.</div>` : '';
      if (r.precisaEscolherCerca && !dialogAtivo && !alertando) {
        const chaveOpcoes = r.cercas.map(c => c.chave).sort().join('|');
        if (cercaOpcoes !== chaveOpcoes || !cercaEscolhida) {
          cercaOpcoes = chaveOpcoes;
          const dados = await formulario({ titulo: 'Endereços próximos', texto: 'Escolha em qual endereço você está.', conteudo: r.cercas.map(c => `<label class="opcao-cerca"><input type="radio" name="cercaChave" value="${esc(c.chave)}" required> ${esc(c.nome)}</label>`).join('') });
          cercaEscolhida = dados?.cercaChave || '';
        }
      } else if (!r.cercas?.some(c => c.chave === cercaEscolhida)) { cercaEscolhida = ''; cercaOpcoes = ''; }
    } finally { pingando = false; }
  }
  async function retomar({ historico = false } = {}) {
    let r = await api('rotas/atual').catch(() => null);
    if (!r?.ok) return false;
    if (!r.rota) {
      let id; try { id = sessionStorage.getItem('kuru-ultima-rota'); } catch {}
      if (id) r = await api('rotas/atual?id=' + encodeURIComponent(id)).catch(() => null);
    }
    if (!r?.ok || !r.rota || r.rota.status === 'cancelada') return false;
    abrir(r.rota, { historico }); return true;
  }
  async function entregar(paradaId) {
    if (ocupada || dialogAtivo || alertando) return;
    ocupada = true;
    try {
      let detalhes = { cercaChave: cercaEscolhida };
      for (let tentativa = 0; tentativa < 5; tentativa++) {
        const pos = await obterPosicao();
        const r = await api('rotas/entregar', { method: 'POST', body: JSON.stringify({ rotaId: rota.id, paradaId, ...(pos || {}), ...detalhes }) }).catch(() => null);
        if (r?.ok) { aplicar(r.rota); vibrar(30); return; }
        if (r?.requerAtualizacao) { aplicar(r.rota); aviso(r.erro); return; }
        if (r?.status !== 409) { aviso(r?.erro || 'Não foi possível confirmar. Confira a internet.'); return; }
        const dados = await formulario({ titulo: r.precisaEscolherCerca ? 'Escolha o endereço' : r.requerConfirmacao ? 'Possível cliente errado' : 'Localização não confirmada', texto: r.erro,
          conteudo: r.precisaEscolherCerca ? r.cercas.map(c => `<label class="opcao-cerca"><input type="radio" name="cercaChave" value="${esc(c.chave)}" required> ${esc(c.nome)}</label>`).join('') : '',
          justificar: Boolean(r.requerJustificativa), confirmar: r.requerConfirmacao ? 'Confirmar mesmo assim' : 'Confirmar' });
        if (!dados) return;
        detalhes = { ...detalhes, ...dados, confirmarDivergencia: Boolean(r.requerConfirmacao), confirmarCercaChave: r.cercaChave };
      }
      aviso('A localização mudou durante a confirmação. Confira e tente novamente.');
    } finally { ocupada = false; avisarEventos(); }
  }
  async function corrigir(paradaId) {
    if (ocupada || dialogAtivo || alertando) return;
    ocupada = true;
    try {
      const dados = await formulario({ titulo: 'Corrigir entrega', texto: 'A entrega voltará a pendente. A correção e sua justificativa serão avisadas no grupo.', justificar: true, confirmar: 'Corrigir e deixar pendente' });
      if (!dados) return;
      const r = await api('rotas/corrigir', { method: 'POST', body: JSON.stringify({ rotaId: rota.id, paradaId, ...dados }) }).catch(() => null);
      if (r?.ok) aplicar(r.rota); else aviso(r?.erro || 'Não foi possível corrigir.');
    } finally { ocupada = false; avisarEventos(); }
  }
  async function reordenar() {
    if (ocupada || dialogAtivo || alertando) return;
    ocupada = true;
    try {
      const ordem = grupos();
      const promessa = formulario({ titulo: 'Reorganizar paradas', texto: 'Use as setas para mudar a sequência. Os clientes do mesmo endereço ficam juntos. A alteração será avisada no grupo.', conteudo: '<div id="ordemEntrega"></div>', confirmar: 'Salvar ordem' });
      const renderizar = () => {
        $('ordemEntrega').innerHTML = ordem.map((g, i) => `<div class="ordem-linha"><span>${i + 1}. ${esc(g.paradas.map(p => p.cliente).join(' / '))}</span><button type="button" class="btn" data-mover="${i}" data-direcao="-1" aria-label="Subir parada" ${i === 0 ? 'disabled' : ''}>↑</button><button type="button" class="btn" data-mover="${i}" data-direcao="1" aria-label="Descer parada" ${i === ordem.length - 1 ? 'disabled' : ''}>↓</button></div>`).join('');
      };
      $('ordemEntrega').addEventListener('click', e => { const b = e.target.closest('[data-mover]'); if (!b) return; const i = Number(b.dataset.mover), j = i + Number(b.dataset.direcao); [ordem[i], ordem[j]] = [ordem[j], ordem[i]]; renderizar(); });
      renderizar();
      if (!await promessa) return;
      const r = await api('rotas/reordenar', { method: 'POST', body: JSON.stringify({ rotaId: rota.id, paradaIds: ordem.flatMap(g => g.paradas.map(p => p.id)) }) }).catch(() => null);
      if (r?.ok) aplicar(r.rota); else aviso(r?.erro || 'Não foi possível reorganizar.');
    } finally { ocupada = false; avisarEventos(); }
  }
  async function cancelar() {
    if (ocupada || dialogAtivo || alertando) return;
    const ok = await confirmarEstilizado({ titulo: 'Cancelar acompanhamento?', texto: 'As baixas de saída continuam registradas. Esta ação encerra o acompanhamento da viagem.', textoConfirmar: 'Cancelar acompanhamento', perigo: true });
    if (!ok) return;
    const r = await api('rotas/cancelar', { method: 'POST', body: JSON.stringify({ rotaId: rota.id }) }).catch(() => null);
    if (!r?.ok) { aviso(r?.erro || 'Não foi possível cancelar.'); return; }
    encerrar(); mostrarInicio({ historico: false });
  }
  function encerrar() { parar(); rota = null; cercaEscolhida = ''; cercaOpcoes = ''; vistos.clear(); cienciaPendente.clear(); if (dialogAtivo) { dialogAtivo.close(); dialogAtivo.remove(); dialogAtivo = null; } }
  document.addEventListener('visibilitychange', () => { if (document.hidden) visibilidadeRev++; else ping(); });
  window.addEventListener('online', ping);
  return { abrir, retomar, parar, encerrar, obterPosicao, get atual() { return rota; } };
};
