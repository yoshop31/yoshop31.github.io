export const BOARD_ID = 'savanna-classic';
export const ADVANCED_BOARD_ID = 'savanna-advanced';
const LEGACY_BOARD_ID = 'savanna-4x4';
export const BOARD_SIZE = 4;
export const PIECES = [
  { id: 'elephant', name: 'Éléphant', icon: '🐘' },
  { id: 'lion', name: 'Lion', icon: '🦁' },
  { id: 'zebra', name: 'Zèbre', icon: '🦓' },
  { id: 'gazelle', name: 'Gazelle', icon: '🦌' }
];

export const PLAYERS = {
  black: { name: 'Noir' },
  white: { name: 'Blanc' }
};

const DIRECTIONS = [
  { row: -1, column: 0 },
  { row: 1, column: 0 },
  { row: 0, column: -1 },
  { row: 0, column: 1 }
];

const GAZELLE_DIRECTIONS = [
  ...DIRECTIONS,
  { row: -1, column: -1 },
  { row: -1, column: 1 },
  { row: 1, column: -1 },
  { row: 1, column: 1 }
];

const FORBIDDEN_PLACEMENTS = {
  [BOARD_ID]: [0, 3, 12, 15],
  [ADVANCED_BOARD_ID]: [5, 6, 9, 10]
};

function otherPlayer(player) {
  return player === 'white' ? 'black' : 'white';
}

function normalizeBoardId(boardId) {
  return boardId === LEGACY_BOARD_ID ? BOARD_ID : boardId;
}

export function getBoardName(boardId) {
  const normalizedBoardId = normalizeBoardId(boardId);
  if (normalizedBoardId === BOARD_ID) return 'Savane — classique';
  if (normalizedBoardId === ADVANCED_BOARD_ID) return 'Savane — avancé';
  throw new Error('Ce plateau n’est pas disponible.');
}

export function isPlacementAllowed(boardId, cellIndex) {
  const forbidden = FORBIDDEN_PLACEMENTS[normalizeBoardId(boardId)];
  if (!forbidden) throw new Error('Ce plateau n’est pas disponible.');
  return !forbidden.includes(cellIndex);
}

function isInsideBoard(row, column) {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
}

function alignedPlayers(board) {
  const winners = new Set();
  const directions = [
    { row: 0, column: 1 },
    { row: 1, column: 0 },
    { row: 1, column: 1 },
    { row: 1, column: -1 }
  ];

  for (let row = 0; row < BOARD_SIZE; row += 1) {
    for (let column = 0; column < BOARD_SIZE; column += 1) {
      const piece = board[row * BOARD_SIZE + column];
      if (!piece) continue;

      for (const direction of directions) {
        const endRow = row + direction.row * (BOARD_SIZE - 1);
        const endColumn = column + direction.column * (BOARD_SIZE - 1);
        if (!isInsideBoard(endRow, endColumn)) continue;

        let aligned = true;
        for (let step = 1; step < BOARD_SIZE; step += 1) {
          const index = (row + direction.row * step) * BOARD_SIZE +
            column + direction.column * step;
          if (board[index]?.player !== piece.player) {
            aligned = false;
            break;
          }
        }
        if (aligned) winners.add(piece.player);
      }
    }
  }

  return winners;
}

function canMoveElephant(state, fromIndex, toIndex, player) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= state.board.length ||
      toIndex < 0 || toIndex >= state.board.length) return false;
  const elephant = state.board[fromIndex];
  if (!elephant || elephant.player !== player || elephant.pieceId !== 'elephant') return false;

  const fromRow = Math.floor(fromIndex / BOARD_SIZE);
  const fromColumn = fromIndex % BOARD_SIZE;
  const toRow = Math.floor(toIndex / BOARD_SIZE);
  const toColumn = toIndex % BOARD_SIZE;
  const rowStep = toRow - fromRow;
  const columnStep = toColumn - fromColumn;
  if (Math.abs(rowStep) + Math.abs(columnStep) !== 1) return false;

  if (!state.board[toIndex]) return false;

  let row = toRow;
  let column = toColumn;
  while (isInsideBoard(row, column)) {
    const piece = state.board[row * BOARD_SIZE + column];
    if (!piece) return true;
    if (piece.pieceId === 'elephant') return false;
    row += rowStep;
    column += columnStep;
  }
  return true;
}

