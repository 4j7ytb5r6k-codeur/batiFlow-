// Fonction « stripe-webhook » : active ou arrête l'offre d'après les événements Stripe.
// Secrets : STRIPE_SECRET_KEY, STRIPE_WEBHOOK_SECRET (whsec_...). Déployée SANS vérification JWT (Stripe n'envoie pas de JWT) : la signature fait foi.
import { createClient } from "npm:@supabase/supabase-js@2.45.4";
import { profileUpdateFromSubscription, stripeCall, verifySignature } from "./lib.ts";

Deno.serve(async (req) => {
  const secret = Deno.env.get("STRIPE_SECRET_KEY"), whsec = Deno.env.get("STRIPE_WEBHOOK_SECRET");
  if (!secret || !whsec) return new Response("not_configured", { status: 503 });
  const raw = await req.text();
  if (!(await verifySignature(raw, req.headers.get("stripe-signature"), whsec))) return new Response("signature invalide", { status: 400 });

  const event = JSON.parse(raw);
  const admin = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

  async function apply(sub: any, userId?: string | null) {
    const customer = typeof sub.customer === "string" ? sub.customer : sub.customer?.id;
    let id = userId ?? sub.metadata?.user_id ?? null;
    if (!id && customer) {
      const { data } = await admin.from("profiles").select("id").eq("stripe_customer_id", customer).maybeSingle();
      id = data?.id ?? null;
    }
    if (!id) { console.warn("webhook : utilisateur introuvable", sub.id); return; }
    const patch = profileUpdateFromSubscription(sub);
    if (patch) { const { error } = await admin.from("profiles").update(patch).eq("id", id); if (error) throw error; }
  }

  try {
    const obj = event.data?.object;
    switch (event.type) {
      case "checkout.session.completed":
        if (obj.mode === "subscription" && obj.subscription) {
          const sub = await stripeCall(secret, `/subscriptions/${obj.subscription}`, "GET");
          await apply(sub, obj.client_reference_id);
        }
        break;
      case "customer.subscription.created":
      case "customer.subscription.updated":
      case "customer.subscription.deleted":
        await apply(obj);
        break;
      default:
        break; // autres événements ignorés
    }
  } catch (e) {
    console.error("webhook", event.type, (e as Error).message);
    return new Response("erreur", { status: 500 }); // Stripe réessaiera
  }
  return new Response("ok", { status: 200 });
});
