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
- Formulaire d'essai gratuit : renseigner `FORM_ENDPOINT` dans `script.js` (Formspree, API maison…). Sans URL, l'inscription est simulée et stockée dans le navigateur.
- Prix : section « Tarifs » de `index.html` (Essentiel 29 € et Pro 59 € HT/mois, ou 290 € et 590 € HT/an, prix à ajuster ; bascule gérée dans `script.js`).

## Mise en ligne

Glissez le dossier sur Netlify, ou connectez le dépôt à Vercel / GitHub Pages. Aucune étape de build.