function canMoveLion(state, fromIndex, toIndex, player) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= state.board.length ||
      toIndex < 0 || toIndex >= state.board.length) return false;
  const lion = state.board[fromIndex];
  if (!lion || lion.player !== player || lion.pieceId !== 'lion') return false;

  const fromRow = Math.floor(fromIndex / BOARD_SIZE);
  const fromColumn = fromIndex % BOARD_SIZE;
  const toRow = Math.floor(toIndex / BOARD_SIZE);
  const toColumn = toIndex % BOARD_SIZE;
  if (Math.abs(fromRow - toRow) + Math.abs(fromColumn - toColumn) !== 1) return false;

  const destination = state.board[toIndex];
  return destination !== null &&
    (destination.pieceId === 'gazelle' ||
      destination.pieceId === 'zebra');
}

function canJumpGazelle(state, fromIndex, toIndex, player) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= state.board.length ||
      toIndex < 0 || toIndex >= state.board.length) return false;
  const gazelle = state.board[fromIndex];
  if (!gazelle || gazelle.player !== player || gazelle.pieceId !== 'gazelle' ||
      state.board[toIndex] !== null) return false;

  const fromRow = Math.floor(fromIndex / BOARD_SIZE);
  const fromColumn = fromIndex % BOARD_SIZE;
  const toRow = Math.floor(toIndex / BOARD_SIZE);
  const toColumn = toIndex % BOARD_SIZE;
  const rowDistance = toRow - fromRow;
  const columnDistance = toColumn - fromColumn;
  const rowStep = Math.sign(rowDistance);
  const columnStep = Math.sign(columnDistance);
  if (rowDistance === 0 && columnDistance === 0) return false;
  if (rowDistance !== 0 && columnDistance !== 0 &&
      Math.abs(rowDistance) !== Math.abs(columnDistance)) return false;

  let row = fromRow + rowStep;
  let column = fromColumn + columnStep;
  let jumpedAnimal = false;
  while (isInsideBoard(row, column)) {
    const index = row * BOARD_SIZE + column;
    if (state.board[index] === null) return jumpedAnimal && index === toIndex;
    jumpedAnimal = true;
    row += rowStep;
    column += columnStep;
  }
  return false;
}

function canMoveZebra(state, fromIndex, toIndex, player) {
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= state.board.length ||
      toIndex < 0 || toIndex >= state.board.length) return false;
  const zebra = state.board[fromIndex];
  if (!zebra || zebra.player !== player || zebra.pieceId !== 'zebra' ||
      state.board[toIndex] !== null) return false;

  const rowStep = Math.sign(Math.floor(toIndex / BOARD_SIZE) - Math.floor(fromIndex / BOARD_SIZE));
  const columnStep = Math.sign((toIndex % BOARD_SIZE) - (fromIndex % BOARD_SIZE));
  const rowDistance = Math.abs(Math.floor(toIndex / BOARD_SIZE) - Math.floor(fromIndex / BOARD_SIZE));
  const columnDistance = Math.abs((toIndex % BOARD_SIZE) - (fromIndex % BOARD_SIZE));
  if (rowDistance === 0 && columnDistance === 0) return false;
  if (rowDistance !== 0 && columnDistance !== 0 && rowDistance !== columnDistance) return false;

  let row = Math.floor(fromIndex / BOARD_SIZE) + rowStep;
  let column = fromIndex % BOARD_SIZE + columnStep;
  while (row !== Math.floor(toIndex / BOARD_SIZE) || column !== toIndex % BOARD_SIZE) {
    if (state.board[row * BOARD_SIZE + column] !== null) return false;
    row += rowStep;
    column += columnStep;
  }
  return true;
}

