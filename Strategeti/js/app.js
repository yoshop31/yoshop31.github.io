import { BOARD_SIZE, PIECES, PLAYERS } from './game.js';
import { loadSavedGame, moveGameElephant, playGameMove, startGame } from './game-api.js';

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
const capturedStock = document.querySelector('#captured-stock');

let gameState = null;
let selectedPiece = null;
let selectedElephantIndex = null;
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
    for (let instanceIndex = 0; instanceIndex < count; instanceIndex += 1) {
      const button = document.createElement('button');
      button.type = 'button';
      button.className = 'piece-choice';
      button.disabled = isSaving ||
        gameState.status !== 'playing' ||
        gameState.currentPlayer !== player;
      button.setAttribute('aria-pressed', String(
        selectedPiece?.pieceId === piece.id &&
        selectedPiece.instanceIndex === instanceIndex &&
        gameState.currentPlayer === player
      ));
      button.setAttribute('aria-label', `${piece.name} ${instanceIndex + 1} sur ${count}`);
      button.innerHTML = `<span class="piece-icon" aria-hidden="true">${piece.icon}</span>`;
      button.addEventListener('click', () => {
        const isSelected = selectedPiece?.pieceId === piece.id &&
          selectedPiece.instanceIndex === instanceIndex;
        selectedPiece = isSelected ? null : { pieceId: piece.id, instanceIndex };
        selectedElephantIndex = null;
        gameMessage.textContent = selectedPiece
          ? `${piece.name} sélectionné. Choisissez une case vide pour le poser.`
          : 'Sélection annulée.';
        renderGame();
      });
      container.append(button);
    }
  }
}

function isAdjacent(firstIndex, secondIndex) {
  const rowDistance = Math.abs(
    Math.floor(firstIndex / BOARD_SIZE) - Math.floor(secondIndex / BOARD_SIZE)
  );
  const columnDistance = Math.abs((firstIndex % BOARD_SIZE) - (secondIndex % BOARD_SIZE));
  return rowDistance + columnDistance === 1;
}

function selectElephant(index) {
  selectedPiece = null;
  selectedElephantIndex = index;
  gameMessage.textContent = 'Choisissez une case adjacente. Les animaux devant l’éléphant seront poussés.';
  renderGame();
}

function renderBoard() {
  boardElement.replaceChildren();
  gameState.board.forEach((cell, index) => {
    const button = document.createElement('button');
    const row = Math.floor(index / BOARD_SIZE) + 1;
    const column = (index % BOARD_SIZE) + 1;
    const canMoveToCell = selectedElephantIndex !== null &&
      (index === selectedElephantIndex || isAdjacent(selectedElephantIndex, index));
    const canSelectElephant = selectedElephantIndex === null &&
      cell?.player === gameState.currentPlayer &&
      cell.pieceId === 'elephant';
    button.type = 'button';
    button.className = `board-cell${cell ? ` occupied ${cell.player}` : ''}${selectedElephantIndex === index ? ' selected-source' : ''}`;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-rowindex', String(row));
    button.setAttribute('aria-colindex', String(column));
    button.disabled = isSaving ||
      gameState.status !== 'playing' ||
      !(selectedElephantIndex !== null ? canMoveToCell : canSelectElephant || !cell);

    if (cell) {
      const piece = PIECES.find(item => item.id === cell.pieceId);
      button.setAttribute('aria-label', `Ligne ${row}, colonne ${column} : ${piece.name}, ${PLAYERS[cell.player].name}`);
      if (cell.player === gameState.currentPlayer && cell.pieceId === 'elephant') {
        button.setAttribute('aria-pressed', String(selectedElephantIndex === index));
      }
      button.innerHTML = `<span class="board-piece" aria-hidden="true">${piece.icon}</span><span class="board-owner">${PLAYERS[cell.player].name}</span>`;
    } else {
      button.setAttribute('aria-label', `Ligne ${row}, colonne ${column} : case vide`);
      button.innerHTML = '<span class="empty-marker" aria-hidden="true"></span>';
    }
    button.addEventListener('click', () => handleBoardClick(index));
    boardElement.append(button);
  });
}

