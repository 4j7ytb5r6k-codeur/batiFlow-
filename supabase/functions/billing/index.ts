// Fonction « billing » : souscription, changement d'offre, résiliation, portail de paiement.
// Secrets à définir dans Supabase (Edge Functions > Secrets) : STRIPE_SECRET_KEY, SITE_URL (ex. https://batiflow.fr, plusieurs séparés par des virgules).
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { Billing, Plan, ensureProduct, isBilling, isPlan, priceData, stripeCall } from "./lib.ts";

const allowed = () => (Deno.env.get("SITE_URL") ?? "").split(",").map((s) => s.trim().replace(/\/$/, "")).filter(Boolean);

function cors(origin: string | null) {
  const ok = origin && allowed().includes(origin);
  return {
    "Access-Control-Allow-Origin": ok ? origin! : "null",
    "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
    "Access-Control-Allow-Methods": "POST, OPTIONS",
    Vary: "Origin",
  };
}
const json = (b: unknown, status: number, origin: string | null) =>
  new Response(JSON.stringify(b), { status, headers: { ...cors(origin), "Content-Type": "application/json" } });

Deno.serve(async (req) => {
  const origin = req.headers.get("origin");
  if (req.method === "OPTIONS") return new Response("ok", { headers: cors(origin) });
  if (req.method !== "POST") return json({ error: "Méthode non autorisée" }, 405, origin);

  const secret = Deno.env.get("STRIPE_SECRET_KEY");
  if (!secret || !allowed().length) return json({ error: "not_configured" }, 503, origin);

  // Utilisateur connecté (JWT vérifié par Supabase)
  const url = Deno.env.get("SUPABASE_URL")!;
  const authHeader = req.headers.get("Authorization") ?? "";
  const asUser = createClient(url, Deno.env.get("SUPABASE_ANON_KEY")!, { global: { headers: { Authorization: authHeader } } });
  const { data: u } = await asUser.auth.getUser();
  if (!u?.user) return json({ error: "Connexion requise" }, 401, origin);
  const user = u.user;
  const admin = createClient(url, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  let body: any;
  try { body = await req.json(); } catch { return json({ error: "Requête invalide" }, 400, origin); }
  const action = String(body.action ?? "");

  // Adresse de retour : uniquement un site autorisé
  let ret: URL;
  try { ret = new URL(String(body.return_url)); } catch { return json({ error: "Adresse de retour invalide" }, 400, origin); }
  if (!allowed().includes(ret.origin)) return json({ error: "Adresse de retour non autorisée" }, 400, origin);
  const base = ret.origin + ret.pathname;

  const { data: profile } = await admin.from("profiles").select("*").eq("id", user.id).maybeSingle();
  if (!profile) return json({ error: "Profil introuvable" }, 404, origin);
  const save = (patch: Record<string, unknown>) => admin.from("profiles").update(patch).eq("id", user.id);

  try {
    // Client Stripe (créé une fois)
    async function customerId(): Promise<string> {
      if (profile.stripe_customer_id) return profile.stripe_customer_id;
      const c = await stripeCall(secret!, "/customers", "POST", { email: user.email, name: profile.full_name ?? undefined, metadata: { user_id: user.id } });
      await save({ stripe_customer_id: c.id });
      return c.id;
    }

    if (action === "checkout") {
      const plan = body.plan, billing = body.billing;
      if (!isPlan(plan) || !isBilling(billing)) return json({ error: "Offre invalide" }, 400, origin);
      if (profile.stripe_subscription_id) return json({ error: "Un abonnement existe déjà : utilisez le changement d'offre." }, 409, origin);
      const product = await ensureProduct(secret, plan as Plan);
      const sub: Record<string, unknown> = { metadata: { user_id: user.id, plan, billing } };
      // Premier abonnement : 7 jours d'essai gratuit, carte obligatoire dès le départ, premier débit à la fin de l'essai.
      // Pas de nouvel essai pour un compte qui a déjà eu un abonnement (offre résiliée).
      const firstTime = profile.plan === "trial" && !profile.stripe_subscription_id;
      if (firstTime) { sub.trial_period_days = 7; sub.trial_settings = { end_behavior: { missing_payment_method: "cancel" } }; }
      const s = await stripeCall(secret, "/checkout/sessions", "POST", {
        mode: "subscription", customer: await customerId(), client_reference_id: user.id, locale: "fr", allow_promotion_codes: true,
        payment_method_collection: "always",
        line_items: [{ quantity: 1, price_data: priceData(product, plan as Plan, billing as Billing) }],
        subscription_data: sub, success_url: `${base}?paiement=ok`, cancel_url: `${base}?paiement=annule`,
      });
      return json({ url: s.url }, 200, origin);
    }

    if (["change", "cancel", "resume", "cancel_now"].includes(action) && !profile.stripe_subscription_id) {
      return json({ error: "Aucun abonnement en cours." }, 409, origin);
    }

    if (action === "change") {
      const plan = body.plan, billing = body.billing;
      if (!isPlan(plan) || !isBilling(billing)) return json({ error: "Offre invalide" }, 400, origin);
      const sub = await stripeCall(secret, `/subscriptions/${profile.stripe_subscription_id}`, "GET");
      const item = sub.items.data[0].id;
      const product = await ensureProduct(secret, plan as Plan);
      const up = await stripeCall(secret, `/subscriptions/${sub.id}`, "POST", {
        items: [{ id: item, price_data: priceData(product, plan as Plan, billing as Billing) }],
        proration_behavior: "create_prorations", payment_behavior: "error_if_incomplete", cancel_at_period_end: false,
        metadata: { user_id: user.id, plan, billing },
      });
      const end = up.current_period_end ?? up.items?.data?.[0]?.current_period_end;
      await save({ plan, billing, cancel_at_period_end: false, current_period_end: end ? new Date(end * 1000).toISOString() : null });
      return json({ message: "Votre offre a été modifiée. Le prorata est calculé automatiquement sur votre prochaine facture." }, 200, origin);
    }

    if (action === "cancel" || action === "resume") {
      const flag = action === "cancel";
      await stripeCall(secret, `/subscriptions/${profile.stripe_subscription_id}`, "POST", { cancel_at_period_end: flag });
      await save({ cancel_at_period_end: flag });
      return json({ message: flag ? "Résiliation enregistrée : votre abonnement reste actif jusqu'à la fin de la période payée." : "Votre abonnement est reconduit." }, 200, origin);
    }

    if (action === "cancel_now") {
      await stripeCall(secret, `/subscriptions/${profile.stripe_subscription_id}`, "DELETE");
      return json({ message: "Abonnement arrêté." }, 200, origin);
    }

    if (action === "portal") {
      if (!profile.stripe_customer_id) return json({ error: "Aucun moyen de paiement enregistré." }, 409, origin);
      const p = await stripeCall(secret, "/billing_portal/sessions", "POST", { customer: profile.stripe_customer_id, return_url: base });
      return json({ url: p.url }, 200, origin);
    }

    return json({ error: "Action inconnue" }, 400, origin);
  } catch (e) {
    const err = e as Error & { code?: string };
    console.error("billing", action, err.code, err.message);
    return json({ error: err.code === "card_declined" ? "Paiement refusé par votre banque." : "Le paiement n'a pas abouti : " + err.message }, 502, origin);
  }
});
