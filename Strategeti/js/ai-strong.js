import { getLegalActions } from './game.js';
import {
  applyAiAction,
  evaluateAiState,
  opponentOf
} from './ai.js';

const SEARCH_DEPTH = 6;//initial =2
const MAX_ORDERED_ACTIONS = 15;//initial =10

function orderActions(state, actions, player, maximize, limit = MAX_ORDERED_ACTIONS) {
  const ordered = actions
    .map(action => ({
      action,
      score: evaluateAiState(applyAiAction(state, action), player)
    }))
    .sort((first, second) => maximize
      ? second.score - first.score
      : first.score - second.score);
  return limit === null ? ordered : ordered.slice(0, limit);
}

function search(state, depth, player, alpha, beta) {
  if (state.status === 'finished') return evaluateAiState(state, player);
  if (depth === 0) return evaluateAiState(state, player);

  const maximize = state.currentPlayer === player;
  const actions = getLegalActions(state, state.currentPlayer);
  if (actions.length === 0) return evaluateAiState(state, player);

  const ordered = orderActions(state, actions, player, maximize);
  let bestScore = maximize ? -Infinity : Infinity;
  for (const { action } of ordered) {
    const score = search(
      applyAiAction(state, action),
      depth - 1,
      player,
      alpha,
      beta
    );
    if (maximize) {
      bestScore = Math.max(bestScore, score);
      alpha = Math.max(alpha, bestScore);
    } else {
      bestScore = Math.min(bestScore, score);
      beta = Math.min(beta, bestScore);
    }
    if (alpha >= beta) break;
  }
  return bestScore;
}

export class StrongAI {
  chooseMove(state, player = state.aiPlayer) {
    if (player !== 'white' && player !== 'black') {
      throw new Error('Le joueur IA n’est pas défini.');
    }
    if (state.currentPlayer !== player || state.status !== 'playing') {
      throw new Error('Ce n’est pas au tour de l’IA.');
    }

    const actions = getLegalActions(state, player);
    if (actions.length === 0) {
      throw new Error('L’IA forte n’a trouvé aucun coup légal alors que la partie est en cours.');
    }

    const ordered = orderActions(state, actions, player, true, null);
    let bestScore = -Infinity;
    let bestActions = [];
    let alpha = -Infinity;
    for (const { action } of ordered) {
      const score = search(
        applyAiAction(state, action),
        SEARCH_DEPTH,
        player,
        alpha,
        Infinity
      );
      if (score > bestScore) {
        bestScore = score;
        bestActions = [action];
      } else if (score === bestScore) {
        bestActions.push(action);
      }
      alpha = Math.max(alpha, bestScore);
    }

    return bestActions[Math.floor(Math.random() * bestActions.length)];
  }
}