function advanceTurn(state, changes, player) {
  const nextPlayer = otherPlayer(player);
  const nextState = {
    ...state,
    ...changes,
    moveCount: state.moveCount + 1,
    currentPlayer: nextPlayer,
    status: 'playing',
    winner: null,
    endReason: null,
    gazelleMove: null
  };
  const aligned = alignedPlayers(nextState.board);
  const capturedByWhite = nextState.captured.filter(piece => piece.player === 'white').length;
  const capturedByBlack = nextState.captured.filter(piece => piece.player === 'black').length;

  if (aligned.has(player) || aligned.has(nextPlayer)) {
    nextState.status = 'finished';
    nextState.winner = aligned.has(player) ? player : nextPlayer;
    nextState.endReason = 'alignment';
  } else if (capturedByWhite >= 5) {
    nextState.status = 'finished';
    nextState.winner = 'black';
    nextState.endReason = 'captures';
  } else if (capturedByBlack >= 5) {
    nextState.status = 'finished';
    nextState.winner = 'white';
    nextState.endReason = 'captures';
  } else if (!hasLegalAction(nextState, nextPlayer)) {
    nextState.status = 'finished';
    nextState.winner = player;
    nextState.endReason = 'no-moves';
  }

  return nextState;
}

function isValidPlayerType(playerType) {
  return playerType === 'human' ||
    (typeof playerType === 'string' && /^[a-z][a-z0-9-]*$/.test(playerType));
}

function normalizePlayers(playersOrAiPlayer, aiLevel) {
  if (playersOrAiPlayer === null || playersOrAiPlayer === undefined) {
    return { black: 'human', white: 'human' };
  }
  if (typeof playersOrAiPlayer === 'string') {
    if (playersOrAiPlayer !== 'black' && playersOrAiPlayer !== 'white') {
      throw new Error('Le joueur IA sélectionné n’est pas disponible.');
    }
    const players = { black: 'human', white: 'human' };
    players[playersOrAiPlayer] = aiLevel ?? 'beginner';
    return players;
  }
  return playersOrAiPlayer;
}

export function createGame(
  boardId = BOARD_ID,
  playersOrAiPlayer = null,
  aiLevel,
  llmModel = 'gpt-oss:20b'
) {
  boardId = normalizeBoardId(boardId);
  if (!Object.prototype.hasOwnProperty.call(FORBIDDEN_PLACEMENTS, boardId)) {
    throw new Error('Ce plateau n’est pas disponible.');
  }
  const players = normalizePlayers(playersOrAiPlayer, aiLevel);
  if (!players || typeof players !== 'object' ||
      !isValidPlayerType(players.black) || !isValidPlayerType(players.white)) {
    throw new Error('Les types de joueurs sélectionnés ne sont pas disponibles.');
  }
  if (typeof llmModel !== 'string' || !/^[a-zA-Z0-9._:/-]{1,200}$/.test(llmModel)) {
    throw new Error('Le modèle Ollama sélectionné n’est pas valide.');
  }

  const stock = Object.fromEntries(PIECES.map(piece => [piece.id, 2]));

  return {
    version: 9,
    boardId,
    players: { black: players.black, white: players.white },
    llmModel,
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    stocks: {
      black: { ...stock },
      white: { ...stock }
    },
    captured: [],
    currentPlayer: 'white',
    status: 'playing',
    winner: null,
    endReason: null,
    gazelleMove: null,
    moveCount: 0
  };
}

export function playMove(state, { cellIndex, pieceId }) {
  if (!isGameState(state) || state.status !== 'playing') {
    throw new Error('Cette partie ne peut pas recevoir de coup.');
  }
  if (state.gazelleMove !== null) {
    throw new Error('Terminez d’abord le déplacement de la gazelle.');
  }
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= state.board.length) {
    throw new Error('Cette case n’existe pas.');
  }
  if (state.board[cellIndex] !== null) {
    throw new Error('Cette case est déjà occupée.');
  }
  if (!isPlacementAllowed(state.boardId, cellIndex)) {
    throw new Error('Vous ne pouvez pas poser de pièce sur cette case avec ce plateau.');
  }
  if (!PIECES.some(piece => piece.id === pieceId)) {
    throw new Error('Cette pièce n’existe pas.');
  }

  const player = state.currentPlayer;
  if (state.stocks[player][pieceId] < 1) {
    throw new Error('Cette pièce n’est plus dans le stock.');
  }

  const board = state.board.slice();
  board[cellIndex] = { player, pieceId };
  const stocks = {
    ...state.stocks,
    [player]: {
      ...state.stocks[player],
      [pieceId]: state.stocks[player][pieceId] - 1
    }
  };

  return advanceTurn(state, { board, stocks }, player);
}

