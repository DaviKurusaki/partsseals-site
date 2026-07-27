(function () {
  "use strict";

  var modal = document.querySelector("[data-datasheet-modal]");
  if (!modal) return;

  var panel = modal.querySelector(".datasheet-modal__panel");
  var viewer = modal.querySelector("[data-datasheet-viewer]");
  var pagesContainer = modal.querySelector("[data-datasheet-pages]");
  var title = modal.querySelector("[data-datasheet-title]");
  var zoomOutput = modal.querySelector("[data-datasheet-zoom-output]");
  var closeButton = modal.querySelector("[data-datasheet-close]");
  var activeTrigger = null;
  var zoom = 1;

  function updateZoom(nextZoom) {
    zoom = Math.max(0.75, Math.min(2, nextZoom));
    pagesContainer.style.setProperty("--datasheet-zoom", String(zoom));
    zoomOutput.textContent = Math.round(zoom * 100) + "%";
  }

  function openDatasheet(button) {
    var imagePaths = (button.getAttribute("data-sheet-images") || "").split("|").filter(Boolean);
    if (!imagePaths.length) return;

    activeTrigger = button;
    title.textContent = button.getAttribute("data-sheet-title") || "Datasheet";
    pagesContainer.textContent = "";
    updateZoom(window.matchMedia("(max-width: 680px)").matches ? 0.75 : 1);

    imagePaths.forEach(function (path, index) {
      var image = document.createElement("img");
      image.src = path;
      image.alt = title.textContent + " - página " + (index + 1);
      image.loading = index === 0 ? "eager" : "lazy";
      image.decoding = "async";
      image.draggable = false;
      pagesContainer.appendChild(image);
    });

    modal.hidden = false;
    modal.setAttribute("aria-hidden", "false");
    document.body.classList.add("datasheet-modal-open");
    viewer.scrollTop = 0;
    viewer.scrollLeft = 0;
    closeButton.focus();
  }

  function closeDatasheet() {
    if (modal.hidden) return;
    modal.hidden = true;
    modal.setAttribute("aria-hidden", "true");
    document.body.classList.remove("datasheet-modal-open");
    pagesContainer.textContent = "";
    if (activeTrigger) activeTrigger.focus();
    activeTrigger = null;
  }

  document.querySelectorAll("[data-datasheet-open]").forEach(function (button) {
    button.addEventListener("click", function () {
      openDatasheet(button);
    });
  });

  modal.querySelectorAll("[data-datasheet-close]").forEach(function (button) {
    button.addEventListener("click", closeDatasheet);
  });

  modal.querySelector("[data-datasheet-zoom-in]").addEventListener("click", function () {
    updateZoom(zoom + 0.25);
  });

  modal.querySelector("[data-datasheet-zoom-out]").addEventListener("click", function () {
    updateZoom(zoom - 0.25);
  });

  viewer.addEventListener("contextmenu", function (event) {
    event.preventDefault();
  });

  viewer.addEventListener("dragstart", function (event) {
    event.preventDefault();
  });

  document.addEventListener("keydown", function (event) {
    if (modal.hidden) return;

    if (event.key === "Escape") {
      closeDatasheet();
      return;
    }

    if ((event.ctrlKey || event.metaKey) && ["s", "p", "u"].includes(event.key.toLowerCase())) {
      event.preventDefault();
    }

    if (event.key === "Tab") {
      var focusable = Array.from(
        panel.querySelectorAll("button:not([disabled]), [href], [tabindex]:not([tabindex='-1'])")
      );
      if (!focusable.length) return;
      var first = focusable[0];
      var last = focusable[focusable.length - 1];
      if (event.shiftKey && document.activeElement === first) {
        event.preventDefault();
        last.focus();
      } else if (!event.shiftKey && document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  });
})();

(function () {
  "use strict";

  var form = document.querySelector("[data-material-selector]");
  if (!form) return;

  var results = document.querySelector("[data-selector-results]");
  var cardsContainer = document.querySelector("[data-selector-cards]");
  var summary = document.querySelector("[data-selector-summary]");
  var whatsapp = document.querySelector("[data-selector-whatsapp]");
  var editButton = document.querySelector("[data-selector-edit]");
  var priorityInputs = Array.from(form.querySelectorAll("input[name='priority']"));

  var temperaturePoints = {
    criogenica: -80,
    baixa: -10,
    normal: 40,
    media: 100,
    alta: 160,
    extrema: 230,
  };

  var materials = [
    {
      name: "Poliuretano",
      code: "PU",
      family: "Polímeros",
      anchor: "polimeros",
      summary: "Alta resistência à abrasão, ao rasgo e à extrusão em vedações hidráulicas dinâmicas.",
      fluids: ["oleo", "agua", "ar"],
      temperatures: [-20, 80],
      pressures: ["media", "alta", "muito-alta"],
      motions: ["estatico", "alternado"],
      speeds: ["baixa", "media"],
      priorities: ["desgaste", "impacto", "custo"],
      compliance: [],
      versatility: 2,
    },
    {
      name: "Borracha nitrílica",
      code: "NBR",
      family: "Elastômeros",
      anchor: "elastomeros",
      summary: "Solução de bom custo-benefício para óleos, graxas e muitas aplicações hidráulicas e pneumáticas.",
      fluids: ["oleo", "combustivel", "ar", "agua"],
      temperatures: [-30, 100],
      pressures: ["baixa", "media", "alta"],
      motions: ["estatico", "alternado", "rotativo"],
      speeds: ["baixa", "media"],
      priorities: ["custo", "desgaste"],
      compliance: [],
      versatility: 3,
    },
    {
      name: "FKM / Viton",
      code: "FKM",
      family: "Elastômeros",
      anchor: "elastomeros",
      summary: "Fluoroelastômero para temperaturas elevadas, combustíveis, óleos e diversos meios químicos.",
      fluids: ["oleo", "combustivel", "quimico", "ar"],
      temperatures: [-10, 200],
      pressures: ["baixa", "media", "alta"],
      motions: ["estatico", "alternado", "rotativo"],
      speeds: ["baixa", "media"],
      priorities: ["quimica", "dimensional"],
      compliance: [],
      versatility: 3,
    },
    {
      name: "PTFE virgem",
      code: "PTFE",
      family: "PTFE e compostos",
      anchor: "ptfe",
      summary: "Grande estabilidade química, baixo atrito e ampla faixa térmica; possui declaração de atoxicidade para o grau documentado.",
      fluids: ["oleo", "combustivel", "agua", "vapor", "quimico", "alimento", "ar", "seco"],
      temperatures: [-200, 260],
      pressures: ["baixa", "media", "alta"],
      motions: ["estatico", "alternado", "rotativo", "oscilante"],
      speeds: ["baixa", "media"],
      priorities: ["atrito", "quimica", "dimensional"],
      compliance: ["atoxicidade", "alimenticia"],
      versatility: 5,
    },
    {
      name: "PTFE com bronze",
      code: "PTFE BR",
      family: "PTFE e compostos",
      anchor: "ptfe",
      summary: "Composto para carga, desgaste e condução térmica em sistemas hidráulicos e componentes deslizantes.",
      fluids: ["oleo", "combustivel", "ar"],
      temperatures: [-100, 260],
      pressures: ["media", "alta", "muito-alta"],
      motions: ["alternado", "rotativo", "oscilante"],
      speeds: ["baixa", "media", "alta"],
      priorities: ["desgaste", "atrito", "dimensional"],
      compliance: [],
      versatility: 3,
    },
    {
      name: "PTFE com grafite",
      code: "PTFE GR",
      family: "PTFE e compostos",
      anchor: "ptfe",
      summary: "Baixo atrito e melhor condução de calor, inclusive em contato com contrapartes metálicas mais macias.",
      fluids: ["agua", "quimico", "ar", "seco"],
      temperatures: [-100, 260],
      pressures: ["baixa", "media", "alta"],
      motions: ["alternado", "rotativo", "oscilante"],
      speeds: ["baixa", "media", "alta"],
      priorities: ["atrito", "quimica", "desgaste"],
      compliance: [],
      versatility: 3,
    },
    {
      name: "PTFE T-46",
      code: "T-46",
      family: "PTFE e compostos",
      anchor: "ptfe",
      summary: "PTFE com bronze voltado à hidráulica lubrificada em movimento linear, pressão e resistência à extrusão.",
      fluids: ["oleo"],
      temperatures: [-200, 260],
      pressures: ["alta", "muito-alta"],
      motions: ["alternado"],
      speeds: ["baixa", "media", "alta"],
      priorities: ["desgaste", "atrito", "dimensional"],
      compliance: [],
      versatility: 2,
    },
    {
      name: "PTFE com fibra de carbono",
      code: "PTFE CF",
      family: "PTFE e compostos",
      anchor: "ptfe",
      summary: "Boa estabilidade, resistência ao desgaste e desempenho em aplicações dinâmicas, inclusive com água.",
      fluids: ["oleo", "agua", "ar", "seco"],
      temperatures: [-100, 260],
      pressures: ["media", "alta", "muito-alta"],
      motions: ["alternado", "rotativo", "oscilante"],
      speeds: ["baixa", "media", "alta"],
      priorities: ["desgaste", "atrito", "dimensional"],
      compliance: [],
      versatility: 3,
    },
    {
      name: "PTFE com molibdênio",
      code: "PTFE MoS2",
      family: "PTFE e compostos",
      anchor: "ptfe",
      summary: "Reforço e lubrificação sólida para reduzir atrito e desgaste em movimentos secos ou intermitentes.",
      fluids: ["oleo", "ar", "seco"],
      temperatures: [-100, 250],
      pressures: ["media", "alta"],
      motions: ["alternado", "rotativo", "oscilante"],
      speeds: ["baixa", "media"],
      priorities: ["atrito", "desgaste"],
      compliance: [],
      versatility: 2,
    },
    {
      name: "PTFE com fibra de vidro",
      code: "PTFE FV",
      family: "PTFE e compostos",
      anchor: "ptfe",
      summary: "Maior rigidez, resistência à compressão e menor fluência para guias e vedações técnicas.",
      fluids: ["agua", "vapor", "quimico", "ar"],
      temperatures: [-100, 260],
      pressures: ["media", "alta", "muito-alta"],
      motions: ["estatico", "alternado"],
      speeds: ["baixa", "media"],
      priorities: ["quimica", "dimensional", "desgaste"],
      compliance: [],
      versatility: 3,
    },
    {
      name: "POM / Poliacetal",
      code: "POM",
      family: "Polímeros",
      anchor: "polimeros",
      summary: "Rigidez, estabilidade dimensional e excelente usinabilidade para componentes de precisão.",
      fluids: ["oleo", "agua", "ar"],
      temperatures: [-40, 100],
      pressures: ["baixa", "media"],
      motions: ["rotativo", "oscilante", "estrutural"],
      speeds: ["baixa", "media"],
      priorities: ["dimensional", "atrito", "custo"],
      compliance: [],
      versatility: 3,
    },
    {
      name: "PEAD",
      code: "PEAD",
      family: "Polímeros",
      anchor: "polimeros",
      summary: "Material leve, tenaz, de baixa absorção de água e boa resistência química para componentes de baixa carga.",
      fluids: ["agua", "quimico", "alimento"],
      temperatures: [-50, 80],
      pressures: ["baixa"],
      motions: ["estatico", "estrutural"],
      speeds: ["baixa"],
      priorities: ["quimica", "impacto", "custo"],
      compliance: ["alimenticia"],
      versatility: 2,
    },
    {
      name: "Nylon 6",
      code: "PA6",
      family: "Polímeros",
      anchor: "polimeros",
      summary: "Tenacidade, amortecimento de impacto e resistência ao desgaste para peças mecânicas.",
      fluids: ["oleo", "ar", "seco"],
      temperatures: [-40, 100],
      pressures: ["baixa", "media"],
      motions: ["rotativo", "oscilante", "estrutural"],
      speeds: ["baixa", "media"],
      priorities: ["impacto", "desgaste", "custo"],
      compliance: [],
      versatility: 2,
    },
    {
      name: "Nylon 6.6",
      code: "PA66",
      family: "Polímeros",
      anchor: "polimeros",
      summary: "Maior rigidez e resistência térmica para componentes mecânicos e estruturais.",
      fluids: ["oleo", "ar", "seco"],
      temperatures: [-30, 120],
      pressures: ["baixa", "media"],
      motions: ["rotativo", "oscilante", "estrutural"],
      speeds: ["baixa", "media"],
      priorities: ["dimensional", "desgaste", "custo"],
      compliance: [],
      versatility: 2,
    },
    {
      name: "Technyl PA6 / PA66",
      code: "TECHNYL",
      family: "Polímeros",
      anchor: "polimeros",
      summary: "Família de poliamidas de engenharia para componentes estruturais conforme o grau e o reforço especificados.",
      fluids: ["oleo", "ar", "seco"],
      temperatures: [-30, 150],
      pressures: ["media", "alta"],
      motions: ["rotativo", "oscilante", "estrutural"],
      speeds: ["baixa", "media"],
      priorities: ["impacto", "dimensional", "desgaste"],
      compliance: [],
      versatility: 2,
    },
    {
      name: "PEEK",
      code: "PEEK",
      family: "Polímeros",
      anchor: "polimeros",
      summary: "Polímero de alta performance para temperatura, química e carga quando materiais convencionais atingem o limite.",
      fluids: ["oleo", "combustivel", "agua", "vapor", "quimico", "alimento", "ar", "seco"],
      temperatures: [-60, 260],
      pressures: ["baixa", "media", "alta", "muito-alta"],
      motions: ["estatico", "alternado", "rotativo", "oscilante", "estrutural"],
      speeds: ["baixa", "media", "alta"],
      priorities: ["quimica", "dimensional", "desgaste", "impacto"],
      compliance: ["alimenticia"],
      versatility: 5,
    },
    {
      name: "Celeron",
      code: "CEL",
      family: "Resina fenólica",
      anchor: "resina-fenolitica",
      summary: "Laminado fenólico para buchas, guias, mancais e peças com amortecimento e isolamento.",
      fluids: ["oleo", "ar", "seco"],
      temperatures: [-20, 120],
      pressures: ["baixa", "media"],
      motions: ["rotativo", "oscilante", "estrutural"],
      speeds: ["baixa", "media"],
      priorities: ["impacto", "atrito", "custo"],
      compliance: [],
      versatility: 2,
    },
  ];

  function selectedText(name) {
    var select = form.elements[name];
    return select.options[select.selectedIndex].text;
  }

  function currentValues() {
    return {
      fluid: form.elements.fluid.value,
      temperature: form.elements.temperature.value,
      pressure: form.elements.pressure.value,
      motion: form.elements.motion.value,
      speed: form.elements.speed.value,
      compliance: form.elements.compliance.value,
      priorities: priorityInputs.filter(function (input) {
        return input.checked;
      }).map(function (input) {
        return input.value;
      }),
    };
  }

  function scoreMaterial(material, values) {
    var score = material.versatility;
    var temperature = temperaturePoints[values.temperature];

    if (values.fluid === "desconhecido") {
      score += material.versatility;
    } else {
      score += material.fluids.includes(values.fluid) ? 6 : -3;
    }

    if (typeof temperature === "number") {
      score += temperature >= material.temperatures[0] && temperature <= material.temperatures[1] ? 5 : -14;
    } else {
      score += material.versatility;
    }

    if (values.pressure === "desconhecida") {
      score += 1;
    } else {
      score += material.pressures.includes(values.pressure) ? 3 : -2;
    }

    if (values.motion === "desconhecido") {
      score += 1;
    } else {
      score += material.motions.includes(values.motion) ? 4 : -3;
    }

    if (values.speed === "desconhecida") {
      score += 1;
    } else {
      score += material.speeds.includes(values.speed) ? 2 : -1;
    }

    values.priorities.forEach(function (priority) {
      score += material.priorities.includes(priority) ? 2.5 : 0;
    });

    if (values.compliance === "atoxicidade") {
      score += material.compliance.includes("atoxicidade") ? 9 : -4;
    } else if (values.compliance === "alimenticia") {
      score += material.compliance.includes("alimenticia") ? 5 : -3;
    } else if (values.compliance === "lote") {
      score += 1;
    }

    var highHydraulicPressure = values.pressure === "alta" || values.pressure === "muito-alta";
    if (values.fluid === "oleo" && values.motion === "alternado" && highHydraulicPressure) {
      if (material.name === "PTFE T-46") score += 6;
      if (material.name === "PTFE com bronze") score += 4;
      if (material.name === "Poliuretano") score += 3;
    }
    if (values.fluid === "seco") {
      if (material.name === "PTFE com grafite") score += 4;
      if (material.name === "PTFE com molibdênio") score += 3;
    }
    if (values.fluid === "agua" && ["alternado", "rotativo"].includes(values.motion)) {
      if (material.name === "PTFE com fibra de carbono") score += 4;
      if (material.name === "Poliuretano") score += 2;
    }
    if (values.motion === "estrutural") {
      if (["POM / Poliacetal", "Nylon 6", "Nylon 6.6", "Technyl PA6 / PA66", "PEEK", "Celeron"].includes(material.name)) {
        score += 3;
      }
    }

    return score;
  }

  function buildReasons(material, values) {
    var reasons = [];
    var temperature = temperaturePoints[values.temperature];

    if (values.fluid !== "desconhecido" && material.fluids.includes(values.fluid)) {
      reasons.push("Família frequentemente avaliada para o fluido ou ambiente informado.");
    }
    if (typeof temperature === "number" && temperature >= material.temperatures[0] && temperature <= material.temperatures[1]) {
      reasons.push("A faixa térmica informada está dentro da referência preliminar do material.");
    }
    if (values.motion !== "desconhecido" && material.motions.includes(values.motion)) {
      reasons.push("Comportamento aplicável ao tipo de movimento selecionado.");
    }
    if (values.compliance === "atoxicidade" && material.compliance.includes("atoxicidade")) {
      reasons.push("Há declaração de atoxicidade disponível para o grau Heroflon MG4-FF/HD.");
    } else if (values.compliance === "alimenticia" && material.compliance.includes("alimenticia")) {
      reasons.push("Existem graus potencialmente aplicáveis, sujeitos à comprovação regulatória específica.");
    }

    values.priorities.forEach(function (priority) {
      if (material.priorities.includes(priority) && reasons.length < 3) {
        var labels = {
          desgaste: "Favorece resistência ao desgaste.",
          atrito: "Favorece baixo atrito e deslizamento.",
          quimica: "Favorece resistência química.",
          dimensional: "Favorece estabilidade dimensional.",
          impacto: "Favorece impacto e tenacidade.",
          custo: "Tende a oferecer bom equilíbrio técnico e econômico.",
        };
        reasons.push(labels[priority]);
      }
    });

    if (!reasons.length) {
      reasons.push("Opção versátil para aprofundar na análise técnica.");
    }
    return reasons.slice(0, 3);
  }

  function createResultCard(material, index, values) {
    var card = document.createElement("article");
    card.className = "selector-result-card";

    var top = document.createElement("div");
    top.className = "selector-result-card__top";

    var rank = document.createElement("span");
    rank.className = "selector-result-card__rank";
    rank.textContent = "0" + (index + 1);

    var titleWrap = document.createElement("div");
    var code = document.createElement("span");
    code.className = "selector-result-card__code";
    code.textContent = material.code + " · " + material.family;
    var title = document.createElement("h4");
    title.textContent = material.name;
    titleWrap.append(code, title);
    top.append(rank, titleWrap);

    var description = document.createElement("p");
    description.textContent = material.summary;

    var reasonList = document.createElement("ul");
    buildReasons(material, values).forEach(function (reason) {
      var item = document.createElement("li");
      item.textContent = reason;
      reasonList.appendChild(item);
    });

    var link = document.createElement("a");
    link.href = "#" + material.anchor;
    link.textContent = "Ver família e datasheets →";

    card.append(top, description, reasonList, link);
    return card;
  }

  function buildWhatsapp(values, recommendations) {
    var priorityNames = {
      desgaste: "resistência ao desgaste",
      atrito: "baixo atrito",
      quimica: "resistência química",
      dimensional: "estabilidade dimensional",
      impacto: "impacto e tenacidade",
      custo: "custo-benefício",
    };
    var message = [
      "Olá! Usei o seletor técnico de materiais da Parts Seals e gostaria de validar a aplicação.",
      "",
      "Fluido/ambiente: " + selectedText("fluid"),
      "Temperatura: " + selectedText("temperature"),
      "Pressão: " + selectedText("pressure"),
      "Movimento: " + selectedText("motion"),
      "Velocidade: " + selectedText("speed"),
      "Exigência documental: " + selectedText("compliance"),
      "Prioridades: " + (values.priorities.length ? values.priorities.map(function (value) {
        return priorityNames[value];
      }).join(", ") : "não informadas"),
      "",
      "Sugestões preliminares: " + recommendations.map(function (material) {
        return material.name;
      }).join(", "),
      "",
      "Podem me ajudar com a especificação final?",
    ].join("\n");

    whatsapp.href = "https://wa.me/5519983011817?text=" + encodeURIComponent(message);
  }

  priorityInputs.forEach(function (input) {
    input.addEventListener("change", function () {
      var selected = priorityInputs.filter(function (item) {
        return item.checked;
      });
      priorityInputs.forEach(function (item) {
        item.disabled = selected.length >= 3 && !item.checked;
      });
    });
  });

  form.addEventListener("submit", function (event) {
    event.preventDefault();
    if (!form.reportValidity()) return;

    var values = currentValues();
    var recommendations = materials
      .map(function (material) {
        return { material: material, score: scoreMaterial(material, values) };
      })
      .sort(function (a, b) {
        return b.score - a.score;
      })
      .slice(0, 3)
      .map(function (entry) {
        return entry.material;
      });

    cardsContainer.textContent = "";
    recommendations.forEach(function (material, index) {
      cardsContainer.appendChild(createResultCard(material, index, values));
    });

    summary.textContent =
      "Para " + selectedText("fluid").toLowerCase() + ", " +
      selectedText("temperature").toLowerCase() + " e movimento " +
      selectedText("motion").toLowerCase() + ", estas são as famílias mais relevantes para iniciar a análise.";

    buildWhatsapp(values, recommendations);
    results.hidden = false;
    results.scrollIntoView({ behavior: "smooth", block: "start" });
  });

  editButton.addEventListener("click", function () {
    form.scrollIntoView({ behavior: "smooth", block: "start" });
    form.elements.fluid.focus({ preventScroll: true });
  });
})();
