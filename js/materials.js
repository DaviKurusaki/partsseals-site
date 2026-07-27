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
