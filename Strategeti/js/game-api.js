import { createGame, isGameState, playMove } from './game.js';
import { loadGame, saveGame } from './storage.js';

export async function loadSavedGame() {
  const state = await loadGame();
  if (state !== null && !isGameState(state)) {
    throw new Error('La sauvegarde locale est invalide. Démarrez une nouvelle partie pour la remplacer.');
  }
  return state;
}

export async function startGame(boardId) {
  const state = createGame(boardId);
  await saveGame(state);
  return state;
}

export async function playGameMove(state, action) {
  const nextState = playMove(state, action);
  await saveGame(nextState);
  return nextState;
}
