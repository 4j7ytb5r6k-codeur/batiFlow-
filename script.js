// Menu mobile
const toggle = document.getElementById('menuToggle');
const menu = document.getElementById('menu');
toggle.addEventListener('click', () => {
  const open = menu.classList.toggle('is-open');
  toggle.setAttribute('aria-expanded', String(open));
});
menu.addEventListener('click', (e) => {
  if (e.target.closest('a')) {
    menu.classList.remove('is-open');
    toggle.setAttribute('aria-expanded', 'false');
  }
});

document.getElementById('year').textContent = new Date().getFullYear();

// Formulaire d'essai gratuit.
// Pour le brancher sur un vrai service (Formspree, Netlify Forms, votre API…),
// renseignez son URL ici. Tant que c'est vide, l'inscription est simulée.
const FORM_ENDPOINT = '';

const form = document.getElementById('trialForm');
const msg = document.getElementById('formMsg');
const field = (n) => form.elements.namedItem(n);

// Avec Supabase configuré, le formulaire crée un vrai compte (donc l'espace client) : il demande un mot de passe.
if (window.bfClient) {
  document.getElementById('passwordField').hidden = false;
  field('password').required = true;
}

function setError(input, hasError) {
  input.closest('.field').classList.toggle('has-error', hasError);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const password = data.password || '';
  delete data.password; // ne jamais stocker ni envoyer le mot de passe ailleurs que vers Supabase
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '');
  const nameOk = (data.name || '').trim().length > 1;
  const tradeOk = !!data.trade;
  const passOk = !window.bfClient || password.length >= 8;

  setError(field('name'), !nameOk);
  setError(field('email'), !emailOk);
  setError(field('trade'), !tradeOk);
  setError(field('password'), !passOk);

  msg.className = 'form__msg';
  if (!(nameOk && emailOk && tradeOk && passOk)) {
    msg.textContent = passOk ? 'Merci de compléter les champs en rouge.' : 'Le mot de passe doit contenir au moins 8 caractères.';
    msg.classList.add('is-error');
    return;
  }

  try {
    if (window.bfClient) {
      // Création du compte : un déclencheur Supabase crée aussitôt l'espace client (supabase/schema.sql).
      const { data: res, error } = await window.bfClient.auth.signUp({
        email: data.email,
        password,
        options: {
          data: { full_name: data.name.trim(), company: data.company || '', trade: data.trade, phone: data.phone || '' },
          emailRedirectTo: new URL('app.html', location.href).href,
        },
      });
      if (error) throw error;
      form.reset();
      if (res.session) { location.href = 'app.html'; return; }
      msg.textContent = 'Compte créé ! Confirmez votre adresse email (lien envoyé dans votre boîte mail) pour accéder à votre espace client.';
      msg.classList.add('is-ok');
      return;
    }
    if (FORM_ENDPOINT) {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erreur serveur');
    } else {
      // Netlify Forms : fonctionne sans configuration une fois le site déployé sur Netlify.
      let sent = false;
      if (/^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
        try {
          const body = new FormData(form);
          body.delete('password');
          const res = await fetch('/', {
            method: 'POST',
            headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
            body: new URLSearchParams(body).toString(),
          });
          sent = res.ok;
        } catch { sent = false; }
      }
      if (!sent) {
        // Mode démo (aperçu local ou hébergeur sans Netlify Forms) : enregistrement dans le navigateur
        const list = JSON.parse(localStorage.getItem('batiflow_trials') || '[]');
        list.push({ ...data, date: new Date().toISOString() });
        localStorage.setItem('batiflow_trials', JSON.stringify(list));
      }
    }
    form.reset();
    msg.textContent = 'Merci ! Votre essai gratuit de 7 jours est enregistré. Nous vous contactons très vite.';
    msg.classList.add('is-ok');
  } catch (err) {
    const already = err && /already registered|already been registered/i.test(err.message || '');
    msg.textContent = already
      ? 'Un compte existe déjà avec cet email. Utilisez « Connexion ».'
      : "Une erreur est survenue, merci de réessayer.";
    msg.classList.add('is-error');
  }
});

// ---------- Animations (désactivées si prefers-reduced-motion) ----------
const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)');

