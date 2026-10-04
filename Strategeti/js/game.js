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

export function createGame(boardId = BOARD_ID) {
  if (boardId !== BOARD_ID) {
    throw new Error('Ce plateau n’est pas disponible.');
  }

  const stock = Object.fromEntries(PIECES.map(piece => [piece.id, 2]));

  return {
    version: 1,
    boardId,
    board: Array(BOARD_SIZE * BOARD_SIZE).fill(null),
    stocks: {
      black: { ...stock },
      white: { ...stock }
    },
    currentPlayer: 'white',
    status: 'playing',
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
  const moveCount = state.moveCount + 1;

  return {
    ...state,
    board,
    stocks,
    moveCount,
    status: moveCount === board.length ? 'finished' : 'playing',
    currentPlayer: moveCount === board.length
      ? player
      : player === 'white' ? 'black' : 'white'
  };
}

export function isGameState(value) {
  if (!value || value.version !== 1 || value.boardId !== BOARD_ID) return false;
  if (!Array.isArray(value.board) || value.board.length !== BOARD_SIZE * BOARD_SIZE) return false;
  if (value.currentPlayer !== 'white' && value.currentPlayer !== 'black') return false;
  if (value.status !== 'playing' && value.status !== 'finished') return false;
  if (!Number.isInteger(value.moveCount) || value.moveCount < 0 || value.moveCount > value.board.length) return false;
  if (value.board.filter(Boolean).length !== value.moveCount) return false;
  if ((value.status === 'finished') !== (value.moveCount === value.board.length)) return false;
  if (!value.stocks || typeof value.stocks !== 'object' ||
      !value.stocks.black || typeof value.stocks.black !== 'object' ||
      !value.stocks.white || typeof value.stocks.white !== 'object') return false;

  for (const player of ['black', 'white']) {
    for (const piece of PIECES) {
      const count = value.stocks[player][piece.id];
      const placed = value.board.filter(cell => cell && cell.player === player && cell.pieceId === piece.id).length;
      if (!Number.isInteger(count) || count < 0 || count > 2 || count + placed !== 2) return false;
    }
  }
  const expectedPlayer = value.moveCount % 2 === 0 ? 'white' : 'black';
  if (value.status === 'playing' && value.currentPlayer !== expectedPlayer) return false;
  return value.board.every(cell => cell === null || (
    cell &&
    (cell.player === 'black' || cell.player === 'white') &&
    PIECES.some(piece => piece.id === cell.pieceId)
  ));
}
