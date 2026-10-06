// Administration batiFlow : réservée aux comptes is_admin (règles RLS côté base). CA estimé = offres attribuées, pas des encaissements.
(function () {
  'use strict';
  const client = window.bfClient;
  const DAY = 864e5;
  const PRICE_MONTHLY = { essentiel: { month: 35, year: 350 / 12 }, pro: { month: 70, year: 700 / 12 } };
  const root = document.getElementById('root');
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const fdate = (d) => (d ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(d)) : '—');
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v; else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v); else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) { if (kid == null || kid === false) continue; e.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
    return e;
  }
  const state = { profiles: [], messages: [], q: '' };

  function stats() {
    const now = Date.now(), cl = state.profiles.filter((p) => !p.is_admin);
    const paying = cl.filter((p) => p.plan === 'essentiel' || p.plan === 'pro');
    const trials = cl.filter((p) => p.plan === 'trial');
    const mrr = paying.reduce((s, p) => s + PRICE_MONTHLY[p.plan][p.billing === 'year' ? 'year' : 'month'], 0);
    return {
      total: cl.length,
      new7: cl.filter((p) => now - new Date(p.created_at) < 7 * DAY).length,
      trialActive: trials.filter((p) => new Date(p.trial_ends_at) > now).length,
      trialSoon: trials.filter((p) => { const l = new Date(p.trial_ends_at) - now; return l > 0 && l < 2 * DAY; }).length,
      trialEnded: trials.filter((p) => new Date(p.trial_ends_at) <= now).length,
      essentiel: cl.filter((p) => p.plan === 'essentiel').length, pro: cl.filter((p) => p.plan === 'pro').length,
      cancelled: cl.filter((p) => p.plan === 'annule').length,
      mrr, arr: mrr * 12, conv: cl.length ? Math.round((paying.length / cl.length) * 100) : 0,
    };
  }
  const kpi = (v, l, hint) => el('div', { class: 'd-card' }, el('b', { text: v }), el('span', { text: l }), hint ? el('small', { class: 'd-muted', text: hint }) : null);

  function chart() {
    const days = [];
    for (let i = 13; i >= 0; i--) { const d = new Date(Date.now() - i * DAY); days.push({ key: d.toISOString().slice(0, 10), n: 0 }); }
    state.profiles.filter((p) => !p.is_admin).forEach((p) => { const d = days.find((x) => x.key === (p.created_at || '').slice(0, 10)); if (d) d.n++; });
    const max = Math.max(1, ...days.map((d) => d.n));
    return el('div', { class: 'a-bars', role: 'img', 'aria-label': 'Inscriptions des 14 derniers jours : ' + days.map((d) => d.key.slice(5) + ' ' + d.n).join(', ') },
      days.map((d) => el('div', { class: 'a-bar' }, el('i', { style: 'height:' + Math.round((d.n / max) * 100) + '%', title: d.key + ' : ' + d.n }), el('small', { text: d.key.slice(8) }))));
  }

  async function updateProfile(id, patch) {
    const { error } = await client.from('profiles').update(patch).eq('id', id);
    if (error) { alert('Modification impossible : ' + error.message); return; }
    Object.assign(state.profiles.find((p) => p.id === id), patch); render();
  }
  async function toggleHandled(m) {
    const next = !m.handled;
    const { error } = await client.from('contact_messages').update({ handled: next }).eq('id', m.id);
    if (error) { alert('Modification impossible : ' + error.message); return; }
    m.handled = next; render();
  }
  const sel = (opts, val, onchange, label) => { const s = el('select', { 'aria-label': label, onchange: (e) => onchange(e.target.value) }, opts.map(([v, l]) => el('option', { value: v, text: l, selected: v === val }))); return s; };

  function render() {
    const s = stats(), q = state.q.trim().toLowerCase();
    const list = state.profiles.filter((p) => !q || [p.full_name, p.company, p.email, p.trade, p.phone].some((x) => (x || '').toLowerCase().includes(q)));
    const planOf = (m) => (state.profiles.find((p) => p.id === m.user_id) || {}).plan;
    const isPro = (m) => planOf(m) === 'pro';
    const inbox = [...state.messages].sort((a, b) => (a.handled - b.handled) || (isPro(b) - isPro(a)) || (new Date(b.created_at) - new Date(a.created_at)));
    const open = state.messages.filter((m) => !m.handled).length;
    root.replaceChildren(
      el('h1', { text: 'Tableau de bord administrateur' }),
      el('section', { class: 'd-stats' }, kpi(s.total, 'Clients inscrits', s.new7 + ' cette semaine'), kpi(s.trialActive, 'Essais en cours', s.trialSoon + ' se terminent sous 48 h'),
        kpi(s.essentiel + s.pro, 'Abonnés', s.essentiel + ' Essentiel · ' + s.pro + ' Pro'), kpi(s.conv + ' %', 'Conversion essai → payant', s.trialEnded + ' essais terminés sans offre')),
      el('section', { class: 'd-stats d-stats--3' }, kpi(eur.format(s.mrr), 'CA mensuel estimé (TTC)', 'Calculé d\'après les offres attribuées'), kpi(eur.format(s.arr), 'CA annuel estimé (TTC)', 'MRR × 12'), kpi(s.cancelled, 'Abonnements résiliés')),
      el('p', { class: 'd-note', text: 'Le chiffre d\'affaires est une estimation basée sur l\'offre et la facturation que vous attribuez à chaque client. Il ne reflète pas des encaissements réels tant qu\'aucun système de paiement n\'est branché.' }),
      el('div', { class: 'd-card' }, el('h2', { text: 'Inscriptions des 14 derniers jours' }), chart()),
      el('div', { class: 'd-card' },
        el('div', { class: 'a-head' }, el('h2', { text: 'Clients (' + list.length + ')' }), el('input', { type: 'search', placeholder: 'Rechercher…', 'aria-label': 'Rechercher un client', value: state.q, oninput: (e) => { state.q = e.target.value; const pos = e.target.selectionStart; render(); const i = root.querySelector('input[type=search]'); i.focus(); i.setSelectionRange(pos, pos); } })),
        el('div', { class: 'a-scroll' }, el('table', { class: 'a-table' },
          el('thead', null, el('tr', null, ['Client', 'Contact', 'Inscrit le', 'Offre', 'Facturation', 'Fin d\'essai'].map((h) => el('th', { scope: 'col', text: h })))),
          el('tbody', null, list.map((p) => el('tr', null,
            el('td', null, el('strong', { text: p.full_name || '—' }), el('small', { text: [p.company, p.trade].filter(Boolean).join(' · ') }), p.is_admin ? el('em', { class: 'tag tag--blue', text: 'admin' }) : null, p.stripe_subscription_id ? el('em', { class: 'tag tag--green', text: p.cancel_at_period_end ? 'Stripe · résilie' : 'Stripe' }) : null),
            el('td', null, el('a', { href: 'mailto:' + (p.email || ''), text: p.email || '—' }), el('small', { text: p.phone || '' })),
            el('td', { text: fdate(p.created_at) }),
            el('td', null, sel([['trial', 'Essai'], ['essentiel', 'Essentiel'], ['pro', 'Pro'], ['annule', 'Résilié']], p.plan, (v) => updateProfile(p.id, { plan: v }), 'Offre de ' + (p.full_name || p.email))),
            el('td', null, sel([['month', 'Mensuel'], ['year', 'Annuel']], p.billing || 'month', (v) => updateProfile(p.id, { billing: v }), 'Facturation de ' + (p.full_name || p.email))),
            el('td', null, el('span', { text: fdate(p.trial_ends_at) + ' ' }), el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '+7 j', title: 'Prolonger l\'essai de 7 jours',
              onclick: () => updateProfile(p.id, { trial_ends_at: new Date(Math.max(Date.now(), new Date(p.trial_ends_at).getTime()) + 7 * DAY).toISOString() }) }))))))),
        list.length ? null : el('p', { class: 'd-muted', text: 'Aucun client ne correspond.' })),
      el('div', { class: 'd-card' }, el('h2', { text: 'Messages reçus (' + open + ' à traiter)' }),
        inbox.length ? el('ul', { class: 'd-rows d-rows--wide' }, inbox.map((m) => el('li', { class: 'd-cr' + (m.handled ? ' is-done' : '') },
          el('div', null, el('strong', { text: m.name + ' · ' + fdate(m.created_at) }), isPro(m) ? el('em', { class: 'pro', text: 'Pro · prioritaire' }) : null, el('small', null, el('a', { href: 'mailto:' + m.email + '?subject=' + encodeURIComponent('Votre message à batiFlow'), text: m.email })), el('p', { class: 'd-crtext', text: m.message })),
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: m.handled ? 'Rouvrir' : 'Marquer traité', onclick: () => toggleHandled(m) })))) : el('p', { class: 'd-muted', text: 'Aucun message pour le moment.' })));
  }

  async function start() {
    document.getElementById('logout').addEventListener('click', async () => { if (client) await client.auth.signOut(); location.href = 'index.html'; });
    if (!client) { document.body.hidden = false; root.replaceChildren(el('p', { class: 'd-banner d-banner--warn', text: 'Supabase n\'est pas configuré : l\'administration nécessite une connexion à la base.' })); return; }
    const { data } = await client.auth.getSession();
    if (!data.session) { location.replace('login.html'); return; }
    const { data: me } = await client.from('profiles').select('is_admin').eq('id', data.session.user.id).maybeSingle();
    if (!me || !me.is_admin) { location.replace('app.html'); return; }
    const [p, m] = await Promise.all([
      client.from('profiles').select('*').order('created_at', { ascending: false }),
      client.from('contact_messages').select('*').order('created_at', { ascending: false }),
    ]);
    if (p.error || m.error) { document.body.hidden = false; root.replaceChildren(el('p', { class: 'd-banner d-banner--warn', text: 'Chargement impossible : ' + (p.error || m.error).message })); return; }
    state.profiles = p.data || []; state.messages = m.data || [];
    document.body.hidden = false; render();
  }
  start();
})();
