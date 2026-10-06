import {
  ADVANCED_BOARD_ID,
  BOARD_ID,
  BOARD_SIZE,
  getBoardName,
  isPlacementAllowed,
  PIECES,
  PLAYERS
} from './game.js';
import {
  cancelGameGazelleMove,
  finishGameGazelleMove,
  getGazelleMoves,
  loadSavedGame,
  moveGameElephant,
  moveGameGazelle,
  moveGameLion,
  moveGameZebra,
  playGameMove,
  startGame
} from './game-api.js';

const setupPanel = document.querySelector('#setup-panel');
const rulesPanel = document.querySelector('#rules-panel');
const gamePanel = document.querySelector('#game-panel');
const rulesButton = document.querySelector('#rules-button');
const rulesTitle = document.querySelector('#rules-title');
const returnFromRulesButton = document.querySelector('#return-from-rules-button');
const boardElement = document.querySelector('#game-board');
const boardNameElement = document.querySelector('#board-name');
const boardHeading = document.querySelector('#board-heading');
const placementRuleHint = document.querySelector('#placement-rule-hint');
const gameResult = document.querySelector('#game-result');
const gameResultWinner = document.querySelector('#game-result-winner');
const gameResultReason = document.querySelector('#game-result-reason');
const turnIndicator = document.querySelector('#turn-indicator');
const gameMessage = document.querySelector('#game-message');
const saveStatus = document.querySelector('#save-status');
const restartButton = document.querySelector('#restart-button');
const newGameForm = document.querySelector('#new-game-form');
const newGameButton = document.querySelector('#new-game-button');
const playerModeSelect = document.querySelector('#player-mode');
const confirmDialog = document.querySelector('#confirm-dialog');
const confirmTitle = document.querySelector('#confirm-title');
const confirmMessage = document.querySelector('#confirm-message');
const confirmAction = document.querySelector('#confirm-action');
const capturedStock = document.querySelector('#captured-stock');
const blackPlayerZone = document.querySelector('.player-black');
const whitePlayerZone = document.querySelector('.player-white');
const gazelleMoveControls = document.querySelector('#gazelle-move-controls');
const gazelleMoveProgress = document.querySelector('#gazelle-move-progress');
const finishGazelleMoveButton = document.querySelector('#finish-gazelle-move');
const cancelGazelleMoveButton = document.querySelector('#cancel-gazelle-move');

let turnChangeAudioContext = null;
let gameState = null;
let selectedPiece = null;
let selectedBoardPiece = null;
let pendingOperation = null;
let isSaving = false;
let isAiThinking = false;
let aiTurnKey = null;
let lastRenderedCurrentPlayer = null;
let rulesReturnTarget = setupPanel;
const aiWorkerUrl = new URL('./ai-worker.js', import.meta.url);

function prepareTurnChangeSound() {
  if (!window.AudioContext) return;
  try {
    turnChangeAudioContext ??= new window.AudioContext();
    if (turnChangeAudioContext.state === 'suspended') {
      turnChangeAudioContext.resume().catch(error => {
        console.error('Impossible d’activer le son de changement de joueur.', error);
      });
    }
  } catch (error) {
    console.error('Impossible de préparer le son de changement de joueur.', error);
  }
}

function playWoodPieceSound() {
  const context = turnChangeAudioContext;
  if (!context) return;
  if (context.state !== 'running') {
    context.resume().then(() => {
      if (context.state === 'running') playWoodPieceSound();
    }).catch(error => {
      console.error('Impossible de jouer le son de changement de joueur.', error);
    });
    return;
  }

  const startTime = context.currentTime;
  const duration = 0.14;
  const noiseBuffer = context.createBuffer(1, Math.ceil(context.sampleRate * duration), context.sampleRate);
  const noiseSamples = noiseBuffer.getChannelData(0);
  for (let index = 0; index < noiseSamples.length; index += 1) {
    noiseSamples[index] = Math.random() * 2 - 1;
  }

  const noise = context.createBufferSource();
  noise.buffer = noiseBuffer;
  const filter = context.createBiquadFilter();
  filter.type = 'lowpass';
  filter.frequency.value = 1300;
  const noiseGain = context.createGain();
  noiseGain.gain.setValueAtTime(0.16, startTime);
  noiseGain.gain.exponentialRampToValueAtTime(0.001, startTime + duration);
  noise.connect(filter);
  filter.connect(noiseGain);
  noiseGain.connect(context.destination);
  noise.start(startTime);
  noise.stop(startTime + duration);

  for (const [frequency, volume] of [[185, 0.08], [345, 0.035]]) {
    const tone = context.createOscillator();
    const toneGain = context.createGain();
    tone.type = 'triangle';
    tone.frequency.setValueAtTime(frequency, startTime);
    toneGain.gain.setValueAtTime(volume, startTime);
    toneGain.gain.exponentialRampToValueAtTime(0.001, startTime + 0.11);
    tone.connect(toneGain);
    toneGain.connect(context.destination);
    tone.start(startTime);
    tone.stop(startTime + 0.11);
  }
}

