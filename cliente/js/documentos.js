(function () {
  'use strict';
  var C=window.PSCliente, nomes={pdf:'Nota fiscal em PDF',xml:'XML da nota',boleto:'Boleto em PDF'};
  document.addEventListener('click',function(ev) {
    var botao=ev.target.closest('[data-nf]');
    if(!botao) return;
    var anterior=botao,dialog=document.createElement('dialog');
    dialog.className='cli-documentos';
    dialog.innerHTML='<div class="cli-documentos-topo"><h2>Nota fiscal '+C.escapar(botao.dataset.nf)+'</h2><button class="cli-fechar" type="button" aria-label="Fechar documentos">×</button></div><div data-conteudo aria-live="polite"><p>Buscando documentos…</p></div>';
    document.body.appendChild(dialog);
    function fechar(){dialog.close();}
    dialog.querySelector('.cli-fechar').addEventListener('click',fechar);
    dialog.addEventListener('click',function(e){if(e.target===dialog) fechar();});
    dialog.addEventListener('close',function(){dialog.remove();anterior.focus();});
    dialog.showModal();
    C.api('GET','documentos?empresa='+encodeURIComponent(botao.dataset.empresa)+'&nf='+encodeURIComponent(botao.dataset.nf)).then(function(r){
      if(!dialog.isConnected) return;
      var caixa=dialog.querySelector('[data-conteudo]');
      if(r.status!==200) {caixa.textContent=r.dados.erro || C.FALHA_REDE;return;}
      var docs=(r.dados.documentos || []).filter(function(d){return nomes[d.tipo] && /^[a-f0-9-]{36}$/i.test(d.id);});
      if(!docs.length) {caixa.innerHTML='<p>Os documentos desta nota ainda não estão disponíveis.</p><p>Solicite ao Comercial pelo <a target="_blank" rel="noopener noreferrer" href="'+C.linkComercial('Olá! Gostaria dos documentos da NF '+botao.dataset.nf+'.')+'">WhatsApp</a>.</p>';return;}
      caixa.innerHTML='<div class="cli-documentos-lista">'+docs.map(function(d){return '<a class="cli-documento" target="_blank" rel="noopener noreferrer" href="/cliente/api/arquivo?id='+encodeURIComponent(d.id)+'"><strong>'+nomes[d.tipo]+'</strong><span>'+(d.tipo==='xml'?'Baixar XML':'Abrir PDF')+' ↗</span></a>';}).join('')+'</div>';
      ['pdf','xml','boleto'].forEach(function(tipo){if(!docs.some(function(d){return d.tipo===tipo;})){var p=document.createElement('p');p.textContent=nomes[tipo]+': ainda não disponível.';caixa.appendChild(p);}});
    }).catch(function(){if(dialog.isConnected) dialog.querySelector('[data-conteudo]').textContent=C.FALHA_REDE;});
  });
})();
