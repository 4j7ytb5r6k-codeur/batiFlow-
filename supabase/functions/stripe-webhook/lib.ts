// Utilitaires Stripe (sans SDK : appels REST). Fichier identique dans billing/ et stripe-webhook/.
export type Plan = "essentiel" | "pro";
export type Billing = "month" | "year";

// Prix TTC en centimes. 2 mois offerts en annuel.
export const PRICES: Record<Plan, Record<Billing, number>> = {
  essentiel: { month: 3500, year: 35000 },
  pro: { month: 7000, year: 70000 },
};
export const PLAN_NAMES: Record<Plan, string> = { essentiel: "batiFlow Essentiel", pro: "batiFlow Pro" };

export const isPlan = (v: unknown): v is Plan => v === "essentiel" || v === "pro";
export const isBilling = (v: unknown): v is Billing => v === "month" || v === "year";

/** {a:{b:1},c:[{d:2}]} -> [["a[b]","1"],["c[0][d]","2"]] (format attendu par l'API Stripe). */
export function flatten(obj: unknown, prefix = ""): [string, string][] {
  const out: [string, string][] = [];
  if (obj === null || obj === undefined) return out;
  if (typeof obj === "object") {
    for (const [k, v] of Object.entries(obj as Record<string, unknown>)) {
      const key = prefix ? `${prefix}[${k}]` : k;
      if (v === null || v === undefined) continue;
      if (typeof v === "object") out.push(...flatten(v, key));
      else out.push([key, String(v)]);
    }
  }
  return out;
}

export async function stripeCall(secret: string, path: string, method: string, params?: unknown) {
  const body = params ? new URLSearchParams(flatten(params)) : undefined;
  const url = "https://api.stripe.com/v1" + path + (method === "GET" && body ? "?" + body.toString() : "");
  const res = await fetch(url, {
    method,
    headers: {
      Authorization: `Bearer ${secret}`,
      "Stripe-Version": "2024-06-20",
      ...(method !== "GET" && body ? { "Content-Type": "application/x-www-form-urlencoded" } : {}),
    },
    body: method === "GET" ? undefined : body,
  });
  const json = await res.json();
  if (!res.ok) {
    const err = new Error(json?.error?.message ?? "Erreur Stripe") as Error & { status?: number; code?: string };
    err.status = res.status;
    err.code = json?.error?.code;
    throw err;
  }
  return json;
}

/** Produit Stripe à identifiant fixe (batiflow_pro...), créé au premier usage. */
export async function ensureProduct(secret: string, plan: Plan): Promise<string> {
  const id = `batiflow_${plan}`;
  try {
    await stripeCall(secret, `/products/${id}`, "GET");
  } catch (e) {
    if ((e as { status?: number }).status !== 404) throw e;
    await stripeCall(secret, "/products", "POST", { id, name: PLAN_NAMES[plan], metadata: { bf_plan: plan } });
  }
  return id;
}

export function priceData(product: string, plan: Plan, billing: Billing) {
  return {
    currency: "eur",
    product,
    unit_amount: PRICES[plan][billing],
    recurring: { interval: billing },
    tax_behavior: "inclusive",
  };
}

/** Vérifie l'en-tête stripe-signature (HMAC SHA-256, tolérance 5 minutes). */
export async function verifySignature(raw: string, header: string | null, secret: string, nowSec = Math.floor(Date.now() / 1000)): Promise<boolean> {
  if (!header) return false;
  const parts = Object.fromEntries(header.split(",").map((p) => p.split("=") as [string, string]));
  const t = Number(parts["t"]);
  const sigs = header.split(",").filter((p) => p.startsWith("v1=")).map((p) => p.slice(3));
  if (!t || !sigs.length || Math.abs(nowSec - t) > 300) return false;
  const key = await crypto.subtle.importKey("raw", new TextEncoder().encode(secret), { name: "HMAC", hash: "SHA-256" }, false, ["sign"]);
  const mac = await crypto.subtle.sign("HMAC", key, new TextEncoder().encode(`${t}.${raw}`));
  const hex = [...new Uint8Array(mac)].map((b) => b.toString(16).padStart(2, "0")).join("");
  return sigs.some((s) => s.length === hex.length && timingSafeEqual(s, hex));
}
function timingSafeEqual(a: string, b: string) {
  let r = 0;
  for (let i = 0; i < a.length; i++) r |= a.charCodeAt(i) ^ b.charCodeAt(i);
  return r === 0;
}

/** Transforme un abonnement Stripe en mise à jour du profil. null = rien à changer. */
export function profileUpdateFromSubscription(sub: any): Record<string, unknown> | null {
  const status = String(sub?.status ?? "");
  const customer = typeof sub?.customer === "string" ? sub.customer : sub?.customer?.id;
  if (["canceled", "unpaid", "incomplete_expired"].includes(status)) {
    return { plan: "annule", subscription_status: status, stripe_subscription_id: null, cancel_at_period_end: false, current_period_end: null, stripe_customer_id: customer ?? null };
  }
  if (!["active", "trialing", "past_due"].includes(status)) return null; // incomplete : en attente du paiement
  const plan = sub?.metadata?.plan, billing = sub?.metadata?.billing;
  if (!isPlan(plan) || !isBilling(billing)) return null;
  const end = sub?.current_period_end ?? sub?.items?.data?.[0]?.current_period_end;
  const patch: Record<string, unknown> = {
    plan, billing, subscription_status: status, stripe_customer_id: customer ?? null, stripe_subscription_id: sub.id,
    cancel_at_period_end: !!sub.cancel_at_period_end,
    current_period_end: end ? new Date(end * 1000).toISOString() : null,
  };
  // Essai gratuit en cours : la date de fin d'essai vient de Stripe (carte déjà enregistrée, premier débit à cette date).
  if (status === "trialing" && sub.trial_end) patch.trial_ends_at = new Date(sub.trial_end * 1000).toISOString();
  return patch;
}
