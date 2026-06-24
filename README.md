# yt-helper — Téléchargeur MP4 propre pour YouTube

Télécharge tes propres vidéos YouTube (ou tout contenu que tu as le droit de télécharger)
en **MP4 de haute qualité**, directement depuis un bouton sur la page YouTube.

> **⚠ Avertissement légal**
> Utilise cet outil **uniquement sur tes propres vidéos** ou sur des contenus pour lesquels
> tu as une autorisation explicite de téléchargement. Télécharger du contenu protégé par le
> droit d'auteur sans permission est illégal dans la plupart des pays.
>
> L'option **"Utiliser mes cookies Chrome"** transmet ta session YouTube active au serveur local.
> Ce risque est acceptable **uniquement parce que le serveur tourne sur ta propre machine**
> et n'est pas accessible depuis internet. Ne l'active jamais si tu fais tourner le serveur
> sur une machine partagée ou distante.

---

## Comment ça fonctionne

```
Extension Chrome ──HTTP──► Serveur Python local (127.0.0.1:5000) ──► yt-dlp + ffmpeg ──► .mp4
```

- **L'extension Chrome** ajoute des boutons sur les pages YouTube.
- **Le serveur Python** tourne sur ton PC et fait le vrai travail (téléchargement, fusion).
- **yt-dlp + ffmpeg** font le travail de fond (ils s'installent une seule fois).

---

## Installation étape par étape

### Étape 1 — Installer Python

1. Va sur **https://www.python.org/downloads/** et clique sur le gros bouton jaune
   « Download Python 3.x.x ».
2. Lance le fichier `.exe` téléchargé.
3. **TRÈS IMPORTANT** : tout en bas de la première fenêtre d'installation, coche la case
   **"Add Python.exe to PATH"** avant de cliquer sur « Install Now ».
   Si tu oublies ça, le reste ne fonctionnera pas.
4. Clique « Install Now » et attends la fin.
5. Ferme la fenêtre d'installation.

**Vérification** : ouvre le menu Démarrer, tape `cmd`, appuie sur Entrée pour ouvrir
l'invite de commande, puis tape :
```
python --version
```
Tu devrais voir quelque chose comme `Python 3.12.3`. Si tu vois une erreur, recommence
l'installation en cochant bien la case PATH.

---

### Étape 2 — Installer yt-dlp et ffmpeg

Ces deux outils font le téléchargement et la fusion vidéo/audio.

#### Méthode recommandée : avec winget (déjà installé sur Windows 10/11)

Ouvre l'invite de commande (menu Démarrer → `cmd` → Entrée) et tape ces deux commandes,
une par une, en appuyant sur Entrée après chaque :

```
winget install yt-dlp.yt-dlp
```
```
winget install Gyan.FFmpeg
```

**winget** est un gestionnaire de paquets inclus dans Windows 10/11. Il télécharge
et installe automatiquement les logiciels.

#### Méthode alternative si winget ne fonctionne pas

**yt-dlp :**
1. Va sur https://github.com/yt-dlp/yt-dlp/releases/latest
2. Télécharge `yt-dlp.exe`
3. Place ce fichier dans `C:\Windows\System32\` (nécessite les droits administrateur)

**ffmpeg :**
1. Va sur https://www.gyan.dev/ffmpeg/builds/
2. Télécharge `ffmpeg-release-essentials.zip`
3. Extrais l'archive, navigue dans le dossier `bin\`
4. Copie `ffmpeg.exe` dans `C:\Windows\System32\`

**Vérification** : dans l'invite de commande, tape :
```
yt-dlp --version
```
```
ffmpeg -version
```
Chacune de ces commandes doit afficher un numéro de version. Si tu vois « not recognized »,
les outils ne sont pas dans le PATH — réessaie l'installation.

---

### Étape 3 — Installer les dépendances Python du serveur

**pip** est l'outil qui installe les bibliothèques Python (comme un "app store" pour Python).

Dans l'invite de commande, navigue d'abord vers le dossier du serveur.
Pour naviguer, utilise la commande `cd` (« change directory ») :

```
cd "C:\Users\oscar\Documents\After Effects Plugins\yt-helper\server"
```

> **Astuce** : tu peux glisser-déposer le dossier depuis l'Explorateur vers la fenêtre
> de commande pour écrire le chemin automatiquement.

Puis installe les dépendances :
```
pip install -r requirements.txt
```

Tu verras défiler des lignes d'installation. À la fin, tu dois voir
`Successfully installed flask...`.

---

### Étape 4 — Lancer le serveur pour la première fois

Toujours dans le même dossier (`server\`), tape :
```
python server.py
```

Tu verras s'afficher quelque chose comme :
```
============================================================
  yt-helper serveur v1.0.0
  Dossier de sortie : C:\Users\oscar\Downloads
  Token secret : a3f8c2e1...d9b7 ← COPIE CETTE VALEUR
  Copiez ce token dans l'extension Chrome (popup → Paramètres)
============================================================
✓ yt-dlp trouvé
✓ ffmpeg trouvé
 * Running on http://127.0.0.1:5000
```

**Copie le token secret** (la longue suite de lettres et chiffres). Tu en auras besoin
à l'étape suivante. Ce token est aussi enregistré dans le fichier `server\config.json`.

⚠ **Garde cette fenêtre ouverte** tant que tu utilises l'extension. Si tu la fermes,
le serveur s'arrête et l'extension ne peut plus télécharger.

---

### Étape 5 — Charger l'extension dans Chrome

1. Ouvre Chrome et va à l'adresse : `chrome://extensions`
2. En haut à droite, active le **Mode développeur** (interrupteur bleu).
3. Clique sur **« Charger l'extension non empaquetée »**.
4. Navigue vers le dossier `yt-helper\extension\` et clique **Sélectionner le dossier**.
5. L'extension apparaît dans la liste. Note son **ID** (une longue chaîne de lettres).

**Coller le token dans l'extension :**

1. Clique sur l'icône rouge ▶ de yt-helper dans la barre d'outils Chrome
   (si elle n'est pas visible, clique sur l'icône puzzle 🧩 pour épingler l'extension).
2. Dans le champ **« Token secret du serveur »**, colle le token copié à l'étape 4.
3. Clique **« Sauvegarder les réglages »**.
4. L'indicateur doit passer au **vert** : « Serveur actif ✓ »

---

### Étape 6 — Utiliser l'extension

1. Va sur une page YouTube (`youtube.com/watch?v=...`).
2. Les boutons **« ⬇ Télécharger en MP4 propre »** et **« 🖼 Miniature »** apparaissent
   en haut de la page, sous le titre.
3. Clique sur **« ⬇ Télécharger en MP4 propre »** : une barre de progression s'affiche.
4. Le fichier `.mp4` sera dans ton dossier **Téléchargements** (ou celui configuré dans
   `config.json`).

---

### Étape 7 (optionnel) — Démarrer le serveur automatiquement avec Windows

Pour ne pas avoir à relancer `python server.py` à chaque démarrage :

1. Appuie sur **Windows + R**, tape `shell:startup` et appuie sur Entrée.
   L'Explorateur ouvre le dossier de démarrage automatique.
2. Copie le fichier `server\start-server.bat` dans ce dossier.
3. Redémarre Windows. Le serveur démarrera automatiquement en arrière-plan
   (sans fenêtre noire visible).

**Pour arrêter le serveur :**
- Appuie sur **Ctrl + Alt + Suppr** → **Gestionnaire des tâches**
- Onglet **Détails**
- Cherche `pythonw.exe`, clique dessus, puis **Fin de tâche**.

**Pour désactiver le démarrage automatique :**
- Ouvre à nouveau `shell:startup` et supprime le fichier `start-server.bat` que tu y avais copié.

---

## Réglages avancés

Le fichier `server\config.json` (créé au premier lancement) contient :

```json
{
  "auth_token": "...",
  "output_dir": "C:\\Users\\oscar\\Downloads"
}
```

- **`output_dir`** : change ce chemin pour sauvegarder les vidéos ailleurs.
  N'oublie pas de doubler les `\` en `\\` dans le JSON.
- **`auth_token`** : ne change pas ce champ à la main (ou recopie-le dans la popup).

---

## Dépannage

### « Le serveur ne démarre pas »

- Vérifie que Python est bien installé : `python --version` dans cmd.
- Vérifie que tu es dans le bon dossier (`cd` vers `server\`) avant de taper `python server.py`.
- Vérifie que Flask est installé : `pip install -r requirements.txt` (peut être relancé sans risque).

### « yt-dlp introuvable » ou « ffmpeg introuvable »

- Ferme et rouvre la fenêtre cmd après l'installation (le PATH n'est lu qu'au démarrage de cmd).
- Vérifie avec `yt-dlp --version`. Si erreur → réinstalle via winget ou mets le .exe dans
  `C:\Windows\System32\`.

### « La vidéo est privée / non répertoriée »

- Dans la popup de l'extension, coche **« Utiliser mes cookies Chrome »**.
- Tu dois être **connecté à YouTube** dans Chrome avec le bon compte.
- Relance le téléchargement.

### « Le bouton n'apparaît pas sur YouTube »

- Recharge la page YouTube (F5) après avoir chargé l'extension.
- Vérifie que l'extension est bien activée dans `chrome://extensions`.
- YouTube est une application complexe : si le bouton disparaît en naviguant,
  recharge la page de la vidéo directement (colle l'URL ou appuie sur F5).

### « Erreur 403 — Token invalide »

- Le token dans la popup ne correspond pas à celui de `config.json`.
- Ouvre `server\config.json`, copie la valeur de `auth_token`, et recolle-la dans la popup.

### « Le téléchargement se lance mais le fichier est vide ou corrompu »

- Assure-toi que ffmpeg est bien installé (`ffmpeg -version`).
- Vérifie l'espace disque disponible dans le dossier de sortie.
- Consulte `server\server.log` pour voir le message d'erreur détaillé.

### « Je vois une erreur "No space left" »

- Change `output_dir` dans `config.json` vers un disque avec plus d'espace.

---

## Récapitulatif des commandes du premier lancement

Ouvre l'invite de commande (menu Démarrer → `cmd`) et tape ces commandes dans l'ordre :

```
winget install yt-dlp.yt-dlp
```
```
winget install Gyan.FFmpeg
```
```
cd "C:\Users\oscar\Documents\After Effects Plugins\yt-helper\server"
```
```
pip install -r requirements.txt
```
```
python server.py
```

Ensuite dans Chrome :
1. `chrome://extensions` → Mode développeur → Charger l'extension non empaquetée → dossier `extension\`
2. Clique sur l'icône yt-helper → colle le token → Sauvegarder
3. Va sur une vidéo YouTube → clique **⬇ Télécharger en MP4 propre**

---

## Structure du projet

```
yt-helper/
├── README.md                  ← ce fichier
├── server/
│   ├── server.py              ← le serveur Flask (lance-le avec python server.py)
│   ├── requirements.txt       ← dépendances Python (flask, flask-cors)
│   ├── config.json            ← créé automatiquement au premier lancement
│   ├── config.example.json    ← modèle de config
│   ├── server.log             ← journal des téléchargements (créé automatiquement)
│   └── start-server.bat       ← pour démarrage automatique avec Windows
└── extension/
    ├── manifest.json          ← déclaration de l'extension Chrome MV3
    ├── content.js             ← boutons injectés sur YouTube
    ├── content.css            ← styles des boutons
    ├── popup.html             ← interface de la popup
    ├── popup.js               ← logique de la popup
    ├── popup.css              ← styles de la popup
    └── icons/
        ├── icon16.png
        ├── icon48.png
        └── icon128.png
```
