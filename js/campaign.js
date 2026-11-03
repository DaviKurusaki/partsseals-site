// Campanhas sazonais: troca a cor de destaque do site conforme o mês
// e mostra um selo com a fita da campanha. Carregado no <head> (sem defer) para
// a cor certa já aparecer no primeiro desenho da página.
// Pré-visualização: ?campanha=setembro-amarelo | outubro-rosa | novembro-azul | natal | nenhuma
(function () {
  "use strict";

  var BY_MONTH = { 9: "setembro-amarelo", 10: "outubro-rosa", 11: "novembro-azul", 12: "natal" };

  var COPY = {
    "setembro-amarelo": {
      color: "#f5b800",
      pt: { name: "Setembro Amarelo", text: "Falar é a melhor solução. Se precisar de apoio, ligue 188 (CVV), 24h e gratuito.", link: "Conheça o CVV" },
      en: { name: "Yellow September", text: "Suicide prevention month. In Brazil, CVV offers free 24/7 support at 188.", link: "Learn more" },
      es: { name: "Septiembre Amarillo", text: "Mes de prevención del suicidio. En Brasil, el CVV atiende gratis 24h en el 188.", link: "Saber más" },
      url: "https://cvv.org.br/",
    },
    "outubro-rosa": {
      color: "#e0457b",
      pt: { name: "Outubro Rosa", text: "A Parts Seals apoia a prevenção e o diagnóstico precoce do câncer de mama.", link: "Saiba mais" },
      en: { name: "Pink October", text: "Parts Seals supports breast cancer prevention and early diagnosis.", link: "Learn more" },
      es: { name: "Octubre Rosa", text: "Parts Seals apoya la prevención y el diagnóstico precoz del cáncer de mama.", link: "Saber más" },
      url: "https://www.gov.br/inca/pt-br/assuntos/cancer/tipos/mama",
    },
    "novembro-azul": {
      color: "#2b7de9",
      pt: { name: "Novembro Azul", text: "A Parts Seals apoia o cuidado com a saúde do homem e a prevenção do câncer de próstata.", link: "Saiba mais" },
      en: { name: "Blue November", text: "Parts Seals supports men's health and prostate cancer prevention.", link: "Learn more" },
      es: { name: "Noviembre Azul", text: "Parts Seals apoya la salud masculina y la prevención del cáncer de próstata.", link: "Saber más" },
      url: "https://www.gov.br/inca/pt-br/assuntos/cancer/tipos/prostata",
    },
    "natal": {
      color: "#28845e",
      manterLogo: true,
      pt: { name: "Boas festas", text: "Um Natal de paz e um novo ano de boas parcerias. Obrigado por fazer parte da nossa história." },
      en: { name: "Happy holidays", text: "Wishing you a peaceful Christmas and a new year of great partnerships. Thank you for being part of our story." },
      es: { name: "Felices fiestas", text: "Una Navidad de paz y un nuevo año de buenas alianzas. Gracias por ser parte de nuestra historia." },
    },
  };

  var CLOSE_LABEL = { pt: "Fechar aviso da campanha", en: "Close campaign notice", es: "Cerrar aviso de la campaña" };

  var root = document.documentElement;
  var forced = (location.search.match(/[?&]campanha=([a-z-]+)/) || [])[1];
  var campaign = forced ? (COPY[forced] ? forced : null) : BY_MONTH[new Date().getMonth() + 1];
  if (!campaign) return;

  var info = COPY[campaign];
  root.setAttribute("data-campaign", campaign);

  var themeColor = document.querySelector('meta[name="theme-color"]');
  if (themeColor) themeColor.setAttribute("content", info.color);

  // Gaxetas da logo e ícone da aba na cor da campanha (assets/campanhas/<campanha>/).
  var LOGO_PATTERN = /assets\/(logo-(?:header|footer)-white\.png)$/;

  function recolorNode(node) {
    if (info.manterLogo) return;
    if (node.nodeType !== 1) return;
    var images = node.tagName === "IMG" ? [node] : node.querySelectorAll("img");
    for (var i = 0; i < images.length; i++) {
      var src = images[i].getAttribute("src") || "";
      if (LOGO_PATTERN.test(src)) {
        images[i].setAttribute("src", src.replace(LOGO_PATTERN, "assets/campanhas/" + campaign + "/$1"));
      }
    }
  }

  var svgIcon = document.querySelector('link[rel="icon"][type="image/svg+xml"]');
  if (svgIcon && !info.manterLogo) {
    svgIcon.setAttribute("href", svgIcon.getAttribute("href").replace("assets/icons/favicon.svg", "assets/campanhas/" + campaign + "/favicon.svg"));
  }

  // Troca a logo enquanto a página é montada, antes de aparecer em vermelho.
  var logoObserver = "MutationObserver" in window ? new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
      mutation.addedNodes.forEach(recolorNode);
    });
  }) : null;
  if (logoObserver) logoObserver.observe(root, { childList: true, subtree: true });

  // O selo some depois de fechado, até a campanha do ano seguinte.
  var storageKey = "ps-campanha-fechada-" + campaign + "-" + new Date().getFullYear();

  function wasDismissed() {
    if (forced) return false;
    try { return localStorage.getItem(storageKey) === "1"; } catch (error) { return false; }
  }

  function showBadge() {
    if (logoObserver) logoObserver.disconnect();
    recolorNode(document.body);

    // Na área autenticada a campanha pinta a interface sem cobrir ferramentas.
    if (document.body.classList.contains("cli-corpo")) return;
    if (wasDismissed()) return;

    var lang = (root.lang || "pt").toLowerCase().slice(0, 2);
    var copy = info[lang] || info.pt;
    var svgNs = "http://www.w3.org/2000/svg";

    var badge = document.createElement("aside");
    badge.className = "campaign-badge";
    badge.setAttribute("aria-label", copy.name);

    var ribbon = document.createElementNS(svgNs, "svg");
    ribbon.setAttribute("viewBox", "0 0 24 32");
    ribbon.setAttribute("aria-hidden", "true");
    ribbon.setAttribute("class", "campaign-badge__ribbon");
    var path = document.createElementNS(svgNs, "path");
    path.setAttribute("d", "M12 1.5c-3.6 0-6 2.6-6 6 0 2.8 1.6 5.8 3.5 8.6L3 26.5l3.6 2.3L12 20.4l5.4 8.4 3.6-2.3-6.5-10.4c1.9-2.8 3.5-5.8 3.5-8.6 0-3.4-2.4-6-6-6Zm0 3.7c1.4 0 2.3 1 2.3 2.5 0 1.6-1 3.6-2.3 5.6-1.3-2-2.3-4-2.3-5.6 0-1.5.9-2.5 2.3-2.5Z");
    if (campaign === "natal") {
      ribbon.setAttribute("viewBox", "0 0 24 24");
      path.setAttribute("d", "m12 2 3.1 6.3 6.9 1-5 4.9 1.2 6.8-6.2-3.3L5.8 21 7 14.2 2 9.3l6.9-1Z");
    }
    ribbon.appendChild(path);

    var content = document.createElement("div");
    var title = document.createElement("strong");
    title.textContent = copy.name;
    var text = document.createElement("p");
    text.textContent = copy.text + " ";
    if (info.url) {
      var link = document.createElement("a");
      link.href = info.url;
      link.target = "_blank";
      link.rel = "noopener noreferrer";
      link.textContent = copy.link;
      text.appendChild(link);
    }
    content.appendChild(title);
    content.appendChild(text);

    var close = document.createElement("button");
    close.type = "button";
    close.className = "campaign-badge__close";
    close.setAttribute("aria-label", CLOSE_LABEL[lang] || CLOSE_LABEL.pt);
    close.textContent = "×";
    close.addEventListener("click", function () {
      badge.remove();
      try { localStorage.setItem(storageKey, "1"); } catch (error) { /* sem armazenamento: só fecha */ }
    });

    badge.appendChild(ribbon);
    badge.appendChild(content);
    badge.appendChild(close);
    document.body.appendChild(badge);
  }

  if (document.readyState === "loading") {
    document.addEventListener("DOMContentLoaded", showBadge);
  } else {
    showBadge();
  }
})();
