(function () {
  "use strict";

  document.documentElement.classList.remove("no-js");
  document.documentElement.classList.add("js");

  var PAGE_LANG = (document.documentElement.lang || "pt-BR").toLowerCase().slice(0, 2);
  var CONTACT_COPY = {
    pt: {
      whatsappMessage: "Olá! Vim pelo site da Parts Seals e gostaria de solicitar um orçamento.",
      interestPrefix: " Interesse: ",
      emailSubject: "Solicitação de orçamento - Parts Seals",
      emailBody: "Olá! Vim pelo site da Parts Seals e gostaria de enviar um desenho técnico para orçamento.",
      menuOpen: "Abrir menu",
      menuClose: "Fechar menu",
    },
    en: {
      whatsappMessage: "Hello! I came from the Parts Seals website and would like to request a quote.",
      interestPrefix: " Interest: ",
      emailSubject: "Quote request - Parts Seals",
      emailBody: "Hello! I came from the Parts Seals website and would like to send a technical drawing for quotation.",
      menuOpen: "Open menu",
      menuClose: "Close menu",
    },
    es: {
      whatsappMessage: "¡Hola! Vengo del sitio web de Parts Seals y quisiera solicitar una cotización.",
      interestPrefix: " Interés: ",
      emailSubject: "Solicitud de cotización - Parts Seals",
      emailBody: "¡Hola! Vengo del sitio web de Parts Seals y quisiera enviar un dibujo técnico para cotización.",
      menuOpen: "Abrir menú",
      menuClose: "Cerrar menú",
    },
  };

  var CONTACT = {
    whatsappNumber: "5519983011817",
    email: "vendas@parts-seals.com.br",
    copy: CONTACT_COPY[PAGE_LANG] || CONTACT_COPY.pt,
  };

  var SEGMENT_PRODUCTS = {
    pt: {
      "white-goods": ["Gaxetas compactas", "Raspadores e anéis guia", "Vedações em PU e PTFE", "Peças sob medida por amostra"],
      "oil-gas": ["Perfis DP e DH em PTFE", "Anéis back-up padrões", "Gaxetas e raspadores resistentes", "Peças conforme fluido e pressão"],
      food: ["Vedações compatíveis com o processo", "Gaxetas e raspadores", "Anéis guia", "Peças sob medida para higienização"],
      pharma: ["Perfis em PTFE e polímeros compatíveis", "Gaxetas compactas", "Raspadores", "Peças sob desenho técnico"],
      mining: ["Gaxetas em poliuretano", "Raspadores para contaminação severa", "Anéis guia", "Back-ups e peças robustas"],
      construction: ["Gaxetas compactas", "Raspadores", "Anéis back-up", "Guias para cilindros hidráulicos"],
      agriculture: ["Gaxetas e raspadores", "Anéis guia", "Back-ups padrões", "Vedações para cilindros e implementos"],
      metallurgy: ["Perfis em PTFE e poliuretano", "Gaxetas resistentes ao desgaste", "Raspadores", "Peças técnicas sob medida"],
      "pulp-paper": ["Gaxetas e raspadores", "Anéis guia", "Peças em PTFE e PU", "Vedações desenvolvidas por amostra"],
      maintenance: ["Reposição por amostra ou desenho", "Gaxetas compactas", "Raspadores e guias", "Back-ups e peças técnicas"],
      hydraulic: ["Gaxetas compactas e perfis DP/DH", "Raspadores", "Anéis guia", "Back-ups padrões"],
      pneumatic: ["Gaxetas para ciclos repetitivos", "Raspadores", "Anéis guia de baixo atrito", "Peças em PU e PTFE"],
      "yellow-line": ["Gaxetas compactas para cilindros", "Raspadores para serviço pesado", "Anéis guia", "Back-ups e peças sob medida"],
      "green-line": ["Gaxetas para implementos agrícolas", "Raspadores", "Anéis guia", "Back-ups para sistemas hidráulicos móveis"],
    },
    en: {
      "white-goods": ["Compact seals", "Wipers and guide rings", "PU and PTFE seals", "Custom parts from samples"],
      "oil-gas": ["DP and DH PTFE profiles", "Standard back-up rings", "Heavy-duty seals and wipers", "Parts selected for fluid and pressure"],
      food: ["Process-compatible seals", "Seals and wipers", "Guide rings", "Custom parts designed for cleaning"],
      pharma: ["PTFE and compatible polymer profiles", "Compact seals", "Wipers", "Parts made from technical drawings"],
      mining: ["Polyurethane seals", "Wipers for severe contamination", "Guide rings", "Heavy-duty back-ups and parts"],
      construction: ["Compact seals", "Wipers", "Back-up rings", "Guides for hydraulic cylinders"],
      agriculture: ["Seals and wipers", "Guide rings", "Standard back-ups", "Seals for cylinders and implements"],
      metallurgy: ["PTFE and polyurethane profiles", "Wear-resistant seals", "Wipers", "Custom technical parts"],
      "pulp-paper": ["Seals and wipers", "Guide rings", "PTFE and PU parts", "Seals developed from samples"],
      maintenance: ["Replacement from samples or drawings", "Compact seals", "Wipers and guides", "Back-ups and technical parts"],
      hydraulic: ["Compact seals and DP/DH profiles", "Wipers", "Guide rings", "Standard back-ups"],
      pneumatic: ["Seals for repetitive cycles", "Wipers", "Low-friction guide rings", "PU and PTFE parts"],
      "yellow-line": ["Compact cylinder seals", "Heavy-duty wipers", "Guide rings", "Back-ups and custom parts"],
      "green-line": ["Seals for agricultural implements", "Wipers", "Guide rings", "Back-ups for mobile hydraulic systems"],
    },
    es: {
      "white-goods": ["Sellos compactos", "Rascadores y anillos guía", "Sellos en PU y PTFE", "Piezas a medida por muestra"],
      "oil-gas": ["Perfiles DP y DH en PTFE", "Anillos back-up estándar", "Sellos y rascadores resistentes", "Piezas según fluido y presión"],
      food: ["Sellos compatibles con el proceso", "Sellos y rascadores", "Anillos guía", "Piezas a medida para higienización"],
      pharma: ["Perfiles en PTFE y polímeros compatibles", "Sellos compactos", "Rascadores", "Piezas según dibujo técnico"],
      mining: ["Sellos de poliuretano", "Rascadores para contaminación severa", "Anillos guía", "Back-ups y piezas robustas"],
      construction: ["Sellos compactos", "Rascadores", "Anillos back-up", "Guías para cilindros hidráulicos"],
      agriculture: ["Sellos y rascadores", "Anillos guía", "Back-ups estándar", "Sellos para cilindros e implementos"],
      metallurgy: ["Perfiles en PTFE y poliuretano", "Sellos resistentes al desgaste", "Rascadores", "Piezas técnicas a medida"],
      "pulp-paper": ["Sellos y rascadores", "Anillos guía", "Piezas en PTFE y PU", "Sellos desarrollados por muestra"],
      maintenance: ["Reposición por muestra o dibujo", "Sellos compactos", "Rascadores y guías", "Back-ups y piezas técnicas"],
      hydraulic: ["Sellos compactos y perfiles DP/DH", "Rascadores", "Anillos guía", "Back-ups estándar"],
      pneumatic: ["Sellos para ciclos repetitivos", "Rascadores", "Anillos guía de baja fricción", "Piezas en PU y PTFE"],
      "yellow-line": ["Sellos compactos para cilindros", "Rascadores para servicio pesado", "Anillos guía", "Back-ups y piezas a medida"],
      "green-line": ["Sellos para implementos agrícolas", "Rascadores", "Anillos guía", "Back-ups para sistemas hidráulicos móviles"],
    },
  };

  var SEGMENT_QUOTE_PREFIX = {
    pt: "Orientação técnica para o setor: ",
    en: "Technical guidance for sector: ",
    es: "Orientación técnica para el sector: ",
  };

  var header = document.querySelector("[data-header]");
  var menu = document.querySelector("[data-menu]");
  var menuToggle = document.querySelector("[data-menu-toggle]");
  var year = document.getElementById("currentYear");
  var revealItems = document.querySelectorAll(".reveal");
  var faqButtons = document.querySelectorAll(".faq-item button");
  var segmentButtons = document.querySelectorAll("[data-segment]");
  var segmentModal = document.getElementById("segmentModal");
  var segmentModalTitle = document.getElementById("segmentModalTitle");
  var segmentModalProducts = document.getElementById("segmentModalProducts");
  var segmentModalClose = segmentModal ? segmentModal.querySelector(".segment-modal__close") : null;
  var segmentQuoteLink = segmentModal ? segmentModal.querySelector("[data-segment-quote]") : null;
  var activeSegmentTrigger = null;

  function buildWhatsAppUrl(extraText) {
    var message = CONTACT.copy.whatsappMessage;
    if (extraText) {
      message += CONTACT.copy.interestPrefix + extraText + ".";
    }
    return "https://wa.me/" + CONTACT.whatsappNumber + "?text=" + encodeURIComponent(message);
  }

  function buildEmailUrl() {
    return "mailto:" + CONTACT.email + "?subject=" + encodeURIComponent(CONTACT.copy.emailSubject) + "&body=" + encodeURIComponent(CONTACT.copy.emailBody);
  }

  document.querySelectorAll("[data-whatsapp-link]").forEach(function (link) {
    link.href = buildWhatsAppUrl(link.getAttribute("data-product"));
  });

  document.querySelectorAll("[data-email-drawing]").forEach(function (link) {
    link.href = buildEmailUrl();
  });

  function closeSegmentModal() {
    if (!segmentModal || segmentModal.hidden) return;
    segmentModal.hidden = true;
    segmentModal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("segment-modal-open");

    if (activeSegmentTrigger) {
      activeSegmentTrigger.setAttribute("aria-expanded", "false");
      activeSegmentTrigger.focus();
      activeSegmentTrigger = null;
    }
  }

  function openSegmentModal(button) {
    if (!segmentModal || !segmentModalTitle || !segmentModalProducts) return;

    var segmentKey = button.getAttribute("data-segment");
    var productsByLanguage = SEGMENT_PRODUCTS[PAGE_LANG] || SEGMENT_PRODUCTS.pt;
    var products = productsByLanguage[segmentKey];
    var titleElement = button.querySelector("span");
    var title = titleElement ? titleElement.textContent.trim() : "";

    if (!products || !title) return;

    segmentModalTitle.textContent = title;
    segmentModalProducts.textContent = "";
    products.forEach(function (product) {
      var item = document.createElement("li");
      item.textContent = product;
      segmentModalProducts.appendChild(item);
    });

    if (segmentQuoteLink) {
      var quotePrefix = SEGMENT_QUOTE_PREFIX[PAGE_LANG] || SEGMENT_QUOTE_PREFIX.pt;
      segmentQuoteLink.href = buildWhatsAppUrl(quotePrefix + title);
    }

    activeSegmentTrigger = button;
    button.setAttribute("aria-expanded", "true");
    segmentModal.hidden = false;
    segmentModal.setAttribute("aria-hidden", "false");
    document.body.classList.add("segment-modal-open");

    if (segmentModalClose) {
      segmentModalClose.focus();
    }
  }

  if (segmentButtons.length && segmentModal) {
    segmentButtons.forEach(function (button) {
      button.setAttribute("aria-expanded", "false");
      button.addEventListener("click", function () {
        openSegmentModal(button);
      });
    });

    segmentModal.querySelectorAll("[data-segment-modal-close]").forEach(function (control) {
      control.addEventListener("click", closeSegmentModal);
    });

    segmentModal.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        closeSegmentModal();
        return;
      }

      if (event.key !== "Tab") return;

      var focusableItems = segmentModal.querySelectorAll('button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])');
      if (!focusableItems.length) return;

      var firstItem = focusableItems[0];
      var lastItem = focusableItems[focusableItems.length - 1];

      if (event.shiftKey && document.activeElement === firstItem) {
        event.preventDefault();
        lastItem.focus();
      } else if (!event.shiftKey && document.activeElement === lastItem) {
        event.preventDefault();
        firstItem.focus();
      }
    });
  }

  if (year) {
    year.textContent = String(new Date().getFullYear());
  }

  function setHeaderState() {
    if (!header) return;
    header.classList.toggle("is-scrolled", window.scrollY > 12);
  }

  setHeaderState();
  window.addEventListener("scroll", setHeaderState, { passive: true });

  function closeMenu() {
    if (!menu || !menuToggle) return;
    menu.classList.remove("is-open");
    menuToggle.setAttribute("aria-expanded", "false");
    menuToggle.setAttribute("aria-label", CONTACT.copy.menuOpen);
    document.body.classList.remove("menu-open");
  }

  if (menu && menuToggle) {
    menuToggle.setAttribute("aria-label", CONTACT.copy.menuOpen);

    menuToggle.addEventListener("click", function () {
      var willOpen = menuToggle.getAttribute("aria-expanded") !== "true";
      menu.classList.toggle("is-open", willOpen);
      menuToggle.setAttribute("aria-expanded", String(willOpen));
      menuToggle.setAttribute("aria-label", willOpen ? CONTACT.copy.menuClose : CONTACT.copy.menuOpen);
      document.body.classList.toggle("menu-open", willOpen);
    });

    menu.querySelectorAll("a").forEach(function (link) {
      link.addEventListener("click", closeMenu);
    });

    document.addEventListener("keydown", function (event) {
      if (event.key === "Escape") {
        closeMenu();
      }
    });
  }

  if ("IntersectionObserver" in window) {
    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add("is-visible");
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.12,
        rootMargin: "0px 0px -40px",
      }
    );

    revealItems.forEach(function (item) {
      observer.observe(item);
    });
  } else {
    revealItems.forEach(function (item) {
      item.classList.add("is-visible");
    });
  }

  faqButtons.forEach(function (button) {
    button.addEventListener("click", function () {
      var answerId = button.getAttribute("aria-controls");
      var answer = answerId ? document.getElementById(answerId) : null;
      var isOpen = button.getAttribute("aria-expanded") === "true";

      faqButtons.forEach(function (otherButton) {
        var otherId = otherButton.getAttribute("aria-controls");
        var otherAnswer = otherId ? document.getElementById(otherId) : null;
        otherButton.setAttribute("aria-expanded", "false");
        if (otherAnswer) {
          otherAnswer.hidden = true;
        }
      });

      button.setAttribute("aria-expanded", String(!isOpen));
      if (answer) {
        answer.hidden = isOpen;
      }
    });
  });
})();