// Header compact au scroll (une seule écriture DOM par changement d'état)
const nav = document.querySelector('.nav');
let scrolled = false;
function onScroll() {
  const next = window.scrollY > 24;
  if (next !== scrolled) { scrolled = next; nav.classList.toggle('is-scrolled', next); }
}
window.addEventListener('scroll', onScroll, { passive: true });
onScroll();

if (!reduceMotion.matches) {
  // Apparition au scroll : fade + translation, décalée au sein d'un même groupe
  const targets = document.querySelectorAll(
    '.hero__text > *, .app, .eyebrow, .section__title, .card, .feature, details, .stats .grid > div, .cta h2, .cta .lead, .form'
  );
  targets.forEach((el) => {
    el.classList.add('reveal');
    const group = [...el.parentElement.children].filter((n) => n.classList.contains('reveal'));
    el.style.setProperty('--d', Math.min(group.indexOf(el), 5) * 90 + 'ms');
  });
  const revealIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); revealIO.unobserve(e.target); }
    });
  }, { threshold: 0.15, rootMargin: '0px 0px -6% 0px' });
  targets.forEach((el) => revealIO.observe(el));

  // Chiffres qui défilent
  const easeOut = (t) => 1 - Math.pow(1 - t, 3);
  function countUp(el) {
    const end = parseFloat(el.dataset.count);
    const suffix = el.dataset.suffix || '';
    const dur = 1400;
    const start = performance.now();
    (function tick(now) {
      const t = Math.min((now - start) / dur, 1);
      el.textContent = Math.round(end * easeOut(t)) + suffix;
      if (t < 1) requestAnimationFrame(tick);
    })(start);
  }
  const counters = document.querySelectorAll('[data-count]');
  counters.forEach((el) => { el.textContent = '0' + (el.dataset.suffix || ''); });
  const countIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { countUp(e.target); countIO.unobserve(e.target); }
    });
  }, { threshold: 0.6 });
  counters.forEach((el) => countIO.observe(el));

  // Effet magnétique sur les boutons (souris uniquement)
  if (window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
    document.querySelectorAll('.btn').forEach((btn) => {
      let raf = 0;
      const strength = btn.classList.contains('btn--sm') ? 0.25 : 0.35;
      btn.addEventListener('pointermove', (e) => {
        const r = btn.getBoundingClientRect();
        const x = (e.clientX - (r.left + r.width / 2)) * strength;
        const y = (e.clientY - (r.top + r.height / 2)) * strength;
        cancelAnimationFrame(raf);
        raf = requestAnimationFrame(() => {
          btn.style.setProperty('--mx', x.toFixed(1) + 'px');
          btn.style.setProperty('--my', y.toFixed(1) + 'px');
        });
      });
      btn.addEventListener('pointerleave', () => {
        cancelAnimationFrame(raf);
        btn.style.removeProperty('--mx');
        btn.style.removeProperty('--my');
      });
    });
  }
}