export function moveElephant(state, { fromIndex, toIndex }) {
  if (!isGameState(state) || state.status !== 'playing') {
    throw new Error('Cette partie ne peut pas recevoir de coup.');
  }
  if (state.gazelleMove !== null) {
    throw new Error('Terminez d’abord le déplacement de la gazelle.');
  }
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= state.board.length ||
      toIndex < 0 || toIndex >= state.board.length) {
    throw new Error('Cette case n’existe pas.');
  }

  const player = state.currentPlayer;
  const elephant = state.board[fromIndex];
  if (!elephant || elephant.player !== player || elephant.pieceId !== 'elephant') {
    throw new Error('Vous devez sélectionner un de vos éléphants.');
  }

  if (!canMoveElephant(state, fromIndex, toIndex, player)) {
    if (Math.abs(Math.floor(toIndex / BOARD_SIZE) - Math.floor(fromIndex / BOARD_SIZE)) +
        Math.abs((toIndex % BOARD_SIZE) - (fromIndex % BOARD_SIZE)) !== 1) {
      throw new Error('L’éléphant se déplace d’une case, horizontalement ou verticalement.');
    }
    if (!state.board[toIndex]) {
      throw new Error('L’éléphant doit pousser au moins un animal pour se déplacer.');
    }
    const rowStep = Math.floor(toIndex / BOARD_SIZE) - Math.floor(fromIndex / BOARD_SIZE);
    const columnStep = (toIndex % BOARD_SIZE) - (fromIndex % BOARD_SIZE);
    let row = Math.floor(toIndex / BOARD_SIZE);
    let column = toIndex % BOARD_SIZE;
    while (isInsideBoard(row, column)) {
      const piece = state.board[row * BOARD_SIZE + column];
      if (!piece) break;
      if (piece.pieceId === 'elephant') {
        throw new Error('Un éléphant ne peut pas pousser un autre éléphant.');
      }
      row += rowStep;
      column += columnStep;
    }
    throw new Error('Ce déplacement ne peut pas être effectué.');
  }

  const fromRow = Math.floor(fromIndex / BOARD_SIZE);
  const fromColumn = fromIndex % BOARD_SIZE;
  const toRow = Math.floor(toIndex / BOARD_SIZE);
  const toColumn = toIndex % BOARD_SIZE;
  const rowStep = toRow - fromRow;
  const columnStep = toColumn - fromColumn;

  const board = state.board.slice();
  const pushed = [];
  let row = toRow;
  let column = toColumn;
  while (isInsideBoard(row, column)) {
    const index = row * BOARD_SIZE + column;
    const piece = board[index];
    if (!piece) break;
    if (piece.pieceId === 'elephant') {
      throw new Error('Un éléphant ne peut pas pousser un autre éléphant.');
    }
    pushed.push({ index, piece });
    row += rowStep;
    column += columnStep;
  }

  const captured = state.captured.slice();
  if (!isInsideBoard(row, column)) {
    const removedPiece = pushed.pop();
    if (removedPiece) captured.push(removedPiece.piece);
  } else if (pushed.length > 0) {
    const endIndex = row * BOARD_SIZE + column;
    const lastPiece = pushed[pushed.length - 1];
    board[endIndex] = lastPiece.piece;
  }

  for (let index = pushed.length - 1; index >= 0; index -= 1) {
    const destination = pushed[index].index + rowStep * BOARD_SIZE + columnStep;
    board[destination] = pushed[index].piece;
  }

  board[fromIndex] = null;
  board[toIndex] = elephant;

  return advanceTurn(state, { board, captured }, player);
}

export function moveZebra(state, { fromIndex, toIndex }) {
  if (!isGameState(state) || state.status !== 'playing') {
    throw new Error('Cette partie ne peut pas recevoir de coup.');
  }
  if (state.gazelleMove !== null) {
    throw new Error('Terminez d’abord le déplacement de la gazelle.');
  }
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= state.board.length ||
      toIndex < 0 || toIndex >= state.board.length) {
    throw new Error('Cette case n’existe pas.');
  }
  const player = state.currentPlayer;
  const zebra = state.board[fromIndex];
  if (!zebra || zebra.player !== player || zebra.pieceId !== 'zebra') {
    throw new Error('Vous devez sélectionner un de vos zèbres.');
  }
  if (state.board[toIndex] !== null) {
    throw new Error('Le zèbre ne peut se déplacer que sur une case vide.');
  }
  if (!canMoveZebra(state, fromIndex, toIndex, player)) {
    throw new Error('Le zèbre se déplace en ligne droite ou en diagonale et ne peut pas franchir une autre pièce.');
  }

  const board = state.board.slice();
  board[fromIndex] = null;
  board[toIndex] = zebra;
  return advanceTurn(state, { board }, player);
}

