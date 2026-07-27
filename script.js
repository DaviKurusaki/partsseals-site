(function () {
  var currentYear = document.getElementById('currentYear');
  var backToTopButton = document.getElementById('backToTop');
  var revealElements = document.querySelectorAll('.reveal');
  var pdfLinks = document.querySelectorAll('.pdf-action');
  var pdfChoiceModal = document.getElementById('pdfChoiceModal');
  var pdfChoiceTitle = document.getElementById('pdfChoiceTitle');
  var viewPdfButton = document.getElementById('viewPdfButton');
  var downloadPdfButton = document.getElementById('downloadPdfButton');
  var closePdfModalButton = document.getElementById('closePdfModalButton');
  var selectedPdf = null;
  var pageLang = (document.documentElement.lang || 'pt').toLowerCase();
  var isEnglish = pageLang.indexOf('en') === 0;

  if (currentYear) {
    currentYear.textContent = String(new Date().getFullYear());
  }

  if (backToTopButton) {
    window.addEventListener('scroll', function () {
      if (window.scrollY > 420) {
        backToTopButton.classList.add('show');
      } else {
        backToTopButton.classList.remove('show');
      }
    });

    backToTopButton.addEventListener('click', function () {
      window.scrollTo({ top: 0, behavior: 'smooth' });
    });
  }

  if ('IntersectionObserver' in window) {
    var observer = new IntersectionObserver(
      function (entries, obs) {
        entries.forEach(function (entry) {
          if (entry.isIntersecting) {
            entry.target.classList.add('visible');
            obs.unobserve(entry.target);
          }
        });
      },
      {
        threshold: 0.15,
      }
    );

    revealElements.forEach(function (element) {
      observer.observe(element);
    });
  } else {
    revealElements.forEach(function (element) {
      element.classList.add('visible');
    });
  }

  function closePdfModal() {
    if (!pdfChoiceModal) return;
    pdfChoiceModal.hidden = true;
    pdfChoiceModal.setAttribute('aria-hidden', 'true');
    selectedPdf = null;
  }

  if (pdfLinks.length && pdfChoiceModal && viewPdfButton && downloadPdfButton) {
    pdfLinks.forEach(function (link) {
      link.addEventListener('click', function (event) {
        event.preventDefault();
        selectedPdf = {
          href: link.getAttribute('href'),
          downloadName: link.getAttribute('data-download-name') || 'arquivo.pdf',
          title: link.getAttribute('data-pdf-title') || 'PDF',
        };

        if (pdfChoiceTitle) {
          pdfChoiceTitle.textContent = isEnglish
            ? selectedPdf.title + ': view or download?'
            : selectedPdf.title + ': ver ou baixar?';
        }

        pdfChoiceModal.hidden = false;
        pdfChoiceModal.setAttribute('aria-hidden', 'false');
      });
    });

    viewPdfButton.addEventListener('click', function () {
      if (!selectedPdf) return;
      window.open(selectedPdf.href, '_blank', 'noopener');
      closePdfModal();
    });

    downloadPdfButton.addEventListener('click', function () {
      if (!selectedPdf) return;
      var anchor = document.createElement('a');
      anchor.href = selectedPdf.href;
      anchor.download = selectedPdf.downloadName;
      document.body.appendChild(anchor);
      anchor.click();
      anchor.remove();
      closePdfModal();
    });

    if (closePdfModalButton) {
      closePdfModalButton.addEventListener('click', closePdfModal);
    }

    pdfChoiceModal.addEventListener('click', function (event) {
      var target = event.target;
      if (target && target.getAttribute('data-close-modal') === 'true') {
        closePdfModal();
      }
    });

    document.addEventListener('keydown', function (event) {
      if (event.key === 'Escape' && !pdfChoiceModal.hidden) {
        closePdfModal();
      }
    });
  }
})();
