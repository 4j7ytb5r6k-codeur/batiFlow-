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

## Espace client (Supabase)

À l'inscription, un compte est créé et l'espace client (profil + essai de 7 jours) est créé automatiquement. Pages : `login.html` (connexion) et `app.html` (tableau de bord, réservé aux comptes connectés, avec des données d'exemple).

Tant que `config.js` est vide, le site reste en mode démo (aucun compte réel).

1. Créez un projet gratuit sur https://supabase.com.
2. Supabase > SQL Editor > New query : collez le contenu de `supabase/schema.sql` puis « Run ». Cela crée la table `profiles`, les règles de sécurité (RLS) et le déclencheur qui crée l'espace client à chaque inscription.
3. Supabase > Project Settings > API : copiez l'URL du projet et la clé « anon public » dans `config.js`. N'utilisez jamais la clé `service_role`.
4. Supabase > Authentication > URL Configuration : mettez l'adresse du site en production dans « Site URL » et ajoutez-la dans « Redirect URLs » (sinon le lien de confirmation par email pointe au mauvais endroit).
5. Supabase > Authentication > Providers > Email : laissez « Confirm email » activé (recommandé). L'email de confirmation par défaut est limité en volume ; pour la production, configurez un SMTP (Authentication > SMTP Settings).

## Mise en ligne

### Netlify (recommandé, gère aussi le formulaire)

1. Créez un compte sur https://app.netlify.com (gratuit).
2. « Add new site » > « Import an existing project » > GitHub > choisissez ce dépôt et la branche à publier.
3. Laissez les réglages par défaut (`netlify.toml` s'en charge, aucune commande de build) puis « Deploy ».
4. Dans Netlify > Forms > « essai-gratuit » > Notifications, ajoutez votre email pour recevoir chaque inscription.
5. Pour une adresse personnalisée : Domain management > Add a domain.

Sans compte : glissez-déposez le dossier sur https://app.netlify.com/drop.