export function moveLion(state, { fromIndex, toIndex }) {
  if (!isGameState(state) || state.status !== 'playing') {
    throw new Error('Cette partie ne peut pas recevoir de coup.');
  }
  if (state.gazelleMove !== null) {
    throw new Error('Terminez d’abord le déplacement de la gazelle.');
  }
  if (!Number.isInteger(fromIndex) || !Number.isInteger(toIndex) ||
      fromIndex < 0 || fromIndex >= state.board.length ||
      toIndex < 0 || toIndex >= state.board.length) {
    throw new Error('Cette case n’existe pas.');
  }

  const player = state.currentPlayer;
  const lion = state.board[fromIndex];
  if (!lion || lion.player !== player || lion.pieceId !== 'lion') {
    throw new Error('Vous devez sélectionner un de vos lions.');
  }
  if (!canMoveLion(state, fromIndex, toIndex, player)) {
    throw new Error('Le lion doit manger un zèbre ou une gazelle adjacent pour se déplacer.');
  }

  const board = state.board.slice();
  const captured = state.captured.slice();
  const prey = board[toIndex];
  if (prey) captured.push(prey);
  board[fromIndex] = null;
  board[toIndex] = lion;
  return advanceTurn(state, { board, captured }, player);
}

export function getGazelleJumpDestinations(state, fromIndex) {
  if (!isGameState(state)) {
    throw new Error('Cette partie ne peut pas recevoir de coup.');
  }
  if (!Number.isInteger(fromIndex) || fromIndex < 0 || fromIndex >= state.board.length) {
    throw new Error('Cette case n’existe pas.');
  }
  const gazelle = state.board[fromIndex];
  if (!gazelle || gazelle.player !== state.currentPlayer || gazelle.pieceId !== 'gazelle') {
    return [];
  }

  const destinations = [];
  for (const direction of GAZELLE_DIRECTIONS) {
    let row = Math.floor(fromIndex / BOARD_SIZE) + direction.row;
    let column = fromIndex % BOARD_SIZE + direction.column;
    let jumpedAnimal = false;
    while (isInsideBoard(row, column)) {
      const index = row * BOARD_SIZE + column;
      if (state.board[index] === null) {
        if (jumpedAnimal) destinations.push(index);
        break;
      }
      jumpedAnimal = true;
      row += direction.row;
      column += direction.column;
    }
  }
  return destinations;
}

export function moveGazelle(state, { fromIndex, toIndex }) {
  if (!isGameState(state) || state.status !== 'playing') {
    throw new Error('Cette partie ne peut pas recevoir de coup.');
  }
  const player = state.currentPlayer;
  const gazelleMove = state.gazelleMove;
  if (gazelleMove && fromIndex !== gazelleMove.path[gazelleMove.path.length - 1]) {
    throw new Error('La gazelle doit continuer son déplacement depuis sa case actuelle.');
  }

  const gazelle = state.board[fromIndex];
  if (!gazelle || gazelle.player !== player || gazelle.pieceId !== 'gazelle') {
    throw new Error('Vous devez sélectionner une de vos gazelles.');
  }
  if (!canJumpGazelle(state, fromIndex, toIndex, player)) {
    throw new Error('La gazelle doit sauter par-dessus une suite d’animaux et atterrir sur la case vide juste après.');
  }

  const board = state.board.slice();
  board[fromIndex] = null;
  board[toIndex] = gazelle;
  const path = gazelleMove ? gazelleMove.path : [fromIndex];
  return {
    ...state,
    board,
    gazelleMove: {
      player,
      path: [...path, toIndex]
    }
  };
}

export function finishGazelleMove(state) {
  if (!isGameState(state) || state.status !== 'playing' || state.gazelleMove === null) {
    throw new Error('Aucun déplacement de gazelle n’est à terminer.');
  }
  return advanceTurn(state, { gazelleMove: null }, state.currentPlayer);
}