function showSetup() {
  setupPanel.hidden = false;
  rulesPanel.hidden = true;
  gamePanel.hidden = true;
  rulesButton.hidden = false;
  document.querySelector('#new-game-button').hidden = false;
  restartButton.hidden = true;
  document.querySelector('#resume-button').hidden = !gameState;
}

function showGame() {
  setupPanel.hidden = true;
  rulesPanel.hidden = true;
  gamePanel.hidden = false;
  rulesButton.hidden = false;
  document.querySelector('#new-game-button').hidden = false;
  restartButton.hidden = false;
  renderGame();
}

function showRules() {
  rulesReturnTarget = gameState ? gamePanel : setupPanel;
  document.querySelector('#new-game-button').hidden = true;
  restartButton.hidden = true;
  rulesButton.hidden = true;
  setupPanel.hidden = true;
  gamePanel.hidden = true;
  rulesPanel.hidden = false;
  returnFromRulesButton.textContent = rulesReturnTarget === gamePanel
    ? 'Retour à la partie en cours'
    : 'Retour à l’accueil';
  rulesTitle.focus();
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
        isAiThinking ||
        gameState.status !== 'playing' ||
        gameState.aiPlayer === gameState.currentPlayer ||
        gameState.gazelleMove !== null ||
        gameState.currentPlayer !== player;
      button.setAttribute('aria-pressed', String(
        selectedPiece?.pieceId === piece.id &&
        selectedPiece.instanceIndex === instanceIndex &&
        gameState.currentPlayer === player
      ));
      button.setAttribute('aria-label', `${piece.name} ${instanceIndex + 1} sur ${count}`);
      button.innerHTML = `<span class="piece-icon" aria-hidden="true">${piece.icon}</span>`;
      button.addEventListener('click', () => {
        prepareTurnChangeSound();
        const isSelected = selectedPiece?.pieceId === piece.id &&
          selectedPiece.instanceIndex === instanceIndex;
        selectedPiece = isSelected ? null : { pieceId: piece.id, instanceIndex };
        selectedBoardPiece = null;
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

function selectBoardPiece(index) {
  const piece = gameState.board[index];
  selectedPiece = null;
  selectedBoardPiece = { index, pieceId: piece.pieceId };
  if (piece.pieceId === 'elephant') {
    gameMessage.textContent = 'Choisissez un animal adjacent à pousser. L’éléphant ne peut pas se déplacer sans pousser.';
  } else if (piece.pieceId === 'lion') {
    gameMessage.textContent = 'Choisissez un zèbre ou une gazelle adjacent à manger. Le lion ne peut pas se déplacer sans manger.';
  } else if (piece.pieceId === 'gazelle') {
    gameMessage.textContent = 'Choisissez une case d’atterrissage après avoir sauté par-dessus une suite d’animaux.';
  } else {
    gameMessage.textContent = 'Choisissez une case vide sur la ligne droite ou diagonale du zèbre. Les autres pièces lui barrent le passage.';
  }
  renderGame();
}

function renderBoard() {
  boardElement.replaceChildren();
  const gazelleDestinations = selectedBoardPiece?.pieceId === 'gazelle'
    ? getGazelleMoves(gameState, selectedBoardPiece.index)
    : [];
  const gazellePath = gameState.gazelleMove?.path ?? [];
  gameState.board.forEach((cell, index) => {
    const button = document.createElement('button');
    const row = Math.floor(index / BOARD_SIZE) + 1;
    const column = (index % BOARD_SIZE) + 1;
    const canMoveToCell = selectedBoardPiece !== null &&
      (index === selectedBoardPiece.index ||
          (selectedBoardPiece.pieceId === 'gazelle' &&
           gameState.gazelleMove !== null &&
           index === gameState.gazelleMove.path[0]) ||
        (selectedBoardPiece.pieceId === 'elephant'
          ? isElephantMoveAvailable(selectedBoardPiece.index, index)
          : selectedBoardPiece.pieceId === 'lion'
            ? isLionMoveAvailable(selectedBoardPiece.index, index)
            : selectedBoardPiece.pieceId === 'gazelle'
              ? gazelleDestinations.includes(index)
              : isZebraMoveAvailable(selectedBoardPiece.index, index)));
    const canSelectPiece = selectedBoardPiece === null &&
      cell?.player === gameState.currentPlayer &&
      (cell.pieceId === 'elephant' || cell.pieceId === 'lion' ||
       cell.pieceId === 'zebra' || cell.pieceId === 'gazelle');
    button.type = 'button';
    button.className = `board-cell${cell ? ` occupied ${cell.player}` : ''}${selectedBoardPiece?.index === index ? ' selected-source' : ''}${gazellePath.includes(index) ? ' jump-path' : ''}${gazelleDestinations.includes(index) ? ' jump-target' : ''}`;
    button.setAttribute('role', 'gridcell');
    button.setAttribute('aria-rowindex', String(row));
    button.setAttribute('aria-colindex', String(column));
    button.disabled = isSaving ||
      isAiThinking ||
      gameState.status !== 'playing' ||
      gameState.aiPlayer === gameState.currentPlayer ||
      (selectedPiece !== null && !cell &&
       !isPlacementAllowed(gameState.boardId, index)) ||
      !(selectedBoardPiece !== null ? canMoveToCell : canSelectPiece || !cell);

    if (cell) {
      const piece = PIECES.find(item => item.id === cell.pieceId);
      let cellLabel = `Ligne ${row}, colonne ${column} : ${piece.name}, ${PLAYERS[cell.player].name}`;
      if (selectedBoardPiece?.pieceId === 'gazelle' && gameState.gazelleMove !== null) {
        const path = gameState.gazelleMove.path;
        if (index === path[0]) {
          cellLabel += ', cliquer pour annuler le déplacement';
        } else if (index === path[path.length - 1]) {
          cellLabel += ', cliquer pour terminer le déplacement';
        }
      }
      button.setAttribute('aria-label', cellLabel);
      if (cell.player === gameState.currentPlayer &&
          (cell.pieceId === 'elephant' || cell.pieceId === 'lion' ||
           cell.pieceId === 'zebra' || cell.pieceId === 'gazelle')) {
        button.setAttribute('aria-pressed', String(selectedBoardPiece?.index === index));
      }
      button.innerHTML = `<span class="board-piece" aria-hidden="true">${piece.icon}</span><span class="board-owner">${PLAYERS[cell.player].name}</span>`;
    } else {
      const placementAllowed = isPlacementAllowed(gameState.boardId, index);
      const gazelleStart = selectedBoardPiece?.pieceId === 'gazelle' &&
        gameState.gazelleMove !== null &&
        index === gameState.gazelleMove.path[0];
      button.setAttribute('aria-label', gazelleStart
        ? `Ligne ${row}, colonne ${column} : case de départ, cliquer pour annuler le déplacement`
        : `Ligne ${row}, colonne ${column} : case vide${placementAllowed ? '' : ', pose interdite'}`);
      button.classList.toggle('placement-forbidden', !placementAllowed);
      button.innerHTML = '<span class="empty-marker" aria-hidden="true"></span>';
    }
    button.addEventListener('click', () => {
      prepareTurnChangeSound();
      handleBoardClick(index);
    });
    boardElement.append(button);
  });
}

function isZebraMoveAvailable(fromIndex, toIndex) {
  const fromRow = Math.floor(fromIndex / BOARD_SIZE);
  const fromColumn = fromIndex % BOARD_SIZE;
  const toRow = Math.floor(toIndex / BOARD_SIZE);
  const toColumn = toIndex % BOARD_SIZE;
  const rowDistance = Math.abs(toRow - fromRow);
  const columnDistance = Math.abs(toColumn - fromColumn);
  if (rowDistance !== columnDistance && rowDistance !== 0 && columnDistance !== 0) return false;
  if (gameState.board[toIndex] !== null) return false;

  const rowStep = Math.sign(toRow - fromRow);
  const columnStep = Math.sign(toColumn - fromColumn);
  let row = fromRow + rowStep;
  let column = fromColumn + columnStep;
  while (row !== toRow || column !== toColumn) {
    if (gameState.board[row * BOARD_SIZE + column] !== null) return false;
    row += rowStep;
    column += columnStep;
  }
  return rowDistance !== 0 || columnDistance !== 0;
}

function isLionMoveAvailable(fromIndex, toIndex) {
  if (!isAdjacent(fromIndex, toIndex)) return false;
  const destination = gameState.board[toIndex];
  return destination !== null &&
    (destination.pieceId === 'gazelle' ||
      destination.pieceId === 'zebra');
}

function isElephantMoveAvailable(fromIndex, toIndex) {
  if (!isAdjacent(fromIndex, toIndex) || !gameState.board[toIndex]) return false;

  const rowStep = Math.floor(toIndex / BOARD_SIZE) - Math.floor(fromIndex / BOARD_SIZE);
  const columnStep = (toIndex % BOARD_SIZE) - (fromIndex % BOARD_SIZE);
  let row = Math.floor(toIndex / BOARD_SIZE);
  let column = toIndex % BOARD_SIZE;
  while (row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE) {
    const piece = gameState.board[row * BOARD_SIZE + column];
    if (!piece) return true;
    if (piece.pieceId === 'elephant') return false;
    row += rowStep;
    column += columnStep;
  }
  return true;
}

function renderGazelleMoveControls() {
  const gazelleMove = gameState.gazelleMove;
  gazelleMoveControls.hidden = gazelleMove === null;
  if (gazelleMove === null) return;

  const jumpCount = gazelleMove.path.length - 1;
  const route = gazelleMove.path.map(index =>
    `L${Math.floor(index / BOARD_SIZE) + 1}C${index % BOARD_SIZE + 1}`
  ).join(' → ');
  gazelleMoveProgress.textContent =
    `${jumpCount} saut${jumpCount === 1 ? '' : 's'} effectué${jumpCount === 1 ? '' : 's'} · Trajet : ${route}`;
  finishGazelleMoveButton.disabled = isSaving;
  cancelGazelleMoveButton.disabled = isSaving;
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
      for (let index = 0; index < count; index += 1) {
        const item = document.createElement('span');
        item.className = 'captured-piece';
        item.setAttribute('aria-label', piece.name);
        item.title = piece.name;
        item.innerHTML = `<span aria-hidden="true">${piece.icon}</span>`;
        container.append(item);
      }
    }
  }
  capturedStock.classList.toggle('has-captured', gameState.captured.length > 0);
}

function renderGame() {
  const activePlayer = gameState.status === 'playing' ? gameState.currentPlayer : null;
  blackPlayerZone.classList.toggle('is-current-player', activePlayer === 'black');
  whitePlayerZone.classList.toggle('is-current-player', activePlayer === 'white');
  if (lastRenderedCurrentPlayer !== null &&
      activePlayer !== null &&
      activePlayer !== lastRenderedCurrentPlayer) {
    playWoodPieceSound();
  }
  lastRenderedCurrentPlayer = activePlayer;

  const currentBoardName = getBoardName(gameState.boardId);
  boardNameElement.textContent = currentBoardName;
  boardHeading.textContent = currentBoardName;
  placementRuleHint.textContent = gameState.boardId === ADVANCED_BOARD_ID
    ? 'Les quatre cases centrales sont interdites à la pose ; les déplacements sur ces cases restent autorisés.'
    : 'Les quatre coins sont interdits à la pose ; les déplacements sur ces cases restent autorisés.';
  document.querySelector('#black-title .player-position').textContent =
    gameState.aiPlayer === 'black'
      ? `— en haut · IA ${gameState.aiLevel === 'strong' ? 'forte' : 'débutante'}`
      : '— en haut';
  document.querySelector('#white-title .player-position').textContent =
    gameState.aiPlayer === 'white'
      ? `— en bas · IA ${gameState.aiLevel === 'strong' ? 'forte' : 'débutante'}`
      : '— en bas';
  renderBoard();
  renderGazelleMoveControls();
  describeStock('black');
  describeStock('white');
  renderCapturedStock();

  if (gameState.status === 'finished') {
    const winner = PLAYERS[gameState.winner].name;
    turnIndicator.textContent = `${winner} gagne`;
    const capturedByWhite = gameState.captured.filter(piece => piece.player === 'white').length;
    const capturedByBlack = gameState.captured.filter(piece => piece.player === 'black').length;
    gameResult.hidden = false;
    gameResultWinner.textContent = `Victoire de ${winner} !`;
    if (gameState.endReason === 'alignment') {
      gameResultReason.textContent = 'Quatre pièces de la même couleur sont alignées.';
    } else if (gameState.endReason === 'captures' || capturedByWhite >= 5 || capturedByBlack >= 5) {
      const loser = capturedByWhite >= 5 ? 'blanches' : 'noires';
      gameResultReason.textContent = `Cinq pièces ${loser} ont été mangées.`;
    } else if (gameState.endReason === 'no-moves') {
      gameResultReason.textContent = `${PLAYERS[gameState.currentPlayer].name} n’a plus de coup légal.`;
    } else {
      gameResultReason.textContent = 'La partie est terminée.';
    }
    gameMessage.textContent = '';
  } else {
    gameResult.hidden = true;
    turnIndicator.textContent = `Au tour de ${PLAYERS[gameState.currentPlayer].name}${
      gameState.aiPlayer === gameState.currentPlayer ? ' (IA)' : ''
    }`;
    if (!gameMessage.textContent) {
      gameMessage.textContent = selectedBoardPiece !== null
        ? selectedBoardPiece.pieceId === 'elephant'
            ? 'Choisissez un animal adjacent à pousser pour déplacer l’éléphant.'
          : selectedBoardPiece.pieceId === 'lion'
              ? 'Choisissez un zèbre ou une gazelle adjacent à manger pour déplacer le lion.'
            : selectedBoardPiece.pieceId === 'gazelle'
              ? 'Choisissez une case d’atterrissage après avoir sauté par-dessus une suite d’animaux.'
              : 'Choisissez une case vide sur la ligne droite ou diagonale du zèbre.'
        : selectedPiece
          ? 'Choisissez une case vide pour poser la pièce.'
          : `Au tour de ${PLAYERS[gameState.currentPlayer].name} : posez une pièce ou sélectionnez un éléphant, un lion, un zèbre ou une gazelle à déplacer.`;
    }
  }

  if (gameState.gazelleMove !== null && gameState.status === 'playing') {
    const currentIndex = gameState.gazelleMove.path[gameState.gazelleMove.path.length - 1];
    const nextJumps = getGazelleMoves(gameState, currentIndex);
    gameMessage.textContent = nextJumps.length > 0
      ? 'Choisissez une destination pour continuer, cliquez sur la gazelle pour terminer ou sur sa case de départ pour annuler.'
      : 'Aucun autre saut possible : cliquez sur la gazelle pour terminer ou sur sa case de départ pour annuler.';
  }

  restartButton.disabled = isAiThinking;
  newGameButton.disabled = isAiThinking;
  scheduleAiTurn();
}

function chooseAiMove(state) {
  return new Promise((resolve, reject) => {
    let worker;
    try {
      worker = new Worker(aiWorkerUrl, { type: 'module' });
    } catch (error) {
      reject(error);
      return;
    }

    const terminateWorker = () => worker.terminate();
    worker.addEventListener('message', event => {
      terminateWorker();
      if (event.data.error) {
        reject(new Error(event.data.error));
      } else {
        resolve(event.data.action);
      }
    }, { once: true });
    worker.addEventListener('error', event => {
      terminateWorker();
      reject(new Error(event.message || 'Le calcul du coup de l’IA a échoué.'));
    }, { once: true });
    try {
      worker.postMessage({ state, level: state.aiLevel });
    } catch (error) {
      terminateWorker();
      reject(error);
    }
  });
}

function scheduleAiTurn() {
  if (isSaving || isAiThinking || gamePanel.hidden ||
      gameState.status !== 'playing' ||
      gameState.aiPlayer !== gameState.currentPlayer ||
      aiTurnKey === gameState.moveCount) return;

  aiTurnKey = gameState.moveCount;
  playAiTurn(gameState.moveCount);
}

async function playAiTurn(expectedMoveCount) {
  isAiThinking = true;
  try {
    gameMessage.textContent = 'L’IA réfléchit…';
    const actionPromise = chooseAiMove(gameState);
    renderGame();
    const action = await actionPromise;
    selectedPiece = action.type === 'place'
      ? { pieceId: action.pieceId, instanceIndex: 0 }
      : null;
    selectedBoardPiece = action.type === 'move'
      ? { index: action.fromIndex, pieceId: action.pieceId }
      : null;
    const pieceName = PIECES.find(piece => piece.id === action.pieceId).name.toLowerCase();
    gameMessage.textContent = `L’IA a choisi ${pieceName}. Son coup sera joué dans 2 secondes.`;
    renderGame();
    await new Promise(resolve => window.setTimeout(resolve, 2000));
    while (gamePanel.hidden) {
      await new Promise(resolve => window.setTimeout(resolve, 100));
    }
    if (gameState.moveCount !== expectedMoveCount ||
        gameState.currentPlayer !== gameState.aiPlayer) return;

    isSaving = true;
    renderGame();
    if (action.type === 'place') {
      gameState = await playGameMove(gameState, {
        cellIndex: action.cellIndex,
        pieceId: action.pieceId
      });
    } else if (action.pieceId === 'gazelle') {
      let fromIndex = action.fromIndex;
      for (const toIndex of action.path) {
        gameState = await moveGameGazelle(gameState, { fromIndex, toIndex });
        fromIndex = toIndex;
        selectedBoardPiece = { index: toIndex, pieceId: 'gazelle' };
        renderGame();
      }
      gameState = await finishGameGazelleMove(gameState);
    } else {
      const move = action.pieceId === 'elephant'
        ? moveGameElephant
        : action.pieceId === 'lion'
          ? moveGameLion
          : moveGameZebra;
      gameState = await move(gameState, action);
    }
    selectedPiece = null;
    selectedBoardPiece = null;
    gameMessage.textContent = 'Coup de l’IA joué.';
    setSaveStatus('Partie sauvegardée sur cet appareil.');
  } catch (error) {
    setSaveStatus(`Coup de l’IA impossible : ${error.message}`, true);
  } finally {
    isSaving = false;
    isAiThinking = false;
    renderGame();
  }
}

function handleBoardClick(index) {
  const cell = gameState.board[index];
  if (gameState.gazelleMove !== null) {
    const path = gameState.gazelleMove.path;
    const startIndex = path[0];
    const currentIndex = path[path.length - 1];
    if (index === startIndex) {
      cancelGazelleMove();
    } else if (index === currentIndex) {
      finishGazelleMove();
    } else if (selectedBoardPiece?.pieceId === 'gazelle' &&
        getGazelleMoves(gameState, currentIndex).includes(index)) {
      moveSelectedPieceTo(index);
    }
    return;
  }

  if (selectedBoardPiece !== null) {
    if (index === selectedBoardPiece.index) {
      selectedBoardPiece = null;
      gameMessage.textContent = 'Déplacement annulé.';
      renderGame();
    } else if (selectedBoardPiece.pieceId === 'elephant' &&
        isElephantMoveAvailable(selectedBoardPiece.index, index)) {
      moveSelectedPieceTo(index);
    } else if (selectedBoardPiece.pieceId === 'lion' &&
        isLionMoveAvailable(selectedBoardPiece.index, index)) {
      moveSelectedPieceTo(index);
    } else if (selectedBoardPiece.pieceId === 'gazelle' &&
        getGazelleMoves(gameState, selectedBoardPiece.index).includes(index)) {
      moveSelectedPieceTo(index);
    } else if (selectedBoardPiece.pieceId === 'zebra' && !cell &&
        isZebraMoveAvailable(selectedBoardPiece.index, index)) {
      moveSelectedPieceTo(index);
    }
    return;
  }
  if (cell?.player === gameState.currentPlayer &&
      (cell.pieceId === 'elephant' || cell.pieceId === 'lion' ||
       cell.pieceId === 'zebra' || cell.pieceId === 'gazelle')) {
    selectBoardPiece(index);
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
    selectedBoardPiece = null;
    gameMessage.textContent = '';
    setSaveStatus('Partie sauvegardée sur cet appareil.');
  } catch (error) {
    setSaveStatus(error.message, true);
  } finally {
    isSaving = false;
    renderGame();
  }
}

async function moveSelectedPieceTo(toIndex) {
  if (isSaving || selectedBoardPiece === null) return;
  const { index: fromIndex, pieceId } = selectedBoardPiece;
  try {
    isSaving = true;
    setSaveStatus('Enregistrement…');
    renderGame();
    const move = pieceId === 'elephant'
      ? moveGameElephant
      : pieceId === 'lion'
        ? moveGameLion
        : pieceId === 'gazelle'
          ? moveGameGazelle
          : moveGameZebra;
    const nextState = await move(gameState, { fromIndex, toIndex });
    const isGazelleJump = pieceId === 'gazelle';
    const wasCaptured = !isGazelleJump &&
      nextState.captured.length > gameState.captured.length;
    gameState = nextState;
    if (isGazelleJump) {
      selectedBoardPiece = { index: toIndex, pieceId };
      gameMessage.textContent = 'Saut effectué.';
    } else {
      selectedPiece = null;
      selectedBoardPiece = null;
      gameMessage.textContent = wasCaptured
        ? 'Déplacement effectué : une pièce a été mangée.'
        : 'Déplacement effectué.';
    }
    setSaveStatus('Partie sauvegardée sur cet appareil.');
  } catch (error) {
    gameMessage.textContent = error.message;
    setSaveStatus(error.message, true);
  } finally {
    isSaving = false;
    renderGame();
  }
}

async function finishGazelleMove() {
  if (isSaving || gameState.gazelleMove === null) return;
  try {
    isSaving = true;
    setSaveStatus('Enregistrement…');
    renderGame();
    gameState = await finishGameGazelleMove(gameState);
    selectedBoardPiece = null;
    gameMessage.textContent = '';
    setSaveStatus('Partie sauvegardée sur cet appareil.');
  } catch (error) {
    gameMessage.textContent = error.message;
    setSaveStatus(error.message, true);
  } finally {
    isSaving = false;
    renderGame();
  }
}

async function cancelGazelleMove() {
  if (isSaving || gameState.gazelleMove === null) return;
  try {
    isSaving = true;
    setSaveStatus('Enregistrement…');
    renderGame();
    gameState = await cancelGameGazelleMove(gameState);
    selectedBoardPiece = null;
    gameMessage.textContent = 'Déplacement de la gazelle annulé. Vous pouvez choisir une autre action.';
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
    const nextState = await startGame(action.boardId, action.aiPlayer, action.aiLevel);
    gameState = nextState;
    aiTurnKey = null;
    lastRenderedCurrentPlayer = null;
    selectedPiece = null;
    selectedBoardPiece = null;
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
rulesButton.addEventListener('click', showRules);
returnFromRulesButton.addEventListener('click', () => {
  if (rulesReturnTarget === gamePanel) {
    showGame();
  } else {
    showSetup();
  }
});

newGameForm.addEventListener('submit', event => {
  event.preventDefault();
  prepareTurnChangeSound();
  const action = {
    type: 'new',
    boardId: document.querySelector('#board-choice').value,
    aiPlayer: playerModeSelect.value === 'none' ? null : playerModeSelect.value.split('-')[0],
    aiLevel: playerModeSelect.value === 'none' ? null : playerModeSelect.value.split('-')[1]
  };
  if (gameState) {
    requestConfirmation(action);
  } else {
    beginGame(action);
  }
});

restartButton.addEventListener('click', () => {
  if (gameState) {
    requestConfirmation({
      type: 'restart',
      boardId: gameState.boardId,
      aiPlayer: gameState.aiPlayer,
      aiLevel: gameState.aiLevel
    });
  }
});

document.querySelector('#resume-button').addEventListener('click', () => {
  prepareTurnChangeSound();
  showGame();
});
finishGazelleMoveButton.addEventListener('click', () => {
  prepareTurnChangeSound();
  finishGazelleMove();
});
cancelGazelleMoveButton.addEventListener('click', cancelGazelleMove);

async function initialize() {
  try {
    const savedGame = await loadSavedGame();
    gameState = savedGame;
    if (gameState) {
      if (gameState.gazelleMove !== null) {
        const path = gameState.gazelleMove.path;
        selectedBoardPiece = {
          index: path[path.length - 1],
          pieceId: 'gazelle'
        };
      }
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
