// Calcul des devis (HT / TVA par taux / TTC) et génération du PDF. Chargé avant app.js. Aucune donnée n'est envoyée à un serveur.
(function () {
  'use strict';
  const round2 = (n) => Math.round((Number(n) + Number.EPSILON) * 100) / 100;
  const num = (v) => { const n = Number(String(v).replace(',', '.')); return Number.isFinite(n) ? n : 0; };

  /** lignes : [{desc, qty, unit_ht, tva}] -> totaux par taux de TVA. */
  function calc(lignes) {
    const byRate = new Map();
    let ht = 0;
    const rows = (lignes || []).map((l) => {
      const total = round2(num(l.qty) * num(l.unit_ht));
      const rate = num(l.tva);
      byRate.set(rate, round2((byRate.get(rate) || 0) + total));
      ht = round2(ht + total);
      return { ...l, total_ht: total, tva: rate };
    });
    const taxes = [...byRate.entries()].sort((a, b) => a[0] - b[0]).map(([rate, base]) => ({ rate, base, amount: round2(base * rate / 100) }));
    const tva = round2(taxes.reduce((s, t) => s + t.amount, 0));
    return { rows, ht, taxes, tva, ttc: round2(ht + tva) };
  }

  // Les polices PDF standard ne gèrent pas l'espace fine insécable de Intl : on formate à la main.
  function money(n) {
    const v = round2(n), neg = v < 0, [i, d] = Math.abs(v).toFixed(2).split('.');
    return (neg ? '-' : '') + i.replace(/\B(?=(\d{3})+(?!\d))/g, ' ') + ',' + d + ' €';
  }
  const rate = (r) => String(r).replace('.', ',') + ' %';
  const fdate = (d) => new Date(d).toLocaleDateString('fr-FR');

  /** data : { reference, date, validity_days, title, notes, lignes, issuer:{...}, client:{...}, chantier:{...} } */
  function pdf(data) {
    const jsPDF = (window.jspdf && window.jspdf.jsPDF) || null;
    if (!jsPDF) throw new Error('Le module PDF n\'est pas chargé');
    const doc = new jsPDF({ unit: 'mm', format: 'a4' });
    const W = 210, M = 18, R = W - M, H = 297;
    const t = calc(data.lignes);
    const iss = data.issuer || {}, cl = data.client || {};
    const date = data.date ? new Date(data.date) : new Date();
    const until = new Date(date.getTime() + (data.validity_days || 30) * 864e5);
    const blue = [37, 99, 235], navy = [15, 29, 54], grey = [91, 103, 133];
    let y = M;

    const text = (s, x, yy, o = {}) => { doc.setFont('helvetica', o.bold ? 'bold' : 'normal'); doc.setFontSize(o.size || 10); doc.setTextColor(...(o.color || navy)); doc.text(String(s), x, yy, o.align ? { align: o.align } : undefined); };
    const lines = (s, w) => doc.splitTextToSize(String(s || ''), w);
    const footer = () => {
      const n = doc.getNumberOfPages();
      for (let p = 1; p <= n; p++) { doc.setPage(p); text('Devis ' + (data.reference || '') + ' - ' + (iss.company || iss.name || ''), M, H - 9, { size: 8, color: grey }); text('Page ' + p + '/' + n, R, H - 9, { size: 8, color: grey, align: 'right' }); }
    };
    const ensure = (h) => { if (y + h > H - 20) { doc.addPage(); y = M; head(); } };

    // En-tête : émetteur à gauche, titre du devis à droite
    text(iss.company || iss.name || 'Entreprise', M, y + 4, { bold: true, size: 15, color: blue });
    let ly = y + 10;
    [iss.name && iss.company ? iss.name : '', iss.address, iss.siret ? 'SIRET : ' + iss.siret : '', iss.tva, iss.phone, iss.email].filter(Boolean).forEach((s) => { lines(s, 95).forEach((l) => { text(l, M, ly, { size: 9, color: grey }); ly += 4.4; }); });
    text('DEVIS', R, y + 5, { bold: true, size: 22, align: 'right' });
    text('N° ' + (data.reference || ''), R, y + 12, { bold: true, size: 11, align: 'right' });
    text('Date : ' + fdate(date), R, y + 18, { size: 9, color: grey, align: 'right' });
    text('Valable jusqu\'au ' + fdate(until), R, y + 23, { size: 9, color: grey, align: 'right' });
    y = Math.max(ly, y + 28) + 6;

    // Client
    doc.setDrawColor(228, 233, 242); doc.setFillColor(245, 247, 251); doc.roundedRect(M, y, 85, 30, 2, 2, 'F');
    text('CLIENT', M + 4, y + 6, { bold: true, size: 8, color: grey });
    let cy = y + 12; [cl.name, cl.address, cl.email, cl.phone].filter(Boolean).forEach((s, i) => { lines(s, 77).slice(0, 2).forEach((l) => { text(l, M + 4, cy, { bold: i === 0, size: 9.5 }); cy += 4.6; }); });
    if (data.chantier && (data.chantier.title || data.chantier.address)) {
      text('CHANTIER', 110, y + 6, { bold: true, size: 8, color: grey });
      let hy = y + 12; [data.chantier.title, data.chantier.address].filter(Boolean).forEach((s) => lines(s, 82).slice(0, 3).forEach((l) => { text(l, 110, hy, { size: 9.5 }); hy += 4.6; }));
    }
    y += 38;
    if (data.title) { text('Objet : ' + data.title, M, y, { bold: true, size: 11 }); y += 8; }

    // Tableau
    const cols = { desc: M + 2, qty: 118, pu: 140, tva: 152, tot: R - 2 };
    function head() {
      doc.setFillColor(...navy); doc.rect(M, y, R - M, 8, 'F');
      text('Désignation', cols.desc, y + 5.4, { bold: true, size: 9, color: [255, 255, 255] });
      text('Qté', cols.qty, y + 5.4, { bold: true, size: 9, color: [255, 255, 255], align: 'right' });
      text('P.U. HT', cols.pu + 8, y + 5.4, { bold: true, size: 9, color: [255, 255, 255], align: 'right' });
      text('TVA', cols.tva + 8, y + 5.4, { bold: true, size: 9, color: [255, 255, 255], align: 'right' });
      text('Total HT', cols.tot, y + 5.4, { bold: true, size: 9, color: [255, 255, 255], align: 'right' });
      y += 8;
    }
    head();
    t.rows.forEach((r, i) => {
      const d = lines(r.desc, 90), h = Math.max(7, d.length * 4.6 + 3);
      ensure(h);
      if (i % 2) { doc.setFillColor(248, 250, 253); doc.rect(M, y, R - M, h, 'F'); }
      d.forEach((l, k) => text(l, cols.desc, y + 5 + k * 4.6, { size: 9.5 }));
      const qty = String(num(r.qty)).replace('.', ',');
      text(qty, cols.qty, y + 5, { size: 9.5, align: 'right' }); text(money(num(r.unit_ht)), cols.pu + 8, y + 5, { size: 9.5, align: 'right' });
      text(rate(r.tva), cols.tva + 8, y + 5, { size: 9.5, align: 'right' }); text(money(r.total_ht), cols.tot, y + 5, { size: 9.5, align: 'right', bold: true });
      y += h;
    });
    doc.setDrawColor(228, 233, 242); doc.line(M, y, R, y); y += 6;

    // Totaux
    ensure(14 + t.taxes.length * 6 + 16);
    const tx = 120;
    text('Total HT', tx, y, { size: 10 }); text(money(t.ht), R - 2, y, { size: 10, align: 'right' }); y += 6;
    t.taxes.forEach((x) => { text('TVA ' + rate(x.rate) + ' (base ' + money(x.base) + ')', tx, y, { size: 9, color: grey }); text(money(x.amount), R - 2, y, { size: 9.5, align: 'right' }); y += 6; });
    doc.setFillColor(...blue); doc.roundedRect(tx - 4, y - 2, R - tx + 6, 10, 2, 2, 'F');
    text('TOTAL TTC', tx, y + 4.8, { bold: true, size: 11, color: [255, 255, 255] }); text(money(t.ttc), R - 2, y + 4.8, { bold: true, size: 12, color: [255, 255, 255], align: 'right' });
    y += 18;

    if (data.notes) { ensure(8 + lines(data.notes, R - M).length * 4.6); text('Conditions et remarques', M, y, { bold: true, size: 9.5 }); y += 5; lines(data.notes, R - M).forEach((l) => { ensure(5); text(l, M, y, { size: 9 }); y += 4.6; }); y += 4; }
    if (iss.tva_note) { ensure(8); lines(iss.tva_note, R - M).forEach((l) => { text(l, M, y, { size: 9, color: grey }); y += 4.4; }); y += 3; }

    // Signature
    ensure(34);
    text('Devis valable ' + (data.validity_days || 30) + ' jours à compter de sa date d\'émission.', M, y, { size: 9, color: grey }); y += 7;
    doc.setDrawColor(...grey); doc.roundedRect(M, y, R - M, 24, 2, 2);
    text('Bon pour accord, date et signature du client', M + 4, y + 6, { size: 9, color: grey });
    footer();
    return doc;
  }

  window.BFDevis = { calc, money, pdf, num, round2 };
})();