export function cancelGazelleMove(state) {
  if (!isGameState(state) || state.status !== 'playing' || state.gazelleMove === null) {
    throw new Error('Aucun déplacement de gazelle n’est à annuler.');
  }

  const path = state.gazelleMove.path;
  const startIndex = path[0];
  const currentIndex = path[path.length - 1];
  const gazelle = state.board[currentIndex];
  if (state.board[startIndex] !== null && startIndex !== currentIndex) {
    throw new Error('Impossible de restaurer la position initiale de la gazelle.');
  }

  const board = state.board.slice();
  board[currentIndex] = null;
  board[startIndex] = gazelle;
  return {
    ...state,
    board,
    gazelleMove: null
  };
}

export function hasLegalAction(state, player = state.currentPlayer) {
  if (state.status !== 'playing') return false;
  if (state.gazelleMove !== null) return player === state.currentPlayer;
  const hasEmptyCell = state.board.some((cell, index) =>
    cell === null && isPlacementAllowed(state.boardId, index)
  );
  if (hasEmptyCell && Object.values(state.stocks[player]).some(count => count > 0)) {
    return true;
  }

  for (let fromIndex = 0; fromIndex < state.board.length; fromIndex += 1) {
    const piece = state.board[fromIndex];
    if (!piece || piece.player !== player) continue;

    const fromRow = Math.floor(fromIndex / BOARD_SIZE);
    const fromColumn = fromIndex % BOARD_SIZE;
    if (piece.pieceId === 'elephant') {
      for (const direction of DIRECTIONS) {
        const toRow = fromRow + direction.row;
        const toColumn = fromColumn + direction.column;
        if (!isInsideBoard(toRow, toColumn)) continue;
        if (canMoveElephant(state, fromIndex, toRow * BOARD_SIZE + toColumn, player)) return true;
      }
    } else if (piece.pieceId === 'lion') {
      for (const direction of DIRECTIONS) {
        const toRow = fromRow + direction.row;
        const toColumn = fromColumn + direction.column;
        if (!isInsideBoard(toRow, toColumn)) continue;
        if (canMoveLion(state, fromIndex, toRow * BOARD_SIZE + toColumn, player)) return true;
      }
    } else if (piece.pieceId === 'zebra') {
      for (let toIndex = 0; toIndex < state.board.length; toIndex += 1) {
        if (canMoveZebra(state, fromIndex, toIndex, player)) return true;
      }
    } else if (piece.pieceId === 'gazelle') {
      for (let toIndex = 0; toIndex < state.board.length; toIndex += 1) {
        if (canJumpGazelle(state, fromIndex, toIndex, player)) return true;
      }
    }
  }
  return false;
}

export function getLegalActions(state, player = state.currentPlayer) {
  if (!isGameState(state) || state.status !== 'playing' ||
      state.gazelleMove !== null ||
      (player !== 'white' && player !== 'black')) return [];

  const actions = [];
  const stock = state.stocks[player];
  for (let cellIndex = 0; cellIndex < state.board.length; cellIndex += 1) {
    if (state.board[cellIndex] !== null || !isPlacementAllowed(state.boardId, cellIndex)) continue;
    for (const piece of PIECES) {
      if (stock[piece.id] > 0) actions.push({ type: 'place', cellIndex, pieceId: piece.id });
    }
  }

  for (let fromIndex = 0; fromIndex < state.board.length; fromIndex += 1) {
    const piece = state.board[fromIndex];
    if (!piece || piece.player !== player) continue;

    if (piece.pieceId === 'elephant' || piece.pieceId === 'lion') {
      const fromRow = Math.floor(fromIndex / BOARD_SIZE);
      const fromColumn = fromIndex % BOARD_SIZE;
      for (const direction of DIRECTIONS) {
        const toRow = fromRow + direction.row;
        const toColumn = fromColumn + direction.column;
        if (!isInsideBoard(toRow, toColumn)) continue;
        const toIndex = toRow * BOARD_SIZE + toColumn;
        const canMove = piece.pieceId === 'elephant'
          ? canMoveElephant(state, fromIndex, toIndex, player)
          : canMoveLion(state, fromIndex, toIndex, player);
        if (canMove) actions.push({ type: 'move', pieceId: piece.pieceId, fromIndex, toIndex });
      }
    } else if (piece.pieceId === 'zebra') {
      for (let toIndex = 0; toIndex < state.board.length; toIndex += 1) {
        if (canMoveZebra(state, fromIndex, toIndex, player)) {
          actions.push({ type: 'move', pieceId: piece.pieceId, fromIndex, toIndex });
        }
      }
    } else if (piece.pieceId === 'gazelle') {
      const addGazelleRoutes = (currentState, currentIndex, path, visited) => {
        for (const toIndex of getGazelleJumpDestinations(currentState, currentIndex)) {
          if (visited.has(toIndex)) continue;
          const nextState = moveGazelle(currentState, {
            fromIndex: currentIndex,
            toIndex
          });
          const nextPath = [...path, toIndex];
          actions.push({
            type: 'move',
            pieceId: 'gazelle',
            fromIndex,
            path: nextPath
          });
          addGazelleRoutes(nextState, toIndex, nextPath, new Set([...visited, toIndex]));
        }
      };
      addGazelleRoutes(state, fromIndex, [], new Set([fromIndex]));
    }
  }

  return actions;
}

