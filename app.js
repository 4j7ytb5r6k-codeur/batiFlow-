// Espace client : réservé aux comptes connectés. Sans Supabase configuré, affiche un espace de démonstration.
(async function () {
  const $ = (id) => document.getElementById(id);
  const show = (p) => {
    const first = (p.full_name || '').trim().split(/\s+/)[0];
    $('hello').textContent = first ? 'Bonjour ' + first + ' !' : 'Bonjour !';
    $('uname').textContent = p.full_name || 'Votre compte';
    $('ucompany').textContent = p.company || p.trade || '';
    $('avatar').textContent = ((p.full_name || '?').trim()[0] || '?').toUpperCase();
    const left = Math.ceil((new Date(p.trial_ends_at) - Date.now()) / 86400000);
    $('trial').textContent = left > 0
      ? 'Essai gratuit : ' + left + ' jour' + (left > 1 ? 's' : '') + ' restant' + (left > 1 ? 's' : '')
      : 'Essai terminé';
    $('trial').classList.toggle('is-over', left <= 0);
    $('today').textContent = new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date());
    document.body.hidden = false;
  };

  const client = window.bfClient;
  if (!client) {
    // Mode démo
    show({ full_name: 'Thomas Lefèvre', company: 'Artisan Rénovation', trial_ends_at: new Date(Date.now() + 7 * 864e5) });
  } else {
    const { data } = await client.auth.getSession();
    if (!data.session) { location.replace('login.html'); return; }
    const user = data.session.user;
    // L'espace client est créé à l'inscription par un déclencheur SQL ; on le lit ici.
    const { data: profile } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
    show(profile || { full_name: (user.user_metadata || {}).full_name, trial_ends_at: new Date(Date.now() + 7 * 864e5) });
  }

  $('logout').addEventListener('click', async () => {
    if (client) await client.auth.signOut();
    location.href = 'index.html';
  });

  // Chiffres qui défilent
  if (!matchMedia('(prefers-reduced-motion: reduce)').matches) {
    document.querySelectorAll('[data-count]').forEach((el) => {
      const end = +el.dataset.count, t0 = performance.now();
      (function tick(now) {
        const t = Math.min((now - t0) / 1000, 1);
        el.textContent = Math.round(end * (1 - Math.pow(1 - t, 3)));
        if (t < 1) requestAnimationFrame(tick);
      })(t0);
    });
  }
})();
