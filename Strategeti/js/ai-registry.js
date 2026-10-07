import { BeginnerAI } from './ai.js';
import { StrongAI } from './ai-strong.js';
import { UltraAI } from './ai-ultra.js';
import { LLMIA } from './llm-ai.js';

export const AI_TYPES = [
  { id: 'beginner', label: 'IA débutante', create: () => new BeginnerAI() },
  { id: 'strong', label: 'IA forte', create: () => new StrongAI() },
  { id: 'ultra', label: 'IA ultra', create: () => new UltraAI() },
  { id: 'llm', label: 'LLMIA (Ollama)', create: () => new LLMIA() }
];

export function createAI(level) {
  const definition = AI_TYPES.find(ai => ai.id === level);
  if (!definition) {
    throw new Error(`Le type d’IA « ${level} » n’est pas enregistré.`);
  }
  return definition.create();
}

export function getAIName(level) {
  return AI_TYPES.find(ai => ai.id === level)?.label ??
    (level === 'human' ? 'Joueur' : level);
}