function isValidPiece(piece) {
  return piece &&
    (piece.player === 'black' || piece.player === 'white') &&
    PIECES.some(definition => definition.id === piece.pieceId);
}

export function isGameState(value) {
  if (!value || value.version !== 9 ||
      !Object.prototype.hasOwnProperty.call(FORBIDDEN_PLACEMENTS, value.boardId)) return false;
  if (!value.players || typeof value.players !== 'object' ||
      !isValidPlayerType(value.players.black) ||
      !isValidPlayerType(value.players.white)) return false;
  if (typeof value.llmModel !== 'string' ||
      !/^[a-zA-Z0-9._:/-]{1,200}$/.test(value.llmModel)) return false;
  if (!Array.isArray(value.board) || value.board.length !== BOARD_SIZE * BOARD_SIZE) return false;
  if (value.currentPlayer !== 'white' && value.currentPlayer !== 'black') return false;
  if (value.status !== 'playing' && value.status !== 'finished') return false;
  if (value.status === 'playing' && (value.winner !== null || value.endReason !== null)) return false;
  if (value.status === 'finished' &&
      (!['alignment', 'captures', 'no-moves', 'legacy'].includes(value.endReason) ||
       (value.winner !== 'black' && value.winner !== 'white'))) return false;
  if (value.gazelleMove !== null) {
    if (value.status !== 'playing' || !value.gazelleMove ||
        value.gazelleMove.player !== value.currentPlayer ||
        !Array.isArray(value.gazelleMove.path) || value.gazelleMove.path.length < 2 ||
        !value.gazelleMove.path.every(index =>
          Number.isInteger(index) && index >= 0 && index < value.board.length
        )) return false;
    const gazelleIndex = value.gazelleMove.path[value.gazelleMove.path.length - 1];
    const gazelle = value.board[gazelleIndex];
    if (!gazelle || gazelle.player !== value.currentPlayer || gazelle.pieceId !== 'gazelle') return false;
  }
  if (!Number.isInteger(value.moveCount) || value.moveCount < 0) return false;
  if (!Array.isArray(value.captured) || !value.captured.every(isValidPiece)) return false;
  if (value.board.filter(Boolean).length + value.captured.length > value.moveCount) return false;
  if (!value.stocks || typeof value.stocks !== 'object' ||
      !value.stocks.black || typeof value.stocks.black !== 'object' ||
      !value.stocks.white || typeof value.stocks.white !== 'object') return false;

  for (const player of ['black', 'white']) {
    for (const piece of PIECES) {
      const count = value.stocks[player][piece.id];
      const placed = value.board.filter(cell =>
        cell && cell.player === player && cell.pieceId === piece.id
      ).length;
      const captured = value.captured.filter(item =>
        item.player === player && item.pieceId === piece.id
      ).length;
      if (!Number.isInteger(count) || count < 0 || count > 2 || count + placed + captured !== 2) {
        return false;
      }
    }
  }

  const expectedPlayer = value.moveCount % 2 === 0 ? 'white' : 'black';
  if (value.status === 'playing' && value.currentPlayer !== expectedPlayer) return false;
  if (!value.board.every(cell => cell === null || isValidPiece(cell))) return false;

  const capturedByWhite = value.captured.filter(piece => piece.player === 'white').length;
  const capturedByBlack = value.captured.filter(piece => piece.player === 'black').length;
  if (value.status === 'playing' &&
      (capturedByWhite >= 5 || capturedByBlack >= 5 ||
       (value.gazelleMove === null && alignedPlayers(value.board).size > 0) ||
       !hasLegalAction(value, value.currentPlayer))) return false;
  if (value.status === 'finished') {
    if (value.endReason === 'alignment' && !alignedPlayers(value.board).has(value.winner)) return false;
    if (value.endReason === 'captures' &&
        !((capturedByWhite >= 5 && value.winner === 'black') ||
          (capturedByBlack >= 5 && value.winner === 'white'))) return false;
    if (value.endReason === 'no-moves' &&
        (hasLegalAction(value, value.currentPlayer) || value.winner !== otherPlayer(value.currentPlayer))) return false;
  }
  return true;
}

