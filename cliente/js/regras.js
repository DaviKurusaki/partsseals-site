/*
 * Área do Cliente — regras puras (sem DOM nem rede). Usadas pelas páginas e
 * pelos testes (tests/cliente-regras.cjs). Script clássico, como o resto do
 * site: expõe window.PSRegras no navegador e module.exports no Node.
 */
(function (raiz) {
  "use strict";

  var ETAPAS = ["recebido", "em_producao", "pronto", "aguardando_retirada", "em_rota", "com_transportadora", "entregue"];
  var INDICE = { recebido: 0, em_producao: 1, pronto: 2, aguardando_retirada: 3, em_rota: 3, com_transportadora: 3, entregue: 4 };
  var GRUPO = { recebido: "producao", em_producao: "producao", pronto: "producao",
    aguardando_retirada: "caminho", em_rota: "caminho", com_transportadora: "caminho", entregue: "entregue" };
  var ROTULO_ETAPA = {
    recebido: "Pedido recebido", em_producao: "Em produção", pronto: "Pronto",
    aguardando_retirada: "Aguardando retirada", em_rota: "A caminho", com_transportadora: "Na transportadora", entregue: "Entregue",
  };

  function texto(v) { return v === null || v === undefined ? "" : String(v).trim(); }

  /** Rótulo do 4º passo: pela etapa, ou (antes de chegar lá) pelo método de entrega. */
  function rotuloQuartoPasso(pedido) {
    var e = pedido && pedido.etapa;
    if (e === "aguardando_retirada" || e === "em_rota" || e === "com_transportadora") return ROTULO_ETAPA[e];
    var m = texto(pedido && pedido.metodo_entrega);
    if (m === "Cliente Retira") return "Aguardando retirada";
    if (m === "Transportadora" || m === "Correio" || m === "Azul Cargo") return "Na transportadora";
    return "A caminho";
  }

  /** Os 5 passos da linha do tempo com o estado de cada um. */
  function passos(pedido) {
    var atual = INDICE[pedido && pedido.etapa];
    if (atual === undefined) atual = 0;
    var nomes = ["Pedido recebido", "Em produção", "Pronto", rotuloQuartoPasso(pedido), "Entregue"];
    return nomes.map(function (nome, i) {
      var estado = i < atual ? "feito" : i === atual ? (atual === 4 ? "feito" : "atual") : "futuro";
      return { nome: nome, estado: estado, corrente: i === atual };
    });
  }

  function resumo(pedidos) {
    var r = { producao: 0, caminho: 0, entregue: 0 };
    (pedidos || []).forEach(function (p) { var g = GRUPO[p.etapa]; if (g) r[g] += 1; });
    return r;
  }

  function semAcento(v) { return texto(v).normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase(); }

  /** filtro: "todos" | "aberto" | "entregue"; busca: nº do pedido ou OC;
   *  empresa: id da empresa ("" ou ausente = todas). */
  function filtrar(pedidos, opcoes) {
    var busca = semAcento(opcoes && opcoes.busca);
    var filtro = (opcoes && opcoes.filtro) || "todos";
    var empresa = texto(opcoes && opcoes.empresa);
    return (pedidos || []).filter(function (p) {
      if (empresa && texto(p.empresa_id) !== empresa) return false;
      if (filtro === "aberto" && p.etapa === "entregue") return false;
      if (filtro === "entregue" && p.etapa !== "entregue") return false;
      if (!busca) return true;
      return semAcento(p.pedido).indexOf(busca) >= 0 || semAcento(p.pedido_cliente).indexOf(busca) >= 0;
    });
  }

  /** "X de Y itens entregues" — só quando os itens estão em etapas diferentes. */
  function progressoItens(pedido) {
    var itens = (pedido && pedido.itens) || [];
    if (itens.length < 2) return null;
    var etapas = {};
    itens.forEach(function (i) { etapas[i.etapa] = true; });
    if (Object.keys(etapas).length < 2) return null;
    var entregues = itens.filter(function (i) { return i.etapa === "entregue"; }).length;
    // Só faz sentido com entrega parcial: "0 de 3 entregues" não informa nada.
    if (entregues === 0) return null;
    return { entregues: entregues, total: itens.length };
  }

  var CORREIOS = /^[A-Z]{2}\d{9}[A-Z]{2}$/;
  function rastreios(pedido) {
    return ((pedido && pedido.rastreios) || []).map(texto).filter(function (r) { return r && r.toUpperCase() !== "PRESENCIAL"; })
      .map(function (r) {
        var codigo = r.toUpperCase();
        return CORREIOS.test(codigo)
          ? { codigo: codigo, correios: true, link: "https://rastreamento.correios.com.br/app/index.php?objetos=" + codigo }
          : { codigo: r, correios: false, link: null };
      });
  }

  /** "2026-11-02" -> "02/11/2026" (data pura, sem fuso). */
  function dataBr(iso) {
    var m = texto(iso).match(/^(\d{4})-(\d{2})-(\d{2})/);
    return m ? m[3] + "/" + m[2] + "/" + m[1] : "";
  }

  /** Instante -> "02/11 às 14:30" no fuso de São Paulo. */
  function dataHoraBr(instante) {
    var d = new Date(instante);
    if (!instante || isNaN(d.getTime())) return "";
    var partes = {};
    new Intl.DateTimeFormat("pt-BR", { timeZone: "America/Sao_Paulo", day: "2-digit", month: "2-digit", hour: "2-digit", minute: "2-digit", hour12: false })
      .formatToParts(d).forEach(function (p) { partes[p.type] = p.value; });
    return partes.day + "/" + partes.month + " às " + partes.hour + ":" + partes.minute;
  }

  function quantidade(q) {
    if (q === null || q === undefined || q === "") return "";
    var n = Number(q);
    return isFinite(n) ? n.toLocaleString("pt-BR", { maximumFractionDigits: 3 }) : texto(q);
  }

  // --- validação do cadastro (mesmas regras do servidor, só para avisar antes) ---

  function digitos(v) { return texto(v).replace(/\D/g, ""); }
  function cnpjValido(v) {
    var d = digitos(v);
    if (d.length !== 14 || /^(\d)\1{13}$/.test(d)) return false;
    function dv(pesos) {
      var soma = 0;
      for (var i = 0; i < pesos.length; i++) soma += Number(d[i]) * pesos[i];
      var resto = soma % 11;
      return resto < 2 ? 0 : 11 - resto;
    }
    var p1 = [5, 4, 3, 2, 9, 8, 7, 6, 5, 4, 3, 2];
    return dv(p1) === Number(d[12]) && dv([6].concat(p1)) === Number(d[13]);
  }
  function mascaraCnpj(v) {
    var d = digitos(v).slice(0, 14);
    return d.replace(/^(\d{2})(\d)/, "$1.$2").replace(/^(\d{2})\.(\d{3})(\d)/, "$1.$2.$3")
      .replace(/\.(\d{3})(\d)/, ".$1/$2").replace(/(\d{4})(\d)/, "$1-$2");
  }
  function mascaraTelefone(v) {
    var d = digitos(v).slice(0, 11);
    if (d.length <= 2) return d.length ? "(" + d : "";
    if (d.length <= 6) return "(" + d.slice(0, 2) + ") " + d.slice(2);
    if (d.length <= 10) return "(" + d.slice(0, 2) + ") " + d.slice(2, 6) + "-" + d.slice(6);
    return "(" + d.slice(0, 2) + ") " + d.slice(2, 7) + "-" + d.slice(7);
  }

  var api = {
    ETAPAS: ETAPAS, ROTULO_ETAPA: ROTULO_ETAPA, passos: passos, rotuloQuartoPasso: rotuloQuartoPasso, resumo: resumo,
    filtrar: filtrar, progressoItens: progressoItens, rastreios: rastreios, dataBr: dataBr, dataHoraBr: dataHoraBr,
    quantidade: quantidade, cnpjValido: cnpjValido, mascaraCnpj: mascaraCnpj, mascaraTelefone: mascaraTelefone, digitos: digitos,
  };
  if (typeof module !== "undefined" && module.exports) module.exports = api;
  else raiz.PSRegras = api;
})(typeof window !== "undefined" ? window : globalThis);
