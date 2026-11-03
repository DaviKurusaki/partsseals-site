/* Área do Cliente — painel. A tela é decidida pelo status do cadastro
 * (pendente/aprovado/recusado/bloqueado), nunca pela lista de pedidos. */
(function () {
  "use strict";
  var R = window.PSRegras, C = window.PSCliente, esc = C.escapar;
  var tela = document.querySelector("[data-tela]");
  var principal = document.querySelector("#conteudo");
  var botaoSair = document.querySelector("[data-sair]");

  // Ícones SVG inline (traço simples, cor do texto).
  function svg(caminho) {
    return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true">' + caminho + "</svg>";
  }
  var ICONES = {
    check: svg('<path d="M5 12l4.5 4.5L19 7"/>'),
    relogio: svg('<circle cx="12" cy="12" r="9"/><path d="M12 7v5l3 2"/>'),
    alerta: svg('<path d="M12 9v4M12 17h.01"/><path d="M10.3 3.9L2.5 17.5A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3L13.7 3.9a2 2 0 0 0-3.4 0z"/>'),
    caminhao: svg('<path d="M3 6h11v10H3zM14 9h4l3 3v4h-7"/><circle cx="7" cy="17.5" r="1.8"/><circle cx="17" cy="17.5" r="1.8"/>'),
    carta: svg('<rect x="3" y="5" width="18" height="14" rx="2"/><path d="M3 7l9 6 9-6"/>'),
    aviao: svg('<path d="M10.5 13.5L3 11l1.5-1.5 7 1 4-4.5c1-1 2.5-1.5 3-1s0 2-1 3l-4.5 4 1 7L17.5 20.5 15 13z"/>'),
    loja: svg('<path d="M4 10v10h16V10M3 6l2-3h14l2 3v2a3 3 0 0 1-6 0 3 3 0 0 1-6 0 3 3 0 0 1-6 0z"/>'),
    caixa: svg('<path d="M21 8l-9-5-9 5 9 5 9-5zM3 8v8l9 5 9-5V8M12 13v8"/>'),
    nota: svg('<path d="M7 3h7l5 5v13H7zM14 3v5h5M10 13h6M10 17h6"/>'),
    lupa: svg('<circle cx="11" cy="11" r="7"/><path d="M20 20l-3.5-3.5"/>'),
    seta: svg('<path d="M9 6l6 6-6 6"/>'),
    whats: svg('<path d="M20 11.5a8.5 8.5 0 0 1-12.6 7.4L3 20l1.2-4.2A8.5 8.5 0 1 1 20 11.5z"/><path d="M8.5 9c.5 2.5 2.5 4.5 5 5l1.2-1.2 2 .8c-.2 1.3-1.4 2-2.7 1.8-3.3-.6-5.8-3.1-6.4-6.4C7.4 7.7 8.1 6.5 9.4 6.3l.8 2z"/>'),
  };
  var ICONE_METODO = { Transportadora: "caminhao", Entregamos: "caminhao", Correio: "carta", "Azul Cargo": "aviao", "Cliente Retira": "loja" };

  var estado = { pedidos: [], empresas: [], empresa: "", dias: 180, filtro: "todos", busca: "", nome: "" };

  // Mais de uma empresa liberada: cada pedido diz de qual é e aparece o filtro.
  function variasEmpresas() { return estado.empresas.length > 1; }

  function irParaEntrar() { location.replace("/cliente/entrar"); }

  function mostrar(html) {
    tela.innerHTML = html;
    principal.setAttribute("aria-busy", "false");
  }

  function contatos() {
    return '<ul class="cli-contatos"><li>WhatsApp e telefone: (19) 98301-1817 · (19) 3626-3552</li>' +
      '<li><a href="mailto:vendas@parts-seals.com.br">vendas@parts-seals.com.br</a></li></ul>';
  }

  function telaEstado(icone, titulo, texto, extra) {
    mostrar('<section class="cli-cartao cli-estado cli-estreito"><div class="cli-estado__icone">' + ICONES[icone] + "</div>" +
      "<h1>" + esc(titulo) + "</h1><p>" + esc(texto) + "</p>" + (extra || "") + "</section>");
  }

  function telaPendente(nome) {
    telaEstado("relogio", "Seu cadastro está em análise",
      (nome ? nome + ", r" : "R") + "ecebemos seus dados. Nossa equipe confere e libera seu acesso, e você recebe um aviso no WhatsApp. Se tiver pressa, fale com o nosso comercial.",
      '<a class="btn btn-primary" href="' + esc(C.linkComercial()) + '" target="_blank" rel="noopener noreferrer">' + ICONES.whats + " Falar com o comercial</a>");
  }

  function telaSemAcesso() {
    telaEstado("alerta", "Acesso indisponível", "No momento não é possível mostrar seus pedidos por aqui. Fale com a Parts Seals pelos contatos abaixo.", contatos());
  }

  // --- pedidos ------------------------------------------------------------------

  function etiquetaEtapa(etapa) {
    var classe = etapa === "entregue" ? " cli-etiqueta--entregue" : ["aguardando_retirada", "em_rota", "com_transportadora"].indexOf(etapa) >= 0 ? " cli-etiqueta--caminho" : "";
    return '<span class="cli-etiqueta' + classe + '">' + esc(R.ROTULO_ETAPA[etapa] || "Em andamento") + "</span>";
  }

  function linhaDoTempo(p) {
    return '<ol class="cli-tempo" aria-label="Andamento do pedido">' + R.passos(p).map(function (passo) {
      return '<li class="cli-passo cli-passo--' + passo.estado + '"' + (passo.corrente ? ' aria-current="step"' : "") + ">" +
        '<span class="cli-passo__marca">' + (passo.estado === "feito" ? ICONES.check : "") + "</span>" +
        "<span>" + esc(passo.nome) + '<span class="cli-oculto">' + (passo.estado === "feito" ? " (concluído)" : passo.estado === "atual" ? " (etapa atual)" : " (próximo)") + "</span></span></li>";
    }).join("") + "</ol>";
  }

  function blocoDetalhes(p) {
    var partes = [];
    if (p.metodo_entrega) {
      partes.push('<div class="cli-info">' + ICONES[ICONE_METODO[p.metodo_entrega] || "caixa"] + "<div><span>Entrega</span><strong>" + esc(p.metodo_entrega) + "</strong></div></div>");
    }
    var nfs = (p.nfs || []).filter(Boolean);
    if (nfs.length) partes.push('<div class="cli-info">' + ICONES.nota + "<div><span>Nota fiscal</span><strong>" + nfs.map(esc).join(", ") + "</strong></div></div>");
    var rs = R.rastreios(p);
    if (rs.length) {
      partes.push('<div class="cli-info">' + ICONES.caixa + "<div><span>Rastreio</span>" + rs.map(function (r) {
        return '<div class="cli-rastreio">' + (r.correios
          ? '<a href="' + esc(r.link) + '" target="_blank" rel="noopener noreferrer">' + esc(r.codigo) + "</a>"
          : "<strong>" + esc(r.codigo) + '</strong><button class="cli-copiar" type="button" data-copiar="' + esc(r.codigo) + '">Copiar</button>') + "</div>";
      }).join("") + "</div></div>");
    }
    return partes.length ? '<div class="cli-detalhes">' + partes.join("") + "</div>" : "";
  }

  function blocoItens(p) {
    var itens = p.itens || [];
    if (!itens.length) return "";
    var rotulo = itens.length === 1 ? "Ver o item" : "Ver os " + itens.length + " itens";
    return '<details class="cli-itens"><summary>' + ICONES.seta + esc(rotulo) + "</summary><ul>" + itens.map(function (i) {
      var meta = [];
      if (i.material) meta.push("<span>Material: " + esc(i.material) + "</span>");
      var q = R.quantidade(i.quantidade);
      if (q) meta.push("<span>Quantidade: " + esc(q) + "</span>");
      meta.push(etiquetaEtapa(i.etapa));
      return '<li class="cli-item"><span class="cli-item__desc">' + esc(i.descricao) + '</span><span class="cli-item__meta">' + meta.join("") + "</span></li>";
    }).join("") + "</ul></details>";
  }

  function cartaoPedido(p) {
    var entregue = p.etapa === "entregue";
    var prazo = entregue
      ? '<div class="cli-prazo cli-prazo--entregue"><span>Situação</span><strong>Entregue</strong></div>'
      : (p.data_prevista ? '<div class="cli-prazo"><span>Previsão</span><strong>' + esc(R.dataBr(p.data_prevista)) + "</strong></div>" : "");
    var meta = [];
    if (p.pedido_cliente) meta.push("Sua OC: " + esc(p.pedido_cliente));
    if (p.data_pedido) meta.push("Pedido em " + esc(R.dataBr(p.data_pedido)));
    var linhaEntregue = "";
    if (entregue && p.entregue_em) {
      linhaEntregue = '<p class="cli-entregue">Entregue em ' + esc(R.dataHoraBr(p.entregue_em)) + (p.recebido_por ? ", recebido por " + esc(p.recebido_por) : "") + "</p>";
    }
    var progresso = R.progressoItens(p);
    // O mesmo nº de pedido pode existir em duas empresas: o id leva a empresa.
    var idTitulo = "ped-" + esc(p.empresa_id == null ? "" : p.empresa_id) + "-" + esc(p.pedido);
    var empresa = variasEmpresas() && p.empresa ? '<span class="cli-empresa">' + esc(p.empresa) + "</span>" : "";
    return '<article class="cli-pedido" aria-labelledby="' + idTitulo + '">' +
      '<div class="cli-pedido__topo"><div>' + empresa + '<h2 class="cli-pedido__num" id="' + idTitulo + '">Pedido ' + esc(p.pedido) + "</h2>" +
      (meta.length ? '<p class="cli-pedido__meta">' + meta.join(" · ") + "</p>" : "") +
      (progresso ? '<span class="cli-parcial">' + progresso.entregues + " de " + progresso.total + " itens entregues</span>" : "") +
      "</div>" + prazo + "</div>" + linhaEntregue + linhaDoTempo(p) + blocoDetalhes(p) + blocoItens(p) + "</article>";
  }

  function esqueleto() {
    return '<div class="cli-lista" aria-hidden="true">' + [1, 2, 3].map(function () { return '<div class="cli-esqueleto"><span></span><span></span><span></span></div>'; }).join("") + "</div>";
  }

  function desenharLista() {
    var lista = document.querySelector("[data-lista]");
    var visiveis = R.filtrar(estado.pedidos, { filtro: estado.filtro, busca: estado.busca, empresa: estado.empresa });
    if (!visiveis.length) {
      lista.innerHTML = '<div class="cli-vazio">' + ICONES.caixa + "<p>" + (estado.pedidos.length ? "Nenhum pedido encontrado com esse filtro." : "Nenhum pedido nesse período.") + "</p></div>";
      return;
    }
    lista.innerHTML = visiveis.map(cartaoPedido).join("");
  }

  function desenharResumo() {
    var r = R.resumo(R.filtrar(estado.pedidos, { empresa: estado.empresa }));
    document.querySelector("[data-resumo]").innerHTML =
      '<div class="cli-numero cli-numero--producao"><strong>' + r.producao + "</strong><span>Em produção</span></div>" +
      '<div class="cli-numero cli-numero--caminho"><strong>' + r.caminho + "</strong><span>A caminho</span></div>" +
      '<div class="cli-numero cli-numero--entregue"><strong>' + r.entregue + "</strong><span>Entregues</span></div>";
  }

  function carregarPedidos() {
    var lista = document.querySelector("[data-lista]");
    lista.setAttribute("aria-busy", "true");
    lista.innerHTML = esqueleto();
    C.api("GET", "pedidos?dias=" + estado.dias).then(function (r) {
      if (r.status === 401) { irParaEntrar(); return; }
      if (!r.dados || !r.dados.ok) throw new Error("falha");
      estado.pedidos = r.dados.pedidos || [];
      estado.empresas = r.dados.empresas || [];
      if (!estado.empresas.some(function (e) { return String(e.id) === estado.empresa; })) estado.empresa = "";
      desenharEmpresas();
      desenharResumo();
      desenharLista();
    }).catch(function () {
      lista.innerHTML = '<div class="cli-vazio">' + ICONES.alerta + "<p>Não conseguimos carregar seus pedidos agora.</p>" +
        '<button class="btn btn-secondary" type="button" data-tentar>Tentar de novo</button></div>';
    }).then(function () { lista.setAttribute("aria-busy", "false"); });
  }

  function desenharEmpresas() {
    var caixa = document.querySelector("[data-empresas]");
    if (!variasEmpresas()) { caixa.hidden = true; caixa.innerHTML = ""; return; }
    caixa.hidden = false;
    caixa.innerHTML = '<label class="cli-oculto" for="empresa">Empresa</label>' +
      '<select class="cli-input" id="empresa" data-empresa><option value="">Todas as empresas</option>' +
      estado.empresas.map(function (e) {
        var id = String(e.id);
        return '<option value="' + esc(id) + '"' + (id === estado.empresa ? " selected" : "") + ">" + esc(e.nome) + "</option>";
      }).join("") + "</select>";
    caixa.querySelector("[data-empresa]").addEventListener("change", function (ev) {
      estado.empresa = ev.target.value;
      desenharResumo();
      desenharLista();
    });
  }

  function telaPedidos(primeiroNome) {
    mostrar(
      '<div class="cli-ola"><h1>Olá, ' + esc(primeiroNome || "cliente") + "</h1><p>Meus pedidos</p></div>" +
      '<div class="cli-resumo" data-resumo aria-live="polite"></div>' +
      '<div class="cli-ferramentas"><div class="cli-linha-ferr">' +
      '<label class="cli-oculto" for="busca">Buscar pedido ou OC</label>' +
      '<input class="cli-input" id="busca" type="search" placeholder="Buscar pelo nº do pedido ou da sua OC" data-busca>' +
      '<div class="cli-filtros" role="group" aria-label="Filtrar pedidos">' +
      '<button class="cli-chip" type="button" data-filtro="todos" aria-pressed="true">Todos</button>' +
      '<button class="cli-chip" type="button" data-filtro="aberto" aria-pressed="false">Em aberto</button>' +
      '<button class="cli-chip" type="button" data-filtro="entregue" aria-pressed="false">Entregues</button></div>' +
      '<div class="cli-empresas" data-empresas hidden></div>' +
      '<label class="cli-oculto" for="periodo">Período</label>' +
      '<select class="cli-input" id="periodo" data-periodo><option value="90">Últimos 90 dias</option><option value="180" selected>Últimos 6 meses</option>' +
      '<option value="365">Último ano</option><option value="730">Últimos 2 anos</option></select></div></div>' +
      '<div class="cli-lista" data-lista aria-live="polite"></div>');
    desenharResumo();
    var busca = document.querySelector("[data-busca]");
    var espera;
    busca.addEventListener("input", function () { clearTimeout(espera); espera = setTimeout(function () { estado.busca = busca.value; desenharLista(); }, 150); });
    document.querySelectorAll("[data-filtro]").forEach(function (b) {
      b.addEventListener("click", function () {
        estado.filtro = b.dataset.filtro;
        document.querySelectorAll("[data-filtro]").forEach(function (x) { x.setAttribute("aria-pressed", String(x === b)); });
        desenharLista();
      });
    });
    document.querySelector("[data-periodo]").addEventListener("change", function (ev) { estado.dias = Number(ev.target.value); carregarPedidos(); });
    tela.addEventListener("click", function (ev) {
      var copiar = ev.target.closest("[data-copiar]");
      if (copiar && navigator.clipboard) {
        navigator.clipboard.writeText(copiar.dataset.copiar).then(function () {
          copiar.textContent = "Copiado!";
          setTimeout(function () { copiar.textContent = "Copiar"; }, 1600);
        }).catch(function () {});
      }
      if (ev.target.closest("[data-tentar]")) carregarPedidos();
    });
    carregarPedidos();
  }

  function iniciar() {
    C.api("GET", "eu").then(function (r) {
      if (r.status === 401) { irParaEntrar(); return; }
      if (!r.dados || !r.dados.ok) throw new Error("falha");
      botaoSair.hidden = false;
      var cad = r.dados.cadastro;
      if (!cad) { telaSemAcesso(); return; }
      if (cad.status === "aprovado") telaPedidos(cad.primeiroNome);
      else if (cad.status === "pendente") telaPendente(cad.primeiroNome);
      else telaSemAcesso();
    }).catch(function () {
      mostrar('<div class="cli-vazio">' + ICONES.alerta + "<p>" + esc(C.FALHA_REDE) + '</p><button class="btn btn-secondary" type="button" data-recarregar>Tentar de novo</button></div>');
      document.querySelector("[data-recarregar]").addEventListener("click", function () { tela.innerHTML = esqueleto(); iniciar(); });
    });
  }

  botaoSair.addEventListener("click", function () {
    botaoSair.disabled = true;
    C.api("POST", "sair").catch(function () {}).then(function () { location.replace("/cliente/entrar"); });
  });

  iniciar();
})();
