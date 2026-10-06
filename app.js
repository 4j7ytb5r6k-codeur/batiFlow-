// Espace client batiFlow : clients, chantiers, devis (rappels de relance), comptes rendus (dictée), compte.
// Sans Supabase configuré, une démo en mémoire est affichée. Aucune donnée saisie n'est insérée via innerHTML.
(function () {
  'use strict';
  const client = window.bfClient;
  const CFG = window.BATIFLOW_CONFIG || {};
  const TABLE = { clients: 'clients', chantiers: 'chantiers', devis: 'devis', crs: 'comptes_rendus' };
  const STEPS = [3, 7, 14];
  const DAY = 864e5;
  const S = { user: null, profile: null, clients: [], chantiers: [], devis: [], crs: [], view: 'dashboard', demo: !client };

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
    const { data, error } = await client.from(TABLE[k]).insert(row).select().single();
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
    const ch1 = { id: uid(), client_id: c1.id, title: 'Rénovation salle de bain', address: 'Paris 11e', status: 'en_cours', progress: 70, created_at: ago(18) };
    const ch2 = { id: uid(), client_id: c2.id, title: 'Rénovation appartement', address: 'Boulogne', status: 'en_cours', progress: 45, created_at: ago(12) };
    S.chantiers = [ch2, ch1];
    S.devis = [
      { id: uid(), client_id: c2.id, chantier_id: ch2.id, title: 'Peinture complète', amount_ttc: 3600, status: 'envoye', sent_at: ago(9), relances_envoyees: 1, created_at: ago(9) },
      { id: uid(), client_id: c1.id, chantier_id: ch1.id, title: 'Carrelage salle de bain', amount_ttc: 8450, status: 'envoye', sent_at: ago(4), relances_envoyees: 0, created_at: ago(4) },
      { id: uid(), client_id: c1.id, chantier_id: ch1.id, title: 'Plomberie', amount_ttc: 2200, status: 'accepte', sent_at: ago(14), relances_envoyees: 0, created_at: ago(14) },
    ];
    S.crs = [{ id: uid(), chantier_id: ch1.id, content: 'Dépose de l\'ancien carrelage terminée. Début de la pose demain matin.', created_at: ago(1) }];
  }

  // ---------- Droits d'écriture (essai / offre) ----------
  const trialLeft = () => Math.ceil((new Date(S.profile.trial_ends_at) - Date.now()) / DAY);
  function canWrite() {
    const p = S.profile;
    if (S.demo || p.is_admin) return true;
    if (p.plan === 'essentiel' || p.plan === 'pro') return true;
    return p.plan === 'trial' && trialLeft() > 0;
  }
  function guardWrite() {
    if (canWrite()) return true;
    alert("Votre essai est terminé : l'espace est en lecture seule. Contactez-nous pour souscrire.");
    return false;
  }

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
    openForm({ title: c ? 'Modifier le chantier' : 'Nouveau chantier', values: c || { status: 'a_venir', progress: 0 }, onSubmit: (v) => (c ? patch('chantiers', c.id, v) : add('chantiers', v)),
      fields: [{ name: 'title', label: 'Intitulé', required: true }, { name: 'client_id', label: 'Client', type: 'select', options: clientOptions('Sans client') }, { name: 'address', label: 'Adresse du chantier' },
        { name: 'status', label: 'Statut', type: 'select', options: [['a_venir', 'À venir'], ['en_cours', 'En cours'], ['termine', 'Terminé']] },
        { name: 'progress', label: 'Avancement (%)', type: 'number', min: 0, max: 100, step: 5 }] });
  }
  function viewChantiers() {
    return el('div', null, head('Chantiers', '+ Nouveau chantier', () => editChantier()),
      S.chantiers.length ? el('div', { class: 'd-card' }, el('ul', { class: 'd-rows d-rows--wide' }, S.chantiers.map((c) => {
        const n = S.devis.filter((d) => d.chantier_id === c.id).length, r = S.crs.filter((d) => d.chantier_id === c.id).length;
        return el('li', null,
          el('div', null, el('strong', { text: c.title }), el('small', { text: [(byId(S.clients, c.client_id) || {}).name, c.address, n + ' devis', r + ' compte(s) rendu(s)'].filter(Boolean).join(' · ') })),
          el('div', { class: 'd-pc' }, progress(c.progress), el('small', { text: c.progress + ' %' })), tag(STATUS_CH[c.status]),
          el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Modifier', onclick: () => editChantier(c) }),
            el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Supprimer', onclick: () => remove('chantiers', c, 'ce chantier') })));
      }))) : empty('Aucun chantier.', 'Créer un chantier', () => editChantier()));
  }

  function editDevis(d) {
    if (!guardWrite()) return;
    openForm({ title: d ? 'Modifier le devis' : 'Nouveau devis', values: d || { status: 'brouillon' },
      onSubmit: (v) => {
        if (v.status === 'envoye' && !(d && d.sent_at)) v.sent_at = new Date().toISOString();
        if (v.status === 'brouillon') { v.sent_at = null; v.relances_envoyees = 0; }
        return d ? patch('devis', d.id, v) : add('devis', v);
      },
      fields: [{ name: 'title', label: 'Objet du devis', required: true }, { name: 'client_id', label: 'Client', type: 'select', options: clientOptions('Sans client') },
        { name: 'chantier_id', label: 'Chantier', type: 'select', options: chantierOptions('Aucun') }, { name: 'amount_ttc', label: 'Montant TTC (€)', type: 'number', min: 0, step: '0.01', required: true },
        { name: 'status', label: 'Statut', type: 'select', options: [['brouillon', 'Brouillon'], ['envoye', 'Envoyé au client'], ['accepte', 'Accepté'], ['refuse', 'Refusé']] }] });
  }
  async function setStatus(d, status) {
    if (!guardWrite()) return;
    const p = { status };
    if (status === 'envoye') { p.sent_at = new Date().toISOString(); p.relances_envoyees = 0; }
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
        acts.push(el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Modifier', onclick: () => editDevis(d) }), el('button', { type: 'button', class: 'btn btn--ghost btn--sm', text: 'Supprimer', onclick: () => remove('devis', d, 'ce devis') }));
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

  // ---------- Mon compte : export et suppression ----------
  function exportData() {
    const data = { exporte_le: new Date().toISOString(), profil: { nom: S.profile.full_name, entreprise: S.profile.company, metier: S.profile.trade, email: S.user.email, telephone: S.profile.phone },
      clients: S.clients, chantiers: S.chantiers, devis: S.devis, comptes_rendus: S.crs };
    const a = el('a', { href: URL.createObjectURL(new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' })), download: 'batiflow-export.json' });
    document.body.append(a); a.click(); a.remove();
  }
  function deleteAccount() {
    openForm({ title: 'Supprimer mon compte', submitLabel: 'Supprimer définitivement',
      fields: [{ name: 'confirm', label: 'Tapez SUPPRIMER pour confirmer. Toutes vos données seront effacées, sans retour possible.', required: true }],
      onSubmit: async (v) => {
        if (v.confirm !== 'SUPPRIMER') throw new Error('Tapez exactement SUPPRIMER');
        if (!client) { location.href = 'index.html'; return; }
        const { error } = await client.rpc('delete_my_account'); if (error) throw error;
        await client.auth.signOut(); location.href = 'index.html';
      } });
  }
  function viewAccount() {
    const p = S.profile, plan = { trial: 'Essai gratuit', essentiel: 'Essentiel', pro: 'Pro', annule: 'Résilié' }[p.plan] || p.plan;
    const row = (l, v) => el('li', null, el('span', { class: 'd-muted', text: l }), el('strong', { text: v || '—' }));
    return el('div', null, head('Mon compte'),
      el('div', { class: 'd-card' }, el('h2', { text: 'Informations' }), el('ul', { class: 'd-kv' },
        row('Nom', p.full_name), row('Entreprise', p.company), row('Métier', p.trade), row('Email', S.user.email), row('Téléphone', p.phone), row('Offre', plan),
        p.plan === 'trial' ? row('Fin de l\'essai', fdate(p.trial_ends_at)) : null)),
      el('div', { class: 'd-card' }, el('h2', { text: 'Vos données' }), el('p', { class: 'd-muted', text: 'Vos données vous appartiennent : exportez-les ou supprimez votre compte à tout moment.' }),
        el('div', { class: 'd-actions d-actions--inline' }, el('button', { type: 'button', class: 'btn btn--ghost', text: 'Exporter mes données (JSON)', onclick: exportData }),
          el('button', { type: 'button', class: 'btn btn--ghost', text: 'Supprimer mon compte', onclick: deleteAccount }))),
      el('div', { class: 'd-card' }, el('h2', { text: 'Abonnement' }), el('p', { class: 'd-muted', text: 'Pour souscrire ou changer d\'offre, contactez-nous.' }),
        el('a', { class: 'btn btn--primary', href: 'mailto:' + (CFG.CONTACT_EMAIL || '') + '?subject=' + encodeURIComponent('Abonnement batiFlow'), text: 'Écrire à ' + (CFG.CONTACT_EMAIL || 'batiFlow') })));
  }

  async function remove(k, item, label) {
    if (!guardWrite()) return;
    openForm({ title: 'Supprimer ' + label + ' ?', submitLabel: 'Supprimer', fields: [], onSubmit: () => del(k, item.id) });
  }

  // ---------- Rendu général ----------
  const VIEWS = { dashboard: viewDashboard, chantiers: viewChantiers, devis: viewDevis, crs: viewCrs, clients: viewClients, account: viewAccount };
  function banner() {
    const b = $('banner'); b.replaceChildren();
    if (S.demo) b.append(el('p', { class: 'd-banner d-banner--info', text: 'Mode démonstration : données d\'exemple, rien n\'est enregistré.' }));
    else if (!canWrite()) b.append(el('p', { class: 'd-banner d-banner--warn' }, 'Votre essai est terminé : l\'espace est en lecture seule. ', el('a', { href: 'mailto:' + (CFG.CONTACT_EMAIL || '') + '?subject=' + encodeURIComponent('Abonnement batiFlow'), text: 'Souscrire une offre' })));
  }
  function render() {
    banner();
    $('view').replaceChildren(VIEWS[S.view]());
    document.querySelectorAll('#sideNav button').forEach((b) => b.classList.toggle('is-active', b.dataset.view === S.view));
    const p = S.profile, left = S.demo || p.plan !== 'trial' ? null : trialLeft();
    $('trial').textContent = S.demo ? 'Démonstration' : p.plan === 'essentiel' ? 'Offre Essentiel' : p.plan === 'pro' ? 'Offre Pro' : p.plan === 'annule' ? 'Abonnement résilié' : left > 0 ? 'Essai gratuit : ' + left + ' jour' + (left > 1 ? 's' : '') + ' restant' + (left > 1 ? 's' : '') : 'Essai terminé';
    $('trial').classList.toggle('is-over', !S.demo && !canWrite());
  }

  async function start() {
    let user = { email: 'demo@batiflow.test' }, profile = { full_name: 'Thomas Lefèvre', company: 'Artisan Rénovation', trade: 'Peintre', plan: 'trial', trial_ends_at: new Date(Date.now() + 7 * DAY).toISOString(), is_admin: false };
    if (client) {
      const { data } = await client.auth.getSession();
      if (!data.session) { location.replace('login.html'); return; }
      user = data.session.user;
      const { data: prof } = await client.from('profiles').select('*').eq('id', user.id).maybeSingle();
      profile = prof || { full_name: (user.user_metadata || {}).full_name, plan: 'trial', trial_ends_at: new Date(Date.now() + 7 * DAY).toISOString(), is_admin: false };
    }
    S.user = user; S.profile = profile;
    $('uname').textContent = profile.full_name || 'Votre compte';
    $('ucompany').textContent = profile.company || profile.trade || '';
    $('avatar').textContent = ((profile.full_name || user.email || '?').trim()[0] || '?').toUpperCase();
    $('adminLink').hidden = !profile.is_admin;
    if (CFG.CONTACT_EMAIL) $('helpLink').href = 'mailto:' + CFG.CONTACT_EMAIL;
    try { await load(); } catch (e) { $('view').replaceChildren(el('p', { class: 'd-banner d-banner--warn', text: 'Chargement impossible : ' + e.message })); document.body.hidden = false; return; }
    document.body.hidden = false;
    render();
  }

  document.addEventListener('click', (e) => {
    const b = e.target.closest('#sideNav button'); if (!b) return;
    if (rec) rec.stop();
    S.view = b.dataset.view; render(); window.scrollTo(0, 0);
  });
  $('logout').addEventListener('click', async () => { if (client) await client.auth.signOut(); location.href = 'index.html'; });
  start();
})();
