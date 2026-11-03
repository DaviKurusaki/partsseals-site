/* Chegada por NF: fila de leituras para o rastreio nunca ultrapassar a NF. */
(function () {
  'use strict';
  window.criarTelaConferencia = function ({ api, sessao, mostrar, abrirLogin, ligado, aviso, esc }) {
    const $ = id => document.getElementById(id);
    const tela = $('telaDespachar');
    const { interpretarNf, rastreioCorreios } = window.DespachoCodigos;
    let notas = [], fila = Promise.resolve(), aguardando = 0, enviando = false;
    let fluxo = null, geracaoCamera = 0, leitorZxing = null, ultimoResultado = '';
    let geracaoSessao = 0, campoTimer;

    function desenhar() {
      $('despachoLista').innerHTML = notas.length ? notas.map(n => `<div class="despacho-nota">
        <div><b>NF ${esc(n.numero)}</b><span>${esc(n.cliente)}</span><small>${n.quantidade} itens · Pedidos ${esc(n.pedidos.join(', '))}</small></div>
        <button class="btn" type="button" data-remover-nf="${esc(n.id)}" aria-label="Remover NF ${esc(n.numero)}" ${aguardando ? 'disabled' : ''}>×</button></div>`).join('')
        : '<p class="despacho-vazio">Nenhuma NF nesta leva. Comece pelo código de barras da nota fiscal.</p>';
      $('despachoConta').textContent = `${notas.length} NFs · ${notas.reduce((s,n) => s+n.quantidade,0)} itens`;
      $('despachoClientes').hidden = new Set(notas.map(n => n.cliente)).size <= 1;
      $('despachoCameraRastreio').disabled = !notas.length || aguardando > 0;
      $('despachoCameraNf').disabled = aguardando > 0;
      $('despachoLimpar').disabled = !notas.length || aguardando > 0;
      $('despachoLer').disabled = enviando;
      $('despachoCodigo').disabled = enviando;
      $('despachoResultado').textContent = ultimoResultado;
      tela.setAttribute('aria-busy', String(aguardando > 0));
      $('despachoSituacao').textContent = enviando ? 'Confirmando chegada e aviso do grupo…' : aguardando ? 'Conferindo a nota no Fiscal…' : '';
    }
    function abrir({ historico = true } = {}) {
      if (!sessao()) { abrirLogin(); return; }
      if (!sessao().podeMarcar || !ligado()) { aviso('Confirmar entrega exige permissão e a dupla conferência pelo celular ligada no Kuru.'); return; }
      mostrar('telaDespachar', { historico });
      history.replaceState({ tela: 'telaDespachar' }, '');
      desenhar();
    }
    async function processar(valor, sessaoInicial) {
      if (!sessao()) { abrirLogin(); return; }
      if (sessao().sessao !== sessaoInicial) return;
      $('despachoErro').textContent = '';
      const rastreio = rastreioCorreios(valor);
      if (rastreio) {
        if (!notas.length) { $('despachoErro').textContent = 'Escaneie ao menos uma NF antes do rastreio.'; return; }
        enviando = true; desenhar();
        const r = await api('confirmar-entrega', { method: 'POST', body: JSON.stringify({ codigos: notas.map(n => n.codigo), rastreio }) });
        if (!sessao()) { abrirLogin(); return; }
        if (sessao().sessao !== sessaoInicial) return;
        if (!r.ok) {
          $('despachoErro').textContent = r.erro || 'Não foi possível confirmar. As notas foram mantidas: tente o mesmo rastreio novamente.';
          if (r.sessaoExpirada) abrirLogin();
          return;
        }
        ultimoResultado = r.itensEntregues
          ? `ENTREGUE: ${r.notasEntregues} NFs · ${r.itensEntregues} itens · ${r.rastreio}. Chegada registrada; aviso de entrega na fila do grupo. A saída no Kuru foi preservada.`
          : `Entrega já confirmada com ${r.rastreio}. Nenhuma entrega ou mensagem duplicada.`;
        notas = []; $('despachoCodigo').value = '';
        aviso('Entrega confirmada');
        return;
      }
      const codigo = interpretarNf(valor);
      if (!codigo) { $('despachoErro').textContent = 'Código inválido. Use a chave de acesso de 44 dígitos da NF ou o rastreio dos Correios.'; return; }
      if (notas.length >= 100) { $('despachoErro').textContent = 'Esta leva já tem 100 notas. Bipe o rastreio para finalizar.'; return; }
      const r = await api('conferencia/nota', { method: 'POST', body: JSON.stringify({ codigo: codigo.codigo }) });
      if (!sessao()) { abrirLogin(); return; }
      if (sessao().sessao !== sessaoInicial) return;
      if (!r.ok) {
        $('despachoErro').textContent = r.erro || 'Não foi possível conferir a NF. Tente novamente.';
        if (r.sessaoExpirada) abrirLogin();
        return;
      }
      if (notas.some(n => String(n.id) === String(r.nota.id))) { $('despachoErro').textContent = `NF ${r.nota.numero} já está na lista.`; return; }
      notas.push(r.nota); ultimoResultado = '';
      aviso(`NF ${r.nota.numero} adicionada`);
    }
    function lerCodigo(valor) {
      valor = String(valor || '').trim();
      if (!valor) return;
      clearTimeout(campoTimer);
      const geracao = geracaoSessao, sessaoInicial = sessao()?.sessao;
      aguardando++; desenhar();
      const executar = async () => {
        if (geracao !== geracaoSessao) return;
        try { await processar(valor, sessaoInicial); }
        catch { if (geracao === geracaoSessao) $('despachoErro').textContent = 'Sem resposta do servidor. Mantenha as notas e tente novamente com o mesmo rastreio.'; }
        finally {
          if (geracao === geracaoSessao) {
            aguardando--; enviando = false; desenhar();
            if (!tela.hidden && !document.hidden && !enviando) $('despachoCodigo').focus({ preventScroll: true });
          }
        }
      };
      fila = fila.then(executar, executar);
    }
    $('despachoForm').addEventListener('submit', ev => {
      ev.preventDefault(); const valor = $('despachoCodigo').value; $('despachoCodigo').value = ''; lerCodigo(valor);
    });
    $('despachoCodigo').addEventListener('input', () => {
      clearTimeout(campoTimer);
      const valor = $('despachoCodigo').value;
      if (rastreioCorreios(valor) || /^\d{44}$/.test(valor)) campoTimer = setTimeout(() => {
        $('despachoCodigo').value = ''; lerCodigo(valor);
      }, 160);
    });
    $('despachoLista').addEventListener('click', ev => {
      const b = ev.target.closest('[data-remover-nf]');
      if (b && !aguardando) { notas = notas.filter(n => String(n.id) !== b.dataset.removerNf); desenhar(); }
    });
    $('despachoLimpar').addEventListener('click', () => { if (!aguardando) { notas = []; desenhar(); } });

    function pararCamera() {
      geracaoCamera++;
      if (fluxo) fluxo.getTracks().forEach(t => t.stop());
      fluxo = null; $('despachoVideo').srcObject = null;
      $('despachoLeitor').hidden = true;
      leitorZxing?.reset(); leitorZxing = null;
    }
    async function camera(tipo) {
      if (aguardando || (tipo === 'rastreio' && !notas.length)) return;
      pararCamera(); const geracao = geracaoCamera;
      $('despachoLeitor').hidden = false;
      $('despachoTextoCamera').textContent = tipo === 'nf' ? 'Enquadre todo o código de barras da chave de acesso da NF.' : 'Escaneie o rastreio da saída para confirmar a chegada ao cliente.';
      history.pushState({ despachoLeitor: true }, '');
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' }, width: { ideal: 1920 }, height: { ideal: 1080 } }, audio: false });
        if (geracao !== geracaoCamera || document.hidden) { stream.getTracks().forEach(t => t.stop()); return; }
        fluxo = stream; const video = $('despachoVideo'); video.srcObject = stream; await video.play();
        if (geracao !== geracaoCamera) return;
        let detector;
        try {
          const formatos = await window.BarcodeDetector?.getSupportedFormats();
          if (formatos?.includes('code_128')) detector = new window.BarcodeDetector({ formats: ['code_128', 'code_39'].filter(f => formatos.includes(f)) });
        } catch { /* ZXing cobre navegadores sem leitor nativo. */ }
        if (!detector) {
          const Z = window.ZXing;
          leitorZxing = new Z.BrowserMultiFormatReader(new Map([[Z.DecodeHintType.POSSIBLE_FORMATS, [Z.BarcodeFormat.CODE_128, Z.BarcodeFormat.CODE_39]], [Z.DecodeHintType.TRY_HARDER, true]]));
        }
        async function quadro() {
          if (geracao !== geracaoCamera || document.hidden) return;
          try {
            const valores = detector ? (await detector.detect(video)).map(r => r.rawValue) : [leitorZxing.decode(video).getText()];
            for (const valor of valores) {
              if (geracao !== geracaoCamera) return;
              const valido = tipo === 'nf' ? interpretarNf(valor) : rastreioCorreios(valor);
              if (!valido) { $('despachoTextoCamera').textContent = tipo === 'nf' ? 'Use o código de barras da chave de acesso, não o boleto.' : 'Esse não é um rastreio dos Correios. Confira a etiqueta.'; continue; }
              pararCamera(); history.back(); lerCodigo(valor); return;
            }
          } catch { /* Uma imagem sem código ainda não é falha de câmera. */ }
          if (geracao === geracaoCamera) setTimeout(quadro, 200);
        }
        quadro();
      } catch {
        if (geracao !== geracaoCamera) return;
        if (fluxo) fluxo.getTracks().forEach(t => t.stop()); fluxo = null;
        $('despachoTextoCamera').textContent = 'Não foi possível abrir a câmera. Libere a câmera nas configurações do navegador ou volte e use o campo com leitor, digitação ou colagem.';
      }
    }
    $('despachoCameraNf').addEventListener('click', () => camera('nf'));
    $('despachoCameraRastreio').addEventListener('click', () => camera('rastreio'));
    $('despachoFecharCamera').addEventListener('click', () => { pararCamera(); history.back(); });
    window.addEventListener('popstate', () => { if (!$('despachoLeitor').hidden) pararCamera(); });
    document.addEventListener('visibilitychange', () => { if (document.hidden && !$('despachoLeitor').hidden) { pararCamera(); history.back(); } });
    window.addEventListener('pagehide', pararCamera);
    function limpar() {
      geracaoSessao++; aguardando = 0; enviando = false; notas = []; ultimoResultado = '';
      clearTimeout(campoTimer); pararCamera(); $('despachoCodigo').value = ''; $('despachoErro').textContent = ''; desenhar();
    }
    return { abrir, limpar, pararCamera, get ocupado() { return aguardando > 0; } };
  };
})();
