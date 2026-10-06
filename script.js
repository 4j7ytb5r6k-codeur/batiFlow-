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

function setError(input, hasError) {
  input.closest('.field').classList.toggle('has-error', hasError);
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  const data = Object.fromEntries(new FormData(form));
  const emailOk = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(data.email || '');
  const nameOk = (data.name || '').trim().length > 1;
  const tradeOk = !!data.trade;

  setError(form.name, !nameOk);
  setError(form.email, !emailOk);
  setError(form.trade, !tradeOk);

  msg.className = 'form__msg';
  if (!(nameOk && emailOk && tradeOk)) {
    msg.textContent = 'Merci de compléter les champs en rouge.';
    msg.classList.add('is-error');
    return;
  }

  try {
    if (FORM_ENDPOINT) {
      const res = await fetch(FORM_ENDPOINT, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
        body: JSON.stringify(data),
      });
      if (!res.ok) throw new Error('Erreur serveur');
    } else {
      // Mode démo : enregistrement local uniquement
      const list = JSON.parse(localStorage.getItem('batiflow_trials') || '[]');
      list.push({ ...data, date: new Date().toISOString() });
      localStorage.setItem('batiflow_trials', JSON.stringify(list));
    }
    form.reset();
    msg.textContent = 'Merci ! Votre essai gratuit de 7 jours est enregistré. Nous vous contactons très vite.';
    msg.classList.add('is-ok');
  } catch {
    msg.textContent = "Une erreur est survenue, merci de réessayer.";
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
