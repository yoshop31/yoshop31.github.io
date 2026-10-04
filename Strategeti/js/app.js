import { BOARD_SIZE, PIECES, PLAYERS } from './game.js';
import { loadSavedGame, playGameMove, startGame } from './game-api.js';

const setupPanel = document.querySelector('#setup-panel');
const gamePanel = document.querySelector('#game-panel');
const boardElement = document.querySelector('#game-board');
const turnIndicator = document.querySelector('#turn-indicator');
const gameMessage = document.querySelector('#game-message');
const saveStatus = document.querySelector('#save-status');
const restartButton = document.querySelector('#restart-button');
const newGameForm = document.querySelector('#new-game-form');
const newGameButton = document.querySelector('#new-game-button');
const confirmDialog = document.querySelector('#confirm-dialog');
const confirmTitle = document.querySelector('#confirm-title');
const confirmMessage = document.querySelector('#confirm-message');
const confirmAction = document.querySelector('#confirm-action');

let gameState = null;
let selectedPiece = null;
let pendingOperation = null;
let isSaving = false;

function showSetup() {
  setupPanel.hidden = false;
  gamePanel.hidden = true;
  restartButton.hidden = true;
  document.querySelector('#resume-button').hidden = !gameState;
}

function showGame() {
  setupPanel.hidden = true;
  gamePanel.hidden = false;
  restartButton.hidden = false;
  renderGame();
}

function setSaveStatus(message, isError = false) {
  saveStatus.textContent = message;
  saveStatus.classList.toggle('save-error', isError);
}

function describeStock(player) {
  const stock = gameState.stocks[player];
  const total = Object.values(stock).reduce((sum, count) => sum + count, 0);
  document.querySelector(`#${player}-stock-label`).textContent =
    `${total} pièce${total === 1 ? '' : 's'} en réserve`;

  const container = document.querySelector(`#${player}-stock`);
  container.replaceChildren();
  for (const piece of PIECES) {
    const count = stock[piece.id];
    const button = document.createElement('button');
    button.type = 'button';
    button.className = 'piece-choice';
    button.disabled = isSaving ||
      gameState.status !== 'playing' ||
      gameState.currentPlayer !== player ||
      count === 0;
    button.setAttribute('aria-pressed', String(selectedPiece === piece.id && gameState.currentPlayer === player));
    button.setAttribute('aria-label', `${piece.name}, ${count} disponible${count === 1 ? '' : 's'}`);
    button.innerHTML = `<span class="piece-icon" aria-hidden="true">${piece.icon}</span><span class="piece-name">${piece.name}</span><span class="piece-count">× ${count}</span>`;
    button.addEventListener('click', () => {
      selectedPiece = selectedPiece === piece.id ? null : piece.id;
      gameMessage.textContent = selectedPiece
        ? `${piece.name} sélectionné. Choisissez une case vide.`
        : 'Sélection annulée.';
      renderGame();
    });
    container.append(button);
  }
}

function renderBoard() {
  boardElement.replaceChildren();
  gameState.board.forEach((cell, index) => {
    const button = document.createElement('button');
    const row = Math.floor(index / BOARD_SIZE) + 1;
    const column = (index % BOARD_SIZE) + 1;
    button.type = 'button';
    button.className = `board-cell${cell ? ` occupied ${cell.player}` : ''}`;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-rowindex', String(row));
    button.setAttribute('aria-colindex', String(column));
    button.disabled = isSaving || Boolean(cell) || gameState.status !== 'playing';

    if (cell) {
      const piece = PIECES.find(item => item.id === cell.pieceId);
      button.setAttribute('aria-label', `Ligne ${row}, colonne ${column} : ${piece.name}, ${PLAYERS[cell.player].name}`);
      button.innerHTML = `<span class="board-piece" aria-hidden="true">${piece.icon}</span><span class="board-owner">${PLAYERS[cell.player].name}</span>`;
    } else {
      button.setAttribute('aria-label', `Ligne ${row}, colonne ${column} : case vide`);
      button.innerHTML = '<span class="empty-marker" aria-hidden="true"></span>';
      button.addEventListener('click', () => placePiece(index));
    }
    boardElement.append(button);
  });
}

function renderGame() {
  renderBoard();
  describeStock('black');
  describeStock('white');

  if (gameState.status === 'finished') {
    turnIndicator.textContent = 'Plateau complet';
    gameMessage.textContent = 'Toutes les pièces ont été placées. La partie est terminée.';
  } else {
    turnIndicator.textContent = `Au tour de ${PLAYERS[gameState.currentPlayer].name}`;
    if (!gameMessage.textContent) {
      gameMessage.textContent = selectedPiece
        ? 'Choisissez une case vide pour placer la pièce.'
        : `Au tour de ${PLAYERS[gameState.currentPlayer].name} : choisissez une pièce dans votre stock.`;
    }
  }
}

async function placePiece(cellIndex) {
  if (isSaving) return;
  if (!selectedPiece || !gameState) {
    gameMessage.textContent = 'Choisissez d’abord une pièce dans le stock du joueur dont c’est le tour.';
    return;
  }

  try {
    isSaving = true;
    setSaveStatus('Enregistrement…');
    renderGame();
    const nextState = await playGameMove(gameState, { cellIndex, pieceId: selectedPiece });
    gameState = nextState;
    selectedPiece = null;
    gameMessage.textContent = '';
    setSaveStatus('Partie sauvegardée sur cet appareil.');
  } catch (error) {
    setSaveStatus(error.message, true);
  } finally {
    isSaving = false;
    renderGame();
  }
}

async function beginGame(action) {
  if (isSaving) return;
  isSaving = true;
  newGameForm.querySelector('button[type="submit"]').disabled = true;
  try {
    setSaveStatus('Enregistrement…');
    const nextState = await startGame(action.boardId);
    gameState = nextState;
    selectedPiece = null;
    gameMessage.textContent = '';
    setSaveStatus('Nouvelle partie sauvegardée.');
    showGame();
  } catch (error) {
    setSaveStatus(error.message, true);
  } finally {
    isSaving = false;
    newGameForm.querySelector('button[type="submit"]').disabled = false;
    if (!gamePanel.hidden && gameState) renderGame();
  }
}

function requestConfirmation(action) {
  pendingOperation = action;
  confirmTitle.textContent = action.type === 'restart' ? 'Recommencer la partie ?' : 'Démarrer une nouvelle partie ?';
  confirmMessage.textContent = 'La progression actuelle sera remplacée.';
  confirmAction.textContent = action.type === 'restart' ? 'Recommencer' : 'Démarrer';
  confirmDialog.showModal();
}

confirmDialog.addEventListener('close', async () => {
  const action = pendingOperation;
  pendingOperation = null;
  if (confirmDialog.returnValue !== 'confirm' || !action) return;
  await beginGame(action);
});

newGameButton.addEventListener('click', showSetup);

newGameForm.addEventListener('submit', event => {
  event.preventDefault();
  const action = { type: 'new', boardId: document.querySelector('#board-choice').value };
  if (gameState) {
    requestConfirmation(action);
  } else {
    beginGame(action);
  }
});

restartButton.addEventListener('click', () => {
  if (gameState) requestConfirmation({ type: 'restart', boardId: gameState.boardId });
});

document.querySelector('#resume-button').addEventListener('click', showGame);

async function initialize() {
  try {
    const savedGame = await loadSavedGame();
    gameState = savedGame;
    if (gameState) {
      setSaveStatus('Partie précédente restaurée.');
      showGame();
    } else {
      showSetup();
    }
  } catch (error) {
    showSetup();
    setSaveStatus(error.message, true);
  }
}

initialize();
