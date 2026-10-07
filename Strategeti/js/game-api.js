import {
  cancelGazelleMove,
  createGame,
  finishGazelleMove,
  getGazelleJumpDestinations,
  migrateGameState,
  moveElephant,
  moveGazelle,
  moveLion,
  moveZebra,
  playMove
} from './game.js';
import { loadGame, saveGame } from './storage.js';

export async function loadSavedGame() {
  const savedState = await loadGame();
  if (savedState === null) return null;

  const state = migrateGameState(savedState);
  if (state === null) {
    throw new Error('La sauvegarde locale est invalide. Démarrez une nouvelle partie pour la remplacer.');
  }
  if (state !== savedState) await saveGame(state);
  return state;
}

export async function startGame(boardId, players = null, aiLevel) {
  const state = createGame(boardId, players, aiLevel);
  await saveGame(state);
  return state;
}

export async function playGameMove(state, action) {
  const nextState = playMove(state, action);
  await saveGame(nextState);
  return nextState;
}

export async function moveGameElephant(state, action) {
  const nextState = moveElephant(state, action);
  await saveGame(nextState);
  return nextState;
}

export async function moveGameZebra(state, action) {
  const nextState = moveZebra(state, action);
  await saveGame(nextState);
  return nextState;
}

export async function moveGameLion(state, action) {
  const nextState = moveLion(state, action);
  await saveGame(nextState);
  return nextState;
}

export function getGazelleMoves(state, fromIndex) {
  return getGazelleJumpDestinations(state, fromIndex);
}

export async function moveGameGazelle(state, action) {
  const nextState = moveGazelle(state, action);
  await saveGame(nextState);
  return nextState;
}

export async function finishGameGazelleMove(state) {
  const nextState = finishGazelleMove(state);
  await saveGame(nextState);
  return nextState;
}

export async function cancelGameGazelleMove(state) {
  const nextState = cancelGazelleMove(state);
  await saveGame(nextState);
  return nextState;
}
