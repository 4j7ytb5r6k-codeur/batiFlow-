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
- **CA** : l'administration affiche les encaissements réels (paiements acceptés par la banque) et une estimation mensuelle d'après les offres actives.

## Offre Pro et paiement (Crédit Mutuel / Monetico)

- **Essai gratuit** : 7 jours avec toutes les fonctions Pro, démarré automatiquement à l'inscription, sans carte bancaire. À la fin, l'espace passe en lecture seule (y compris côté base : déclencheurs `require_writable`) jusqu'au paiement.
- **Paiement et activation automatiques** : depuis « Mon compte », le client choisit son offre, saisit son adresse de facturation et paie par carte sur la page sécurisée du Crédit Mutuel. La banque prévient la fonction Supabase `paiement` (serveur à serveur), qui vérifie le sceau et **active l'offre immédiatement**, sans intervention. Chaque paiement ajoute un mois ou un an à l'échéance ; payer avant l'échéance prolonge la période en cours.
- **Pas de reconduction automatique** : le client renouvelle quand il veut (rappel dans l'espace 3 jours avant l'échéance, 3 jours de tolérance après). Si le Crédit Mutuel active plus tard l'option de paiement récurrent sur votre contrat, chaque échéance qu'il notifie prolonge aussi l'accès automatiquement.
- **Offre Pro** : équipe jusqu'à 5 utilisateurs, planning partagé, statistiques, support prioritaire.
- **Administration** (`admin.html`) : paiements reçus, encaissé sur 30 jours, statut et échéance de chaque client. Pour offrir une offre : choisissez-la et videz la date d'échéance (accès sans limite de durée).
- Les prix (35 € / 70 € TTC par mois, 350 € / 700 € par an) sont dans `supabase/functions/paiement/index.ts` (`PRICES`) **et** dans le site (`index.html`, `app.js`, `admin.js`) : modifiez-les partout.

**Activation** (tant que ce n'est pas fait, le bouton de paiement affiche « le paiement en ligne n'est pas encore activé ») :
1. Souscrivez Monetico (paiement en ligne) auprès de votre agence Crédit Mutuel. Vous recevez un numéro de TPE, un code société et une clé de sécurité (40 caractères), d'abord pour l'environnement de test.
2. Dans votre espace Monetico, renseignez l'URL de l'interface retour (URL de confirmation) : `https://yvdkrrkrxiizyelivtlv.supabase.co/functions/v1/paiement`.
3. Supabase > Edge Functions > Secrets : ajoutez `MONETICO_TPE`, `MONETICO_KEY`, `MONETICO_SOCIETE`, `SITE_URL` (ex. `https://batiflow.fr`) et `MONETICO_MODE` = `test`.
4. Faites au moins 3 paiements de test avec les cartes de test Monetico (la banque l'exige avant la production), vérifiez que l'offre s'active toute seule.
5. Demandez le passage en production, remplacez la clé par la clé de production et passez `MONETICO_MODE` à `production`.

À faire côté Supabase (Authentication > URL Configuration) : renseigner l'adresse du site dans « Site URL » et « Redirect URLs ». Pour la production, configurer un SMTP (Authentication > SMTP Settings).

Pages légales : `mentions-legales.html`, `cgv.html`, `cgu.html`, `remboursement.html`, `confidentialite.html`, `cookies.html`. À compléter avant de vendre : les passages surlignés `[ENTRE CROCHETS]` (identité de l'éditeur, durées, choix de remboursement), puis faire relire par un juriste.

## Mise en ligne

### Netlify (recommandé, gère aussi le formulaire)

1. Créez un compte sur https://app.netlify.com (gratuit).
2. « Add new site » > « Import an existing project » > GitHub > choisissez ce dépôt et la branche à publier.
3. Laissez les réglages par défaut (`netlify.toml` s'en charge, aucune commande de build) puis « Deploy ».
4. Dans Netlify > Forms > « essai-gratuit » > Notifications, ajoutez votre email pour recevoir chaque inscription.
5. Pour une adresse personnalisée : Domain management > Add a domain.

Sans compte : glissez-déposez le dossier sur https://app.netlify.com/drop.