function renderCapturedStock() {
  document.querySelector('#captured-empty').hidden = gameState.captured.length > 0;
  for (const player of ['white', 'black']) {
    const container = document.querySelector(`#${player}-captured`);
    container.replaceChildren();
    for (const piece of PIECES) {
      const count = gameState.captured.filter(item =>
        item.player === player && item.pieceId === piece.id
      ).length;
      if (count === 0) continue;
      const item = document.createElement('span');
      item.className = 'captured-piece';
      item.setAttribute('aria-label', `${count} ${piece.name}${count === 1 ? '' : 's'}`);
      item.title = `${count} ${piece.name}${count === 1 ? '' : 's'}`;
      item.innerHTML = `<span aria-hidden="true">${piece.icon}</span>${count > 1 ? `<span aria-hidden="true">×${count}</span>` : ''}`;
      container.append(item);
    }
  }
  capturedStock.classList.toggle('has-captured', gameState.captured.length > 0);
}

function renderGame() {
  renderBoard();
  describeStock('black');
  describeStock('white');
  renderCapturedStock();

  if (gameState.status === 'finished') {
    turnIndicator.textContent = `${PLAYERS[gameState.winner].name} gagne`;
    const capturedByWhite = gameState.captured.filter(piece => piece.player === 'white').length;
    const capturedByBlack = gameState.captured.filter(piece => piece.player === 'black').length;
    if (capturedByWhite >= 5 || capturedByBlack >= 5) {
      const loser = capturedByWhite >= 5 ? 'blanches' : 'noires';
      gameMessage.textContent = `${PLAYERS[gameState.winner].name} gagne : cinq pièces ${loser} ont été mangées.`;
    } else {
      gameMessage.textContent = `${PLAYERS[gameState.currentPlayer].name} n’a plus de coup légal.`;
    }
  } else {
    turnIndicator.textContent = `Au tour de ${PLAYERS[gameState.currentPlayer].name}`;
    if (!gameMessage.textContent) {
      gameMessage.textContent = selectedElephantIndex !== null
        ? 'Choisissez une case adjacente pour déplacer l’éléphant.'
        : selectedPiece
          ? 'Choisissez une case vide pour poser la pièce.'
          : `Au tour de ${PLAYERS[gameState.currentPlayer].name} : posez une pièce ou sélectionnez un éléphant à déplacer.`;
    }
  }
}

function handleBoardClick(index) {
  const cell = gameState.board[index];
  if (selectedElephantIndex !== null) {
    if (index === selectedElephantIndex) {
      selectedElephantIndex = null;
      gameMessage.textContent = 'Déplacement annulé.';
      renderGame();
    } else if (isAdjacent(selectedElephantIndex, index)) {
      moveElephantTo(index);
    }
    return;
  }
  if (cell?.player === gameState.currentPlayer && cell.pieceId === 'elephant') {
    selectElephant(index);
  } else if (!cell) {
    placePiece(index);
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
    const nextState = await playGameMove(gameState, { cellIndex, pieceId: selectedPiece.pieceId });
    gameState = nextState;
    selectedPiece = null;
    selectedElephantIndex = null;
    gameMessage.textContent = '';
    setSaveStatus('Partie sauvegardée sur cet appareil.');
  } catch (error) {
    setSaveStatus(error.message, true);
  } finally {
    isSaving = false;
    renderGame();
  }
}

async function moveElephantTo(toIndex) {
  if (isSaving || selectedElephantIndex === null) return;
  const fromIndex = selectedElephantIndex;
  try {
    isSaving = true;
    setSaveStatus('Enregistrement…');
    renderGame();
    const nextState = await moveGameElephant(gameState, { fromIndex, toIndex });
    const wasCaptured = nextState.captured.length > gameState.captured.length;
    gameState = nextState;
    selectedPiece = null;
    selectedElephantIndex = null;
    gameMessage.textContent = wasCaptured
      ? 'Déplacement effectué : une pièce a été mangée.'
      : 'Déplacement effectué.';
    setSaveStatus('Partie sauvegardée sur cet appareil.');
  } catch (error) {
    gameMessage.textContent = error.message;
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
    selectedElephantIndex = null;
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