export function migrateGameState(value) {
  if (isGameState(value)) return value;
  if (!value || ![1, 2, 3, 4, 5, 6, 7, 8].includes(value.version) ||
      ![LEGACY_BOARD_ID, BOARD_ID, ADVANCED_BOARD_ID].includes(value.boardId) ||
      !Array.isArray(value.board) || value.board.length !== BOARD_SIZE * BOARD_SIZE) {
    return null;
  }
  if (value.status !== 'playing' && value.status !== 'finished') {
    return null;
  }

  if (value.version === 1) {
    const placedCount = value.board.filter(Boolean).length;
    if (value.moveCount !== placedCount ||
        (value.status === 'finished') !== (placedCount === value.board.length)) return null;
    const currentPlayer = value.status === 'finished'
      ? value.moveCount % 2 === 0 ? 'white' : 'black'
      : value.currentPlayer;
    const migratedLegacy = {
      ...value,
      version: 9,
      boardId: normalizeBoardId(value.boardId),
      players: { black: 'human', white: 'human' },
      llmModel: 'gpt-oss:20b',
      captured: [],
      gazelleMove: null,
      currentPlayer,
      winner: value.status === 'finished' ? otherPlayer(currentPlayer) : null,
      endReason: value.status === 'finished' ? 'legacy' : null
    };
    return isGameState(migratedLegacy) ? migratedLegacy : null;
  }

  const captured = Array.isArray(value.captured) ? value.captured : [];
  const aligned = alignedPlayers(value.board);
  const lastPlayer = otherPlayer(value.currentPlayer);
  const migratedWinner = aligned.has(lastPlayer)
    ? lastPlayer
    : aligned.values().next().value;
  const gazelleMove = value.version === 4 ? value.gazelleMove ?? null : null;
  const resumedAfterWin = value.status === 'playing' && aligned.size > 0 && gazelleMove === null;
  const migratedPlayer = value.version >= 6 &&
    (value.aiPlayer === 'black' || value.aiPlayer === 'white')
    ? value.aiLevel === 'strong' || value.aiLevel === 'ultra'
      ? value.aiLevel
      : 'beginner'
    : 'human';
  const players = value.version === 8 &&
    value.players &&
    isValidPlayerType(value.players.black) &&
    isValidPlayerType(value.players.white)
    ? { black: value.players.black, white: value.players.white }
    : { black: 'human', white: 'human' };
  if (value.version < 8 && value.version >= 6 &&
      (value.aiPlayer === 'black' || value.aiPlayer === 'white')) {
    players[value.aiPlayer] = migratedPlayer;
  }
  const legacyState = { ...value };
  delete legacyState.aiPlayer;
  delete legacyState.aiLevel;
  const migrated = {
    ...legacyState,
    version: 9,
    boardId: normalizeBoardId(value.boardId),
    players,
    llmModel: value.version === 8 && typeof value.llmModel === 'string'
      ? value.llmModel
      : 'gpt-oss:20b',
    status: resumedAfterWin ? 'finished' : value.status,
    winner: resumedAfterWin ? migratedWinner : value.winner,
    captured,
    gazelleMove,
    endReason: resumedAfterWin
      ? 'alignment'
      : value.status === 'playing'
      ? null
      : value.version >= 3 && ['alignment', 'captures', 'no-moves', 'legacy'].includes(value.endReason)
        ? value.endReason
        : captured.filter(piece => piece.player === otherPlayer(value.winner)).length >= 5
        ? 'captures'
        : 'no-moves'
  };
  return isGameState(migrated) ? migrated : null;
}
