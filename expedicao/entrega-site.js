/* O portal confirma a chegada. Toda saída continua no Acabamento do Kuru. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const esc = v => String(v ?? '').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const chaveSessao = 'kuru-expedicao-sessao';
  let memoria = null, destino = 'conferencia', ligado = false, confirmarLigado = false;
  let pin = '', entrando = false, telaAtual = 'telaInicio', controlador;
  let historico = [], pagina = 0, token = '', camera = null, leitorGeracao = 0;
  let filaEtiquetas=Promise.resolve(), leiturasPendentes=0, geracaoEtiquetas=0;
  const data = valor => valor ? new Date(valor).toLocaleString('pt-BR',{timeZone:'America/Sao_Paulo',dateStyle:'short',timeStyle:'short'}) : 'Não confirmada';
  function sessao() {
    if (memoria?.expira > Date.now()) return memoria;
    try { const s = JSON.parse(localStorage.getItem(chaveSessao)); return s?.expira > Date.now() ? s : null; } catch { return null; }
  }
  function aviso(texto) { $('aviso').textContent=texto;$('aviso').classList.add('ver');clearTimeout(aviso.timer);aviso.timer=setTimeout(()=>$('aviso').classList.remove('ver'),3500); }
  async function api(caminho,opcoes={}) {
    try {
      const base=location.pathname.startsWith('/expedicao')?'/expedicao/api/':'/api/';
      const r = await fetch(base+caminho,{...opcoes,headers:{'Content-Type':'application/json',...(sessao()?{Authorization:'Bearer '+sessao().sessao}:{}),...opcoes.headers}});
      return await r.json();
    } catch { return {ok:false,erro:'Sem resposta do servidor. Confira a conexão e tente novamente.'}; }
  }
  function ajustarFaixa() {
    const hero = $(telaAtual)?.querySelector('[data-hero]');
    if (!hero) return;
    let topo=0;for(let el=hero;el;el=el.offsetParent)topo+=el.offsetTop;
    document.body.style.setProperty('--altura-faixa',`${Math.round(topo+hero.offsetHeight+42)}px`);
  }
  function mostrar(id,{historico:empilhar=true}={}) {
    document.querySelectorAll('main > .tela').forEach(t=>t.hidden=t.id!==id);
    const s=sessao();$('usuario').hidden=!s||id==='telaInicio';
    if(s){$('nomeUsuario').textContent=s.nome.split(/\s+/)[0];$('avatar').textContent=s.nome.split(/\s+/).slice(0,2).map(p=>p[0]).join('').toUpperCase();}
    if(empilhar&&id!==telaAtual)history.pushState({tela:id},'');
    telaAtual=id;window.scrollTo({top:0});requestAnimationFrame(ajustarFaixa);
  }
  function inicio(){pararQr();mostrar('telaInicio',{historico:false});history.replaceState({tela:'telaInicio'},'');$('saudacao').textContent='Bem-vindo';}
  function bloqueioInterno(texto){$('internoBloqueioTexto').textContent=texto||'';$('internoBloqueio').hidden=!texto;}
  function semPermissao(ferramenta){
    const s=sessao();if(s&&s.podeMarcar&&ligado&&confirmarLigado)return false;
    bloqueioInterno(!ligado||!confirmarLigado?ferramenta+' está desligado no Kuru (Tabula > Etiquetas > Expedição).'
      :ferramenta+': o usuário '+s.nome+' não tem a permissão para confirmar entrega pelo celular. Se ela acabou de ser liberada no Kuru, toque em Entrar com outro PIN.');
    interno({historico:false});return true;
  }
  function interno({historico=true}={}){pararQr();mostrar('telaInterno',{historico});if(!historico)history.replaceState({tela:'telaInterno'},'');}
  function abrirLogin(){pin='';$('erroLogin').textContent='';desenharPin();mostrar('telaLogin');}
  function desenharPin(){ $('pontos').innerHTML=Array.from({length:Math.max(4,pin.length)},(_,i)=>`<i class="${i<pin.length?'cheio':''}"></i>`).join('');$('pinLeitor').textContent=pin.length+' dígitos'; }
  function tecla(t){if(entrando)return;if(t==='entrar'){entrar();return;}if(t==='apagar')pin=pin.slice(0,-1);else if(pin.length<8)pin+=t;desenharPin();}
  async function entrar(){
    if(pin.length<3||entrando)return;entrando=true;$('erroLogin').textContent='Conferindo PIN…';
    const r=await api('login',{method:'POST',body:JSON.stringify({pin})});entrando=false;
    if(!r.ok){pin='';desenharPin();$('erroLogin').textContent=r.erro;return;}
    controlador.limpar();limparMarcacao();memoria={sessao:r.sessao,nome:r.nome,expira:r.expira,podeMarcar:Boolean(r.podeMarcar)};
    try{localStorage.setItem(chaveSessao,JSON.stringify(memoria));}catch{}
    abrirDestino();
  }
  function abrirDestino(){if(!sessao()){abrirLogin();return;}bloqueioInterno('');if(destino==='conferencia'){if(!semPermissao('Marcar Despache Correio'))controlador.abrir();}else if(destino==='historico')abrirHistorico();else if(!semPermissao('Marcar Entrega'))abrirConsulta();}
  async function abrirHistorico(mais=false){
    mostrar('telaHistorico');if(!mais){historico=[];pagina=0;}$('historicoErro').textContent='Carregando…';
    const r=await api('entregas?offset='+pagina);
    if(!r.ok){$('historicoErro').textContent=r.erro;if(r.sessaoExpirada)abrirLogin();return;}
    historico.push(...r.entregas);pagina+=r.entregas.length;$('historicoErro').textContent='';$('historicoMais').hidden=!r.mais;
    const grupos=new Map();
    for(const item of historico){const k=[item.conferencia_id,item.nf_id,item.rastreio].join('|');if(!grupos.has(k))grupos.set(k,{...item,itens:[]});grupos.get(k).itens.push(item);}
    $('historicoLista').innerHTML=[...grupos.values()].map(g=>`<article class="cartao despacho-bloco"><strong>ENTREGUE · ${g.numero_nf?'NF '+esc(g.numero_nf):g.etiqueta_tipo==='pedido'?'Pedido '+esc(g.pedido):'OP '+esc(g.numero_op)}</strong><span>${esc(g.cliente)}</span>${g.rastreio?`<span>Rastreio ${esc(g.rastreio)}</span>`:''}<span>${g.itens.length} itens · ${esc(g.motorista_nome)}</span><small>${esc(data(g.entregue_em))}</small><p>Saída no Kuru: ${esc(g.data_saida||'data não informada')}</p></article>`).join('')||'<div class="cartao">Nenhuma chegada conferida ainda. Os despachos antigos não viram entregas automaticamente.</div>';
  }
  function extrairToken(valor){
    valor=String(valor||'').trim();if(/^[A-Za-z0-9]{6,20}$/.test(valor))return valor;
    try{const u=new URL(valor,location.origin);if(u.host===location.host||['parts-seals.com.br','www.parts-seals.com.br','parts-seals-expedicao.netlify.app'].includes(u.hostname))return (u.pathname.match(/\/e\/([A-Za-z0-9]{6,20})(?:\/|$)/)||[])[1]||'';}catch{}
    return '';
  }
  async function abrirConsulta(){
    mostrar('telaConsulta');$('consultaErro').textContent='';
    if(token){$('consultaCodigo').value=token;await carregarEtiqueta(token);}
  }
  async function carregarEtiqueta(codigo){
    const identidade=sessao()?.sessao;
    const r=await api('consulta?t='+encodeURIComponent(codigo));
    if(sessao()?.sessao!==identidade)return;
    if(!r.ok){$('consultaErro').textContent=r.erro;if(r.sessaoExpirada)abrirLogin();return;}
    $('consultaErro').textContent='';
    $('consultaResultado').innerHTML=`<div class="cartao despacho-bloco"><h2>${esc(r.cliente)}</h2><p>Pedido ${esc(r.pedido)} · NF ${esc(r.nf||'não informada')}</p><p>Rastreio ${esc(r.rastreio||'não informado')}</p></div>`+r.itens.map(i=>`<article class="cartao despacho-bloco"><strong>${esc(i.numeroOp)} · ${esc(i.descricao)}</strong><span>Saída da fábrica: ${i.despachado?'registrada no Kuru':'ainda não registrada'}</span><span>Chegada ao cliente: <b>${i.entregaConfirmada?'ENTREGUE':'aguardando dupla conferência'}</b></span>${i.entregaConfirmada?`<small>${esc(data(i.entregueEm))} · ${esc(i.motoristaEntrega)}</small>`:''}</article>`).join('');
  }
  function limparMarcacao(){geracaoEtiquetas++;leiturasPendentes=0;$('consultaCodigo').value='';$('consultaMarcacao').textContent='';$('consultaErro').textContent='';$('consultaCamera').disabled=false;}
  function marcarEtiqueta(codigo){
    if(!sessao()){destino='consulta';abrirLogin();return;}
    const geracao=geracaoEtiquetas,identidade=sessao().sessao;
    leiturasPendentes++;$('consultaCamera').disabled=true;
    const executar=async()=>{
      if(geracao!==geracaoEtiquetas)return;
      try{
        if(sessao()?.sessao!==identidade){if(!sessao())abrirLogin();return;}
        $('consultaMarcacao').textContent='';$('consultaResultado').innerHTML='';
        $('consultaErro').textContent='Marcando chegada ao cliente…';
        const r=await api('marcar-entrega-etiqueta',{method:'POST',body:JSON.stringify({token:codigo})});
        if(geracao!==geracaoEtiquetas||sessao()?.sessao!==identidade)return;
        if(!r.ok){$('consultaErro').textContent=r.erro;$('consultaCodigo').value=codigo;if(r.sessaoExpirada)abrirLogin();return;}
        token=codigo;$('consultaErro').textContent='';
        $('consultaMarcacao').textContent=r.itensEntregues
          ? `ENTREGUE · ${r.itensEntregues} ${r.itensEntregues===1?'item marcado':'itens marcados'} na chegada ao cliente.${r.semSaida?` ${r.semSaida} itens ainda sem saída ficaram de fora.`:''} Aviso registrado para o grupo de Expedição.`
          : r.semSaida ? `Os itens com saída desta etiqueta já estão entregues. ${r.semSaida} itens ainda sem saída ficaram de fora.` : 'Esta etiqueta já está marcada como entregue. A primeira confirmação foi preservada.';
        aviso(r.itensEntregues?'Entrega marcada':'Entrega já confirmada');
        await carregarEtiqueta(codigo);
      }finally{if(geracao===geracaoEtiquetas){leiturasPendentes--;$('consultaCamera').disabled=leiturasPendentes>0;}}
    };
    filaEtiquetas=filaEtiquetas.then(executar,executar);return filaEtiquetas;
  }
  function pararQr(){leitorGeracao++;if(camera)camera.getTracks().forEach(t=>t.stop());camera=null;$('qrVideo').srcObject=null;$('qrLeitor').hidden=true;}
  async function lerQr(){
    pararQr();const geracao=leitorGeracao;$('qrLeitor').hidden=false;$('qrTexto').textContent='Aponte para o QR da etiqueta para marcar a entrega.';history.pushState({qr:true},'');
    try{
      const stream=await navigator.mediaDevices.getUserMedia({video:{facingMode:{ideal:'environment'}},audio:false});
      if(geracao!==leitorGeracao||document.hidden){stream.getTracks().forEach(t=>t.stop());return;}
      camera=stream;const video=$('qrVideo');video.srcObject=stream;await video.play();
      const canvas=document.createElement('canvas');
      async function quadro(){
        if(geracao!==leitorGeracao)return;
        if(video.readyState>=2&&video.videoWidth){
          const escala=Math.min(1,900/video.videoWidth);canvas.width=video.videoWidth*escala;canvas.height=video.videoHeight*escala;
          const ctx=canvas.getContext('2d',{willReadFrequently:true});ctx.drawImage(video,0,0,canvas.width,canvas.height);
          const imagem=ctx.getImageData(0,0,canvas.width,canvas.height);const qr=window.jsQR(imagem.data,imagem.width,imagem.height);
          const lido=qr&&extrairToken(qr.data);
          if(lido){pararQr();history.back();marcarEtiqueta(lido);return;}
        }
        setTimeout(quadro,200);
      }quadro();
    }catch{if(geracao===leitorGeracao){if(camera)camera.getTracks().forEach(t=>t.stop());camera=null;$('qrVideo').srcObject=null;$('qrTexto').textContent='Libere a câmera ou volte para digitar ou colar o código da etiqueta.';}}
  }
  $('btnExpedir').onclick=()=>{destino='conferencia';abrirDestino();};
  $('btnInterno').onclick=()=>{bloqueioInterno('');interno();};$('internoVoltar').onclick=inicio;
  $('btnHistorico').onclick=()=>{destino='historico';abrirDestino();};
  $('btnConsulta').onclick=()=>{destino='consulta';abrirDestino();};
  $('despachoVoltar').onclick=$('historicoVoltar').onclick=$('consultaVoltar').onclick=()=>interno({historico:false});$('btnLogo').onclick=inicio;
  $('btnVoltar').onclick=()=>interno({historico:false});$('historicoMais').onclick=()=>abrirHistorico(true);
  $('consultaForm').onsubmit=ev=>{ev.preventDefault();const lido=extrairToken($('consultaCodigo').value);if(!lido){$('consultaErro').textContent='Informe o código ou o link do QR da etiqueta.';return;}$('consultaCodigo').value='';marcarEtiqueta(lido);};
  $('consultaCamera').onclick=lerQr;$('qrFechar').onclick=()=>{pararQr();history.back();};
  $('internoReentrar').onclick=()=>{$('btnSair').onclick();abrirLogin();};
  $('btnSair').onclick=()=>{bloqueioInterno('');controlador.limpar();limparMarcacao();memoria=null;token='';try{localStorage.removeItem(chaveSessao);}catch{}$('consultaResultado').innerHTML='';$('historicoLista').innerHTML='';historico=[];inicio();};
  $('teclado').innerHTML=['1','2','3','4','5','6','7','8','9','apagar','0','entrar'].map(t=>`<button type="button" class="tecla ${t==='entrar'?'entrar':''}" data-t="${t}" aria-label="${t==='apagar'?'Apagar último dígito':t==='entrar'?'Entrar':t}">${t==='apagar'?'⌫':t==='entrar'?'→':t}</button>`).join('');
  $('teclado').onclick=ev=>{const b=ev.target.closest('[data-t]');if(b)tecla(b.dataset.t);};
  document.addEventListener('keydown',ev=>{if($('telaLogin').hidden||ev.ctrlKey||ev.metaKey||ev.altKey)return;if(/^\d$/.test(ev.key)){ev.preventDefault();tecla(ev.key);}else if(ev.key==='Backspace'){ev.preventDefault();tecla('apagar');}else if(ev.key==='Enter'){ev.preventDefault();tecla('entrar');}});
  window.addEventListener('popstate',()=>{if(!$('qrLeitor').hidden){pararQr();return;}if(!$('despachoLeitor').hidden||history.state?.tela===telaAtual)return;if(history.state?.tela&&history.state.tela!=='telaInicio')interno({historico:false});else inicio();});
  window.addEventListener('resize',ajustarFaixa);window.addEventListener('pagehide',pararQr);
  document.addEventListener('visibilitychange',()=>{if(document.hidden&&!$('qrLeitor').hidden){pararQr();history.back();}});
  controlador=window.criarTelaConferencia({api,sessao,mostrar,abrirLogin,ligado:()=>ligado&&confirmarLigado,aviso,esc});
  // Rascunhos de saída da versão antiga não podem reaparecer no novo controle.
  try{localStorage.removeItem('kuru-expedicao-carrinho');localStorage.removeItem('kuru-expedicao-fluxo');}catch{}
  api('estado').then(r=>{ligado=Boolean(r.ligado);confirmarLigado=Boolean(r.ligadoBaixa);inicio();$('btnInterno').disabled=false;if(!r.ok)aviso(r.erro);token=extrairToken(location.pathname);if(token){destino='consulta';abrirDestino();}});
})();
