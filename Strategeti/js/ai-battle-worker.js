import { createGame } from './game.js';
import { applyAiAction } from './ai.js';
import { createAI } from './ai-registry.js';

const MAX_GAMES = 100;
const MAX_MOVES_PER_GAME = 200;

self.addEventListener('message', async event => {
  const { firstLevel, secondLevel, gameCount, model } = event.data;
  try {
    //if (!['beginner', 'strong'].includes(firstLevel) ||
    //    !['beginner', 'strong'].includes(secondLevel)) {
    //  throw new Error('Sélectionnez deux niveaux d’IA valides.');
    //}
    if (!Number.isInteger(gameCount) || gameCount < 1 || gameCount > MAX_GAMES) {
      throw new Error(`Le nombre de parties doit être compris entre 1 et ${MAX_GAMES}.`);
    }

    const ais = { first: createAI(firstLevel), second: createAI(secondLevel) };
    const scores = {
      firstWins: 0,
      secondWins: 0,
      draws: 0,
      firstWhiteWins: 0,
      firstBlackWins: 0,
      secondWhiteWins: 0,
      secondBlackWins: 0
    };

    for (let gameNumber = 1; gameNumber <= gameCount; gameNumber += 1) {
      const firstPlayer = gameNumber % 2 === 1 ? 'white' : 'black';
      let state = createGame();
      while (state.status === 'playing' && state.moveCount < MAX_MOVES_PER_GAME) {
        const currentPlayer = state.currentPlayer;
        const aiKey = currentPlayer === firstPlayer ? 'first' : 'second';
        self.postMessage({
          type: 'thinking',
          completedGames: gameNumber - 1,
          gameNumber,
          gameCount,
          moveNumber: state.moveCount + 1,
          level: aiKey === 'first' ? firstLevel : secondLevel,
          player: currentPlayer
        });
        const action = await ais[aiKey].chooseMove(state, currentPlayer, model);
        state = applyAiAction(state, action);
      }

      if (state.status === 'finished') {
        const winnerKey = state.winner === firstPlayer ? 'first' : 'second';
        scores[`${winnerKey}Wins`] += 1;
        scores[`${winnerKey}${state.winner === 'white' ? 'White' : 'Black'}Wins`] += 1;
      } else {
        scores.draws += 1;
      }

      self.postMessage({ type: 'progress', gameNumber, gameCount, scores });
    }

    self.postMessage({ type: 'complete', gameCount, scores });
  } catch (error) {
    self.postMessage({
      type: 'error',
      message: error instanceof Error ? error.message : String(error)
    });
  }
});
