import { createGame } from './game.js';
import { BeginnerAI, applyAiAction } from './ai.js';
import { StrongAI } from './ai-strong.js';
import { UltraAI } from './ai-ultra.js';

const MAX_GAMES = 100;
const MAX_MOVES_PER_GAME = 200;

function createAi(level) {
  if (level === 'beginner') return new BeginnerAI();
  if (level === 'strong') return new StrongAI();
  if (level === 'ultra') return new UltraAI();
  throw new Error('Niveau d’IA non reconnu.');
}

self.addEventListener('message', event => {
  const { firstLevel, secondLevel, gameCount } = event.data;
  try {
    //if (!['beginner', 'strong'].includes(firstLevel) ||
    //    !['beginner', 'strong'].includes(secondLevel)) {
    //  throw new Error('Sélectionnez deux niveaux d’IA valides.');
    //}
    if (!Number.isInteger(gameCount) || gameCount < 1 || gameCount > MAX_GAMES) {
      throw new Error(`Le nombre de parties doit être compris entre 1 et ${MAX_GAMES}.`);
    }

    const ais = {
      first: createAi(firstLevel),
      second: createAi(secondLevel)
    };
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
        const action = ais[aiKey].chooseMove(state, currentPlayer);
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
