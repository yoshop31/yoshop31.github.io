import {
  BOARD_SIZE,
  getLegalActions,
  moveElephant,
  moveGazelle,
  moveLion,
  moveZebra,
  playMove,
  finishGazelleMove
} from './game.js';

const PIECE_VALUES = {
  elephant: 2.2,
  lion: 2.8,
  zebra: 1.5,
  gazelle: 1.7
};

const LINES = [
  ...Array.from({ length: BOARD_SIZE }, (_, row) =>
    Array.from({ length: BOARD_SIZE }, (_, column) => row * BOARD_SIZE + column)
  ),
  ...Array.from({ length: BOARD_SIZE }, (_, column) =>
    Array.from({ length: BOARD_SIZE }, (_, row) => row * BOARD_SIZE + column)
  ),
  Array.from({ length: BOARD_SIZE }, (_, index) => index * (BOARD_SIZE + 1)),
  Array.from({ length: BOARD_SIZE }, (_, index) => (index + 1) * (BOARD_SIZE - 1))
];

export function opponentOf(player) {
  return player === 'white' ? 'black' : 'white';
}

export function applyAiAction(state, action) {
  if (action.type === 'place') {
    return playMove(state, {
      cellIndex: action.cellIndex,
      pieceId: action.pieceId
    });
  }
  if (action.pieceId === 'elephant') {
    return moveElephant(state, action);
  }
  if (action.pieceId === 'lion') {
    return moveLion(state, action);
  }
  if (action.pieceId === 'zebra') {
    return moveZebra(state, action);
  }

  let nextState = state;
  let fromIndex = action.fromIndex;
  for (const toIndex of action.path) {
    nextState = moveGazelle(nextState, { fromIndex, toIndex });
    fromIndex = toIndex;
  }
  return finishGazelleMove(nextState);
}

export function evaluateAiState(state, player) {
  if (state.status === 'finished') {
    return state.winner === player ? 100000 + state.moveCount : -100000 - state.moveCount;
  }

  const opponent = opponentOf(player);
  let score = 0;
  for (const piece of state.board) {
    if (!piece) continue;
    const value = PIECE_VALUES[piece.pieceId];
    score += (piece.player === player ? 1 : -1) * value;
  }
  for (const side of ['white', 'black']) {
    const sign = side === player ? 1 : -1;
    for (const [pieceId, count] of Object.entries(state.stocks[side])) {
      score += sign * count * PIECE_VALUES[pieceId] * 0.48;
    }
  }

  for (const line of LINES) {
    const pieces = line.map(index => state.board[index]);
    const ownCount = pieces.filter(piece => piece?.player === player).length;
    const opponentCount = pieces.filter(piece => piece?.player === opponent).length;
    if (opponentCount === 0 && ownCount > 0) {
      score += [0, 0.8, 4, 32, 100000][ownCount];
    }
    if (ownCount === 0 && opponentCount > 0) {
      score -= [0, 0.8, 4, 32, 100000][opponentCount];
    }
  }

  for (const index of [5, 6, 9, 10]) {
    const piece = state.board[index];
    if (piece) score += piece.player === player ? 0.35 : -0.35;
  }

  return score;
}

export class BeginnerAI {
  chooseMove(state, player = state.currentPlayer) {
    if (player !== 'white' && player !== 'black') {
      throw new Error('Le joueur IA n’est pas défini.');
    }
    if (state.currentPlayer !== player || state.status !== 'playing') {
      throw new Error('Ce n’est pas au tour de l’IA.');
    }

    const actions = getLegalActions(state, player);
    if (actions.length === 0) {
      throw new Error('L’IA n’a trouvé aucun coup légal alors que la partie est en cours.');
    }

    const opponent = opponentOf(player);
    let bestScore = -Infinity;
    let bestActions = [];
    for (const action of actions) {
      const nextState = applyAiAction(state, action);
      let score = evaluateAiState(nextState, player);
      if (nextState.status === 'playing') {
        const replies = getLegalActions(nextState, opponent);
        if (replies.length === 0) {
          score = Math.max(score, 100000 + nextState.moveCount);
        } else {
          score = Infinity;
          for (const reply of replies) {
            const afterReply = applyAiAction(nextState, reply);
            score = Math.min(score, evaluateAiState(afterReply, player));
            if (score < bestScore) break;
          }
        }
      }

      if (score > bestScore) {
        bestScore = score;
        bestActions = [action];
      } else if (score === bestScore) {
        bestActions.push(action);
      }
    }

    return bestActions[Math.floor(Math.random() * bestActions.length)];
  }
}

export function chooseAiMove(state, player = state.currentPlayer) {
  return new BeginnerAI().chooseMove(state, player);
}
