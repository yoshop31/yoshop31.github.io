# Strategeti

Jeu de placement pour deux joueurs sur le même appareil, installable comme PWA et jouable hors ligne après son premier chargement.

## Règles disponibles

- Plateau Savane de 4 × 4 cases, vide au début de la partie.
- Noir joue en haut ; Blanc joue en bas et commence.
- Chaque joueur dispose de deux éléphants, deux lions, deux zèbres et deux gazelles.
- À son tour, un joueur choisit une pièce de son stock et la place sur une case vide.
- La partie se termine lorsque les 16 cases sont occupées. Aucune condition de victoire n’est définie pour le moment.

## Architecture

- `js/game.js` contient les règles et le modèle de partie. `createGame` initialise une partie et `playMove` valide un coup et retourne un nouvel état sans modifier l’état précédent.
- `js/game-api.js` expose les actions du jeu à l’interface et coordonne règles et sauvegarde.
- `js/app.js` affiche l’état du jeu, collecte les interactions et appelle cette API.
- `js/storage.js` gère le stockage IndexedDB, sans logique d’affichage.
- `pwa-sw.js` met en cache les ressources de l’application pour le démarrage hors ligne ; il ne stocke pas la progression.

L’état est sauvegardé après chaque coup et lors de la création ou de la remise à zéro d’une partie. Au rechargement, l’application restaure la dernière partie sauvegardée. Effacer les données du navigateur ou changer d’appareil efface/perd cette sauvegarde.

## Lancer en local

Servir le dossier `Strategeti` avec un serveur HTTP local, puis ouvrir `index.html` via cette adresse. Les modules JavaScript, IndexedDB et le Service Worker nécessitent un contexte sécurisé : `localhost` convient pour le développement. Après le premier chargement réussi, les ressources de l’application sont disponibles hors ligne.
