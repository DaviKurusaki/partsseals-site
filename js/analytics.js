/*
 * Google Analytics 4 com consentimento (LGPD).
 *
 * COMO ATIVAR: cole abaixo o ID de medição do GA4 (formato G-XXXXXXXXXX).
 * Enquanto estiver vazio, nada é carregado e nenhum banner aparece.
 *
 * Funcionamento:
 * - Na primeira visita aparece um aviso com "Aceitar" e "Recusar".
 * - O Google Analytics só é carregado DEPOIS do "Aceitar". Sem aceite, nenhum
 *   cookie é gravado e nada é enviado ao Google.
 * - A escolha fica guardada neste navegador por 12 meses; depois perguntamos de novo.
 * - O link "Preferências de cookies" no rodapé reabre o aviso a qualquer momento.
 * - Cliques em WhatsApp, telefone, e-mail e PDFs viram eventos no GA4.
 */
(function () {
  'use strict';

  var GA_MEASUREMENT_ID = '';

  var STORAGE_KEY = 'ps-consentimento-analytics';
  var CONSENT_MAX_AGE = 365 * 24 * 60 * 60 * 1000;

  if (!/^G-[A-Z0-9]+$/.test(GA_MEASUREMENT_ID)) return;
  // Área interna da expedição nunca é medida.
  if (location.pathname.indexOf('/expedicao') === 0) return;

  var lang = (document.documentElement.lang || 'pt').toLowerCase().slice(0, 2);
  var TEXTS = {
    pt: {
      message: 'Usamos cookies do Google Analytics para entender, de forma estatística, quantas pessoas visitam o site e de quais regiões. Só ativamos com a sua autorização.',
      policy: 'Política de Privacidade',
      policyUrl: '/politica-de-privacidade.html',
      accept: 'Aceitar',
      reject: 'Recusar',
      prefs: 'Preferências de cookies',
      label: 'Aviso de cookies'
    },
    en: {
      message: 'We use Google Analytics cookies to understand, statistically, how many people visit the site and from which regions. They are only enabled with your permission.',
      policy: 'Privacy Policy',
      policyUrl: '/privacy.html',
      accept: 'Accept',
      reject: 'Decline',
      prefs: 'Cookie preferences',
      label: 'Cookie notice'
    },
    es: {
      message: 'Usamos cookies de Google Analytics para entender, de forma estadística, cuántas personas visitan el sitio y desde qué regiones. Solo se activan con su autorización.',
      policy: 'Política de Privacidad',
      policyUrl: '/privacidad.html',
      accept: 'Aceptar',
      reject: 'Rechazar',
      prefs: 'Preferencias de cookies',
      label: 'Aviso de cookies'
    }
  };
  var t = TEXTS[lang] || TEXTS.pt;

  function readChoice() {
    try {
      var saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || 'null');
      if (saved && (saved.value === 'granted' || saved.value === 'denied') &&
          Date.now() - saved.date < CONSENT_MAX_AGE) {
        return saved.value;
      }
    } catch (error) { /* armazenamento bloqueado: pergunta de novo */ }
    return null;
  }

  function saveChoice(value) {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify({ value: value, date: Date.now() }));
    } catch (error) { /* sem armazenamento, vale só para esta página */ }
  }

  // ---- Google Analytics ----
  window.dataLayer = window.dataLayer || [];
  function gtag() { window.dataLayer.push(arguments); }
  window.gtag = gtag;
  var loaded = false;

  function loadAnalytics() {
    if (loaded) return;
    loaded = true;
    window['ga-disable-' + GA_MEASUREMENT_ID] = false;
    gtag('consent', 'default', {
      analytics_storage: 'granted',
      ad_storage: 'denied',
      ad_user_data: 'denied',
      ad_personalization: 'denied'
    });
    gtag('js', new Date());
    gtag('config', GA_MEASUREMENT_ID, {
      allow_google_signals: false,
      allow_ad_personalization_signals: false,
      page_language: lang
    });
    var script = document.createElement('script');
    script.async = true;
    script.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_MEASUREMENT_ID);
    document.head.appendChild(script);
  }

  function removeAnalyticsCookies() {
    var host = location.hostname;
    var domains = ['', host, '.' + host, '.' + host.replace(/^www\./, '')];
    document.cookie.split(';').forEach(function (cookie) {
      var name = cookie.split('=')[0].trim();
      if (name !== '_ga' && name.indexOf('_ga_') !== 0) return;
      domains.forEach(function (domain) {
        document.cookie = name + '=; Max-Age=0; path=/' + (domain ? '; domain=' + domain : '');
      });
    });
  }

  function track(eventName, params) {
    if (loaded) gtag('event', eventName, params || {});
  }

  // ---- Eventos de contato (o que interessa para vendas) ----
  document.addEventListener('click', function (event) {
    var link = event.target.closest && event.target.closest('a[href]');
    if (!link) return;
    var href = link.getAttribute('href') || '';
    var place = link.closest('header') ? 'cabecalho'
      : link.closest('footer') ? 'rodape'
      : link.classList.contains('floating-whatsapp') ? 'botao_flutuante'
      : 'pagina';

    if (/wa\.me|whatsapp\.com/i.test(href)) {
      var params = { method: 'whatsapp', link_location: place };
      var product = link.getAttribute('data-product');
      if (product) params.product = product;
      track('generate_lead', params);
      track('clique_whatsapp', params);
    } else if (href.indexOf('tel:') === 0) {
      track('clique_telefone', { link_location: place });
    } else if (href.indexOf('mailto:') === 0) {
      track('clique_email', { link_location: place, email_to: href.slice(7).split('?')[0] });
    } else if (/\.pdf(\?|#|$)/i.test(href)) {
      track('file_download', {
        file_name: href.split('/').pop().split('?')[0],
        file_extension: 'pdf',
        link_url: link.href
      });
    }
  }, true);

  // ---- Aviso de consentimento ----
  var banner = null;

  function closeBanner() {
    if (banner) banner.hidden = true;
  }

  function choose(value) {
    saveChoice(value);
    closeBanner();
    if (value === 'granted') {
      loadAnalytics();
    } else {
      window['ga-disable-' + GA_MEASUREMENT_ID] = true;
      removeAnalyticsCookies();
      if (loaded) location.reload();
    }
  }

  function buildBanner() {
    banner = document.createElement('section');
    banner.className = 'cookie-banner';
    banner.setAttribute('role', 'region');
    banner.setAttribute('aria-label', t.label);

    var text = document.createElement('p');
    text.appendChild(document.createTextNode(t.message + ' '));
    var policy = document.createElement('a');
    policy.href = t.policyUrl;
    policy.textContent = t.policy;
    text.appendChild(policy);
    text.appendChild(document.createTextNode('.'));

    var actions = document.createElement('div');
    actions.className = 'cookie-banner-actions';
    var reject = document.createElement('button');
    reject.type = 'button';
    reject.className = 'btn btn-secondary';
    reject.textContent = t.reject;
    reject.addEventListener('click', function () { choose('denied'); });
    var accept = document.createElement('button');
    accept.type = 'button';
    accept.className = 'btn btn-primary';
    accept.textContent = t.accept;
    accept.addEventListener('click', function () { choose('granted'); });
    actions.appendChild(reject);
    actions.appendChild(accept);

    banner.appendChild(text);
    banner.appendChild(actions);
    document.body.appendChild(banner);
  }

  function openBanner() {
    if (!banner) buildBanner();
    banner.hidden = false;
    var first = banner.querySelector('button');
    if (first) first.focus();
  }

  function addPreferencesLink() {
    document.querySelectorAll('.footer-legal').forEach(function (footer) {
      var button = document.createElement('button');
      button.type = 'button';
      button.className = 'cookie-preferences-link';
      button.textContent = t.prefs;
      button.addEventListener('click', openBanner);
      var policyLink = footer.querySelector('a');
      if (policyLink && policyLink.nextSibling) {
        footer.insertBefore(button, policyLink.nextSibling);
      } else {
        footer.appendChild(button);
      }
    });
  }

  function start() {
    addPreferencesLink();
    var choice = readChoice();
    if (choice === 'granted') {
      loadAnalytics();
    } else if (choice === null) {
      buildBanner();
    }
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();
