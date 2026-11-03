// Google Analytics 4 somente com consentimento (LGPD).
// Enquanto GA_ID for o marcador, nada acontece: sem faixa, sem script externo.
// Só ao "Aceitar" o gtag.js do Google é carregado; "Recusar" não carrega nada.
// /cliente e /expedicao não incluem este arquivo (dados pessoais).
(function () {
  'use strict';

  var GA_ID = 'G-J3F846B60L';
  var CHAVE = 'ps_consentimento';
  var ativo = /^G-[A-Z0-9]{6,}$/.test(GA_ID) && GA_ID !== 'G-XXXXXXXXXX';
  if (!ativo) return;

  var lang = (document.documentElement.lang || 'pt').slice(0, 2).toLowerCase();
  var TEXTOS = {
    pt: {
      titulo: 'Cookies de estatística',
      texto: 'Usamos o Google Analytics para entender quais páginas e produtos interessam mais. Só ativamos se você aceitar.',
      politica: 'Política de Privacidade', link: '/politica-de-privacidade.html',
      aceitar: 'Aceitar', recusar: 'Recusar'
    },
    en: {
      titulo: 'Statistics cookies',
      texto: 'We use Google Analytics to understand which pages and products interest visitors most. It only runs if you accept.',
      politica: 'Privacy Policy', link: '/privacy.html',
      aceitar: 'Accept', recusar: 'Decline'
    },
    es: {
      titulo: 'Cookies de estadística',
      texto: 'Usamos Google Analytics para entender qué páginas y productos interesan más. Solo se activa si usted acepta.',
      politica: 'Política de Privacidad', link: '/privacidad.html',
      aceitar: 'Aceptar', recusar: 'Rechazar'
    }
  };
  var t = TEXTOS[lang] || TEXTOS.pt;

  function ler() {
    try { return localStorage.getItem(CHAVE); } catch (e) { return null; }
  }
  function gravar(valor) {
    try { localStorage.setItem(CHAVE, valor); } catch (e) { /* sem armazenamento: vale só nesta página */ }
  }

  // Consent Mode v2: tudo negado até a pessoa aceitar.
  window.dataLayer = window.dataLayer || [];
  window.gtag = function () { window.dataLayer.push(arguments); };
  window.gtag('consent', 'default', {
    analytics_storage: 'denied',
    ad_storage: 'denied',
    ad_user_data: 'denied',
    ad_personalization: 'denied'
  });

  var carregado = false;
  function ligar() {
    window.gtag('consent', 'update', { analytics_storage: 'granted' });
    if (carregado) return;
    carregado = true;
    var s = document.createElement('script');
    s.async = true;
    s.src = 'https://www.googletagmanager.com/gtag/js?id=' + encodeURIComponent(GA_ID);
    document.head.appendChild(s);
    window.gtag('js', new Date());
    window.gtag('config', GA_ID);
  }
  function desligar() {
    window.gtag('consent', 'update', { analytics_storage: 'denied' });
  }

  var faixa = null;
  function fecharFaixa() {
    if (faixa) { faixa.remove(); faixa = null; }
  }
  function abrirFaixa() {
    if (faixa) return;
    faixa = document.createElement('div');
    faixa.className = 'cookie-faixa';
    faixa.setAttribute('role', 'region');
    faixa.setAttribute('aria-label', t.titulo);
    faixa.innerHTML =
      '<div class="cookie-faixa__texto"><strong></strong><p><span></span> <a></a></p></div>' +
      '<div class="cookie-faixa__acoes">' +
      '<button type="button" class="btn btn-secondary" data-cookie="recusar"></button>' +
      '<button type="button" class="btn btn-primary" data-cookie="aceitar"></button>' +
      '</div>';
    faixa.querySelector('strong').textContent = t.titulo;
    faixa.querySelector('span').textContent = t.texto;
    var a = faixa.querySelector('a');
    a.textContent = t.politica;
    a.href = t.link;
    faixa.querySelector('[data-cookie="recusar"]').textContent = t.recusar;
    faixa.querySelector('[data-cookie="aceitar"]').textContent = t.aceitar;
    faixa.addEventListener('click', function (ev) {
      var botao = ev.target.closest('[data-cookie]');
      if (!botao) return;
      if (botao.dataset.cookie === 'aceitar') { gravar('aceito'); ligar(); }
      else { gravar('recusado'); desligar(); }
      fecharFaixa();
    });
    document.body.appendChild(faixa);
  }

  function evento(nome, params) {
    if (carregado) window.gtag('event', nome, params || {});
  }

  function iniciar() {
    var escolha = ler();
    if (escolha === 'aceito') ligar();
    else if (escolha !== 'recusado') abrirFaixa();

    // Links "Preferências de cookies" (rodapé e política) só aparecem com o GA ativo.
    document.querySelectorAll('[data-cookie-preferencias]').forEach(function (el) {
      el.hidden = false;
      el.addEventListener('click', function (ev) { ev.preventDefault(); abrirFaixa(); });
    });

    document.addEventListener('click', function (ev) {
      var link = ev.target.closest && ev.target.closest('a[href]');
      if (!link) return;
      var href = link.getAttribute('href') || '';
      if (link.hasAttribute('data-whatsapp-link')) {
        evento('gerar_lead', { canal: 'whatsapp', produto: link.dataset.product || '', pagina: location.pathname });
      } else if (/\.pdf(?:$|[?#])/i.test(href)) {
        evento('file_download', { file_name: href.split('/').pop().split(/[?#]/)[0], link_url: link.href });
      } else if (link.host === location.host && /^\/cliente(?:\/|$)/.test(link.pathname)) {
        evento('area_cliente', { pagina: location.pathname });
      }
    }, true);
  }

  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', iniciar);
  else iniciar();
})();
