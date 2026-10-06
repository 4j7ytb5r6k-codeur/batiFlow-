# BatiFlow – Compte rendu de chantier

L'artisan écrit sa note de fin de journée en vrac, clique sur « Générer le compte rendu »,
relit/corrige les 5 rubriques, puis télécharge un PDF.

## 1. Créer ta clé API (une seule fois)

1. Va sur <https://console.anthropic.com> et crée un compte (ou connecte-toi).
2. Ajoute un peu de crédit : menu **Billing** (Facturation). Quelques euros suffisent pour tester.
3. Menu **API Keys** → bouton **Create Key** → donne un nom (ex : `batiflow`) → **Create**.
4. **Copie la clé tout de suite** (elle commence par `sk-ant-`). Elle ne sera plus affichée ensuite.

## 2. Mettre la clé dans le fichier `.env`

1. Dans le dossier du projet, copie `.env.example` et nomme la copie `.env`
   (`cp .env.example .env` dans le terminal).
2. Ouvre `.env` et colle ta clé après le `=` :
   `ANTHROPIC_API_KEY=sk-ant-ta-vraie-cle`
3. Enregistre. Ne partage jamais ce fichier : il est exclu de Git par `.gitignore`.

## 3. Lancer le site

```bash
npm install     # une seule fois : télécharge les outils nécessaires
npm start       # lance le site
```

Puis ouvre <http://localhost:3000> dans ton navigateur. Pour arrêter : `Ctrl + C`.

## Comment c'est organisé

| Fichier | Rôle |
|---|---|
| `public/index.html` | La page (formulaire, rubriques modifiables, bouton PDF) |
| `server.js` | Le serveur : garde la clé secrète et envoie la note à Claude |
| `.env` | Ta clé API (à créer, jamais publié) |
| `.env.example` | Modèle du fichier `.env` |

Le modèle utilisé est `claude-opus-5-5`. Pour changer (par exemple pour payer moins cher),
décommente la ligne `CLAUDE_MODEL` dans `.env`.
