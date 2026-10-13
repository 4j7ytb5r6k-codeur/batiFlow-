// Paiement par carte via Monetico (Crédit Mutuel / CIC), avec activation automatique de l'offre.
//
// 1. « checkout » (appelé par l'espace client, utilisateur connecté) : crée le paiement en attente et renvoie le
//    formulaire signé à envoyer à la page de paiement sécurisée de la banque.
// 2. « Interface retour » (appelée par la banque, serveur à serveur) : vérifie le sceau, puis active ou prolonge
//    l'offre du client sans intervention. Réponse attendue par la banque : « version=2 / cdr=0 » (sceau valide).
//
// Secrets Supabase (Edge Functions > Secrets) fournis par le Crédit Mutuel à la signature du contrat :
//   MONETICO_TPE     numéro de TPE (7 caractères)
//   MONETICO_KEY     clé de sécurité (40 caractères)
//   MONETICO_SOCIETE code société
//   MONETICO_MODE    « test » (par défaut) ou « production »
//   SITE_URL         adresse du site, ex. https://batiflow.fr
import { createClient } from 'npm:@supabase/supabase-js@2';

const PRICES: Record<string, { month: number; year: number }> = { essentiel: { month: 35, year: 350 }, pro: { month: 70, year: 700 } };
const env = (k: string) => (Deno.env.get(k) || '').trim();
const TEST = env('MONETICO_MODE') !== 'production';
const PAY_URL = 'https://p.monetico-services.com/' + (TEST ? 'test/' : '') + 'paiement.cgi';
const admin = createClient(env('SUPABASE_URL'), env('SUPABASE_SERVICE_ROLE_KEY'), { auth: { persistSession: false } });

const cors = { 'Access-Control-Allow-Origin': '*', 'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type', 'Access-Control-Allow-Methods': 'POST, OPTIONS' };
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } });

// Clé opérationnelle Monetico : conversion de la clé de 40 caractères (règle des kits officiels pour les 2 derniers caractères).
function usableKey(key: string): Uint8Array {
  let hex = key.slice(0, 38);
  const fin = key.slice(38, 40) + '00';
  const c = fin.charCodeAt(0);
  if (c > 70 && c < 97) hex += String.fromCharCode(c - 23) + fin[1];
  else if (fin[1] === 'M') hex += fin[0] + '0';
  else hex += fin.slice(0, 2);
  return new Uint8Array(hex.match(/../g)!.map((h) => parseInt(h, 16)));
}
// Sceau : champs triés par nom, « nom=valeur » séparés par « * », HMAC-SHA1, hexadécimal majuscule.
async function seal(fields: Record<string, string>): Promise<string> {
  const data = Object.keys(fields).filter((k) => k !== 'MAC').sort().map((k) => k + '=' + fields[k]).join('*');
  const k = await crypto.subtle.importKey('raw', usableKey(env('MONETICO_KEY')), { name: 'HMAC', hash: 'SHA-1' }, false, ['sign']);
  const sig = new Uint8Array(await crypto.subtle.sign('HMAC', k, new TextEncoder().encode(data)));
  return Array.from(sig, (b) => b.toString(16).padStart(2, '0')).join('').toUpperCase();
}
function sameMac(a: string, b: string) {
  a = (a || '').toUpperCase(); if (a.length !== b.length) return false;
  let d = 0; for (let i = 0; i < a.length; i++) d |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return d === 0;
}
function parisDate(d = new Date()) {
  const p = Object.fromEntries(new Intl.DateTimeFormat('fr-FR', { timeZone: 'Europe/Paris', year: 'numeric', month: '2-digit', day: '2-digit', hour: '2-digit', minute: '2-digit', second: '2-digit', hourCycle: 'h23' })
    .formatToParts(d).map((x) => [x.type, x.value]));
  return `${p.day}/${p.month}/${p.year}:${p.hour}:${p.minute}:${p.second}`;
}
const b64 = (s: string) => btoa(String.fromCharCode(...new TextEncoder().encode(s)));
const clean = (v: unknown, max: number) => String(v ?? '').replace(/[\u0000-\u001f]/g, ' ').trim().slice(0, max);
const configured = () => !!(env('MONETICO_TPE') && env('MONETICO_KEY').length === 40 && env('MONETICO_SOCIETE') && env('SITE_URL'));

