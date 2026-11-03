'use strict';
const assert=require('node:assert/strict');
const fs=require('node:fs');
const path=require('node:path');
const {pathToFileURL}=require('node:url');
const ler=f=>fs.readFileSync(path.join(__dirname,'..',f),'utf8');
let testes=0;
const ok=(c,t)=>{assert(c,t);testes++;console.log('ok '+t);};
(async()=>{
  const {Window}=await import(pathToFileURL(process.env.PS_HAPPY_DOM || require.resolve('happy-dom')).href);
  const w=new Window({url:'https://parts-seals.com.br/cliente/cadastro',settings:{enableJavaScriptEvaluation:true,disableJavaScriptFileLoading:true,disableCSSFileLoading:true,suppressInsecureJavaScriptEnvironmentWarning:true}});
  try {
    w.document.write(ler('cliente/cadastro.html').replace(/<script\b[^>]*>[\s\S]*?<\/script>/g,''));
    let empresas=[],resolver,atrasar=false;
    w.fetch=async()=>{
      if(atrasar) return new Promise(r=>{resolver=()=>r({status:200,json:async()=>({ok:true,empresas})});});
      return {status:200,json:async()=>({ok:true,empresas})};
    };
    for(const nome of ['regras','comum','empresa-cadastro']) w.eval(ler('cliente/js/'+nome+'.js'));
    const d=w.document,nome=d.querySelector('#empresa'),cnpj=d.querySelector('#cnpj');
    const input=el=>el.dispatchEvent(new w.Event('input',{bubbles:true}));
    const esperar=()=>new Promise(r=>setTimeout(r,420));
    const acme={nome:'ACME',razao_social:'ACME LTDA',cnpj:'11222333000181'};
    empresas=[acme];nome.focus();nome.value='ACME';input(nome);await esperar();
    ok(cnpj.value==='11.222.333/0001-81','nome exato preenche CNPJ');
    nome.value='';cnpj.value='11222333000181';input(cnpj);await esperar();
    ok(nome.value==='ACME','CNPJ válido preenche empresa');
    empresas=[acme,{nome:'ACME FILIAL',cnpj:'11222333000262'}];
    nome.focus();nome.value='acm';input(nome);await esperar();
    ok(!d.querySelector('#empresas-sugestoes').hidden && nome.getAttribute('aria-expanded')==='true','nome parcial abre lista acessível com opções de CNPJ');
    for(const key of ['ArrowDown','ArrowDown','Enter']) nome.dispatchEvent(new w.KeyboardEvent('keydown',{key,bubbles:true,cancelable:true}));
    ok(nome.value==='ACME FILIAL' && cnpj.value==='11.222.333/0002-62','setas e Enter selecionam a empresa correta');
    atrasar=true;nome.value='ACME';input(nome);await esperar();nome.value='Outra empresa';input(nome);resolver();
    await new Promise(setImmediate);
    ok(nome.value==='Outra empresa','resposta antiga não sobrescreve edição mais recente');
    atrasar=false;empresas=[];await esperar();nome.value='DESCONHECIDA';input(nome);await esperar();
    ok(nome.value==='DESCONHECIDA' && d.querySelector('[data-empresa-ajuda]').textContent.includes('manualmente'),'empresa desconhecida permite cadastro manual');
    w.document.body.innerHTML='<button data-nf="10727" data-empresa="1">10727</button>';
    let documentos=[{id:'11111111-1111-4111-8111-111111111111',tipo:'pdf',numero:'10727'},{id:'22222222-2222-4222-8222-222222222222',tipo:'xml',numero:'10727'}];
    const rotas=[];w.PSCliente.api=async(m,rota)=>{rotas.push(rota);return {status:200,dados:{ok:true,documentos}};};
    w.eval(ler('cliente/js/documentos.js'));
    d.querySelector('[data-nf]').click();await new Promise(setImmediate);
    ok(rotas[0]==='documentos?empresa=1&nf=10727','clique da NF consulta documentos no contexto da empresa');
    ok(d.querySelector('dialog').open && d.querySelectorAll('.cli-documento').length===2 && d.querySelector('dialog').textContent.includes('Boleto em PDF: ainda não disponível'),
      'modal mostra os arquivos existentes e informa boleto pendente');
    const link=d.querySelector('.cli-documento');
    ok(link.getAttribute('href').startsWith('/cliente/api/arquivo?id=') && link.target==='_blank' && !link.href.includes('supabase'),
      'arquivo abre na rota protegida sem expor URL do armazenamento');
    d.querySelector('.cli-fechar').click();
    ok(!d.querySelector('dialog') && d.activeElement.hasAttribute('data-nf'),'fechar remove modal e devolve foco à NF');
    documentos=[];d.querySelector('[data-nf]').click();await new Promise(setImmediate);
    ok(d.querySelector('dialog').textContent.includes('ainda não estão disponíveis') && d.querySelector('dialog a').href.startsWith('https://wa.me/'),
      'documentos não sincronizados oferecem solicitação ao Comercial');
    console.log(`\nOK: ${testes} verificações de cadastro e documentos no DOM.`);
  } finally {await w.happyDOM.close();}
})().catch(e=>{console.error(e);process.exitCode=1;});
