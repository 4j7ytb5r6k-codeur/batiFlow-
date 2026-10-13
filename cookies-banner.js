// Bandeau d'information cookies, affiché à la première visite.
// batiFlow ne dépose aucun traceur soumis à consentement : le bandeau informe, il ne demande pas d'accord.
// Le choix « J'ai compris » est mémorisé dans le navigateur (stockage strictement nécessaire).
(function () {
  'use strict';
  const KEY = 'bf_cookie_notice_v1';
  try { if (localStorage.getItem(KEY)) return; } catch { /* stockage indisponible : on affiche le bandeau */ }
  function show() {
    const box = document.createElement('section');
    box.className = 'cookie-banner';
    box.setAttribute('role', 'region');
    box.setAttribute('aria-label', 'Information sur les cookies');
    const text = document.createElement('p');
    text.append('🍪 batiFlow n\'utilise ', Object.assign(document.createElement('strong'), { textContent: 'aucun cookie publicitaire ni de mesure d\'audience' }),
      '. Seul le stockage nécessaire à votre connexion est utilisé. ');
    const more = Object.assign(document.createElement('a'), { href: 'cookies.html', textContent: 'En savoir plus' });
    text.append(more);
    const ok = Object.assign(document.createElement('button'), { type: 'button', className: 'btn btn--primary btn--sm', textContent: 'J\'ai compris' });
    ok.addEventListener('click', () => {
      try { localStorage.setItem(KEY, new Date().toISOString()); } catch { /* sans stockage, le bandeau reviendra */ }
      box.remove();
    });
    box.append(text, ok);
    document.body.append(box);
  }
  if (document.readyState === 'loading') document.addEventListener('DOMContentLoaded', show); else show();
})();
