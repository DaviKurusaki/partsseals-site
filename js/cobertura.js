/* Mapa público: apenas a geometria do IBGE e a contagem anônima do servidor. */
(function () {
  'use strict';
  const raiz = document.querySelector('[data-cobertura]');
  if (!raiz) return;
  const idioma = document.documentElement.lang.slice(0, 2);
  const mensagens = {
    pt: { estado: 'Por estado', regiao: 'Por região', pesquisar: 'Pesquisar UF ou estado', todos: 'Todas as regiões',
      atendido: 'Já atendido', desconhecido: 'Sem atendimento comprovado', vazio: 'Cobertura em atualização. Ainda não há UFs comprovadas para exibir.',
      erro: 'Não foi possível carregar os dados de atendimento. Tente novamente mais tarde.', contador: 'UFs com atendimento comprovado',
      legenda: 'Vermelho: atendimento comprovado. Cinza: sem registro comprovado.', escolher: 'Selecione um estado no mapa ou na lista.',
      orcamento: 'Solicitar orçamento', nenhuma: 'Nenhuma UF encontrada.', fonte: 'Malha: IBGE. Atendimento: registros internos aprovados.',
      em: 'Referência' },
    en: { estado: 'By state', regiao: 'By region', pesquisar: 'Search state or abbreviation', todos: 'All regions',
      atendido: 'Previously served', desconhecido: 'No verified record', vazio: 'Coverage is being updated. No states have been verified yet.',
      erro: 'Service data could not be loaded. Please try again later.', contador: 'states with verified service',
      legenda: 'Red: verified service. Gray: no verified record.', escolher: 'Select a state on the map or in the list.',
      orcamento: 'Request a quote', nenhuma: 'No state found.', fonte: 'Map: IBGE. Service: approved internal records.', em: 'Reference' },
    es: { estado: 'Por estado', regiao: 'Por región', pesquisar: 'Buscar estado o sigla', todos: 'Todas las regiones',
      atendido: 'Ya atendido', desconhecido: 'Sin registro verificado', vazio: 'Cobertura en actualización. Todavía no hay estados verificados.',
      erro: 'No se pudieron cargar los datos de atención. Inténtelo más tarde.', contador: 'estados con atención verificada',
      legenda: 'Rojo: atención verificada. Gris: sin registro verificado.', escolher: 'Seleccione un estado en el mapa o en la lista.',
      orcamento: 'Solicitar presupuesto', nenhuma: 'No se encontró ningún estado.', fonte: 'Mapa: IBGE. Atención: registros internos aprobados.', em: 'Referencia' }
  };
  const textos = mensagens[idioma] || mensagens.pt;
  const regioes = ['Norte', 'Nordeste', 'Centro-Oeste', 'Sudeste', 'Sul'];
  const nomesRegioes = {
    en: { Norte: 'North', Nordeste: 'Northeast', 'Centro-Oeste': 'Central-West', Sudeste: 'Southeast', Sul: 'South' },
    es: { Norte: 'Norte', Nordeste: 'Nordeste', 'Centro-Oeste': 'Centro-Oeste', Sudeste: 'Sudeste', Sul: 'Sur' }
  }[idioma] || {};
  const nomeRegiao = regiao => nomesRegioes[regiao] || regiao;
  const estado = { modo: 'estado', regiao: '', busca: '', selecionada: '', comprovadas: new Map(), ufs: [] };
  const normal = s => String(s).normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
  const svgNS = 'http://www.w3.org/2000/svg';

  function detalhe(uf) {
    const caixa = raiz.querySelector('[data-detalhe]');
    if (!uf) { caixa.textContent = textos.escolher; return; }
    caixa.replaceChildren();
    const titulo = document.createElement('strong');
    titulo.textContent = `${uf.nome} (${uf.uf})`;
    const situacao = document.createElement('p');
    situacao.textContent = `${nomeRegiao(uf.regiao)} · ${estado.comprovadas.has(uf.uf) ? textos.atendido : textos.desconhecido}`;
    caixa.append(titulo, situacao);
    if (estado.comprovadas.has(uf.uf)) {
      const data = document.createElement('small');
      data.textContent = `${textos.em}: ${estado.comprovadas.get(uf.uf)}`;
      caixa.append(data);
    }
  }

  function selecionar(uf) {
    estado.selecionada = uf.uf;
    raiz.querySelectorAll('[data-uf]').forEach(el => el.classList.toggle('selecionado', el.dataset.uf === uf.uf));
    detalhe(uf);
  }

  function lista() {
    const caixa = raiz.querySelector('[data-lista]');
    caixa.replaceChildren();
    const siglaExata = estado.busca.length === 2 && estado.ufs.some(u => u.uf.toLowerCase() === estado.busca.toLowerCase());
    const filtradas = estado.ufs.filter(u => (!estado.regiao || u.regiao === estado.regiao) &&
      (!estado.busca || (siglaExata ? u.uf.toLowerCase() === estado.busca.toLowerCase() : normal(`${u.nome} ${u.uf}`).includes(normal(estado.busca)))));
    if (!filtradas.length) { const p = document.createElement('p'); p.textContent = textos.nenhuma; caixa.append(p); return; }
    filtradas.forEach(uf => {
      const botao = document.createElement('button');
      botao.type = 'button'; botao.className = 'cobertura-uf'; botao.dataset.uf = uf.uf;
      botao.textContent = `${uf.nome} (${uf.uf}) · ${estado.comprovadas.has(uf.uf) ? textos.atendido : textos.desconhecido}`;
      botao.addEventListener('click', () => selecionar(uf));
      caixa.append(botao);
    });
  }

  function iniciar(malha, cobertura) {
    if (!Array.isArray(malha.ufs) || malha.ufs.length !== 27 || !Array.isArray(cobertura.ufs)) throw Error('Dados incompletos');
    estado.ufs = malha.ufs;
    const validas = new Set(malha.ufs.map(u => u.uf));
    cobertura.ufs.forEach(u => { if (validas.has(u.uf)) estado.comprovadas.set(u.uf, u.dataReferencia); });
    raiz.innerHTML = `<div class="cobertura-barra"><div role="group" aria-label="${textos.estado} / ${textos.regiao}">
      <button type="button" data-modo="estado" aria-pressed="true">${textos.estado}</button>
      <button type="button" data-modo="regiao" aria-pressed="false">${textos.regiao}</button></div>
      <p data-contador></p></div><div class="cobertura-layout"><div class="cobertura-mapa" data-mapa></div>
      <div class="cobertura-painel"><div data-detalhe aria-live="polite"></div>
      <div data-regioes hidden></div><label for="buscaUf">${textos.pesquisar}</label>
      <input id="buscaUf" type="search" autocomplete="off" placeholder="SP, São Paulo…">
      <div class="cobertura-lista" data-lista></div></div></div>
      <p class="cobertura-legenda">${textos.legenda}</p><small>${textos.fonte}</small>
      <p><a class="btn btn-primary" href="#contato">${textos.orcamento}</a></p>`;
    const contador = raiz.querySelector('[data-contador]');
    contador.textContent = estado.comprovadas.size ? `${estado.comprovadas.size} ${textos.contador}` : textos.vazio;
    if (estado.comprovadas.size) {
      const grade = document.querySelector('.stats-grid');
      if (grade) {
        grade.classList.add('stats-grid--cobertura');
        const cartao = document.createElement('article');
        cartao.className = 'stat-card';
        const numero = document.createElement('strong');
        numero.textContent = String(estado.comprovadas.size);
        const rotulo = document.createElement('span');
        rotulo.textContent = textos.contador;
        cartao.append(numero, rotulo);
        grade.append(cartao);
      }
    }
    const svg = document.createElementNS(svgNS, 'svg');
    svg.setAttribute('viewBox', malha.viewBox); svg.setAttribute('role', 'group');
    svg.setAttribute('aria-label', textos.estado);
    estado.ufs.forEach(uf => {
      const path = document.createElementNS(svgNS, 'path');
      path.setAttribute('d', uf.d); path.setAttribute('tabindex', '0'); path.setAttribute('role', 'button');
      path.setAttribute('aria-label', `${uf.nome}, ${uf.uf}: ${estado.comprovadas.has(uf.uf) ? textos.atendido : textos.desconhecido}`);
      path.classList.add('cobertura-estado');
      if (estado.comprovadas.has(uf.uf)) path.classList.add('atendido');
      path.dataset.uf = uf.uf;
      path.addEventListener('mouseenter', () => selecionar(uf));
      path.addEventListener('focus', () => selecionar(uf));
      path.addEventListener('click', () => selecionar(uf));
      path.addEventListener('keydown', ev => { if (ev.key === 'Enter' || ev.key === ' ') { ev.preventDefault(); selecionar(uf); } });
      svg.append(path);
    });
    raiz.querySelector('[data-mapa]').append(svg);
    const regiaoCaixa = raiz.querySelector('[data-regioes]');
    const todas = ['', ...regioes];
    todas.forEach(regiao => {
      const b = document.createElement('button'); b.type = 'button'; b.className = 'cobertura-regiao';
      const total = estado.ufs.filter(u => (!regiao || u.regiao === regiao) && estado.comprovadas.has(u.uf)).length;
      b.textContent = `${regiao ? nomeRegiao(regiao) : textos.todos} · ${total}`;
      b.setAttribute('aria-pressed', String(!regiao));
      b.addEventListener('click', () => { estado.regiao = regiao; regiaoCaixa.querySelectorAll('button').forEach(x => x.setAttribute('aria-pressed', String(x === b))); lista(); });
      regiaoCaixa.append(b);
    });
    raiz.querySelectorAll('[data-modo]').forEach(b => b.addEventListener('click', () => {
      estado.modo = b.dataset.modo;
      raiz.querySelectorAll('[data-modo]').forEach(x => x.setAttribute('aria-pressed', String(x === b)));
      regiaoCaixa.hidden = estado.modo !== 'regiao';
      if (regiaoCaixa.hidden) { estado.regiao = ''; lista(); }
    }));
    raiz.querySelector('#buscaUf').addEventListener('input', ev => { estado.busca = ev.target.value.trim(); lista(); });
    detalhe(null); lista(); raiz.setAttribute('aria-busy', 'false');
  }

  Promise.all([
    fetch('/assets/brasil-ufs.json').then(r => { if (!r.ok) throw Error('mapa'); return r.json(); }),
    fetch('/api/cobertura', { cache: 'no-cache' }).then(r => { if (!r.ok) throw Error('cobertura'); return r.json(); })
  ]).then(([malha, cobertura]) => iniciar(malha, cobertura)).catch(() => {
    raiz.innerHTML = `<p role="alert">${textos.erro}</p>`;
    raiz.setAttribute('aria-busy', 'false');
  });
})();
