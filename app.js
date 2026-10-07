// Espace client batiFlow : clients, chantiers, devis (rappels de relance), comptes rendus (dictée), compte.
// Sans Supabase configuré, une démo en mémoire est affichée. Aucune donnée saisie n'est insérée via innerHTML.
(function () {
  'use strict';
  const client = window.bfClient;
  const CFG = window.BATIFLOW_CONFIG || {};
  const TABLE = { clients: 'clients', chantiers: 'chantiers', devis: 'devis', crs: 'comptes_rendus' };
  const STEPS = [3, 7, 14];
  const DAY = 864e5;
  const PLANS = { essentiel: { name: 'Essentiel', month: 35, year: 350 }, pro: { name: 'Pro', month: 70, year: 700 } };
  const S = { user: null, profile: null, ws: null, wp: null, role: 'owner', people: [], members: [], invites: [], clients: [], chantiers: [], devis: [], crs: [],
    view: 'dashboard', demo: !client, planningStart: null, billingPeriod: 'month', notice: '', photoCh: null, photos: [], photoUrls: {}, photosReady: false, demoPhotos: [] };

  // ---------- Utilitaires ----------
  const $ = (id) => document.getElementById(id);
  function el(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
      if (v == null || v === false) continue;
      if (k === 'class') e.className = v;
      else if (k === 'text') e.textContent = v;
      else if (k.startsWith('on')) e.addEventListener(k.slice(2), v);
      else e.setAttribute(k, v === true ? '' : v);
    }
    for (const kid of kids.flat()) { if (kid == null || kid === false) continue; e.append(kid.nodeType ? kid : document.createTextNode(String(kid))); }
    return e;
  }
  const eur = new Intl.NumberFormat('fr-FR', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 });
  const money = (n) => eur.format(Number(n) || 0);
  const fdate = (d) => (d ? new Intl.DateTimeFormat('fr-FR', { dateStyle: 'medium' }).format(new Date(d)) : '');
  const uid = () => (crypto.randomUUID ? crypto.randomUUID() : String(Date.now() + Math.random()));
  const byId = (list, id) => list.find((x) => x.id === id);
  const STATUS_CH = { a_venir: ['À venir', 'blue'], en_cours: ['En cours', 'green'], termine: ['Terminé', 'gray'] };
  const STATUS_DV = { brouillon: ['Brouillon', 'gray'], envoye: ['Envoyé', 'blue'], accepte: ['Accepté', 'green'], refuse: ['Refusé', 'red'] };
  const tag = (pair) => el('em', { class: 'tag tag--' + pair[1], text: pair[0] });

  // ---------- Accès aux données ----------
  async function load() {
    if (!client) { seedDemo(); return; }
    for (const k of Object.keys(TABLE)) {
      const { data, error } = await client.from(TABLE[k]).select('*').order('created_at', { ascending: false });
      if (error) throw error;
      S[k] = data || [];
    }
  }
  async function add(k, row) {
    if (!client) { const r = { id: uid(), created_at: new Date().toISOString(), ...row }; S[k].unshift(r); return r; }
    const { data, error } = await client.from(TABLE[k]).insert({ ...row, owner_id: S.ws }).select().single();
    if (error) throw error;
    S[k].unshift(data); return data;
  }
  async function patch(k, id, p) {
    if (!client) { Object.assign(byId(S[k], id), p); return; }
    const { data, error } = await client.from(TABLE[k]).update(p).eq('id', id).select().single();
    if (error) throw error;
    Object.assign(byId(S[k], id), data);
  }
  async function del(k, id) {
    if (client) { const { error } = await client.from(TABLE[k]).delete().eq('id', id); if (error) throw error; }
    S[k] = S[k].filter((x) => x.id !== id);
    if (k === 'clients') { S.chantiers.forEach((c) => { if (c.client_id === id) c.client_id = null; }); S.devis.forEach((d) => { if (d.client_id === id) d.client_id = null; }); }
    if (k === 'chantiers') { S.devis.forEach((d) => { if (d.chantier_id === id) d.chantier_id = null; }); S.crs.forEach((c) => { if (c.chantier_id === id) c.chantier_id = null; }); }
  }
  function seedDemo() {
    if (S.clients.length) return;
    const ago = (d) => new Date(Date.now() - d * DAY).toISOString();
    const c1 = { id: uid(), name: 'M. Dupont', email: 'dupont@example.com', phone: '06 12 34 56 78', address: 'Paris 11e', created_at: ago(20) };
    const c2 = { id: uid(), name: 'Mme Martin', email: 'martin@example.com', phone: '', address: 'Boulogne', created_at: ago(15) };
    S.clients = [c2, c1];
    const day = (n) => new Date(Date.now() + n * DAY).toISOString().slice(0, 10);
    const ch1 = { id: uid(), client_id: c1.id, title: 'Rénovation salle de bain', address: 'Paris 11e', status: 'en_cours', progress: 70, start_date: day(-6), end_date: day(5), assigned_to: 'demo', created_at: ago(18) };
    const ch2 = { id: uid(), client_id: c2.id, title: 'Rénovation appartement', address: 'Boulogne', status: 'en_cours', progress: 45, start_date: day(-2), end_date: day(16), assigned_to: 'demo2', created_at: ago(12) };
    S.chantiers = [ch2, ch1];
    S.devis = [
      { id: uid(), client_id: c2.id, chantier_id: ch2.id, title: 'Peinture complète', reference: 'D-2026-001', validity_days: 30, amount_ttc: 3600, lignes: [{ desc: 'Préparation et protection des surfaces', qty: 1, unit_ht: 600, tva: 10 }, { desc: 'Peinture murs et plafonds, 2 couches (m²)', qty: 80, unit_ht: 33.75, tva: 10 }], status: 'envoye', sent_at: ago(9), relances_envoyees: 1, created_at: ago(9) },
      { id: uid(), client_id: c1.id, chantier_id: ch1.id, title: 'Carrelage salle de bain', amount_ttc: 8450, status: 'envoye', sent_at: ago(4), relances_envoyees: 0, created_at: ago(4) },
      { id: uid(), client_id: c1.id, chantier_id: ch1.id, title: 'Plomberie', amount_ttc: 2200, status: 'accepte', sent_at: ago(14), decided_at: ago(10), relances_envoyees: 0, created_at: ago(14) },
      { id: uid(), client_id: c2.id, chantier_id: ch2.id, title: 'Électricité', amount_ttc: 4100, status: 'accepte', sent_at: ago(40), decided_at: ago(33), relances_envoyees: 1, created_at: ago(40) },
      { id: uid(), client_id: c2.id, chantier_id: null, title: 'Terrasse', amount_ttc: 6900, status: 'refuse', sent_at: ago(30), decided_at: ago(24), relances_envoyees: 2, created_at: ago(30) },
    ];
    S.crs = [{ id: uid(), chantier_id: ch1.id, content: 'Dépose de l\'ancien carrelage terminée. Début de la pose demain matin.', created_at: ago(1) }];
  }

  // ---------- Droits d'écriture et offre Pro (d'après l'espace de travail : le vôtre, ou celui de votre équipe) ----------
  const trialLeft = (p = S.wp) => Math.ceil((new Date(p.trial_ends_at) - Date.now()) / DAY);
  const hasOffer = (p = S.wp) => p.plan === 'essentiel' || p.plan === 'pro'; // l'essai gratuit est une offre avec moyen de paiement enregistré
  const isTrialing = (p = S.wp) => hasOffer(p) && p.subscription_status === 'trialing';
  function canWrite() { return S.demo || S.profile.is_admin || S.wp.is_admin || hasOffer(); }
  function hasPro() { return S.demo || S.profile.is_admin || S.wp.is_admin || S.wp.plan === 'pro'; }
  const needsOffer = () => !S.demo && !S.profile.is_admin && S.role === 'owner' && !hasOffer();
  function guardWrite() {
    if (canWrite()) return true;
    alert("Pour continuer, choisissez une offre dans « Mon compte » : l'essai gratuit de 7 jours démarre à ce moment-là.");
    if (S.view !== 'account') go('account');
    return false;
  }
  const personName = (id) => { const p = S.people.find((x) => x.id === id); return p ? (p.full_name || p.email || 'Collègue') : ''; };

  // ---------- Relances ----------
  function relance(d) {
    if (d.status !== 'envoye' || !d.sent_at) return null;
    const n = d.relances_envoyees || 0;
    if (n >= STEPS.length) return { finished: true };
    const due = new Date(d.sent_at).getTime() + STEPS[n] * DAY;
    return { n, label: 'J+' + STEPS[n], overdue: Date.now() >= due, due };
  }
  const toRelance = () => S.devis.filter((d) => { const r = relance(d); return r && r.overdue; });
  function relanceMail(d) {
    const c = byId(S.clients, d.client_id);
    const me = [S.profile.full_name, S.profile.company].filter(Boolean).join(' – ');
    const subject = 'Votre devis « ' + d.title + ' »';
    const body = 'Bonjour' + (c ? ' ' + c.name : '') + ',\n\nJe reviens vers vous au sujet du devis « ' + d.title + ' » d\'un montant de ' + money(d.amount_ttc) +
      ' TTC, envoyé le ' + fdate(d.sent_at) + '.\nAvez-vous eu l\'occasion de le consulter ? Je reste à votre disposition pour toute question.\n\nCordialement,\n' + me;
    return { to: c && c.email ? c.email : '', subject, body };
  }

  // ---------- Formulaire en fenêtre ----------
  function openForm({ title, fields, values = {}, submitLabel = 'Enregistrer', onSubmit }) {
    const dlg = $('dlg'), form = $('dlgForm');
    form.replaceChildren();
    const msg = el('p', { class: 'form__msg', role: 'alert' });
    form.append(el('h2', { text: title }));
    for (const f of fields) {
      const id = 'f_' + f.name;
      let input;
      if (f.type === 'select') {
        input = el('select', { id, name: f.name }, f.options.map(([v, l]) => el('option', { value: v, text: l, selected: String(values[f.name] ?? '') === String(v) })));
      } else if (f.type === 'textarea') {
        input = el('textarea', { id, name: f.name, rows: 5, maxlength: f.max || 4000 }); input.value = values[f.name] ?? '';
      } else {
        input = el('input', { id, name: f.name, type: f.type || 'text', min: f.min, max: f.max, step: f.step, maxlength: f.type ? null : 200 }); input.value = values[f.name] ?? '';
      }
      if (f.required) input.required = true;
      form.append(el('div', { class: 'field' }, el('label', { for: id, text: f.label }), input));
    }
    const cancel = el('button', { type: 'button', class: 'btn btn--ghost', text: 'Annuler', onclick: () => dlg.close() });
    const ok = el('button', { type: 'submit', class: 'btn btn--primary', text: submitLabel });
    form.append(msg, el('div', { class: 'd-actions' }, cancel, ok));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const out = {};
      for (const f of fields) {
        let v = form.elements.namedItem(f.name).value.trim();
        if (f.required && !v) { msg.textContent = 'Merci de renseigner : ' + f.label; msg.className = 'form__msg is-error'; return; }
        if (f.type === 'number' || f.type === 'range') v = v === '' ? 0 : Number(v);
        else if (f.type === 'select' && v === '') v = null;
        else if (v === '') v = null;
        out[f.name] = v;
      }
      ok.disabled = true;
      try { await onSubmit(out); dlg.close(); render(); }
      catch (err) { msg.textContent = 'Enregistrement impossible : ' + (err && err.message ? err.message : 'erreur'); msg.className = 'form__msg is-error'; ok.disabled = false; }
    };
    dlg.showModal();
    const first = form.querySelector('input,select,textarea'); if (first) first.focus();
  }
  const clientOptions = (empty = 'Aucun') => [['', empty], ...S.clients.map((c) => [c.id, c.name])];
  const chantierOptions = (empty = 'Aucun') => [['', empty], ...S.chantiers.map((c) => [c.id, c.title])];

  // ---------- Écrans ----------
  function empty(text, label, fn) {
    return el('div', { class: 'd-empty' }, el('p', { text }), label ? el('button', { type: 'button', class: 'btn btn--primary', text: label, onclick: fn }) : null);
  }
  function head(title, actionLabel, fn) {
    return el('div', { class: 'd-hello' }, el('h1', { text: title }), actionLabel ? el('button', { type: 'button', class: 'btn btn--primary', text: actionLabel, onclick: fn }) : null);
  }
  const progress = (n) => el('div', { class: 'd-prog', role: 'img', 'aria-label': n + ' %' }, el('i', { style: 'width:' + n + '%' }));

  function viewDashboard() {
    const first = (S.profile.full_name || '').trim().split(/\s+/)[0];
    const en = S.chantiers.filter((c) => c.status === 'en_cours').length;
    const attente = S.devis.filter((d) => d.status === 'envoye');
    const accepte = S.devis.filter((d) => d.status === 'accepte');
    const month = new Date().toISOString().slice(0, 7);
    const crMonth = S.crs.filter((c) => (c.created_at || '').slice(0, 7) === month).length;
    const relances = toRelance();
    const card = (n, l, extra) => el('div', { class: 'd-card' }, el('b', { text: n }), el('span', { text: l }, extra));
    return el('div', null,
      el('div', { class: 'd-hello' }, el('div', null, el('h1', { text: first ? 'Bonjour ' + first + ' !' : 'Bonjour !' }), el('p', { class: 'd-date', text: new Intl.DateTimeFormat('fr-FR', { dateStyle: 'full' }).format(new Date()) })),
        el('button', { type: 'button', class: 'btn btn--primary', text: '+ Nouveau chantier', onclick: () => editChantier() })),
      el('section', { class: 'd-stats' },
        card(en, 'Chantiers en cours'),
        card(attente.length, 'Devis en attente', relances.length ? el('em', { class: 'tag tag--red', text: relances.length + ' à relancer' }) : null),
        card(money(accepte.reduce((s, d) => s + Number(d.amount_ttc), 0)), 'Devis acceptés (TTC)'),
        card(crMonth, 'Comptes rendus ce mois-ci')),
      el('section', { class: 'd-lists' },
        el('article', { class: 'd-card' }, el('h2', { text: 'Mes chantiers' }),
          S.chantiers.length ? el('ul', { class: 'd-rows' }, S.chantiers.slice(0, 5).map((c) => el('li', null,
            el('div', null, el('strong', { text: c.title }), el('small', { text: (byId(S.clients, c.client_id) || {}).name || 'Sans client' })), progress(c.progress), tag(STATUS_CH[c.status])))) :
            empty('Aucun chantier pour le moment.', 'Créer mon premier chantier', () => editChantier())),
        el('article', { class: 'd-card' }, el('h2', { text: 'Devis à relancer' }),
          relances.length ? el('ul', { class: 'd-rows' }, relances.map((d) => el('li', null,
            el('div', null, el('strong', { text: d.title }), el('small', { text: ((byId(S.clients, d.client_id) || {}).name || 'Sans client') + ' · envoyé le ' + fdate(d.sent_at) })),
            el('b', { text: money(d.amount_ttc) }), el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Relancer (' + relance(d).label + ')', onclick: () => doRelance(d) })))) :
            el('p', { class: 'd-muted', text: S.devis.length ? 'Aucun devis à relancer pour le moment.' : 'Vos devis envoyés apparaîtront ici avec un rappel à J+3, J+7 et J+14.' }))));
  }

  function editClient(c) {
    if (!guardWrite()) return;
    openForm({ title: c ? 'Modifier le client' : 'Nouveau client', values: c || {}, onSubmit: (v) => (c ? patch('clients', c.id, v) : add('clients', v)),
      fields: [{ name: 'name', label: 'Nom', required: true }, { name: 'email', label: 'Email', type: 'email' }, { name: 'phone', label: 'Téléphone', type: 'tel' }, { name: 'address', label: 'Adresse' }] });
  }
  function viewClients() {
    return el('div', null, head('Clients', '+ Nouveau client', () => editClient()),
      S.clients.length ? el('div', { class: 'd-card' }, el('ul', { class: 'd-rows d-rows--wide' }, S.clients.map((c) => el('li', null,
        el('div', null, el('strong', { text: c.name }), el('small', { text: [c.email, c.phone, c.address].filter(Boolean).join(' · ') || 'Aucune coordonnée' })),
        el('span', { class: 'd-muted', text: S.chantiers.filter((x) => x.client_id === c.id).length + ' chantier(s)' }),
        el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Modifier', onclick: () => editClient(c) }),
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Supprimer', onclick: () => remove('clients', c, 'ce client') })))))) :
        empty('Aucun client enregistré.', 'Ajouter un client', () => editClient()));
  }

  function editChantier(c) {
    if (!guardWrite()) return;
    const fields = [{ name: 'title', label: 'Intitulé', required: true }, { name: 'client_id', label: 'Client', type: 'select', options: clientOptions('Sans client') }, { name: 'address', label: 'Adresse du chantier' },
      { name: 'status', label: 'Statut', type: 'select', options: [['a_venir', 'À venir'], ['en_cours', 'En cours'], ['termine', 'Terminé']] },
      { name: 'progress', label: 'Avancement (%)', type: 'number', min: 0, max: 100, step: 5 },
      { name: 'start_date', label: 'Début (planning)', type: 'date' }, { name: 'end_date', label: 'Fin prévue (planning)', type: 'date' }];
    if (hasPro() && S.people.length > 1) fields.push({ name: 'assigned_to', label: 'Assigné à', type: 'select', options: [['', 'Non assigné'], ...S.people.map((p) => [p.id, personName(p.id)])] });
    openForm({ title: c ? 'Modifier le chantier' : 'Nouveau chantier', values: c || { status: 'a_venir', progress: 0 },
      onSubmit: (v) => {
        if (v.start_date && v.end_date && v.end_date < v.start_date) throw new Error('La fin doit être après le début');
        return c ? patch('chantiers', c.id, v) : add('chantiers', v);
      }, fields });
  }
  function viewChantiers() {
    return el('div', null, head('Chantiers', '+ Nouveau chantier', () => editChantier()),
      S.chantiers.length ? el('div', { class: 'd-card' }, el('ul', { class: 'd-rows d-rows--wide' }, S.chantiers.map((c) => {
        const n = S.devis.filter((d) => d.chantier_id === c.id).length, r = S.crs.filter((d) => d.chantier_id === c.id).length;
        return el('li', null,
          el('div', null, el('strong', { text: c.title }), el('small', { text: [(byId(S.clients, c.client_id) || {}).name, c.address, n + ' devis', r + ' compte(s) rendu(s)'].filter(Boolean).join(' · ') })),
          el('div', { class: 'd-pc' }, progress(c.progress), el('small', { text: c.progress + ' %' })), tag(STATUS_CH[c.status]),
          el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Photos', onclick: () => openPhotos(c) }), el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Modifier', onclick: () => editChantier(c) }),
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Supprimer', onclick: () => remove('chantiers', c, 'ce chantier') })));
      }))) : empty('Aucun chantier.', 'Créer un chantier', () => editChantier()));
  }

  // ---------- Devis : formulaire détaillé, PDF, email ----------
  const TVA_RATES = [[10, '10 %'], [20, '20 %'], [5.5, '5,5 %'], [0, '0 %']];
  const nextReference = () => {
    const y = new Date().getFullYear(), pre = 'D-' + y + '-';
    const n = S.devis.filter((x) => (x.reference || '').startsWith(pre)).map((x) => parseInt(x.reference.slice(pre.length), 10) || 0);
    return pre + String((n.length ? Math.max(...n) : 0) + 1).padStart(3, '0');
  };
  function editDevis(d) {
    if (!guardWrite()) return;
    const dlg = $('dlg'), form = $('dlgForm'); form.replaceChildren(); form.onsubmit = null;
    const B = window.BFDevis;
    const L = (d && d.lignes && d.lignes.length ? d.lignes : [{ desc: d ? d.title : '', qty: 1, unit_ht: 0, tva: 10 }]).map((x) => ({ ...x }));
    const msg = el('p', { class: 'form__msg', role: 'alert' });
    const f = (id, label, node) => el('div', { class: 'field' }, el('label', { for: id, text: label }), node);
    const title = el('input', { id: 'd_title', maxlength: 200 }); title.value = d ? d.title : '';
    const client_ = el('select', { id: 'd_client' }, clientOptions('Sans client').map(([v, l]) => el('option', { value: v, text: l, selected: String((d && d.client_id) || '') === String(v) })));
    const chantier_ = el('select', { id: 'd_chantier' }, chantierOptions('Aucun').map(([v, l]) => el('option', { value: v, text: l, selected: String((d && d.chantier_id) || '') === String(v) })));
    const status = el('select', { id: 'd_status' }, [['brouillon', 'Brouillon'], ['envoye', 'Envoyé au client'], ['accepte', 'Accepté'], ['refuse', 'Refusé']].map(([v, l]) => el('option', { value: v, text: l, selected: ((d && d.status) || 'brouillon') === v })));
    const valid = el('input', { id: 'd_valid', type: 'number', min: 1, max: 365, step: 1 }); valid.value = (d && d.validity_days) || 30;
    const notes = el('textarea', { id: 'd_notes', rows: 3, maxlength: 1000, placeholder: 'Ex. : acompte de 30 % à la commande, solde à la réception des travaux.' }); notes.value = (d && d.notes) || '';
    const body = el('div', { class: 'dv-lines' });
    const totals = el('div', { class: 'dv-totals', 'aria-live': 'polite' });
    function refresh() {
      const t = B.calc(L);
      totals.replaceChildren(el('span', { text: 'Total HT : ' + B.money(t.ht) }), ...t.taxes.map((x) => el('span', { class: 'd-muted', text: 'TVA ' + String(x.rate).replace('.', ',') + ' % : ' + B.money(x.amount) })), el('strong', { text: 'Total TTC : ' + B.money(t.ttc) }));
    }
    function drawLines() {
      body.replaceChildren(...L.map((l, i) => {
        const inp = (key, type, ph, w) => { const x = el('input', { type, placeholder: ph, 'aria-label': ph + ' ligne ' + (i + 1), class: w, step: type === 'number' ? '0.01' : null, min: type === 'number' ? '0' : null, maxlength: type === 'text' ? 300 : null }); x.value = l[key] ?? ''; x.addEventListener('input', () => { l[key] = type === 'number' ? (x.value === '' ? '' : Number(x.value)) : x.value; refresh(); }); return x; };
        const tva = el('select', { 'aria-label': 'TVA ligne ' + (i + 1) }, TVA_RATES.map(([v, t]) => el('option', { value: v, text: t, selected: Number(l.tva) === v }))); tva.addEventListener('change', () => { l.tva = Number(tva.value); refresh(); });
        return el('div', { class: 'dv-line' }, inp('desc', 'text', 'Désignation', 'dv-desc'), inp('qty', 'number', 'Qté', 'dv-n'), inp('unit_ht', 'number', 'P.U. HT', 'dv-n'), tva,
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', 'aria-label': 'Supprimer la ligne ' + (i + 1), text: '✕', disabled: L.length === 1, onclick: () => { L.splice(i, 1); drawLines(); refresh(); } }));
      }));
    }
    drawLines(); refresh();
    const ok = el('button', { type: 'submit', class: 'btn btn--primary', text: 'Enregistrer' });
    form.append(el('h2', { text: d ? 'Modifier le devis' : 'Nouveau devis' }), f('d_title', 'Objet du devis', title), el('div', { class: 'dv-row' }, f('d_client', 'Client', client_), f('d_chantier', 'Chantier', chantier_)),
      el('div', { class: 'field' }, el('label', { text: 'Lignes du devis' }), body, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '+ Ajouter une ligne', onclick: () => { L.push({ desc: '', qty: 1, unit_ht: 0, tva: L[L.length - 1] ? L[L.length - 1].tva : 10 }); drawLines(); refresh(); } })),
      totals, el('div', { class: 'dv-row' }, f('d_status', 'Statut', status), f('d_valid', 'Validité (jours)', valid)), f('d_notes', 'Conditions et remarques (visibles sur le PDF)', notes),
      el('p', { class: 'd-muted dv-legal', text: 'Vérifiez que votre devis contient toutes les mentions légales exigées pour votre activité (identité, assurance, délais, conditions de paiement…).' }),
      msg, el('div', { class: 'd-actions' }, el('button', { type: 'button', class: 'btn btn--ghost', text: 'Annuler', onclick: () => dlg.close() }), ok));
    form.onsubmit = async (e) => {
      e.preventDefault();
      const clean = L.filter((l) => String(l.desc || '').trim()).map((l) => ({ desc: String(l.desc).trim(), qty: B.num(l.qty), unit_ht: B.num(l.unit_ht), tva: Number(l.tva) }));
      const fail = (m) => { msg.textContent = m; msg.className = 'form__msg is-error'; };
      if (!title.value.trim()) return fail('Merci de renseigner l\'objet du devis.');
      if (!clean.length) return fail('Ajoutez au moins une ligne avec une désignation.');
      if (clean.some((l) => l.qty <= 0 || l.unit_ht < 0)) return fail('Quantité et prix doivent être positifs.');
      const t = B.calc(clean), st = status.value;
      const v = { title: title.value.trim(), client_id: client_.value || null, chantier_id: chantier_.value || null, status: st, validity_days: Math.min(365, Math.max(1, parseInt(valid.value, 10) || 30)),
        notes: notes.value.trim() || null, lignes: clean, amount_ttc: t.ttc, reference: (d && d.reference) || nextReference() };
      if (st === 'envoye' && !(d && d.sent_at)) v.sent_at = new Date().toISOString();
      if (st === 'brouillon') { v.sent_at = null; v.relances_envoyees = 0; }
      if ((st === 'accepte' || st === 'refuse') && !(d && d.decided_at)) v.decided_at = new Date().toISOString();
      if (st === 'brouillon' || st === 'envoye') v.decided_at = null;
      ok.disabled = true;
      try { if (d) await patch('devis', d.id, v); else await add('devis', v); dlg.close(); render(); }
      catch (err) { fail('Enregistrement impossible : ' + (err && err.message ? err.message : 'erreur')); ok.disabled = false; }
    };
    dlg.showModal(); title.focus();
  }
  function devisData(d) {
    const p = S.profile, c = byId(S.clients, d.client_id) || {}, ch = byId(S.chantiers, d.chantier_id);
    return { reference: d.reference, date: d.sent_at || d.created_at, validity_days: d.validity_days, title: d.title, notes: d.notes, lignes: d.lignes,
      issuer: { name: p.full_name, company: p.company, address: p.company_address, siret: p.siret, tva: p.tva_mention, phone: p.phone, email: S.user.email },
      client: { name: c.name, address: c.address, email: c.email, phone: c.phone }, chantier: ch ? { title: ch.title, address: ch.address } : null };
  }
  function devisFile(d) {
    if (!d.lignes || !d.lignes.length) { alert('Ce devis n\'a pas de lignes détaillées. Ouvrez-le avec « Modifier » pour les ajouter, puis générez le PDF.'); return null; }
    if (!S.profile.siret || !S.profile.company_address) {
      if (!confirm('Votre SIRET ou l\'adresse de votre entreprise ne sont pas renseignés (Mon compte > Informations). Générer le PDF quand même ?')) return null;
    }
    try { const doc = window.BFDevis.pdf(devisData(d)); const name = (d.reference || 'devis') + '.pdf'; doc.save(name); return name; }
    catch (e) { alert('Génération du PDF impossible : ' + e.message); return null; }
  }
  async function sendDevis(d) {
    const name = devisFile(d); if (!name) return;
    const c = byId(S.clients, d.client_id) || {}, me = [S.profile.full_name, S.profile.company].filter(Boolean).join(' – ');
    const subject = 'Devis ' + (d.reference || '') + ' – ' + d.title;
    const mail = 'Bonjour' + (c.name ? ' ' + c.name : '') + ',\n\nVeuillez trouver ci-joint le devis ' + (d.reference || '') + ' « ' + d.title + ' » d\'un montant de ' + money(d.amount_ttc) + ' TTC, valable ' + (d.validity_days || 30) + ' jours.\nPour l\'accepter, merci de me le retourner daté et signé avec la mention « Bon pour accord ».\n\nCordialement,\n' + me;
    alert('Le PDF « ' + name + ' » vient d\'être téléchargé. Votre messagerie va s\'ouvrir : joignez-y ce fichier avant d\'envoyer.');
    window.location.href = 'mailto:' + (c.email || '') + '?subject=' + encodeURIComponent(subject) + '&body=' + encodeURIComponent(mail);
    if (d.status === 'brouillon' && confirm('Marquer ce devis comme envoyé ? Les rappels de relance démarrent à partir d\'aujourd\'hui.')) await setStatus(d, 'envoye');
  }

  async function setStatus(d, status) {
    if (!guardWrite()) return;
    const p = { status };
    if (status === 'envoye') { p.sent_at = new Date().toISOString(); p.relances_envoyees = 0; p.decided_at = null; }
    if (status === 'accepte' || status === 'refuse') p.decided_at = new Date().toISOString();
    try { await patch('devis', d.id, p); render(); } catch (e) { alert('Action impossible : ' + e.message); }
  }
  async function doRelance(d) {
    if (!guardWrite()) return;
    const m = relanceMail(d);
    if (!m.to && !confirm("Ce client n'a pas d'adresse email. Ouvrir quand même le message ?")) return;
    window.location.href = 'mailto:' + encodeURIComponent(m.to).replace('%40', '@') + '?subject=' + encodeURIComponent(m.subject) + '&body=' + encodeURIComponent(m.body);
    try { await patch('devis', d.id, { relances_envoyees: Math.min((d.relances_envoyees || 0) + 1, 3) }); render(); } catch (e) { alert('Compteur de relances non mis à jour : ' + e.message); }
  }
  function viewDevis() {
    const total = (st) => S.devis.filter((d) => d.status === st).reduce((s, d) => s + Number(d.amount_ttc), 0);
    return el('div', null, head('Devis', '+ Nouveau devis', () => editDevis()),
      el('section', { class: 'd-stats d-stats--3' },
        el('div', { class: 'd-card' }, el('b', { text: money(total('envoye')) }), el('span', { text: 'En attente de réponse' })),
        el('div', { class: 'd-card' }, el('b', { text: money(total('accepte')) }), el('span', { text: 'Acceptés' })),
        el('div', { class: 'd-card' }, el('b', { text: toRelance().length }), el('span', { text: 'À relancer maintenant' }))),
      S.devis.length ? el('div', { class: 'd-card' }, el('ul', { class: 'd-rows d-rows--wide' }, S.devis.map((d) => {
        const r = relance(d), c = byId(S.clients, d.client_id);
        const acts = [];
        if (d.status === 'brouillon') acts.push(el('button', { type: 'button', class: 'btn btn--primary btn--sm', text: 'Marquer envoyé', onclick: () => setStatus(d, 'envoye') }));
        if (d.status === 'envoye') {
          acts.push(el('button', { type: 'button', class: 'btn ' + (r && r.overdue ? 'btn--primary' : 'btn--ghost') + ' btn--sm', text: r && r.finished ? 'Relancer encore' : 'Relancer', onclick: () => doRelance(d) }),
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Accepté', onclick: () => setStatus(d, 'accepte') }),
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Refusé', onclick: () => setStatus(d, 'refuse') }));
        }
        acts.push(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'PDF', title: 'Télécharger le devis en PDF', onclick: () => devisFile(d) }), el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Envoyer', title: 'Télécharger le PDF et préparer l\'email', onclick: () => sendDevis(d) }),
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Modifier', onclick: () => editDevis(d) }), el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Supprimer', onclick: () => remove('devis', d, 'ce devis') }));
        let note = '';
        if (r && r.finished) note = ' · 3 relances faites';
        else if (r) note = r.overdue ? ' · relance ' + r.label + ' à faire' : ' · prochaine relance ' + r.label + ' le ' + fdate(r.due);
        return el('li', { class: 'd-devis' },
          el('div', null, el('strong', { text: d.title }), el('small', { text: (c ? c.name : 'Sans client') + (d.sent_at ? ' · envoyé le ' + fdate(d.sent_at) : '') + note })),
          el('b', { text: money(d.amount_ttc) }), tag(r && r.overdue ? ['À relancer ' + r.label, 'red'] : STATUS_DV[d.status]),
          el('div', { class: 'd-actions d-actions--inline' }, acts));
      }))) : empty('Aucun devis.', 'Créer un devis', () => editDevis()));
  }

  // ---------- Comptes rendus : dictée vocale ----------
  let rec = null;
  function viewCrs() {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    const ta = el('textarea', { id: 'crText', rows: 6, maxlength: 4000, placeholder: 'Dictez ou saisissez votre compte rendu du jour…' });
    const sel = el('select', { id: 'crChantier' }, chantierOptions('Aucun chantier').map(([v, l]) => el('option', { value: v, text: l })));
    const status = el('small', { class: 'd-muted', role: 'status', text: SR ? 'Cliquez sur le micro puis parlez.' : 'La dictée vocale n\'est pas disponible sur ce navigateur (essayez Chrome ou Safari). Vous pouvez saisir le texte.' });
    const mic = el('button', { type: 'button', class: 'btn btn--ghost', text: '🎤 Dicter', disabled: !SR });
    if (SR) {
      mic.addEventListener('click', () => {
        if (rec) { rec.stop(); return; }
        rec = new SR(); rec.lang = 'fr-FR'; rec.continuous = true; rec.interimResults = false;
        rec.onresult = (e) => { for (let i = e.resultIndex; i < e.results.length; i++) if (e.results[i].isFinal) ta.value = (ta.value ? ta.value.trimEnd() + ' ' : '') + e.results[i][0].transcript.trim(); };
        rec.onerror = (e) => { status.textContent = e.error === 'not-allowed' ? 'Accès au micro refusé : autorisez-le dans votre navigateur.' : 'Dictée interrompue (' + e.error + ').'; };
        rec.onend = () => { rec = null; mic.textContent = '🎤 Dicter'; if (!status.textContent.startsWith('Accès') && !status.textContent.startsWith('Dictée interrompue')) status.textContent = 'Dictée terminée. Relisez et corrigez avant d\'enregistrer.'; };
        try { rec.start(); mic.textContent = '⏹ Arrêter'; status.textContent = 'Je vous écoute…'; } catch { rec = null; }
      });
    }
    const save = el('button', { type: 'button', class: 'btn btn--primary', text: 'Enregistrer le compte rendu', onclick: async () => {
      if (!guardWrite()) return;
      const content = ta.value.trim(); if (!content) { status.textContent = 'Le compte rendu est vide.'; return; }
      if (rec) rec.stop();
      try { await add('crs', { content, chantier_id: sel.value || null }); render(); } catch (e) { status.textContent = 'Enregistrement impossible : ' + e.message; }
    } });
    return el('div', null, head('Comptes rendus'),
      el('div', { class: 'd-card' }, el('h2', { text: 'Nouveau compte rendu' }),
        el('div', { class: 'field' }, el('label', { for: 'crChantier', text: 'Chantier' }), sel),
        el('div', { class: 'field' }, el('label', { for: 'crText', text: 'Texte' }), ta),
        el('div', { class: 'd-actions d-actions--inline' }, mic, save), status),
      S.crs.length ? el('div', { class: 'd-card' }, el('h2', { text: 'Historique' }), el('ul', { class: 'd-rows d-rows--wide' }, S.crs.map((c) => el('li', { class: 'd-cr' },
        el('div', null, el('strong', { text: fdate(c.created_at) + ((byId(S.chantiers, c.chantier_id) || {}).title ? ' · ' + byId(S.chantiers, c.chantier_id).title : '') }), el('p', { class: 'd-crtext', text: c.content })),
        el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Copier', onclick: (e) => { (navigator.clipboard ? navigator.clipboard.writeText(c.content) : Promise.reject()).then(() => { e.target.textContent = 'Copié ✓'; }, () => { e.target.textContent = 'Copie impossible'; }); } }),
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Supprimer', onclick: () => remove('crs', c, 'ce compte rendu') })))))) : null);
  }

  // ---------- Fonctions Pro : verrouillage ----------
  function locked(title, text) {
    return el('div', null, head(title),
      el('div', { class: 'd-card d-lock' }, el('span', { class: 'pro pro--lg', text: 'Pro' }), el('h2', { text: 'Fonction de l\'offre Pro' }), el('p', { class: 'd-muted', text: text }),
        el('button', { type: 'button', class: 'btn btn--primary', text: 'Voir les offres', onclick: () => go('account') })));
  }
  const go = (v) => { S.view = v; render(); window.scrollTo(0, 0); };

  // ---------- Planning partagé (Pro) ----------
  const WEEKS = 4;
  const isoDay = (d) => d.toISOString().slice(0, 10);
  const mondayOf = (d) => { const x = new Date(d); x.setUTCHours(0, 0, 0, 0); const wd = (x.getUTCDay() + 6) % 7; x.setUTCDate(x.getUTCDate() - wd); return x; };
  function viewPlanning() {
    if (!hasPro()) return locked('Planning', 'Visualisez tous vos chantiers sur un calendrier partagé avec votre équipe, et assignez chaque chantier à un collègue.');
    if (!S.planningStart) S.planningStart = mondayOf(new Date());
    const start = S.planningStart, nDays = WEEKS * 7, days = [];
    for (let i = 0; i < nDays; i++) { const d = new Date(start); d.setUTCDate(d.getUTCDate() + i); days.push(d); }
    const idx = (iso) => Math.round((new Date(iso + 'T00:00:00Z') - start) / DAY);
    const today = isoDay(new Date());
    const dated = S.chantiers.filter((c) => c.start_date || c.end_date);
    const undated = S.chantiers.filter((c) => !c.start_date && !c.end_date && c.status !== 'termine');
    const groups = new Map();
    dated.forEach((c) => { const k = c.assigned_to || ''; if (!groups.has(k)) groups.set(k, []); groups.get(k).push(c); });
    const keys = [...groups.keys()].sort((a, b) => (a === '' ? 1 : b === '' ? -1 : personName(a).localeCompare(personName(b))));
    const grid = el('div', { class: 'pl-grid', style: '--cols:' + nDays });
    grid.append(el('div', { class: 'pl-corner' }), ...days.map((d) => { const iso = isoDay(d), wd = (d.getUTCDay() + 6) % 7;
      return el('div', { class: 'pl-day' + (wd >= 5 ? ' is-we' : '') + (iso === today ? ' is-today' : ''), title: fdate(d) }, el('small', { text: 'LMMJVSD'[wd] }), el('b', { text: d.getUTCDate() })); }));
    let rows = 0;
    for (const k of keys) {
      grid.append(el('div', { class: 'pl-group', text: k ? personName(k) || 'Collègue' : 'Non assigné' }));
      for (const c of groups.get(k)) {
        const s0 = c.start_date || c.end_date, e0 = c.end_date || c.start_date;
        let a = idx(s0), b = idx(e0);
        grid.append(el('div', { class: 'pl-label', text: c.title }));
        if (b < 0 || a >= nDays) { grid.append(el('div', { class: 'pl-off', style: 'grid-column:2 / -1', text: 'Hors de la période affichée (' + fdate(s0) + (e0 !== s0 ? ' → ' + fdate(e0) : '') + ')' })); rows++; continue; }
        a = Math.max(a, 0); b = Math.min(b, nDays - 1);
        grid.append(el('button', { type: 'button', class: 'pl-bar pl-bar--' + c.status, style: 'grid-column:' + (a + 2) + ' / ' + (b + 3), title: c.title + ' · ' + fdate(s0) + ' → ' + fdate(e0), onclick: () => editChantier(c), text: c.progress + ' %' }));
        rows++;
      }
    }
    const shift = (n) => () => { const d = new Date(S.planningStart); d.setUTCDate(d.getUTCDate() + n); S.planningStart = d; render(); };
    return el('div', null, head('Planning', '+ Nouveau chantier', () => editChantier()),
      el('div', { class: 'd-card' },
        el('div', { class: 'pl-nav' }, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '◀ Précédent', onclick: shift(-14) }),
          el('strong', { text: fdate(days[0]) + ' – ' + fdate(days[nDays - 1]) }),
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Suivant ▶', onclick: shift(14) }),
          el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Aujourd\'hui', onclick: () => { S.planningStart = mondayOf(new Date()); render(); } })),
        rows ? el('div', { class: 'pl-scroll' }, grid) : el('p', { class: 'd-muted', text: 'Aucun chantier daté. Renseignez un début et une fin dans la fiche d\'un chantier pour le voir ici.' }),
        undated.length ? el('p', { class: 'd-muted', text: 'Sans dates : ' + undated.map((c) => c.title).join(', ') + '.' }) : null));
  }

  // ---------- Statistiques détaillées (Pro) ----------
  function viewStats() {
    if (!hasPro()) return locked('Statistiques', 'Suivez votre taux d\'acceptation, votre panier moyen, votre chiffre d\'affaires par mois et vos meilleurs clients.');
    const acc = S.devis.filter((d) => d.status === 'accepte'), ref = S.devis.filter((d) => d.status === 'refuse'), wait = S.devis.filter((d) => d.status === 'envoye');
    const sum = (l) => l.reduce((s, d) => s + Number(d.amount_ttc), 0);
    const decided = acc.length + ref.length;
    const delays = [...acc, ...ref].filter((d) => d.sent_at && d.decided_at).map((d) => (new Date(d.decided_at) - new Date(d.sent_at)) / DAY);
    const avgDelay = delays.length ? delays.reduce((a, b) => a + b, 0) / delays.length : null;
    const months = [];
    for (let i = 5; i >= 0; i--) { const d = new Date(); d.setUTCDate(1); d.setUTCMonth(d.getUTCMonth() - i); months.push({ key: d.toISOString().slice(0, 7), label: new Intl.DateTimeFormat('fr-FR', { month: 'short' }).format(d), v: 0 }); }
    acc.forEach((d) => { const m = months.find((x) => x.key === (d.decided_at || d.created_at || '').slice(0, 7)); if (m) m.v += Number(d.amount_ttc); });
    const max = Math.max(1, ...months.map((m) => m.v));
    const perClient = new Map(); acc.forEach((d) => { const n = (byId(S.clients, d.client_id) || {}).name || 'Sans client'; perClient.set(n, (perClient.get(n) || 0) + Number(d.amount_ttc)); });
    const top = [...perClient.entries()].sort((a, b) => b[1] - a[1]).slice(0, 5);
    const stat = (v, l, h) => el('div', { class: 'd-card' }, el('b', { text: v }), el('span', { text: l }), h ? el('small', { class: 'd-muted', text: h }) : null);
    const byStatus = ['a_venir', 'en_cours', 'termine'].map((k) => [STATUS_CH[k][0], S.chantiers.filter((c) => c.status === k).length]);
    return el('div', null, head('Statistiques'),
      el('section', { class: 'd-stats' }, stat(decided ? Math.round((acc.length / decided) * 100) + ' %' : '—', 'Taux d\'acceptation', acc.length + ' acceptés · ' + ref.length + ' refusés'),
        stat(acc.length ? money(sum(acc) / acc.length) : '—', 'Panier moyen (devis acceptés)'), stat(avgDelay == null ? '—' : Math.round(avgDelay * 10) / 10 + ' j', 'Délai moyen de décision'), stat(money(sum(wait)), 'En attente de réponse', wait.length + ' devis')),
      el('div', { class: 'd-card' }, el('h2', { text: 'Chiffre d\'affaires accepté par mois (TTC)' }),
        el('div', { class: 'a-bars', role: 'img', 'aria-label': months.map((m) => m.label + ' ' + money(m.v)).join(', ') }, months.map((m) => el('div', { class: 'a-bar' }, el('i', { style: 'height:' + Math.round((m.v / max) * 100) + '%', title: m.label + ' : ' + money(m.v) }), el('small', { text: m.label }))))),
      el('section', { class: 'd-lists' },
        el('article', { class: 'd-card' }, el('h2', { text: 'Meilleurs clients' }), top.length ? el('ul', { class: 'd-rows' }, top.map(([n, v]) => el('li', { class: 'd-line' }, el('strong', { text: n }), el('b', { text: money(v) })))) : el('p', { class: 'd-muted', text: 'Aucun devis accepté pour le moment.' })),
        el('article', { class: 'd-card' }, el('h2', { text: 'Chantiers par statut' }), el('ul', { class: 'd-rows' }, byStatus.map(([l, n]) => el('li', { class: 'd-line' }, el('strong', { text: l }), el('b', { text: n })))))));
  }

  // ---------- Équipe (Pro) ----------
  async function reloadTeam() { await loadTeam(); render(); }
  function viewTeam() {
    if (!hasPro()) return locked('Équipe', 'Travaillez à plusieurs sur les mêmes clients, chantiers et devis : jusqu\'à 5 utilisateurs avec l\'offre Pro.');
    const owner = S.role === 'owner';
    const seats = 1 + S.members.length + S.invites.length;
    const row = (name, sub, tagEl, actions) => el('li', { class: 'd-line' }, el('div', null, el('strong', { text: name }), el('small', { text: sub })), tagEl, actions);
    const invite = () => openForm({ title: 'Inviter un collègue', submitLabel: 'Inviter', fields: [{ name: 'email', label: 'Email de votre collègue', type: 'email', required: true }],
      onSubmit: async (v) => {
        if (S.demo) { S.invites.push({ id: uid(), email: v.email }); return; }
        const { error } = await client.from('team_invites').insert({ email: v.email });
        if (error) throw new Error(/Limite/.test(error.message) ? 'Limite de 5 utilisateurs atteinte' : /duplicate/.test(error.message) ? 'Cette personne est déjà invitée' : error.message);
        await loadTeam();
      } });
    const removeMember = async (m) => { if (!confirm('Retirer ' + (personName(m.member_id) || 'ce collègue') + ' de l\'équipe ?')) return; if (!S.demo) { const { error } = await client.from('team_members').delete().eq('member_id', m.member_id); if (error) { alert(error.message); return; } } S.members = S.members.filter((x) => x !== m); await reloadTeam(); };
    const cancelInvite = async (i) => { if (!S.demo) { const { error } = await client.from('team_invites').delete().eq('id', i.id); if (error) { alert(error.message); return; } } S.invites = S.invites.filter((x) => x.id !== i.id); render(); };
    const leave = async () => { if (!confirm('Quitter cette équipe ? Vous n\'aurez plus accès à ses données.')) return; const { error } = await client.from('team_members').delete().eq('member_id', S.user.id); if (error) { alert(error.message); return; } location.reload(); };
    return el('div', null, head('Équipe', owner ? '+ Inviter un collègue' : null, invite),
      el('div', { class: 'd-card' }, el('h2', { text: 'Utilisateurs (' + seats + ' / 5)' }),
        el('p', { class: 'd-muted', text: owner ? 'Votre collègue crée son compte batiFlow avec l\'adresse invitée et rejoint automatiquement votre équipe : vous partagez les mêmes clients, chantiers, devis et comptes rendus.' : 'Vous travaillez dans l\'équipe de ' + (S.wp.full_name || 'votre responsable') + '.' }),
        el('ul', { class: 'd-rows' },
          row(owner ? (S.profile.full_name || 'Vous') : (S.wp.full_name || 'Responsable'), owner ? S.user.email : S.wp.email || '', el('em', { class: 'tag tag--blue', text: owner ? 'Vous · responsable' : 'Responsable' })),
          S.members.map((m) => row(personName(m.member_id) || 'Collègue', (S.people.find((p) => p.id === m.member_id) || {}).email || '', el('em', { class: 'tag tag--green', text: m.member_id === S.user.id ? 'Vous' : 'Actif' }),
            owner ? el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Retirer', onclick: () => removeMember(m) }) : null)),
          S.invites.map((i) => row(i.email, 'Invitation envoyée : en attente de création de compte', el('em', { class: 'tag tag--gray', text: 'En attente' }), owner ? el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Annuler', onclick: () => cancelInvite(i) }) : null))),
        !owner && !S.demo ? el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost', text: 'Quitter l\'équipe', onclick: leave })) : null));
  }

  // ---------- Mon compte : abonnement, support, données ----------
  async function billing(action, extra = {}) {
    if (S.demo) { alert('Mode démonstration : le paiement n\'est pas actif.'); return null; }
    const { data, error } = await client.functions.invoke('billing', { body: { action, return_url: location.origin + location.pathname, ...extra } });
    if (error) {
      let m = error.message || 'Erreur';
      try { const j = await error.context.json(); if (j && j.error) m = j.error; } catch { /* corps non lisible */ }
      throw new Error(m === 'not_configured' ? 'Le paiement en ligne n\'est pas encore activé. Écrivez-nous pour souscrire.' : m);
    }
    return data;
  }
  async function pay(action, extra) {
    try { const r = await billing(action, extra); if (!r) return; if (r.url) { location.href = r.url; return; } S.notice = r.message || 'Modification enregistrée.'; await refreshProfile(); render(); }
    catch (e) { alert(e.message); }
  }
  async function refreshProfile(waitFor) {
    if (!client) return;
    for (let i = 0; i < (waitFor ? 12 : 1); i++) {
      const { data } = await client.from('profiles').select('*').eq('id', S.user.id).maybeSingle();
      if (data) { S.profile = data; if (S.role === 'owner') S.wp = data; }
      if (!waitFor || (data && waitFor(data))) return;
      await new Promise((r) => setTimeout(r, 1500));
    }
  }
  // ---------- Photos de chantier (stockage privé) ----------
  const BUCKET = 'chantier-photos', MAX_PHOTOS = 60;
  function openPhotos(c) { S.photoCh = c.id; S.photos = []; S.photoUrls = {}; S.photosReady = false; go('photos'); loadPhotos(c.id); }
  async function loadPhotos(chId) {
    try {
      if (client) {
        const { data, error } = await client.from('photos').select('*').eq('chantier_id', chId).order('created_at', { ascending: false });
        if (error) throw error;
        S.photos = data || [];
        if (S.photos.length) {
          const { data: urls, error: e2 } = await client.storage.from(BUCKET).createSignedUrls(S.photos.map((p) => p.path), 3600);
          if (e2) throw e2;
          (urls || []).forEach((u) => { if (u.signedUrl) S.photoUrls[u.path] = u.signedUrl; });
        }
      } else { S.photos = (S.demoPhotos || []).filter((p) => p.chantier_id === chId); S.photos.forEach((p) => { S.photoUrls[p.path] = p.url; }); }
    } catch (e) { S.notice = 'Photos indisponibles : ' + e.message; }
    S.photosReady = true;
    if (S.view === 'photos' && S.photoCh === chId) render();
  }
  async function shrink(file) {
    const bmp = await createImageBitmap(file), k = Math.min(1, 1600 / Math.max(bmp.width, bmp.height));
    const cv = document.createElement('canvas'); cv.width = Math.round(bmp.width * k); cv.height = Math.round(bmp.height * k);
    cv.getContext('2d').drawImage(bmp, 0, 0, cv.width, cv.height);
    return new Promise((res, rej) => cv.toBlob((b) => (b ? res(b) : rej(new Error('Image illisible'))), 'image/jpeg', 0.82));
  }
  async function uploadPhotos(files, status) {
    if (!guardWrite()) return;
    const ch = S.photoCh; let done = 0, errors = 0;
    for (const f of files) {
      if (S.photos.length >= MAX_PHOTOS) { status.textContent = 'Limite de ' + MAX_PHOTOS + ' photos par chantier atteinte.'; break; }
      if (!/^image\//.test(f.type)) { errors++; continue; }
      status.textContent = 'Envoi ' + (done + errors + 1) + ' / ' + files.length + '…';
      try {
        const blob = await shrink(f), path = S.ws + '/' + ch + '/' + uid() + '.jpg';
        if (client) {
          const up = await client.storage.from(BUCKET).upload(path, blob, { contentType: 'image/jpeg' }); if (up.error) throw up.error;
          const { data, error } = await client.from('photos').insert({ owner_id: S.ws, chantier_id: ch, path }).select().single();
          if (error) { await client.storage.from(BUCKET).remove([path]); throw error; }
          S.photos.unshift(data);
          const { data: u } = await client.storage.from(BUCKET).createSignedUrl(path, 3600); if (u) S.photoUrls[path] = u.signedUrl;
        } else {
          const row = { id: uid(), chantier_id: ch, path, url: URL.createObjectURL(blob), created_at: new Date().toISOString() };
          (S.demoPhotos = S.demoPhotos || []).unshift(row); S.photos.unshift(row); S.photoUrls[path] = row.url;
        }
        done++;
      } catch (e) { errors++; status.textContent = 'Échec : ' + e.message; }
    }
    if (!errors) status.textContent = done + ' photo(s) ajoutée(s).';
    render();
  }
  async function removePhoto(p) {
    if (!guardWrite() || !confirm('Supprimer cette photo ?')) return;
    try {
      if (client) { const r = await client.storage.from(BUCKET).remove([p.path]); if (r.error) throw r.error; const { error } = await client.from('photos').delete().eq('id', p.id); if (error) throw error; }
      else S.demoPhotos = (S.demoPhotos || []).filter((x) => x.id !== p.id);
      S.photos = S.photos.filter((x) => x.id !== p.id); render();
    } catch (e) { alert('Suppression impossible : ' + e.message); }
  }
  function lightbox(url) {
    const dlg = $('dlg'), form = $('dlgForm'); form.replaceChildren(); form.onsubmit = null;
    form.append(el('img', { src: url, alt: 'Photo du chantier', class: 'ph-big' }), el('div', { class: 'd-actions' }, el('button', { type: 'button', class: 'btn btn--primary', text: 'Fermer', onclick: () => dlg.close() })));
    dlg.showModal();
  }
  function viewPhotos() {
    const c = byId(S.chantiers, S.photoCh);
    if (!c) return el('div', null, head('Photos'), empty('Chantier introuvable.', 'Retour aux chantiers', () => go('chantiers')));
    const status = el('small', { class: 'd-muted', role: 'status', text: 'Formats JPEG, PNG ou WebP. Les images sont réduites automatiquement.' });
    const input = el('input', { type: 'file', accept: 'image/jpeg,image/png,image/webp', multiple: true, id: 'phFiles', class: 'ph-input', 'aria-label': 'Ajouter des photos', onchange: (e) => { const fs = [...e.target.files]; e.target.value = ''; if (fs.length) uploadPhotos(fs, status); } });
    return el('div', null,
      el('div', { class: 'd-hello' }, el('div', null, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: '← Chantiers', onclick: () => go('chantiers') }), el('h1', { text: 'Photos · ' + c.title })),
        el('label', { class: 'btn btn--primary', for: 'phFiles', text: '+ Ajouter des photos' })), input,
      el('div', { class: 'd-card' }, status,
        !S.photosReady ? el('p', { class: 'd-muted', text: 'Chargement…' }) :
          S.photos.length ? el('div', { class: 'ph-grid' }, S.photos.map((p) => el('figure', { class: 'ph-item' },
            S.photoUrls[p.path] ? el('button', { type: 'button', class: 'ph-thumb', 'aria-label': 'Agrandir la photo du ' + fdate(p.created_at), onclick: () => lightbox(S.photoUrls[p.path]) }, el('img', { src: S.photoUrls[p.path], alt: 'Photo du ' + fdate(p.created_at), loading: 'lazy' })) : el('div', { class: 'ph-thumb ph-missing', text: 'Indisponible' }),
            el('figcaption', null, el('small', { text: fdate(p.created_at) }), el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Supprimer', onclick: () => removePhoto(p) }))))) :
            empty('Aucune photo pour ce chantier.', null)));
  }

  // ---------- Informations de l'entreprise (utilisées sur les devis) ----------
  function paintUser() {
    const p = S.profile;
    $('uname').textContent = p.full_name || 'Votre compte';
    $('ucompany').textContent = S.role === 'member' ? 'Équipe de ' + (S.wp.full_name || '') : p.company || p.trade || '';
    $('avatar').textContent = ((p.full_name || S.user.email || '?').trim()[0] || '?').toUpperCase();
  }
  function editCompany() {
    openForm({ title: 'Mes informations', submitLabel: 'Enregistrer', values: S.profile,
      fields: [{ name: 'full_name', label: 'Nom et prénom', required: true }, { name: 'company', label: 'Entreprise' }, { name: 'trade', label: 'Métier' }, { name: 'phone', label: 'Téléphone', type: 'tel' },
        { name: 'company_address', label: 'Adresse de l\'entreprise (sur les devis)' }, { name: 'siret', label: 'SIRET (sur les devis)' }, { name: 'tva_mention', label: 'Mention TVA (ex. : N° TVA FR12 345678901, ou « TVA non applicable, art. 293 B du CGI »)' }],
      onSubmit: async (v) => {
        if (client) { const { data, error } = await client.from('profiles').update(v).eq('id', S.user.id).select().single(); if (error) throw error; Object.assign(S.profile, data); } else Object.assign(S.profile, v);
        if (S.role === 'owner') S.wp = S.profile;
        paintUser();
      } });
  }

  function exportData() {
    const data = { exporte_le: new Date().toISOString(), profil: { nom: S.profile.full_name, entreprise: S.profile.company, metier: S.profile.trade, email: S.user.email, telephone: S.profile.phone },
      clients: S.clients, chantiers: S.chantiers, devis: S.devis, comptes_rendus: S.crs, photos: 'Les photos se téléchargent une par une depuis la fiche de chaque chantier.' };
    const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: 'batiflow-export.json' });
    document.body.append(a); a.click(); a.remove();
  }
  function deleteAccount() {
    openForm({ title: 'Supprimer mon compte', submitLabel: 'Supprimer définitivement',
      fields: [{ name: 'confirm', label: 'Tapez SUPPRIMER pour confirmer. Toutes vos données seront effacées, sans retour possible.', required: true }],
      onSubmit: async (v) => {
        if (v.confirm !== 'SUPPRIMER') throw new Error('Tapez exactement SUPPRIMER');
        if (!client) { location.href = 'index.html'; return; }
        if (S.profile.stripe_subscription_id) { try { await billing('cancel_now'); } catch { /* abonnement déjà arrêté ou paiement non activé */ } }
        if (S.role === 'owner') {
          const { data: ph } = await client.from('photos').select('path').eq('owner_id', S.user.id);
          const paths = (ph || []).map((x) => x.path);
          for (let i = 0; i < paths.length; i += 100) { const r = await client.storage.from(BUCKET).remove(paths.slice(i, i + 100)); if (r.error) throw r.error; }
        }
        const { error } = await client.rpc('delete_my_account'); if (error) throw error;
        await client.auth.signOut(); location.href = 'index.html';
      } });
  }
  function supportForm() {
    openForm({ title: 'Support prioritaire', submitLabel: 'Envoyer', fields: [{ name: 'message', label: 'Votre message', type: 'textarea', required: true }],
      onSubmit: async (v) => {
        if (S.demo) return;
        const { error } = await client.from('contact_messages').insert({ name: S.profile.full_name || S.user.email, email: S.user.email, message: v.message });
        if (error) throw error;
        S.notice = 'Message envoyé : il est traité en priorité.';
      } });
  }
  function viewAccount() {
    const p = S.profile, w = S.wp, own = S.role === 'owner';
    const planName = hasOffer(w) ? (w.plan === 'pro' ? 'Pro' : 'Essentiel') + (isTrialing(w) ? ' (essai gratuit)' : '') : w.plan === 'annule' ? 'Résilié' : 'Aucune offre';
    const row = (l, v) => el('li', null, el('span', { class: 'd-muted', text: l }), el('strong', { text: v || '—' }));
    const per = S.billingPeriod;
    const offer = (key) => {
      const o = PLANS[key], cur = w.plan === key && (w.billing || 'month') === per, same = w.plan === key;
      const label = cur ? 'Offre actuelle' : same ? 'Passer en ' + (per === 'year' ? 'annuel' : 'mensuel') : hasOffer(w) ? (key === 'pro' ? 'Passer au Pro' : 'Passer à l\'Essentiel') : w.plan === 'trial' ? 'Démarrer l\'essai gratuit ' + o.name : 'Choisir ' + o.name;
      const price = per === 'year' ? o.year : o.month;
      return el('article', { class: 'd-card d-offer' + (cur ? ' is-current' : '') }, el('h3', { text: o.name }),
        el('p', { class: 'd-price' }, el('b', { text: money(price) }), ' TTC / ' + (per === 'year' ? 'an' : 'mois')),
        el('small', { class: 'd-muted', text: per === 'year' ? 'soit ' + money(Math.round(o.year / 12)) + ' / mois, 2 mois offerts' : 'Sans engagement' }),
        el('button', { type: 'button', class: 'btn ' + (cur ? 'btn--ghost' : 'btn--primary') + ' btn--block', disabled: cur || !own, text: label,
          onclick: () => pay(p.stripe_subscription_id ? 'change' : 'checkout', { plan: key, billing: per }) }));
    };
    const sub = p.stripe_subscription_id && (w.plan === 'essentiel' || w.plan === 'pro');
    return el('div', null, head('Mon compte'),
      S.notice ? el('p', { class: 'd-banner d-banner--info', role: 'status', text: S.notice }) : null,
      el('div', { class: 'd-card' }, el('h2', { text: 'Informations' }), el('ul', { class: 'd-kv' },
        row('Nom', p.full_name), row('Entreprise', p.company), row('Métier', p.trade), row('Email', S.user.email), row('Téléphone', p.phone), row('Adresse', p.company_address), row('SIRET', p.siret), row('Mention TVA', p.tva_mention), row('Offre', planName + (own ? '' : ' (équipe)')),
        isTrialing(w) ? row('Essai gratuit jusqu\'au', fdate(w.trial_ends_at) + ' (premier débit à cette date)') : null,
        sub && p.current_period_end ? row(p.cancel_at_period_end ? 'Se termine le' : 'Prochain renouvellement', fdate(p.current_period_end)) : null),
        el('p', { class: 'd-muted', text: 'Votre adresse, votre SIRET et votre mention de TVA apparaissent sur vos devis PDF.' }),
        el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost', text: 'Modifier mes informations', onclick: editCompany }))),
      own ? el('div', { class: 'd-card' }, el('h2', { text: 'Abonnement' }),
        el('div', { class: 'billing', role: 'group', 'aria-label': 'Période de facturation' }, ['month', 'year'].map((k) => el('button', { type: 'button', class: 'billing__btn' + (per === k ? ' is-active' : ''), 'aria-pressed': String(per === k), text: k === 'month' ? 'Mensuel' : 'Annuel',
          onclick: () => { S.billingPeriod = k; render(); } }))),
        el('div', { class: 'd-offers' }, offer('essentiel'), offer('pro')),
        el('p', { class: 'd-muted', text: w.plan === 'trial' ? 'Essai gratuit de 7 jours : votre moyen de paiement est demandé maintenant, mais vous n\'êtes débité qu\'à la fin de l\'essai. Résiliez avant et vous ne payez rien. Paiement sécurisé par Stripe.' : 'Paiement sécurisé. Vous pouvez changer d\'offre ou résilier à tout moment, sans nous contacter.' }),
        sub ? el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost', text: 'Moyen de paiement et factures', onclick: () => pay('portal') }),
          p.cancel_at_period_end ? el('button', { type: 'button', class: 'btn btn--primary', text: 'Reprendre mon abonnement', onclick: () => pay('resume') })
            : el('button', { type: 'button', class: 'btn btn--ghost', text: isTrialing(w) ? 'Annuler avant le premier débit' : 'Résilier à la fin de la période', onclick: () => { if (confirm(isTrialing(w) ? 'Annuler votre abonnement ? Vous ne serez pas débité et gardez l\'accès jusqu\'à la fin de l\'essai.' : 'Résilier votre abonnement ? Il reste actif jusqu\'à la fin de la période déjà payée.')) pay('cancel'); } })) : null)
        : el('div', { class: 'd-card' }, el('h2', { text: 'Abonnement' }), el('p', { class: 'd-muted', text: 'L\'abonnement est géré par le responsable de l\'équipe.' })),
      hasPro() ? el('div', { class: 'd-card' }, el('h2', { text: 'Support prioritaire' }), el('p', { class: 'd-muted', text: 'Votre message est traité en priorité par notre équipe.' }),
        el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost', text: 'Écrire au support', onclick: supportForm }))) : null,
      el('div', { class: 'd-card' }, el('h2', { text: 'Vos données' }), el('p', { class: 'd-muted', text: 'Vos données vous appartiennent : exportez-les ou supprimez votre compte à tout moment.' }),
        el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost', text: 'Exporter mes données (JSON)', onclick: exportData }),
          el('button', { type: 'button', class: 'btn btn--ghost', text: 'Supprimer mon compte', onclick: deleteAccount }))));
  }

  async function remove(k, item, label) {
    if (!guardWrite()) return;
    openForm({ title: 'Supprimer ' + label + ' ?', submitLabel: 'Supprimer', fields: [], onSubmit: () => del(k, item.id) });
  }

  // ---------- Rendu général ----------
  const VIEWS = { dashboard: viewDashboard, chantiers: viewChantiers, devis: viewDevis, crs: viewCrs, clients: viewClients, planning: viewPlanning, stats: viewStats, team: viewTeam, account: viewAccount, photos: viewPhotos };
  function banner() {
    const b = $('banner'); b.replaceChildren();
    if (S.demo) b.append(el('p', { class: 'd-banner d-banner--info', text: 'Mode démonstration : données d\'exemple, rien n\'est enregistré.' }));
    else if (S.notice && S.view !== 'account') { b.append(el('p', { class: 'd-banner d-banner--info', role: 'status', text: S.notice })); S.notice = ''; }
    else if (needsOffer() && S.wp.plan === 'annule') b.append(el('p', { class: 'd-banner d-banner--warn' }, 'Votre abonnement est résilié : l\'espace est en lecture seule. ', el('a', { href: '#', text: 'Choisir une offre', onclick: (e) => { e.preventDefault(); go('account'); } })));
    else if (needsOffer()) b.append(el('p', { class: 'd-banner d-banner--info' }, 'Bienvenue ! Choisissez votre offre pour démarrer votre essai gratuit de 7 jours. Un moyen de paiement est demandé, mais aucun débit n\'a lieu avant la fin de l\'essai. ', el('a', { href: '#', text: 'Choisir mon offre', onclick: (e) => { e.preventDefault(); go('account'); } })));
    else if (!canWrite()) b.append(el('p', { class: 'd-banner d-banner--warn', text: 'L\'offre de votre équipe est inactive : l\'espace est en lecture seule.' }));
  }
  function render() {
    banner();
    $('view').replaceChildren(VIEWS[S.view]());
    document.querySelectorAll('#sideNav button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === (S.view === 'photos' ? 'chantiers' : S.view)));
    const w = S.wp, nm = w.plan === 'pro' ? 'Pro' : 'Essentiel', left = isTrialing(w) ? Math.max(0, trialLeft(w)) : 0;
    $('trial').textContent = S.demo ? 'Démonstration' : isTrialing(w) ? 'Essai gratuit : ' + left + ' jour' + (left > 1 ? 's' : '') + ' restant' + (left > 1 ? 's' : '') + ' · ' + nm : hasOffer(w) ? 'Offre ' + nm : w.plan === 'annule' ? 'Abonnement résilié' : 'Aucune offre';
    $('trial').classList.toggle('is-over', !S.demo && !canWrite());
  }

  // ---------- Équipe : chargement ----------
  async function loadTeam() {
    if (!client) return;
    const me = S.user.id;
    const [m, i] = await Promise.all([client.from('team_members').select('*'), client.from('team_invites').select('*').is('accepted_at', null)]);
    S.members = (m.data || []).filter((x) => x.owner_id === S.ws);
    S.invites = (i.data || []).filter((x) => x.owner_id === S.ws);
    const ids = [...new Set([S.ws, me, ...S.members.map((x) => x.member_id)])];
    const { data: prof } = await client.from('profiles').select('id,full_name,email').in('id', ids);
    S.people = ids.map((id) => (prof || []).find((p) => p.id === id) || { id, full_name: id === me ? S.profile.full_name : '', email: id === me ? S.user.email : '' });
  }

  async function start() {
    let user = { id: 'demo', email: 'demo@batiflow.test' }, profile = { id: 'demo', full_name: 'Thomas Lefèvre', company: 'Artisan Rénovation', trade: 'Peintre', plan: 'trial', trial_ends_at: new Date(Date.now() + 7 * DAY).toISOString(), is_admin: false };
    if (client) {
      const { data } = await client.auth.getSession();
      if (!data.session) { location.replace('login.html'); return; }
      user = data.session.user;
      const { data: prof } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
      profile = prof || { id: user.id, full_name: (user.user_metadata || {}).full_name, plan: 'trial', trial_ends_at: new Date(Date.now() + 7 * DAY).toISOString(), is_admin: false };
      try { await client.rpc('accept_team_invites'); } catch { /* sans invitation */ }
    }
    S.user = user; S.profile = profile; S.ws = user.id; S.wp = profile; S.role = 'owner';
    if (client) {
      // Membre d'une équipe Pro : on travaille dans l'espace du responsable.
      try {
        const { data: mem } = await client.from('team_members').select('owner_id').eq('member_id', user.id).maybeSingle();
        if (mem) {
          const { data: ownerProf } = await client.from('profiles').select('*').eq('id', mem.owner_id).maybeSingle();
          if (ownerProf && ownerProf.plan === 'pro') { S.ws = mem.owner_id; S.wp = ownerProf; S.role = 'member'; }
          else S.notice = 'L\'équipe de ' + ((ownerProf && ownerProf.full_name) || 'votre responsable') + ' n\'a plus l\'offre Pro : vous retrouvez votre espace personnel.';
        }
      } catch { S.notice = 'Votre équipe n\'a pas pu être chargée : vous êtes dans votre espace personnel.'; }
    } else {
      S.people = [{ id: 'demo', full_name: 'Thomas Lefèvre', email: 'demo@batiflow.test' }, { id: 'demo2', full_name: 'Sophie Bernard', email: 'sophie@example.com' }];
      S.members = [{ owner_id: 'demo', member_id: 'demo2' }];
    }
    paintUser();
    // Lien d'administration : créé uniquement pour un administrateur, absent du HTML des clients.
    if (profile.is_admin) $('sideNav').append(el('a', { href: 'admin.html', text: 'Administration' }));
    if (CFG.CONTACT_EMAIL) $('helpLink').href = 'mailto:' + CFG.CONTACT_EMAIL;
    try { await load(); } catch (e) { $('view').replaceChildren(el('p', { class: 'd-banner d-banner--warn', text: 'Chargement impossible : ' + e.message })); document.body.hidden = false; return; }
    const q = new URLSearchParams(location.search).get('paiement');
    if (q) {
      history.replaceState(null, '', location.pathname);
      if (q === 'ok') { S.view = 'account'; S.notice = 'Moyen de paiement enregistré, merci ! Votre offre est en cours d\'activation…'; document.body.hidden = false; render(); await refreshProfile((d) => d.plan === 'essentiel' || d.plan === 'pro'); S.notice = isTrialing() ? 'Votre essai gratuit de 7 jours est démarré. Aucun débit avant le ' + fdate(S.wp.trial_ends_at) + '.' : hasOffer() ? 'Votre abonnement est actif. Merci !' : 'Activation en cours : actualisez la page dans un instant.'; S.view = 'dashboard'; render(); return; }
      if (q === 'annule') { S.view = 'account'; S.notice = 'Paiement annulé : aucun montant n\'a été débité.'; }
    }
    try { await loadTeam(); } catch { /* l'équipe est facultative */ }
    if (needsOffer() && S.view === 'dashboard') S.view = 'account'; // un nouveau client choisit d'abord son offre
    document.body.hidden = false;
    render();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('#sideNav button'); if (!b) return;
    if (rec) rec.stop();
    S.view = b.dataset.view; render(); window.scrollTo(0, 0);
  });
  $('logout').addEventListener('click', async () => { if (client) await client.auth.signOut(); location.href = 'index.html'; });
  start().catch((e) => { document.body.hidden = false; $('view').replaceChildren(el('p', { class: 'd-banner d-banner--warn', text: 'Une erreur est survenue : ' + (e && e.message ? e.message : 'réessayez plus tard') + '. Actualisez la page.' })); });
})();
