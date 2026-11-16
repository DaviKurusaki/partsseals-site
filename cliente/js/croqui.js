/*
 * Área do Cliente — Croqui.
 *
 * O cliente escolhe um perfil liberado, clica nas cotas do desenho e troca os
 * valores — o mesmo esquema do Castor no Kuru. O desenho NUNCA é calculado
 * aqui: cada mudança vira um pedido (POST croqui-gerar); a estação do Kuru roda
 * o motor do Castor e devolve o desenho e as cotas, que esta tela só mostra.
 * Salvar guarda o croqui no banco e a estação gera o PDF com as marcas d'água
 * da Parts Seals. Rotas: #croqui (meus croquis), #croqui/novo, #croqui/<id>.
 */
(function () {
  "use strict";
  var C = window.PSCliente, esc = C.escapar;
  var UUID = /^[a-f0-9]{8}-(?:[a-f0-9]{4}-){3}[a-f0-9]{12}$/i;
  var ESPERA_DIGITACAO = 500, INTERVALO_CONSULTA = 800, LIMITE_ESPERA = 60000;

  function svg(caminho) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + caminho + "</svg>";
  }
  var ICONES = {
    seta: svg('<path d="M9 6l6 6-6 6"/>'),
    voltar: svg('<path d="M15 6l-6 6 6 6"/>'),
    mais: svg('<path d="M12 5v14M5 12h14"/>'),
    pdf: svg('<path d="M7 3h7l5 5v13H7zM14 3v5h5"/><path d="M12 11v6M9.5 14.5L12 17l2.5-2.5"/>'),
    lixo: svg('<path d="M4 7h16M9 7V4h6v3M6 7l1 13h10l1-13"/>'),
    regua: svg('<path d="M3 17L17 3l4 4L7 21z"/><path d="M7 13l2 2M10 10l2 2M13 7l2 2"/>'),
    alerta: svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
  };

  var numeroCroqui = function (n) { return "CQ-" + String(n == null ? 0 : n).padStart(6, "0"); };
  var mm = function (v) { return typeof v === "number" && isFinite(v) ? v.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : "—"; };
  function resumo(r) {
    if (!r) return "";
    var partes = r.sec != null && r.dext == null ? [r.dint, r.sec] : [r.dint, r.dext, r.h];
    return partes.filter(function (v) { return v != null; }).map(mm).join(" × ") + " mm";
  }
  function dataHora(iso) { try { return new Date(iso).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" }); } catch (e) { return ""; } }
  function tolerancia(t) {
    if (!t || (t.superior == null && t.inferior == null)) return "";
    if (t.superior != null && t.inferior === -t.superior) return " ±" + mm(t.superior);
    return " (" + (t.superior == null ? "—" : (t.superior > 0 ? "+" : "") + mm(t.superior)) + " / " + (t.inferior == null ? "—" : mm(t.inferior)) + ")";
  }
  function valorCota(c) { return (typeof c.valor === "number" ? mm(c.valor) : String(c.valor == null ? "—" : c.valor)) + (c.unidade === "°" ? "°" : c.unidade === "mm" || !c.unidade ? " mm" : ""); }

  // Só desenho: tags e atributos de uma lista fechada (mesma regra do Castor).
  var TAGS = ["svg", "defs", "pattern", "marker", "rect", "line", "path", "text", "tspan", "circle", "ellipse", "g", "polyline", "polygon"];
  var ATRIBUTOS = ["xmlns", "viewbox", "font-family", "id", "class", "x", "y", "x1", "x2", "y1", "y2", "cx", "cy", "r", "rx", "ry", "width", "height", "d", "points", "transform", "patternunits", "patterntransform", "marker-start", "marker-end", "markerwidth", "markerheight", "refx", "refy", "orient", "fill", "stroke", "stroke-width", "stroke-dasharray", "stroke-opacity", "fill-opacity", "opacity", "font-size", "font-weight", "text-anchor", "dominant-baseline", "dy", "dx", "data-cota-id"];
  // As cores e traços do desenho vêm das classes da folha de estilos do motor,
  // que o CSP não deixa aplicar: viram atributos (mesmos valores do Castor).
  var CLASSES = {
    p: { fill: "url(#hatch)", stroke: "#111", "stroke-width": "1.6" }, pl: { stroke: "#111", "stroke-width": "1.4" },
    o: { stroke: "#111", "stroke-width": "1" }, ax: { stroke: "#555", "stroke-width": ".8", "stroke-dasharray": "14 4 3 4" },
    d: { stroke: "#b2221f", "stroke-width": ".9" }, e: { stroke: "#b2221f", "stroke-width": ".6" },
    t: { "font-size": "13", fill: "#b2221f", "font-weight": "700" }, tn: { "font-size": "11.5", fill: "#b2221f" },
    vt: { "font-size": "13", fill: "#111", "font-weight": "700" }, det: { fill: "none", stroke: "#555", "stroke-width": ".8", "stroke-dasharray": "4 3" },
    n: { "font-size": "11.5", fill: "#333" },
  };
  function svgSeguro(texto) {
    // style="" e <style> nem chegam ao DOMParser: o CSP do site (style-src 'self') recusaria.
    var limpo = String(texto || "").replace(/<style[\s\S]*?<\/style>/gi, "")
      .replace(/\sstyle="\s*font-size:\s*([\d.]+)px\s*;?\s*"/gi, ' font-size="$1"').replace(/\sstyle=("[^"]*"|'[^']*')/gi, "");
    var doc = new DOMParser().parseFromString(limpo, "image/svg+xml");
    if (doc.querySelector("parsererror") || doc.documentElement.localName !== "svg") return "";
    var todos = [doc.documentElement].concat(Array.prototype.slice.call(doc.documentElement.querySelectorAll("*")));
    todos.forEach(function (el) {
      if (TAGS.indexOf(el.localName) < 0) { el.remove(); return; }
      Array.prototype.slice.call(el.attributes).forEach(function (a) {
        if (ATRIBUTOS.indexOf(a.name.toLowerCase()) < 0 || (/url\(/i.test(a.value) && !/^url\(#[\w-]+\)$/.test(a.value))) el.removeAttribute(a.name);
      });
      (el.getAttribute("class") || "").split(/\s+/).forEach(function (c) {
        var attrs = CLASSES[c]; if (!attrs) return;
        Object.keys(attrs).forEach(function (k) { if (!el.hasAttribute(k)) el.setAttribute(k, attrs[k]); });
      });
    });
    return new XMLSerializer().serializeToString(doc.documentElement);
  }

  // Liga os textos do desenho às cotas que o motor descreveu (mesma regra do Castor).
  function marcarTextos(raiz, cotas) {
    var desenho = raiz.querySelector(".cq-folha svg");
    if (!desenho || !cotas.length) return;
    var textos = Array.prototype.slice.call(desenho.querySelectorAll("text"));
    var separadas = textos.some(function (el) { return (el.textContent || "").trim() === "DIÂMETROS"; });
    textos.forEach(function (el) {
      var texto = (el.textContent || "").trim();
      var numeros = (texto.match(/-?\d+(?:[.,]\d+)?/g) || []).map(function (x) { return Number(x.replace(",", ".")); });
      if (!numeros.length) return;
      var caixa = el.getBBox(), vista = caixa.y + caixa.height / 2 < 455 ? "diametros" : "secao";
      var achadas = cotas.filter(function (c) {
        return c.alvo && (!separadas || c.vista === vista || c.id === "h" || c.id === "lipLen") && typeof c.valor === "number" &&
          numeros.some(function (n) { return Math.abs(n - c.valor) < (c.unidade === "°" ? 0.051 : 0.015); });
      });
      if (/^H\s/i.test(texto)) achadas = achadas.filter(function (c) { return c.id === "h"; });
      else if (/^R\s*\d/i.test(texto)) achadas = achadas.filter(function (c) { return c.id === "Rg"; });
      else if (/[x×].*°/.test(texto)) achadas = achadas.filter(function (c) { return /^ch/.test(c.id); });
      else if (/°/.test(texto)) achadas = achadas.filter(function (c) { return c.unidade === "°"; });
      if (/Ø/.test(texto) && achadas.some(function (c) { return ["intCalc", "extCalc", "intAp", "extAp"].indexOf(c.id) >= 0; })) achadas = achadas.filter(function (c) { return c.id !== "dint" && c.id !== "dext"; });
      if (!achadas.length) return;
      el.setAttribute("data-cotas", achadas.map(function (c) { return c.id; }).join(","));
      el.setAttribute("class", ((el.getAttribute("class") || "") + " cq-texto-cota").trim());
      el.setAttribute("tabindex", "0"); el.setAttribute("role", "button");
      el.setAttribute("aria-label", "Editar " + achadas.map(function (c) { return c.rotulo; }).join(" ou "));
    });
  }

  var MODOS = [
    ["diametros_alojamento", "Diâmetros do alojamento · altura da peça"],
    ["alojamento", "Todas as medidas do alojamento"],
    ["peca", "Todas as medidas da peça"],
  ];

  var ctx = null, vivo = 0, editor = null;

  function voltarHub() { return '<a class="cli-voltar" href="#inicio">' + ICONES.seta + "Todas as ferramentas</a>"; }

  function telaErro(mensagem, bloqueado) {
    ctx.mostrar('<section class="cli-cartao cli-estado cli-estreito"><div class="cli-estado__icone">' + ICONES.alerta + "</div><h1>" +
      (bloqueado ? "Croqui indisponível" : "Não foi possível abrir o Croqui") + "</h1><p>" + esc(mensagem) + "</p>" + voltarHub() + "</section>");
  }

  // --- lista ----------------------------------------------------------------------
  function telaLista() {
    var minha = ++vivo;
    document.title = "Croqui | Área do Cliente | Parts Seals";
    ctx.mostrar(voltarHub() + '<section class="cq-topo"><div><span class="cli-sobrescrito">Croqui</span><h1>Meus croquis</h1>' +
      "<p>Monte o croqui de um perfil padrão da Parts Seals clicando nas cotas do desenho. Salve e baixe o PDF para enviar ao nosso comercial.</p></div>" +
      '<a class="btn btn-primary" href="#croqui/novo">' + ICONES.mais + " Novo croqui</a></section>" +
      '<div class="cq-lista" data-lista aria-busy="true"><div class="cli-esqueleto"><span></span><span></span><span></span></div></div>');
    C.api("GET", "croquis").then(function (r) {
      if (minha !== vivo) return;
      if (r.status === 401) { location.replace("/cliente/entrar"); return; }
      if (!r.dados.ok) { telaErro(r.dados.erro || C.FALHA_REDE, r.dados.semAcesso); return; }
      var lista = document.querySelector("[data-lista]");
      lista.setAttribute("aria-busy", "false");
      var croquis = r.dados.croquis || [];
      lista.innerHTML = croquis.length ? croquis.map(function (c) {
        return '<article class="cq-item"><a class="cq-item__abrir" href="#croqui/' + esc(c.id) + '"><span class="cq-item__num">' + esc(numeroCroqui(c.numero)) + "</span>" +
          "<strong>" + esc(c.titulo) + "</strong><span>" + esc(c.nome_perfil) + " · " + esc(resumo(c.resumo)) + "</span>" +
          '<span class="cq-item__data">Atualizado ' + esc(dataHora(c.atualizado_em)) + "</span></a>" +
          '<div class="cq-item__acoes">' + (c.pdf_pronto ? '<a class="btn btn-secondary" href="/cliente/api/croqui-pdf?id=' + esc(c.id) + '">' + ICONES.pdf + " PDF</a>" :
            '<span class="cq-pill">' + (c.pdf_erro ? "PDF com erro" : "Gerando PDF…") + "</span>") +
          '<button class="btn btn-secondary" type="button" data-excluir="' + esc(c.id) + '" aria-label="Excluir ' + esc(c.titulo) + '">' + ICONES.lixo + "</button></div></article>";
      }).join("") : '<div class="cli-vazio">' + ICONES.regua + "<p>Você ainda não salvou nenhum croqui.</p></div>";
      lista.querySelectorAll("[data-excluir]").forEach(function (b) {
        b.addEventListener("click", function () {
          if (!window.confirm("Excluir este croqui? Não dá para desfazer.")) return;
          b.disabled = true;
          C.api("POST", "croqui-excluir", { id: b.dataset.excluir }).then(function () { telaLista(); }).catch(function () { b.disabled = false; });
        });
      });
    }).catch(function () { if (minha === vivo) telaErro(C.FALHA_REDE); });
  }

  // --- escolha do perfil ----------------------------------------------------------
  function telaNovo() {
    var minha = ++vivo;
    document.title = "Novo croqui | Área do Cliente | Parts Seals";
    ctx.mostrar('<a class="cli-voltar" href="#croqui">' + ICONES.seta + "Meus croquis</a>" +
      '<section class="cq-topo"><div><span class="cli-sobrescrito">Novo croqui</span><h1>Escolha o perfil</h1><p>Depois é só clicar nas cotas do desenho para colocar as suas medidas.</p></div></section>' +
      '<div class="cq-perfis" data-perfis aria-busy="true"><div class="cli-esqueleto"><span></span><span></span></div></div>');
    C.api("GET", "croqui-inicio").then(function (r) {
      if (minha !== vivo) return;
      if (r.status === 401) { location.replace("/cliente/entrar"); return; }
      if (!r.dados.ok || !r.dados.permitido) { telaErro(r.dados.erro || "O Croqui não está liberado para o seu acesso. Fale com a Parts Seals.", true); return; }
      var caixa = document.querySelector("[data-perfis]");
      caixa.setAttribute("aria-busy", "false");
      var perfis = r.dados.perfis || [];
      caixa.innerHTML = perfis.length ? perfis.map(function (p) {
        var partes = /^(.+?)\s*\((.+)\)\s*$/.exec(p.nome);
        return '<button class="cq-perfil" type="button" data-perfil="' + esc(p.perfil) + '"><strong>' + esc(partes ? partes[1] : p.nome) + "</strong>" + (partes ? "<span>" + esc(partes[2]) + "</span>" : "") + "</button>";
      }).join("") : '<div class="cli-vazio"><p>Nenhum perfil disponível no momento.</p></div>';
      caixa.querySelectorAll("[data-perfil]").forEach(function (b) {
        b.addEventListener("click", function () {
          var p = perfis.filter(function (x) { return x.perfil === b.dataset.perfil; })[0];
          telaEditor({ perfil: p.perfil, nome_perfil: p.nome, titulo: "", entrada: { valores: {}, referencia: null } });
        });
      });
    }).catch(function () { if (minha === vivo) telaErro(C.FALHA_REDE); });
  }

  // --- editor ---------------------------------------------------------------------
  function telaEditor(croqui) {
    var minha = ++vivo;
    var est = {
      id: croqui.id || null, numero: croqui.numero || null, perfil: croqui.perfil, nome: croqui.nome_perfil || croqui.perfil,
      titulo: croqui.titulo || "", valores: Object.assign({}, (croqui.entrada && croqui.entrada.valores) || {}),
      referencia: croqui.entrada && croqui.entrada.referencia ? { modo: croqui.entrada.referencia.modo, valores: Object.assign({}, croqui.entrada.referencia.valores) } : null,
      resultado: croqui.desenho || null, pedido: null, gerando: false, alterado: false, pdfPronto: Boolean(croqui.pdf_pronto),
    };
    var espera = null, consulta = 0, cotaAberta = null;
    document.title = (est.numero ? numeroCroqui(est.numero) : "Novo croqui") + " | Área do Cliente | Parts Seals";
    ctx.mostrar('<a class="cli-voltar" href="#croqui">' + ICONES.seta + "Meus croquis</a>" +
      '<section class="cq-editor">' +
      '<header class="cq-editor__topo"><div><span class="cli-sobrescrito">' + (est.numero ? esc(numeroCroqui(est.numero)) : "Novo croqui") + "</span><h1>" + esc(est.nome) + "</h1></div>" +
      '<label class="cq-campo cq-titulo"><span>Nome do croqui</span><input data-titulo maxlength="120" placeholder="Ex.: Gaxeta do cilindro da prensa 3" value="' + esc(est.titulo) + '"></label></header>' +
      '<div class="cq-referencia" data-referencia hidden><label class="cq-campo"><span>As medidas que você informa são</span><select data-modo>' +
      MODOS.map(function (m) { return '<option value="' + m[0] + '">' + esc(m[1]) + "</option>"; }).join("") + "</select></label>" +
      '<div class="cq-referencia__grade">' + ["interno", "externo", "altura"].map(function (k) {
        return '<label class="cq-campo"><span data-rotulo-ref="' + k + '"></span><input inputmode="decimal" autocomplete="off" data-ref="' + k + '"></label>';
      }).join("") + "</div></div>" +
      '<div class="cq-materiais" data-materiais></div>' +
      '<p class="cq-status" data-status role="status"></p>' +
      '<div class="cq-area"><div class="cq-palco" data-palco><div class="cq-folha" data-folha></div><div class="cq-marca" aria-hidden="true"></div>' +
      '<div class="cq-pop" data-pop hidden><label for="cq-pop-valor" data-pop-rotulo></label><select data-pop-escolha hidden></select><div><input id="cq-pop-valor" inputmode="decimal" autocomplete="off" data-pop-valor>' +
      '<button class="btn btn-primary" type="button" data-pop-ok>Concluir</button></div><small>Enter confirma · Esc cancela</small></div></div>' +
      '<aside class="cq-cotas" data-lista-cotas aria-label="Cotas do desenho"></aside></div>' +
      '<footer class="cq-acoes"><p>Croqui ilustrativo: a Parts Seals confere medidas, material e tolerâncias antes de produzir.</p>' +
      '<div><a class="btn btn-secondary" data-pdf hidden>' + ICONES.pdf + ' Baixar PDF</a><button class="btn btn-primary" type="button" data-salvar>Salvar croqui</button></div></footer>' +
      "</section>");

    var raiz = document.querySelector(".cq-editor");
    var $ = function (s) { return raiz.querySelector(s); };
    var marca = $(".cq-marca"), linhaMarca = "PARTS SEALS · CROQUI · " + (ctx.nome || "").toUpperCase() + " · ";
    marca.innerHTML = new Array(16).join("<span>" + esc(new Array(5).join(linhaMarca)) + "</span>");

    function status(texto, tipo) { var el = $("[data-status]"); el.textContent = texto || ""; el.className = "cq-status" + (tipo ? " cq-status--" + tipo : ""); }
    function atualizarPdf() {
      var a = $("[data-pdf]");
      a.hidden = !(est.id && est.pdfPronto && !est.alterado);
      if (!a.hidden) a.href = "/cliente/api/croqui-pdf?id=" + encodeURIComponent(est.id);
    }

    function desenhar() {
      var r = est.resultado;
      if (!r) return;
      var g = r.geometria || {}, cotas = g.cotas || [];
      // Referência das medidas (gaxetas)
      var caixaRef = $("[data-referencia]");
      if (r.referencia && !est.referencia) est.referencia = { modo: r.referencia.modo, valores: Object.assign({}, r.referencia.valores) };
      caixaRef.hidden = !est.referencia;
      if (est.referencia) {
        $("[data-modo]").value = est.referencia.modo;
        var peca = est.referencia.modo === "peca";
        $('[data-rotulo-ref="interno"]').textContent = peca ? "Ø do lábio interno da peça (mm)" : "Ø interno do alojamento (mm)";
        $('[data-rotulo-ref="externo"]').textContent = peca ? "Ø do lábio externo da peça (mm)" : "Ø externo do alojamento (mm)";
        $('[data-rotulo-ref="altura"]').textContent = est.referencia.modo === "alojamento" ? "Largura do alojamento (mm)" : "Altura da peça (mm)";
        raiz.querySelectorAll("[data-ref]").forEach(function (i) { if (i !== document.activeElement) i.value = est.referencia.valores[i.dataset.ref] == null ? "" : String(est.referencia.valores[i.dataset.ref]); });
      }
      // Material
      var mats = (r.campos || []).filter(function (c) { return c.controle === "select"; });
      $("[data-materiais]").innerHTML = mats.map(function (c) {
        var atual = est.valores[c.k] != null ? est.valores[c.k] : c.valor;
        return '<label class="cq-campo"><span>' + esc(c.rotulo) + '</span><select data-k="' + esc(c.k) + '">' + (c.opcoes || []).map(function (o) {
          return '<option value="' + esc(o.valor) + '"' + (String(o.valor) === String(atual) ? " selected" : "") + ">" + esc(o.texto) + "</option>";
        }).join("") + "</select></label>";
      }).join("");
      // Desenho
      var folha = $("[data-folha]");
      folha.innerHTML = g.vistasSvg ? svgSeguro(g.vistasSvg) : '<div class="cli-vazio"><p>' + esc(r.erro || "Complete as medidas para ver o desenho.") + "</p></div>";
      marcarTextos(raiz, cotas);
      // Lista de cotas
      var editaveis = cotas.filter(function (c) { return c.alvo; }), fixas = cotas.filter(function (c) { return !c.alvo && c.origem !== "calculada"; });
      $("[data-lista-cotas]").innerHTML = "<strong>Cotas do desenho</strong><small>Clique numa cota (no desenho ou aqui) para mudar o valor.</small>" +
        (r.referencia && r.referencia.descricao ? '<p class="cq-cotas__ref">' + esc(r.referencia.descricao) + "</p>" : "") +
        editaveis.map(function (c) {
          return '<button type="button" data-cota-id="' + esc(c.id) + '"><span>' + esc(c.rotulo) + "</span><b>" + esc(valorCota(c)) + "<em>" + esc(tolerancia(c.tolerancia)) + "</em></b></button>";
        }).join("") + fixas.map(function (c) { return '<div><span>' + esc(c.rotulo) + "</span><b>" + esc(valorCota(c)) + "</b></div>"; }).join("");
      if (r.erro) status(r.erro, "erro"); else if (!est.gerando) status(editaveis.length + " cotas editáveis", "ok");
    }

    function meta(id) { return ((est.resultado && est.resultado.geometria && est.resultado.geometria.cotas) || []).filter(function (c) { return c.id === id; })[0]; }
    function campo(k) { return ((est.resultado && est.resultado.campos) || []).filter(function (c) { return c.k === k; })[0]; }

    function mudarValor(chave, valor) {
      est.valores[chave] = valor;
      if (est.referencia) {
        var mapa = est.referencia.modo === "peca" ? { xLi: "interno", xLe: "externo", h: "altura", dint: "nominalInterno", dext: "nominalExterno" } : { dint: "interno", dext: "externo", h: "altura" };
        if (mapa[chave]) est.referencia.valores[mapa[chave]] = valor;
      }
      alterou();
    }
    function alterou() { est.alterado = true; atualizarPdf(); clearTimeout(espera); espera = setTimeout(gerar, ESPERA_DIGITACAO); }

    function gerar() {
      var minhaConsulta = ++consulta;
      est.gerando = true; est.pedido = null;
      status("Gerando o desenho…", "carregando");
      $("[data-palco]").classList.add("cq-palco--gerando");
      var inicio = Date.now();
      C.api("POST", "croqui-gerar", { perfil: est.perfil, entrada: { valores: est.valores, referencia: est.referencia } }).then(function (r) {
        if (minhaConsulta !== consulta || minha !== vivo) return;
        if (r.status === 401) { location.replace("/cliente/entrar"); return; }
        if (!r.dados.ok) { fim(); status(r.dados.erro || C.FALHA_REDE, "erro"); if (r.dados.semAcesso) telaErro(r.dados.erro, true); return; }
        (function consultar() {
          setTimeout(function () {
            if (minhaConsulta !== consulta || minha !== vivo) return;
            C.api("GET", "croqui-pedido?id=" + encodeURIComponent(r.dados.id)).then(function (p) {
              if (minhaConsulta !== consulta || minha !== vivo) return;
              var d = p.dados || {};
              if (d.status === "pronto") { fim(); est.pedido = r.dados.id; est.resultado = d.resultado; desenhar(); return; }
              if (d.status === "erro" || !d.ok) { fim(); status(d.erro || "Não foi possível gerar o desenho. Confira as medidas.", "erro"); return; }
              if (Date.now() - inicio > LIMITE_ESPERA) { fim(); status("O gerador de desenhos da Parts Seals não respondeu. Tente de novo em alguns minutos.", "erro"); return; }
              status(d.fila ? "Na fila (" + d.fila + " antes de você)…" : "Gerando o desenho…", "carregando");
              consultar();
            }).catch(function () { if (minhaConsulta === consulta) { fim(); status(C.FALHA_REDE, "erro"); } });
          }, INTERVALO_CONSULTA);
        })();
      }).catch(function () { if (minhaConsulta === consulta) { fim(); status(C.FALHA_REDE, "erro"); } });
    }
    function fim() { est.gerando = false; $("[data-palco]").classList.remove("cq-palco--gerando"); }

    // Popup de edição da cota
    var pop = $("[data-pop]"), popValor = $("[data-pop-valor]"), popEscolha = $("[data-pop-escolha]");
    function abrirCota(id, alvo, opcoes) {
      var m = meta(id); if (!m || !m.alvo) return;
      fecharCota();
      var c = campo(m.alvo);
      var anterior = est.valores[m.alvo] != null ? String(est.valores[m.alvo]) : c && c.valor != null && String(c.valor) !== "" ? String(c.valor) : String(m.valorEdicao != null ? m.valorEdicao : m.valor).replace(".", ",");
      cotaAberta = { id: id, chave: m.alvo, anterior: est.valores[m.alvo], alvo: alvo };
      $("[data-pop-rotulo]").textContent = m.rotulo + (m.ajuste ? " · " + m.ajuste : "");
      popEscolha.hidden = !(opcoes && opcoes.length > 1);
      if (opcoes && opcoes.length > 1) popEscolha.innerHTML = opcoes.map(function (o) { return '<option value="' + esc(o.id) + '"' + (o.id === id ? " selected" : "") + ">" + esc(o.rotulo) + " · " + esc(valorCota(o)) + "</option>"; }).join("");
      popEscolha._opcoes = opcoes; popEscolha._alvo = alvo;
      popValor.value = anterior;
      pop.hidden = false;
      var palco = $("[data-palco]").getBoundingClientRect(), a = alvo.getBoundingClientRect();
      pop.style.left = Math.max(8, Math.min(palco.width - pop.offsetWidth - 8, a.left - palco.left)) + "px";
      pop.style.top = Math.max(8, Math.min(palco.height - pop.offsetHeight - 8, a.bottom - palco.top + 8)) + "px";
      popValor.focus(); popValor.select();
    }
    function fecharCota(cancelar) {
      if (!cotaAberta) return;
      var c = cotaAberta; cotaAberta = null; pop.hidden = true;
      var digitado = popValor.value.trim();
      if (cancelar) return;
      if (digitado !== "" && !/^\d{1,5}(?:[.,]\d{1,4})?$/.test(digitado)) { status("Use só números, como 98,5.", "erro"); return; }
      if (String(est.valores[c.chave] == null ? "" : est.valores[c.chave]) !== digitado) mudarValor(c.chave, digitado);
    }
    function ativar(alvo) {
      if (alvo.getAttribute("data-cotas")) {
        var opcoes = alvo.getAttribute("data-cotas").split(",").map(meta).filter(function (c) { return c && c.alvo; });
        if (opcoes.length) abrirCota(opcoes[0].id, alvo, opcoes);
      } else abrirCota(alvo.getAttribute("data-cota-id"), alvo);
    }
    raiz.addEventListener("click", function (e) {
      var alvo = e.target.closest && e.target.closest("[data-cota-id],[data-cotas]");
      if (alvo && !pop.contains(alvo)) ativar(alvo);
    });
    raiz.addEventListener("keydown", function (e) {
      var alvo = e.target.closest && e.target.closest("[data-cotas]");
      if (alvo && (e.key === "Enter" || e.key === " ")) { e.preventDefault(); ativar(alvo); }
    });
    popValor.addEventListener("keydown", function (e) { if (e.key === "Enter" || e.key === "Escape") { e.preventDefault(); fecharCota(e.key === "Escape"); } });
    popEscolha.addEventListener("change", function () { abrirCota(popEscolha.value, popEscolha._alvo, popEscolha._opcoes); });
    $("[data-pop-ok]").addEventListener("click", function () { fecharCota(); });

    $("[data-materiais]").addEventListener("change", function (e) { if (e.target.dataset.k) mudarValor(e.target.dataset.k, e.target.value); });
    $("[data-titulo]").addEventListener("input", function (e) { est.titulo = e.target.value; });
    raiz.querySelectorAll("[data-ref]").forEach(function (i) {
      i.addEventListener("input", function () {
        if (!est.referencia) return;
        if (i.value.trim() && !/^\d{1,5}(?:[.,]\d{1,4})?$/.test(i.value.trim())) { status("Use só números, como 98,5.", "erro"); return; }
        est.referencia.valores[i.dataset.ref] = i.value.trim(); alterou();
      });
    });
    $("[data-modo]").addEventListener("change", function (e) {
      var anterior = est.referencia && est.referencia.modo, modo = e.target.value, r = est.resultado || {}, g = r.geometria || {}, med = g.medidas || {};
      var cota = function (id) { var c = meta(id); return c ? c.valor : undefined; };
      var nom = (r.referencia && r.referencia.nominais) || {};
      est.referencia = { modo: modo, valores: modo === "peca"
        ? { interno: cota("intAp") != null ? cota("intAp") : med.dint, externo: cota("extAp") != null ? cota("extAp") : med.dext, altura: med.h }
        : { interno: nom.interno != null ? nom.interno : med.dint, externo: nom.externo != null ? nom.externo : med.dext, altura: nom.altura != null ? nom.altura : med.h } };
      if (anterior === "peca" && modo !== "peca") { delete est.valores.xLi; delete est.valores.xLe; }
      desenhar(); alterou();
    });

    $("[data-salvar]").addEventListener("click", function () {
      var botao = $("[data-salvar]");
      if (!est.titulo.trim()) { status("Dê um nome ao croqui antes de salvar.", "erro"); $("[data-titulo]").focus(); return; }
      if (est.gerando || !est.pedido) {
        status(est.gerando ? "Espere o desenho terminar para salvar." : "Mude uma medida ou aguarde o desenho para salvar.", "erro");
        if (!est.gerando && !est.pedido) gerar();
        return;
      }
      if (est.resultado && est.resultado.erro) { status("Corrija as medidas antes de salvar: " + est.resultado.erro, "erro"); return; }
      botao.disabled = true;
      C.api("POST", "croqui-salvar", { pedido: est.pedido, titulo: est.titulo.trim(), croqui: est.id }).then(function (r) {
        botao.disabled = false;
        if (!r.dados.ok) { status(r.dados.erro || C.FALHA_REDE, "erro"); return; }
        var novo = !est.id;
        est.id = r.dados.id; est.numero = r.dados.numero; est.alterado = false; est.pdfPronto = false;
        raiz.querySelector(".cli-sobrescrito").textContent = numeroCroqui(est.numero);
        if (novo) history.replaceState(null, "", "#croqui/" + est.id);
        status("Croqui " + numeroCroqui(est.numero) + " salvo. O PDF com as marcas d'água fica pronto em instantes.", "ok");
        esperarPdf(minha);
      }).catch(function () { botao.disabled = false; status(C.FALHA_REDE, "erro"); });
    });

    function esperarPdf(dono, tentativa) {
      tentativa = tentativa || 0;
      if (dono !== vivo || tentativa > 40 || est.alterado) return;
      setTimeout(function () {
        if (dono !== vivo || est.alterado) return;
        C.api("GET", "croqui?id=" + encodeURIComponent(est.id)).then(function (r) {
          if (dono !== vivo) return;
          if (r.dados.ok && r.dados.croqui && r.dados.croqui.pdf_pronto) { est.pdfPronto = true; atualizarPdf(); return; }
          esperarPdf(dono, tentativa + 1);
        }).catch(function () { esperarPdf(dono, tentativa + 1); });
      }, 2500);
    }

    atualizarPdf();
    if (est.resultado) { desenhar(); if (est.id && !est.pdfPronto) esperarPdf(minha); }
    // Croqui salvo já tem o desenho; mesmo assim pede um pedido novo para poder salvar alterações.
    gerar();
    editor = { fechar: function () { clearTimeout(espera); consulta++; } };
  }

  function abrirCroquiSalvo(id) {
    var minha = ++vivo;
    ctx.mostrar('<div class="cli-lista" aria-hidden="true"><div class="cli-esqueleto"><span></span><span></span><span></span></div></div>');
    C.api("GET", "croqui?id=" + encodeURIComponent(id)).then(function (r) {
      if (minha !== vivo) return;
      if (r.status === 401) { location.replace("/cliente/entrar"); return; }
      if (!r.dados.ok) { telaErro(r.dados.erro || "Croqui não encontrado.", r.dados.semAcesso); return; }
      telaEditor(r.dados.croqui);
    }).catch(function () { if (minha === vivo) telaErro(C.FALHA_REDE); });
  }

  window.PSCroqui = {
    /** Chamado pelo painel quando o hash começa com #croqui. */
    abrir: function (contexto) {
      ctx = contexto;
      if (editor) { editor.fechar(); editor = null; }
      var partes = String(location.hash || "").replace(/^#/, "").split("/");
      if (partes[1] === "novo") telaNovo();
      else if (partes[1] && UUID.test(partes[1])) abrirCroquiSalvo(partes[1]);
      else telaLista();
    },
    _testes: { svgSeguro: svgSeguro, resumo: resumo, numeroCroqui: numeroCroqui },
  };
})();
