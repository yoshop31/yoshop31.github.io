import { BeginnerAI } from './ai.js';
import { StrongAI } from './ai-strong.js';
import { UltraAI } from './ai-ultra.js';

self.addEventListener('message', event => {
  const { state, level } = event.data;
  try {
    const ai = level === 'strong' ? new StrongAI() : new BeginnerAI();
    const action = ai.chooseMove(state);
    self.postMessage({ action });
  } catch (error) {
    self.postMessage({
      error: error instanceof Error ? error.message : String(error)
    });
  }
});
