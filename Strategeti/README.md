# Strategeti

Jeu de placement pour deux joueurs sur le même appareil, installable comme PWA et jouable hors ligne après son premier chargement.

## Règles disponibles

- Plateau Savane de 4 × 4 cases, vide au début de la partie.
- Noir joue en haut ; Blanc joue en bas et commence.
- Chaque joueur dispose de deux éléphants, deux lions, deux zèbres et deux gazelles.
- À son tour, un joueur pose une pièce de son stock sur une case vide ou déplace un de ses éléphants d’une case horizontalement ou verticalement.
- L’éléphant pousse toute la chaîne d’animaux devant lui ; il ne peut pas pousser un autre éléphant. Un animal poussé hors du plateau est mangé.
- Les pièces mangées sont suivies à droite du plateau et ne retournent pas au stock jouable.
- Un joueur perd si cinq de ses pièces ont été mangées ou s’il n’a aucun coup légal à son tour.
- Les lions, zèbres et gazelles peuvent être posés, mais leurs règles de déplacement ne sont pas encore définies.

## Architecture

- `js/game.js` contient les règles et le modèle de partie. `createGame`, `playMove` et `moveElephant` retournent un nouvel état sans modifier l’état précédent.
- `js/game-api.js` expose les actions du jeu à l’interface, migre les anciennes sauvegardes et coordonne règles et sauvegarde.
- `js/app.js` affiche l’état du jeu, collecte les interactions et appelle cette API.
- `js/storage.js` gère le stockage IndexedDB, sans logique d’affichage.
- `pwa-sw.js` met en cache les ressources de l’application pour le démarrage hors ligne ; il ne stocke pas la progression.

L’état est sauvegardé après chaque coup et lors de la création ou de la remise à zéro d’une partie. Au rechargement, l’application restaure la dernière partie sauvegardée. Effacer les données du navigateur ou changer d’appareil efface/perd cette sauvegarde.

## Lancer en local

Servir le dossier `Strategeti` avec un serveur HTTP local, puis ouvrir `index.html` via cette adresse. Les modules JavaScript, IndexedDB et le Service Worker nécessitent un contexte sécurisé : `localhost` convient pour le développement. Après le premier chargement réussi, les ressources de l’application sont disponibles hors ligne.
