import { createAI } from './ai-registry.js';

self.addEventListener('message', async event => {
  const { state, level, model } = event.data;
  try {
    const ai = createAI(level);
    const action = await ai.chooseMove(state, state.currentPlayer, model);
    self.postMessage({ action });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
