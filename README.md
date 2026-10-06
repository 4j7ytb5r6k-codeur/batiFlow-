# batiFlow – site vitrine

Landing page en HTML, CSS et JavaScript simples (aucune dépendance).

## Lancer le site

Option 1 : double-cliquez sur `index.html`.

Option 2 : serveur local, depuis ce dossier :

```bash
python3 -m http.server 8000
# puis ouvrir http://localhost:8000
```

## Personnaliser

- Textes : `index.html`
- Couleurs : variables en haut de `styles.css`
- Formulaire d'essai gratuit : prêt pour Netlify Forms (les inscriptions apparaissent dans Netlify > Forms > « essai-gratuit »). Pour un autre service, renseigner `FORM_ENDPOINT` dans `script.js`. Hors Netlify, l'inscription est simulée et stockée dans le navigateur.
- Prix : section « Tarifs » de `index.html` (Essentiel 35 € et Pro 70 € TTC/mois, ou 350 € et 700 € TTC/an, prix à ajuster ; bascule gérée dans `script.js`).

## Espace client et administration (Supabase)

Pages : `login.html` (connexion), `app.html` (espace client : clients, chantiers avec photos, devis détaillés avec PDF et rappels de relance J+3/J+7/J+14, comptes rendus par dictée vocale, informations d'entreprise, export et suppression des données), `admin.html` (administration : clients, essais, abonnés, CA estimé, messages de contact).

- **Base** : projet Supabase `yvdkrrkrxiizyelivtlv` (Francfort). Tout le schéma est dans `supabase/schema.sql` (déjà appliqué).
- **Administrateur** : le compte `batiFlow23@gmail.com` devient administrateur automatiquement une fois son email confirmé (voir `supabase/schema.sql`). Pour changer d'adresse, modifier les deux fonctions SQL `handle_new_user` et `grant_admin_on_confirm`.
- **Sécurité** : chaque client ne voit que ses données (règles RLS vérifiées). Les en-têtes de sécurité (CSP, HSTS…) sont dans `netlify.toml`.
- **RGPD** : polices et bibliothèques (Supabase, jsPDF) hébergées avec le site (`fonts/`, `vendor/`), aucun traceur. Les PDF sont générés dans le navigateur du client : aucune donnée n'est envoyée à un tiers.
- **Devis PDF** : `devis-pdf.js` (lignes, TVA par taux, total TTC). L'en-tête reprend les informations d'entreprise du client (Mon compte).
- **Photos** : bucket privé `chantier-photos`, images réduites à 1600 px côté navigateur, 5 Mo max, 60 photos par chantier.
- **CA** : le CA de l'administration est une estimation d'après l'offre attribuée à chaque client, pas des encaissements (pas de paiement en ligne pour l'instant).

## Offre Pro et abonnements (Stripe)

- **Offre Pro** (déjà en place) : équipe jusqu'à 5 utilisateurs (Équipe), planning partagé avec chantiers assignés (Planning), statistiques détaillées (Statistiques), support prioritaire (messages marqués « Pro » dans l'administration). Pendant l'essai de 7 jours, le Pro est inclus pour pouvoir le tester.
- **Changement d'offre sans contact** : depuis « Mon compte », le client souscrit, change d'offre (prorata automatique), résilie ou reprend son abonnement, et accède à ses factures. Cela passe par les fonctions Supabase `billing` et `stripe-webhook` (dossier `supabase/functions/`, déjà déployées).
- **Tant que Stripe n'est pas configuré**, ces boutons affichent « Le paiement en ligne n'est pas encore activé ». Activation :
  1. Créez un compte sur https://stripe.com et activez le mode test (puis le mode production quand tout est validé).
  2. Stripe > Développeurs > Clés API : copiez la clé secrète (`sk_test_...`).
  3. Supabase > Edge Functions > Secrets : ajoutez `STRIPE_SECRET_KEY` (la clé), `SITE_URL` (l'adresse du site, ex. `https://batiflow.fr`, plusieurs adresses séparées par des virgules).
  4. Stripe > Développeurs > Webhooks > Ajouter un point de terminaison : URL `https://yvdkrrkrxiizyelivtlv.supabase.co/functions/v1/stripe-webhook`, événements `checkout.session.completed`, `customer.subscription.created`, `customer.subscription.updated`, `customer.subscription.deleted`. Copiez la clé de signature (`whsec_...`) dans le secret Supabase `STRIPE_WEBHOOK_SECRET`.
  5. Stripe > Paramètres > Billing > Portail client : activez le portail (moyen de paiement et factures).
  6. Testez avec la carte `4242 4242 4242 4242`. Les produits « batiFlow Essentiel » et « batiFlow Pro » sont créés automatiquement au premier paiement.
- Les prix (35 € / 70 € TTC par mois, 350 € / 700 € par an) sont définis dans `supabase/functions/*/lib.ts` (`PRICES`) **et** dans le site (`index.html`, `app.js`) : modifiez-les aux deux endroits.
- **L'administration** (`admin.html`) reste utilisable pour attribuer une offre à la main (offre offerte, geste commercial).

À faire côté Supabase (Authentication > URL Configuration) : renseigner l'adresse du site dans « Site URL » et « Redirect URLs ». Pour la production, configurer un SMTP (Authentication > SMTP Settings).

À compléter dans le site avant de vendre : `mentions-legales.html`, `cgv.html`, `confidentialite.html` (passages surlignés `[À COMPLÉTER]`), puis faire relire par un juriste.

## Mise en ligne

### Netlify (recommandé, gère aussi le formulaire)

1. Créez un compte sur https://app.netlify.com (gratuit).
2. « Add new site » > « Import an existing project » > GitHub > choisissez ce dépôt et la branche à publier.
3. Laissez les réglages par défaut (`netlify.toml` s'en charge, aucune commande de build) puis « Deploy ».
4. Dans Netlify > Forms > « essai-gratuit » > Notifications, ajoutez votre email pour recevoir chaque inscription.
5. Pour une adresse personnalisée : Domain management > Add a domain.

Sans compte : glissez-déposez le dossier sur https://app.netlify.com/drop.
