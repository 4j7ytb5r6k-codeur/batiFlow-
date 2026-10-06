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