// Tarifs : bascule mensuel / annuel
const billingBtns = document.querySelectorAll('.billing__btn');
billingBtns.forEach((btn) => {
  btn.addEventListener('click', () => {
    const period = btn.dataset.period;
    billingBtns.forEach((b) => {
      const on = b === btn;
      b.classList.toggle('is-active', on);
      b.setAttribute('aria-pressed', String(on));
    });
    document.querySelectorAll('[data-price]').forEach((el) => {
      const to = Number(el.dataset[period]);
      if (reduceMotion.matches) { el.textContent = to; return; }
      const from = Number(el.textContent);
      const t0 = performance.now();
      (function step(now) {
        const t = Math.min((now - t0) / 600, 1);
        el.textContent = Math.round(from + (to - from) * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(step);
      })(t0);
    });
    document.querySelectorAll('[data-billed]').forEach((el) => { el.textContent = el.dataset[period]; });
  });
});

// Animation de chaque section + barre de progression du scroll
if (!reduceMotion.matches) {
  const sections = document.querySelectorAll('main > section:not(.hero)');
  sections.forEach((el) => el.classList.add('sect'));
  const sectIO = new IntersectionObserver((entries) => {
    entries.forEach((e) => {
      if (e.isIntersecting) { e.target.classList.add('is-visible'); sectIO.unobserve(e.target); }
    });
  }, { threshold: 0.06 });
  sections.forEach((el) => sectIO.observe(el));

  const bar = document.createElement('div');
  bar.className = 'progress';
  bar.setAttribute('aria-hidden', 'true');
  document.body.prepend(bar);
  let ticking = false;
  function updateProgress() {
    const max = document.documentElement.scrollHeight - window.innerHeight;
    bar.style.transform = 'scaleX(' + (max > 0 ? Math.min(window.scrollY / max, 1) : 0).toFixed(4) + ')';
    ticking = false;
  }
  window.addEventListener('scroll', () => {
    if (!ticking) { ticking = true; requestAnimationFrame(updateProgress); }
  }, { passive: true });
  updateProgress();
}

// Inclinaison 3D de la maquette selon la souris
if (!reduceMotion.matches && window.matchMedia('(hover: hover) and (pointer: fine)').matches) {
  const app = document.querySelector('.app');
  const zone = document.querySelector('.hero');
  let raf = 0;
  zone.addEventListener('pointermove', (e) => {
    const r = app.getBoundingClientRect();
    const nx = Math.max(-1, Math.min(1, (e.clientX - (r.left + r.width / 2)) / (window.innerWidth / 2)));
    const ny = Math.max(-1, Math.min(1, (e.clientY - (r.top + r.height / 2)) / (window.innerHeight / 2)));
    cancelAnimationFrame(raf);
    raf = requestAnimationFrame(() => {
      const angle = Math.min(Math.hypot(nx, ny), 1) * 7;
      app.style.rotate = angle < 0.05 ? 'none' : (-ny).toFixed(3) + ' ' + nx.toFixed(3) + ' 0 ' + angle.toFixed(2) + 'deg';
    });
  });
  zone.addEventListener('pointerleave', () => { cancelAnimationFrame(raf); app.style.rotate = 'none'; });
}

// ---------- Formulaire de contact ----------
(function () {
  const cf = document.getElementById('contactForm');
  if (!cf) return;
  const cmsg = document.getElementById('contactMsg');
  const cfg = window.BATIFLOW_CONFIG || {};
  if (cfg.CONTACT_EMAIL) {
    document.querySelectorAll('[data-contact-email]').forEach((a) => {
      a.textContent = cfg.CONTACT_EMAIL;
      a.href = 'mailto:' + cfg.CONTACT_EMAIL;
    });
  }
  const els = cf.elements;
  const flag = (n, bad) => els.namedItem(n).closest('.field').classList.toggle('has-error', bad);

  cf.addEventListener('submit', async (e) => {
    e.preventDefault();
    const v = Object.fromEntries(new FormData(cf));
    const okName = (v.name || '').trim().length > 0;
    const okMail = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v.email || '');
    const okMsg = (v.message || '').trim().length >= 5;
    flag('name', !okName); flag('email', !okMail); flag('message', !okMsg);
    cmsg.className = 'form__msg';
    if (!(okName && okMail && okMsg)) {
      cmsg.textContent = 'Merci de compléter les champs en rouge.';
      cmsg.classList.add('is-error');
      return;
    }
    let sent = false;
    // 1) Base de données : le message apparaît dans l'espace administrateur
    if (window.bfClient) {
      try {
        const { error } = await window.bfClient.from('contact_messages').insert({
          name: v.name.trim(), email: v.email.trim(), message: v.message.trim(),
        });
        sent = !error;
      } catch { sent = false; }
    }
    // 2) Netlify Forms : permet de recevoir aussi une notification par email (réglage dans Netlify)
    if (/^https?:$/.test(location.protocol) && !/^(localhost|127\.0\.0\.1)$/.test(location.hostname)) {
      try {
        const body = new FormData(cf);
        const res = await fetch('/', { method: 'POST', headers: { 'Content-Type': 'application/x-www-form-urlencoded' }, body: new URLSearchParams(body).toString() });
        sent = sent || res.ok;
      } catch { /* sans effet */ }
    }
    if (sent) {
      cf.reset();
      cmsg.textContent = 'Merci, votre message est envoyé. Nous vous répondons rapidement.';
      cmsg.classList.add('is-ok');
    } else {
      const to = cfg.CONTACT_EMAIL || '';
      cmsg.textContent = 'Envoi impossible pour le moment. Écrivez-nous directement' + (to ? ' à ' + to : '') + '.';
      cmsg.classList.add('is-error');
    }
  });
})();
