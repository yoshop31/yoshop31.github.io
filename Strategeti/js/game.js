export const BOARD_ID = 'savanna-4x4';
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

function otherPlayer(player) {
  return player === 'white' ? 'black' : 'white';
}

function isInsideBoard(row, column) {
  return row >= 0 && row < BOARD_SIZE && column >= 0 && column < BOARD_SIZE;
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

function advanceTurn(state, changes, player) {
  const nextPlayer = otherPlayer(player);
  const nextState = {
    ...state,
    ...changes,
    moveCount: state.moveCount + 1,
    currentPlayer: nextPlayer,
    status: 'playing',
    winner: null
  };
  const capturedByWhite = nextState.captured.filter(piece => piece.player === 'white').length;
  const capturedByBlack = nextState.captured.filter(piece => piece.player === 'black').length;

  if (capturedByWhite >= 5) {
    nextState.status = 'finished';
    nextState.winner = 'black';
  } else if (capturedByBlack >= 5) {
    nextState.status = 'finished';
    nextState.winner = 'white';
  } else if (!hasLegalAction(nextState, nextPlayer)) {
    nextState.status = 'finished';
    nextState.winner = player;
  }

  return nextState;
}

export function createGame(boardId = BOARD_ID) {
  if (boardId !== BOARD_ID) {
    throw new Error('Ce plateau n’est pas disponible.');
  }

  const stock = Object.fromEntries(PIECES.map(piece => [piece.id, 2]));

  return {
    version: 2,
    boardId,
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    stocks: {
      black: { ...stock },
      white: { ...stock }
    },
    captured: [],
    currentPlayer: 'white',
    status: 'playing',
    winner: null,
    moveCount: 0
  };
}

export function playMove(state, { cellIndex, pieceId }) {
  if (!isGameState(state) || state.status !== 'playing') {
    throw new Error('Cette partie ne peut pas recevoir de coup.');
  }
  if (!Number.isInteger(cellIndex) || cellIndex < 0 || cellIndex >= state.board.length) {
    throw new Error('Cette case n’existe pas.');
  }
  if (state.board[cellIndex] !== null) {
    throw new Error('Cette case est déjà occupée.');
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

export function hasLegalAction(state, player = state.currentPlayer) {
  if (state.status !== 'playing') return false;
  const hasEmptyCell = state.board.some(cell => cell === null);
  if (hasEmptyCell && Object.values(state.stocks[player]).some(count => count > 0)) {
    return true;
  }

  for (let fromIndex = 0; fromIndex < state.board.length; fromIndex += 1) {
    const piece = state.board[fromIndex];
    if (!piece || piece.player !== player || piece.pieceId !== 'elephant') continue;

    const fromRow = Math.floor(fromIndex / BOARD_SIZE);
    const fromColumn = fromIndex % BOARD_SIZE;
    for (const direction of DIRECTIONS) {
      const toRow = fromRow + direction.row;
      const toColumn = fromColumn + direction.column;
      if (!isInsideBoard(toRow, toColumn)) continue;
      if (canMoveElephant(state, fromIndex, toRow * BOARD_SIZE + toColumn, player)) return true;
    }
  }
  return false;
}

function isValidPiece(piece) {
  return piece &&
    (piece.player === 'black' || piece.player === 'white') &&
    PIECES.some(definition => definition.id === piece.pieceId);
}

export function isGameState(value) {
  if (!value || value.version !== 2 || value.boardId !== BOARD_ID) return false;
  if (!Array.isArray(value.board) || value.board.length !== BOARD_SIZE * BOARD_SIZE) return false;
  if (value.currentPlayer !== 'white' && value.currentPlayer !== 'black') return false;
  if (value.status !== 'playing' && value.status !== 'finished') return false;
  if (!Number.isInteger(value.moveCount) || value.moveCount < 0) return false;
  if (!Array.isArray(value.captured) || !value.captured.every(isValidPiece)) return false;
  if (value.board.filter(Boolean).length + value.captured.length > value.moveCount) return false;
  if (!value.stocks || typeof value.stocks !== 'object' ||
      !value.stocks.black || typeof value.stocks.black !== 'object' ||
      !value.stocks.white || typeof value.stocks.white !== 'object') return false;
  if (value.status === 'playing' && value.winner !== null) return false;
  if (value.status === 'finished' && value.winner !== 'black' && value.winner !== 'white') return false;

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
  if (capturedByWhite >= 5 && (value.status !== 'finished' || value.winner !== 'black')) return false;
  if (capturedByBlack >= 5 && (value.status !== 'finished' || value.winner !== 'white')) return false;
  if (value.status === 'playing' && !hasLegalAction(value, value.currentPlayer)) return false;
  if (value.status === 'finished' && capturedByWhite < 5 && capturedByBlack < 5 &&
      value.winner !== otherPlayer(value.currentPlayer)) return false;
  return true;
}

export function migrateGameState(value) {
  if (isGameState(value)) return value;
  if (!value || value.version !== 1 || value.boardId !== BOARD_ID ||
      !Array.isArray(value.board) || value.board.length !== BOARD_SIZE * BOARD_SIZE) {
    return null;
  }
  const placedCount = value.board.filter(Boolean).length;
  if (value.moveCount !== placedCount ||
      (value.status !== 'playing' && value.status !== 'finished') ||
      (value.status === 'finished') !== (placedCount === value.board.length)) {
    return null;
  }

  const migrated = {
    ...value,
    version: 2,
    captured: [],
    status: 'playing',
    winner: null,
    currentPlayer: value.status === 'finished'
      ? value.moveCount % 2 === 0 ? 'white' : 'black'
      : value.currentPlayer
  };
  if (!hasLegalAction(migrated, migrated.currentPlayer)) {
    migrated.status = 'finished';
    migrated.winner = otherPlayer(migrated.currentPlayer);
  }
  return isGameState(migrated) ? migrated : null;
}
