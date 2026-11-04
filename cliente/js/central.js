/* Central Técnica: só é servida pela API após autenticação e aprovação. */
(function () {
  'use strict';
  const raiz = document.querySelector('[data-central]');
  if (!raiz) return;
  const C = window.PSCliente, calc = window.PSCalculos, esc = C.escapar;
  const chave = 'ps_tecnica_hist_' + raiz.dataset.userKey;
  const numero = n => new Intl.NumberFormat('pt-BR', { maximumFractionDigits: 6 }).format(n);
  const ferramentas = [
    ['c1', 'Dimensões', 'Espaço do alojamento', 'Diferença entre diâmetros e espaço radial livre.'],
    ['c2', 'Dimensões', 'Seção radial', 'Seção geométrica entre Ø externo e Ø interno.'],
    ['c3', 'Dimensões', 'Conversor de unidades', 'Milímetros, polegadas, pressão e temperatura.'],
    ['c4', 'Materiais', 'Comparador de materiais', 'Dados da biblioteca existente, lado a lado.'],
    ['c5', 'Materiais', 'Compatibilidade química', 'Consulta com resposta conservadora.'],
    ['c6', 'Dimensões', 'Guia de medição', 'Roteiro de paquímetro e ficha local.'],
    ['c7', 'Seleção de Perfis', 'Seletor de perfis', 'Resumo técnico para consulta, sem recomendação não validada.'],
    ['c8', 'Aprendizado e Consultas', 'Perguntas técnicas', 'Respostas do FAQ público aprovado.'],
    ['c9', 'Aprendizado e Consultas', 'Conteúdos visuais', 'Documentos visuais da biblioteca existente.'],
    ['c10', 'Aprendizado e Consultas', 'Histórico local', 'Consultas salvas somente por você neste navegador.'],
  ];
  const avisoGeral = 'Cálculo geométrico ou consulta preliminar. Não determina adequação da vedação; valide com a equipe técnica.';
  const formMedidas = (id, nomes) => `<form data-form="${id}" class="tec-form"><div class="tec-campos">${nomes.map(([name, label]) =>
    `<label class="cli-campo">${label}<input class="cli-input" name="${name}" inputmode="decimal" autocomplete="off" placeholder="Ex.: 50,25" aria-describedby="erro-${id}-${name}" required><small id="erro-${id}-${name}" data-erro="${name}" class="cli-erro" hidden></small></label>`).join('')}</div>
    <div class="tec-acoes"><button class="btn btn-primary" type="submit">Calcular</button><button class="btn btn-secondary" type="reset">Limpar</button></div></form>`;
  const salvar = '<div class="tec-salvar"><label class="cli-marcar"><input type="checkbox" data-optin>Salvar esta consulta neste navegador, apenas para esta conta</label><button class="btn btn-secondary" type="button" data-salvar disabled>Salvar consulta</button><small>Não sincroniza entre dispositivos. Não insira dados sigilosos.</small></div>';
  const resultado = '<div class="tec-resultado" data-resultado role="status" aria-live="polite" hidden></div>';
  const desenho = '<svg class="tec-desenho" viewBox="0 0 220 160" role="img" aria-label="Dois círculos concêntricos ilustram diâmetros externo e interno; desenho sem escala"><circle cx="110" cy="80" r="64"/><circle cx="110" cy="80" r="40"/><line x1="46" y1="80" x2="174" y2="80"/><line x1="70" y1="96" x2="150" y2="96"/><text x="9" y="78">Ø ext.</text><text x="155" y="112">Ø int.</text></svg>';
  const conteudo = {
    c1: `<p>Informe Ø do alojamento e Ø do eixo na mesma unidade. O resultado é apenas o espaço geométrico disponível.</p>${formMedidas('c1', [['alojamento', 'Ø alojamento (mm)'], ['eixo', 'Ø eixo (mm)']])}${resultado}<button class="btn btn-secondary" type="button" data-copiar hidden>Copiar resultado</button>${salvar}<p class="tec-nota">Fórmulas: diferença diametral = Ø alojamento − Ø eixo; espaço radial = diferença / 2. Não calcula tolerância ou interferência de vedação.</p>`,
    c2: `<p>Para geometria cilíndrica: seção radial = (Ø externo − Ø interno) / 2.</p>${desenho}${formMedidas('c2', [['externo', 'Ø externo (mm)'], ['interno', 'Ø interno (mm)']])}${resultado}<button class="btn btn-secondary" type="button" data-copiar hidden>Copiar resultado</button>${salvar}<p class="tec-nota">Desenho didático, sem escala. A fórmula pode não representar a seção funcional de perfis não circulares.</p>`,
    c3: `<form data-form="c3" class="tec-form"><div class="tec-campos"><label class="cli-campo">Valor<input class="cli-input" name="valor" inputmode="decimal" placeholder="Ex.: 25,4" required><small data-erro="valor" class="cli-erro" hidden></small></label>
      <label class="cli-campo">De<select class="cli-input" name="de"><option value="mm">mm</option><option value="pol">pol</option><option value="bar">bar</option><option value="MPa">MPa</option><option value="psi">psi</option><option value="C">°C</option><option value="F">°F</option></select></label>
      <label class="cli-campo">Para<select class="cli-input" name="para"><option value="pol">pol</option><option value="mm">mm</option><option value="MPa">MPa</option><option value="bar">bar</option><option value="psi">psi</option><option value="F">°F</option><option value="C">°C</option></select></label></div>
      <div class="tec-acoes"><button class="btn btn-primary" type="submit">Converter</button><button class="btn btn-secondary" type="reset">Limpar</button></div></form>${resultado}<button class="btn btn-secondary" type="button" data-copiar hidden>Copiar resultado</button>${salvar}<p class="tec-nota">1 pol = 25,4 mm; 1 bar = 100.000 Pa; 1 MPa = 1.000.000 Pa; 1 psi ≈ 6.894,757 Pa. Fonte: <a href="https://www.nist.gov/pml/owm/metric-si/unit-conversion/pressure-and-gas-flow-unit-conversions" target="_blank" rel="noopener noreferrer">NIST</a>. °F = °C × 9/5 + 32. Resultado exibido com até 6 casas decimais.</p>`,
    c4: `<p>Os atributos vêm diretamente dos cartões publicados em <a href="/materiais.html#pergunte">Materiais e datasheets</a>. A fonte não fornece revisão para todos os atributos.</p><div class="tec-campos"><label class="cli-campo">Material A<select class="cli-input" data-material-a></select></label><label class="cli-campo">Material B<select class="cli-input" data-material-b></select></label></div><button class="btn btn-primary" type="button" data-comparar>Comparar</button><div data-comparacao class="tec-comparacao" aria-live="polite">Carregando biblioteca…</div><p class="tec-nota">A comparação é preliminar e não equivale à validação de uma formulação específica.</p>`,
    c5: `<p>Pesquise material e fluido para verificar se existe uma referência validada.</p><form data-form="c5" class="tec-form"><div class="tec-campos"><label class="cli-campo">Material<input class="cli-input" name="material" required autocomplete="off"></label><label class="cli-campo">Fluido químico<input class="cli-input" name="fluido" required autocomplete="off"></label></div><div class="tec-acoes"><button class="btn btn-primary" type="submit">Consultar</button><button class="btn btn-secondary" type="reset">Limpar</button></div></form>${resultado}<p class="tec-nota">Não existe matriz de compatibilidade aprovada neste projeto. Uma validação final depende do grau do material, concentração, temperatura e ambiente.</p>`,
    c6: `<p>Use paquímetro adequado e anote as medidas na mesma unidade. A ilustração é genérica e não dimensional.</p>${desenho}<div class="tec-passos" data-guia><strong data-passo-contador></strong><p data-passo aria-live="polite"></p><div class="tec-acoes"><button class="btn btn-secondary" type="button" data-passo-anterior>Anterior</button><button class="btn btn-secondary" type="button" data-passo-proximo>Próximo passo</button></div></div><form data-form="c6" class="tec-form"><div class="tec-campos"><label class="cli-campo">Perfil ou formato<input class="cli-input" name="perfil" maxlength="80" placeholder="Ex.: anel"></label><label class="cli-campo">Ø interno (mm)<input class="cli-input" name="interno" inputmode="decimal"></label><label class="cli-campo">Ø externo (mm)<input class="cli-input" name="externo" inputmode="decimal"></label><label class="cli-campo">Altura (mm)<input class="cli-input" name="altura" inputmode="decimal"></label></div><div class="tec-acoes"><button class="btn btn-primary" type="submit">Montar ficha</button><button class="btn btn-secondary" type="reset">Limpar</button></div></form>${resultado}<button class="btn btn-secondary" type="button" data-copiar hidden>Copiar ficha</button>${salvar}<p class="tec-nota">Ficha pessoal de medidas, não documento técnico oficial. Confira pontos diferentes da peça e registre desgaste, fluido, movimento e temperatura com a equipe.</p>`,
    c7: `<p>Responda o que souber. Sem catálogo de perfis e regras de seleção aprovadas, não indicamos uma família específica.</p><form data-form="c7" class="tec-form"><div class="tec-campos"><label class="cli-campo">Aplicação<select class="cli-input" name="aplicacao"><option value="">Não informado</option><option>Haste</option><option>Êmbolo</option><option>Raspagem</option><option>Guia</option><option>Estática</option><option>Outra</option></select></label><label class="cli-campo">Movimento<select class="cli-input" name="movimento"><option value="">Não informado</option><option>Estático</option><option>Alternativo</option><option>Rotativo</option><option>Outro</option></select></label><label class="cli-campo">Fluido<input class="cli-input" name="fluido" maxlength="80"></label><label class="cli-campo">Temperatura (°C)<input class="cli-input" name="temperatura" inputmode="decimal"></label><label class="cli-campo">Pressão (bar)<input class="cli-input" name="pressao" inputmode="decimal"></label><label class="cli-campo">Dimensões (mm)<input class="cli-input" name="dimensoes" maxlength="100" placeholder="Ø interno, Ø externo, altura"></label></div><div class="tec-acoes"><button class="btn btn-primary" type="submit">Montar resumo</button><button class="btn btn-secondary" type="reset">Limpar</button></div></form>${resultado}<button class="btn btn-secondary" type="button" data-copiar hidden>Copiar resumo</button>${salvar}<p class="tec-nota">O resumo serve para conversar com o atendimento; não é seleção ou recomendação de perfil.</p>`,
    c8: `<label class="cli-campo">Buscar pergunta<input class="cli-input" type="search" data-busca-faq placeholder="Ex.: desenho"></label><div data-faq aria-live="polite">Carregando perguntas…</div><p class="tec-nota">Fonte: <a href="/#faqTitle">FAQ da página inicial</a>. Se sua pergunta não estiver respondida, <a href="mailto:vendas@parts-seals.com.br">fale com o atendimento</a>.</p>`,
    c9: `<p>Conteúdos visuais já publicados na biblioteca de materiais:</p><label class="cli-campo">Categoria<select class="cli-input" data-categoria-visual><option value="">Todas</option></select></label><div data-visuais aria-live="polite">Carregando conteúdos…</div><p class="tec-nota">Vídeos: nenhum conteúdo aprovado foi encontrado. Fichas e imagens são documentos de referência; consulte a fonte e confirme a aplicação.</p>`,
    c10: `<p>Somente consultas que você salvou após marcar a opção de armazenamento ficam neste navegador e nesta conta. Elas não são sincronizadas. Evite dados sigilosos.</p><div data-historico aria-live="polite"></div><button class="btn btn-secondary" type="button" data-limpar-historico>Limpar todo o histórico</button>`,
  };

  raiz.innerHTML = `<label class="cli-campo tec-busca" data-busca-container>Buscar ferramenta<input class="cli-input" type="search" data-busca placeholder="Ex.: conversor, medição, materiais"></label>
    <div data-cards class="tec-grupos"></div><div data-painel hidden><button class="cli-link" type="button" data-voltar>← Todas as ferramentas</button>
    <section class="cli-cartao tec-ferramenta" aria-labelledby="tecTitulo"><h2 id="tecTitulo" tabindex="-1"></h2><div data-conteudo></div></section></div>`;
  const cards = raiz.querySelector('[data-cards]'), painel = raiz.querySelector('[data-painel]');
  for (const grupo of ['Dimensões', 'Materiais', 'Seleção de Perfis', 'Aprendizado e Consultas']) {
    const secao = document.createElement('section'); secao.className = 'tec-grupo';
    const titulo = document.createElement('h2'); titulo.textContent = grupo; secao.append(titulo);
    const grade = document.createElement('div'); grade.className = 'tec-grade';
    ferramentas.filter(f => f[1] === grupo).forEach(([id, , nome, desc]) => {
      const botao = document.createElement('button'); botao.className = 'tec-card'; botao.type = 'button';
      botao.dataset.tool = id; botao.dataset.nome = `${nome} ${desc}`.toLowerCase();
      const strong = document.createElement('strong'); strong.textContent = nome;
      const pequeno = document.createElement('span'); pequeno.textContent = desc;
      botao.append(strong, pequeno); botao.addEventListener('click', () => { location.hash = id; }); grade.append(botao);
    });
    secao.append(grade); cards.append(secao);
  }
  raiz.querySelector('[data-busca]').addEventListener('input', ev => {
    const termo = ev.target.value.toLowerCase();
    cards.querySelectorAll('.tec-card').forEach(b => { b.hidden = !b.dataset.nome.includes(termo); });
    cards.querySelectorAll('.tec-grupo').forEach(g => { g.hidden = !g.querySelector('.tec-card:not([hidden])'); });
  });
  raiz.querySelector('[data-voltar]').addEventListener('click', () => { location.hash = ''; });
  document.querySelector('[data-sair]').addEventListener('click', () => C.api('POST', 'sair').finally(() => { location.href = '/cliente/entrar'; }));

  function mostrarResultado(texto, erro) {
    const el = painel.querySelector('[data-resultado]'); if (!el) return;
    el.hidden = false; el.classList.toggle('tec-resultado--erro', !!erro); el.setAttribute('role', erro ? 'alert' : 'status'); el.textContent = texto;
    const copiar = painel.querySelector('[data-copiar]'); if (copiar) { copiar.hidden = !!erro; copiar.dataset.texto = texto; }
    const salvar = painel.querySelector('[data-salvar]'); if (salvar) salvar.dataset.texto = erro ? '' : texto;
  }
  function lerHistorico() { try { const itens = JSON.parse(localStorage.getItem(chave) || '[]');
    return Array.isArray(itens) ? itens.filter(x => x && typeof x === 'object' && typeof x.id === 'string' && typeof x.tipo === 'string' && typeof x.resultado === 'string').slice(0, 20) : []; } catch { return []; } }
  function gravarHistorico(lista) { try { localStorage.setItem(chave, JSON.stringify(lista.slice(0, 20))); return true; } catch { return false; } }
  function instalarSalvamento(id) {
    const optin = painel.querySelector('[data-optin]'), b = painel.querySelector('[data-salvar]');
    if (!optin || !b) return;
    optin.addEventListener('change', () => { b.disabled = !optin.checked; });
    b.addEventListener('click', () => {
      if (!optin.checked || !b.dataset.texto) return;
      const form = painel.querySelector('form');
      const entradas = form ? Object.fromEntries(new FormData(form).entries()) : {};
      const item = { id: Date.now().toString(36) + Math.random().toString(36).slice(2, 8), tipo: id,
        data: new Date().toISOString(), entradas, resultado: b.dataset.texto.slice(0, 1500) };
      const ok = gravarHistorico([item, ...lerHistorico()]);
      b.textContent = ok ? 'Consulta salva' : 'Não foi possível salvar neste navegador';
      setTimeout(() => { b.textContent = 'Salvar consulta'; }, 2200);
    });
  }
  function configurarFormulario(id) {
    const form = painel.querySelector('form'); if (!form) return;
    form.addEventListener('reset', () => {
      const r = painel.querySelector('[data-resultado]'); if (r) { r.hidden = true; r.textContent = ''; }
      const b = painel.querySelector('[data-copiar]'); if (b) b.hidden = true;
      const salvar = painel.querySelector('[data-salvar]'); if (salvar) salvar.dataset.texto = '';
      form.querySelectorAll('[aria-invalid]').forEach(x => x.removeAttribute('aria-invalid'));
      form.querySelectorAll('[data-erro]').forEach(x => { x.hidden = true; x.textContent = ''; });
    });
    form.addEventListener('submit', ev => {
      ev.preventDefault();
      try {
        let texto;
        if (id === 'c1') { const r = calc.espacoAlojamento(form.elements.alojamento.value, form.elements.eixo.value);
          texto = `Diferença diametral: ${numero(r.diametral)} mm. Espaço radial: ${numero(r.radial)} mm. Hipótese: cilindros concêntricos, medidas na mesma unidade. ${avisoGeral}`; }
        if (id === 'c2') { const r = calc.secaoRadial(form.elements.externo.value, form.elements.interno.value);
          texto = `Seção radial geométrica: ${numero(r)} mm. Fórmula: (Ø externo − Ø interno) / 2. ${avisoGeral}`; }
        if (id === 'c3') { const de = form.elements.de.value, para = form.elements.para.value;
          const r = calc.converter(form.elements.valor.value, de, para);
          texto = `${form.elements.valor.value} ${de === 'C' || de === 'F' ? '°' : ''}${de} = ${numero(r)} ${para === 'C' || para === 'F' ? '°' : ''}${para}. Fonte das conversões: NIST. Versão de cálculo 1.`; }
        if (id === 'c5') texto = `Material: ${form.elements.material.value.trim()}; fluido: ${form.elements.fluido.value.trim()}. Sem dados suficientes para afirmar compatibilidade. Envie concentração, temperatura e condições de uso ao atendimento técnico.`;
        if (id === 'c6') {
          const campos = [['interno', 'Ø interno'], ['externo', 'Ø externo'], ['altura', 'Altura']];
          if (!campos.some(([nome]) => form.elements[nome].value.trim())) throw Error('Preencha ao menos uma medida para montar a ficha.');
          for (const [nome] of campos) if (form.elements[nome].value.trim() && calc.numero(form.elements[nome].value) <= 0) throw Error('As medidas devem ser positivas.');
          texto = `Ficha pessoal de medidas (não oficial)\nPerfil: ${form.elements.perfil.value.trim() || 'não informado'}\n` +
            campos.map(([nome, rotulo]) => `${rotulo}: ${form.elements[nome].value.trim() || 'não informado'} mm`).join('\n');
        }
        if (id === 'c7') {
          if (form.elements.temperatura.value.trim()) calc.numero(form.elements.temperatura.value);
          if (form.elements.pressao.value.trim() && calc.numero(form.elements.pressao.value) < 0) throw Error('Pressão não pode ser negativa.');
          texto = 'Resumo para consulta técnica (sem indicação de perfil)\n' +
            ['aplicacao', 'movimento', 'fluido', 'temperatura', 'pressao', 'dimensoes'].map(nome =>
              `${{ aplicacao: 'Aplicação', movimento: 'Movimento', fluido: 'Fluido', temperatura: 'Temperatura (°C)', pressao: 'Pressão (bar)', dimensoes: 'Dimensões' }[nome]}: ${form.elements[nome].value.trim() || 'não informado'}`).join('\n') +
            '\nFaltam catálogo de perfis e regras verificadas para recomendar uma família.';
        }
        mostrarResultado(texto, false);
      } catch (e) {
        mostrarResultado(e.message, true);
        form.querySelectorAll('input[required]').forEach(campo => {
          campo.setAttribute('aria-invalid', 'true');
          const caixa = form.querySelector(`[data-erro="${campo.name}"]`);
          if (caixa) { caixa.textContent = e.message; caixa.hidden = false; }
        });
      }
    });
  }
  function configurarCopia() {
    const b = painel.querySelector('[data-copiar]'); if (!b) return;
    b.addEventListener('click', async () => { try { await navigator.clipboard.writeText(b.dataset.texto || ''); b.textContent = 'Copiado'; }
      catch { b.textContent = 'Não foi possível copiar'; } setTimeout(() => { b.textContent = b.dataset.original || 'Copiar'; }, 1800); });
    b.dataset.original = b.textContent;
  }
  let materiais;
  async function carregarMateriais() {
    if (materiais) return materiais;
    const res = await fetch('/materiais.html'); if (!res.ok) throw Error('Biblioteca indisponível.');
    const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
    materiais = [...doc.querySelectorAll('.material-library-card')].map((el, i) => ({ id: i,
      nome: el.querySelector('h3')?.textContent.trim() || el.querySelector('.material-library-card__code')?.textContent.trim() || 'Material',
      codigo: el.querySelector('.material-library-card__code')?.textContent.trim() || '',
      atributos: Object.fromEntries([...el.querySelectorAll('dl > div')].map(d => [d.querySelector('dt')?.textContent.trim(), d.querySelector('dd')?.textContent.trim()])),
      documento: el.querySelector('[data-sheet-title]')?.dataset.sheetTitle || '',
      secao: el.closest('section[id]')?.id || 'biblioteca' })).filter(m => m.codigo);
    if (!materiais.length) throw Error('A biblioteca não contém materiais cadastrados.');
    return materiais;
  }
  async function configurarComparador() {
    const destino = painel.querySelector('[data-comparacao]');
    try {
      const lista = await carregarMateriais();
      const selects = [painel.querySelector('[data-material-a]'), painel.querySelector('[data-material-b]')];
      selects.forEach((s, n) => { s.replaceChildren(); lista.forEach(m => { const o = new Option(`${m.codigo} — ${m.nome}`, String(m.id)); s.add(o); }); s.selectedIndex = Math.min(n, lista.length - 1); });
      const comparar = () => {
        const a = lista.find(m => String(m.id) === selects[0].value), b = lista.find(m => String(m.id) === selects[1].value);
        if (!a || !b) { destino.textContent = 'Selecione dois materiais.'; return; }
        const chaves = [...new Set([...Object.keys(a.atributos), ...Object.keys(b.atributos)])];
        destino.innerHTML = `<div class="tec-comparacao-grid">${[a, b].map(m => `<article><h3>${esc(m.codigo)} — ${esc(m.nome)}</h3>` +
          chaves.map(k => `<p><strong>${esc(k || 'Atributo')}</strong><br>${esc(m.atributos[k] || 'não informado')}</p>`).join('') +
          `<p>Documento: ${esc(m.documento || 'não informado')}<br>Revisão: não informada</p><a href="/materiais.html#${encodeURIComponent(m.secao)}">Ver fonte na biblioteca</a></article>`).join('')}</div>`;
      };
      painel.querySelector('[data-comparar]').addEventListener('click', comparar); comparar();
    } catch (e) { destino.textContent = e.message; }
  }
  async function configurarFaq() {
    const destino = painel.querySelector('[data-faq]');
    try {
      const res = await fetch('/index.html'); if (!res.ok) throw Error('FAQ indisponível.');
      const doc = new DOMParser().parseFromString(await res.text(), 'text/html');
      const perguntas = [...doc.querySelectorAll('.faq-list .faq-item')].map(el => ({
        pergunta: el.querySelector('button')?.firstChild?.textContent.trim() || '', resposta: el.querySelector('.faq-answer')?.textContent.trim() || ''
      })).filter(x => x.pergunta && x.resposta);
      const desenhar = termo => { const lista = perguntas.filter(x => (x.pergunta + x.resposta).toLowerCase().includes(termo.toLowerCase()));
        destino.innerHTML = lista.length ? lista.map(x => `<details><summary>${esc(x.pergunta)}</summary><p>${esc(x.resposta)}</p></details>`).join('') : '<p>Nenhuma resposta encontrada. Fale com o atendimento.</p>'; };
      painel.querySelector('[data-busca-faq]').addEventListener('input', e => desenhar(e.target.value)); desenhar('');
    } catch (e) { destino.textContent = e.message; }
  }
  async function configurarVisuais() {
    const destino = painel.querySelector('[data-visuais]');
    try {
      const res = await fetch('/assets/datasheets-view/manifest.json'); if (!res.ok) throw Error('Conteúdos indisponíveis.');
      const docs = await res.json();
      const seletor = painel.querySelector('[data-categoria-visual]');
      [...new Set(docs.map(d => d.type).filter(Boolean))].sort().forEach(tipo => seletor.add(new Option(tipo, tipo)));
      const desenhar = () => { const filtrados = docs.filter(d => !seletor.value || d.type === seletor.value);
        destino.innerHTML = filtrados.length ? `<ul class="tec-visuais">${filtrados.map(d => `<li><strong>${esc(d.title)}</strong><span>${esc(d.type || 'Documento visual')} · Fonte: biblioteca Parts Seals</span><a href="/materiais.html#biblioteca">Abrir biblioteca</a></li>`).join('')}</ul>` : '<p>Nenhum conteúdo nesta categoria.</p>'; };
      seletor.addEventListener('change', desenhar); desenhar();
    } catch (e) { destino.textContent = e.message; }
  }
  function configurarGuia() {
    const passos = ['Limpe a peça e identifique o tipo de perfil; evite medir sobre rebarbas ou sujeira.',
      'Com as pontas internas do paquímetro, meça o Ø interno em mais de uma posição.',
      'Com as pontas externas, meça o Ø externo em mais de uma posição.',
      'Meça a altura e registre fluido, movimento, pressão e temperatura para a consulta técnica.'];
    let atual = 0;
    const desenhar = () => { painel.querySelector('[data-passo-contador]').textContent = `Passo ${atual + 1} de ${passos.length}`;
      painel.querySelector('[data-passo]').textContent = passos[atual];
      painel.querySelector('[data-passo-anterior]').disabled = atual === 0;
      painel.querySelector('[data-passo-proximo]').disabled = atual === passos.length - 1; };
    painel.querySelector('[data-passo-anterior]').addEventListener('click', () => { atual--; desenhar(); });
    painel.querySelector('[data-passo-proximo]').addEventListener('click', () => { atual++; desenhar(); }); desenhar();
  }
  function configurarHistorico() {
    const destino = painel.querySelector('[data-historico]');
    const desenhar = () => { const lista = lerHistorico();
      destino.innerHTML = lista.length ? lista.map(x => `<article class="tec-historico-item"><strong>${esc(ferramentas.find(f => f[0] === x.tipo)?.[2] || 'Consulta')}</strong>
        <small>${esc(new Date(x.data).toLocaleString('pt-BR'))}</small><p>${esc(x.resultado)}</p><div class="tec-acoes"><button type="button" data-reabrir="${esc(x.id)}">Reabrir</button><button type="button" data-excluir="${esc(x.id)}">Excluir</button></div></article>`).join('') : '<p>Nenhuma consulta salva neste navegador para esta conta.</p>'; };
    destino.addEventListener('click', e => {
      const b = e.target.closest('[data-reabrir], [data-excluir]'); if (!b) return;
      const lista = lerHistorico();
      if (b.dataset.excluir) { gravarHistorico(lista.filter(x => x.id !== b.dataset.excluir)); desenhar(); return; }
      const item = lista.find(x => x.id === b.dataset.reabrir); if (!item) return;
      location.hash = item.tipo;
      setTimeout(() => { const form = painel.querySelector('form'); if (form) Object.entries(item.entradas || {}).forEach(([nome, valor]) => { if (form.elements[nome]) form.elements[nome].value = valor; }); }, 0);
    });
    painel.querySelector('[data-limpar-historico]').addEventListener('click', () => { try { localStorage.removeItem(chave); } catch {} desenhar(); });
    desenhar();
  }

  function rota() {
    const id = location.hash.slice(1);
    const f = ferramentas.find(x => x[0] === id);
    cards.hidden = !!f; raiz.querySelector('[data-busca-container]').hidden = !!f; painel.hidden = !f;
    if (!f) return;
    const titulo = painel.querySelector('#tecTitulo'); titulo.textContent = f[2];
    painel.querySelector('[data-conteudo]').innerHTML = conteudo[id];
    configurarFormulario(id); instalarSalvamento(id); configurarCopia();
    if (id === 'c4') configurarComparador();
    if (id === 'c6') configurarGuia();
    if (id === 'c8') configurarFaq();
    if (id === 'c9') configurarVisuais();
    if (id === 'c10') configurarHistorico();
    titulo.focus();
  }
  window.addEventListener('hashchange', rota); rota();
})();
