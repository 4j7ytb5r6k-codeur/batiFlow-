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

Pages : `login.html` (connexion), `app.html` (espace client : clients, chantiers, devis avec rappels de relance J+3/J+7/J+14, comptes rendus par dictée vocale, export et suppression des données), `admin.html` (administration : clients, essais, abonnés, CA estimé, messages de contact).

- **Base** : projet Supabase `yvdkrrkrxiizyelivtlv` (Francfort). Tout le schéma est dans `supabase/schema.sql` (déjà appliqué).
- **Administrateur** : le compte `batiFlow23@gmail.com` devient administrateur automatiquement une fois son email confirmé (voir `supabase/schema.sql`). Pour changer d'adresse, modifier les deux fonctions SQL `handle_new_user` et `grant_admin_on_confirm`.
- **Sécurité** : chaque client ne voit que ses données (règles RLS vérifiées). Les en-têtes de sécurité (CSP, HSTS…) sont dans `netlify.toml`.
- **RGPD** : polices et bibliothèque Supabase hébergées avec le site (`fonts/`, `vendor/`), aucun traceur.
- **CA** : le CA de l'administration est une estimation d'après l'offre attribuée à chaque client, pas des encaissements (pas de paiement en ligne pour l'instant).

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