async function checkout(req: Request) {
  if (!configured()) return json({ error: 'not_configured' }, 503);
  const token = (req.headers.get('Authorization') || '').replace(/^Bearer\s+/i, '');
  const { data: u } = await admin.auth.getUser(token);
  if (!u?.user) return json({ error: 'Connexion requise' }, 401);
  const body = await req.json().catch(() => ({}));
  const plan = body.plan, billing = body.billing;
  if (!PRICES[plan] || !['month', 'year'].includes(billing)) return json({ error: 'Offre invalide' }, 400);
  if (await admin.from('team_members').select('owner_id').eq('member_id', u.user.id).maybeSingle().then((r) => r.data))
    return json({ error: 'L\'abonnement est géré par le responsable de l\'équipe.' }, 403);
  const a = body.address || {};
  const line1 = clean(a.line1, 50), postalCode = clean(a.postalCode, 10), city = clean(a.city, 50);
  if (!line1 || !/^\d{5}$/.test(postalCode) || !city) return json({ error: 'Adresse de facturation incomplète' }, 400);
  const { data: prof } = await admin.from('profiles').select('full_name, company').eq('id', u.user.id).maybeSingle();

  const amount = PRICES[plan][billing as 'month' | 'year'];
  const reference = 'BF' + Array.from(crypto.getRandomValues(new Uint8Array(10)), (x) => 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'[x % 32]).join('');
  const { error } = await admin.from('payments').insert({ reference, owner_id: u.user.id, email: u.user.email, plan, billing, amount });
  if (error) return json({ error: 'Paiement impossible, réessayez.' }, 500);

  const site = env('SITE_URL').split(',')[0].trim().replace(/\/$/, '');
  const name = clean(prof?.full_name || prof?.company || u.user.email, 45);
  const fields: Record<string, string> = {
    TPE: env('MONETICO_TPE'), societe: env('MONETICO_SOCIETE'), version: '3.0', lgue: 'FR',
    date: parisDate(), montant: amount.toFixed(2) + 'EUR', reference, mail: u.user.email || '',
    'texte-libre': `batiFlow ${plan === 'pro' ? 'Pro' : 'Essentiel'} ${billing === 'year' ? 'annuel' : 'mensuel'}`,
    url_retour_ok: site + '/app.html?paiement=ok', url_retour_err: site + '/app.html?paiement=annule',
    contexte_commande: b64(JSON.stringify({ billing: { name, addressLine1: line1, city, postalCode, country: 'FR', email: u.user.email } })),
  };
  fields.MAC = await seal(fields);
  return json({ url: PAY_URL, fields });
}

async function bankReturn(req: Request) {
  const text = await req.text();
  const f: Record<string, string> = {};
  new URLSearchParams(text).forEach((v, k) => { f[k] = v; });
  const ack = (ok: boolean) => new Response(`version=2\ncdr=${ok ? 0 : 1}\n`, { headers: { 'Content-Type': 'text/plain' } });
  if (!configured() || !f.MAC || f.TPE !== env('MONETICO_TPE')) return ack(false);
  if (!sameMac(f.MAC, await seal(f))) return ack(false);

  const code = f['code-retour'] || '';
  const paid = code === 'paiement' || (TEST && code === 'payetest');
  if (paid) {
    // Le montant payé doit correspondre au paiement attendu
    const { data: pay } = await admin.from('payments').select('amount').eq('reference', f.reference).maybeSingle();
    const m = /^([0-9]+(?:\.[0-9]{1,2})?)EUR$/.exec(f.montant || '');
    if (!pay || !m || Math.abs(Number(m[1]) - Number(pay.amount)) > 0.001) { console.error('Montant incoherent', f.reference, f.montant); return ack(true); }
  }
  if (paid || code === 'Annulation') {
    const { data, error } = await admin.rpc('apply_payment', { ref: f.reference, notif: (f.date || '') + '|' + code, ok: paid });
    if (error) { console.error('apply_payment', error.message); return new Response('erreur', { status: 500 }); } // la banque réessaiera
    console.log('Paiement', f.reference, code, data);
  }
  return ack(true);
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors });
  if (req.method !== 'POST') return new Response('Méthode non autorisée', { status: 405 });
  try {
    const type = req.headers.get('content-type') || '';
    return type.includes('application/json') ? await checkout(req) : await bankReturn(req);
  } catch (e) {
    console.error(e);
    return json({ error: 'Erreur serveur' }, 500);
  }
});
