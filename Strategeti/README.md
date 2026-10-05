# Strategeti

Jeu de placement pour deux joueurs sur le même appareil, installable comme PWA et jouable hors ligne après son premier chargement.

## Règles disponibles

- Deux plateaux Savane de 4 × 4 cases, vides au début de la partie : classique (pose interdite dans les quatre coins) et avancé (pose interdite dans les quatre cases centrales). Les pièces peuvent se déplacer sur toutes les cases.
- Noir joue en haut ; Blanc joue en bas et commence.
- Chaque joueur dispose de deux éléphants, deux lions, deux zèbres et deux gazelles.
- À son tour, un joueur pose une pièce de son stock sur une case vide ou déplace une de ses pièces selon ses règles de déplacement.
- L’éléphant ne peut se déplacer qu’en poussant au moins un animal adjacent ; il pousse toute la chaîne devant lui et ne peut pas pousser un autre éléphant. Un animal poussé hors du plateau est mangé.
- Le lion ne peut se déplacer qu’en mangeant un zèbre ou une gazelle adjacente, de n’importe quelle couleur.
- Le zèbre se déplace en ligne droite, horizontalement, verticalement ou en diagonale, d’autant de cases qu’il le souhaite vers une case vide. Les autres pièces bloquent son passage.
- La gazelle ne se déplace qu’en sautant par-dessus une suite continue d’animaux ; elle atterrit sur la première case vide après cette suite. Elle peut sauter horizontalement, verticalement ou en diagonale, puis enchaîner d’autres sauts en changeant de direction. Après chaque saut, le joueur peut continuer, terminer ou annuler tout le déplacement et revenir à la case initiale.
- Quatre pièces de même couleur alignées horizontalement, verticalement ou en diagonale font gagner leur joueur.
- La fin de partie affiche le vainqueur et la raison de la victoire au centre du plateau.
- Les pièces mangées sont suivies à droite du plateau et ne retournent pas au stock jouable.
- Un joueur perd si cinq de ses pièces ont été mangées ou s’il n’a aucun coup légal à son tour.

## Architecture

- `js/game.js` contient les règles et le modèle de partie. `createGame`, `playMove`, `moveElephant`, `moveLion`, `moveZebra` et `moveGazelle` retournent un nouvel état sans modifier l’état précédent ; `finishGazelleMove` termine le tour et `cancelGazelleMove` restaure sa position initiale.
- `js/game-api.js` expose les actions du jeu à l’interface, migre les anciennes sauvegardes (y compris une partie déjà gagnée par alignement) et coordonne règles et sauvegarde.
- `js/app.js` affiche l’état du jeu et les règles, collecte les interactions et appelle cette API.
- `js/storage.js` gère le stockage IndexedDB, sans logique d’affichage.
- `pwa-sw.js` met en cache les ressources de l’application pour le démarrage hors ligne ; il ne stocke pas la progression.

L’état est sauvegardé après chaque coup et lors de la création ou de la remise à zéro d’une partie. Au rechargement, l’application restaure la dernière partie sauvegardée. Effacer les données du navigateur ou changer d’appareil efface/perd cette sauvegarde.

## Lancer en local

Servir le dossier `Strategeti` avec un serveur HTTP local, puis ouvrir `index.html` via cette adresse. Les modules JavaScript, IndexedDB et le Service Worker nécessitent un contexte sécurisé : `localhost` convient pour le développement. Après le premier chargement réussi, les ressources de l’application sont disponibles hors ligne.
