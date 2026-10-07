export const DEFAULT_OLLAMA_MODEL = 'qwen3:4b';
export const OLLAMA_API_URL = 'http://localhost:11434';
const MODEL_STORAGE_KEY = 'strategeti-ollama-model';

export function getPreferredOllamaModel() {
  return localStorage.getItem(MODEL_STORAGE_KEY) || DEFAULT_OLLAMA_MODEL;
}

export function savePreferredOllamaModel(model) {
  localStorage.setItem(MODEL_STORAGE_KEY, model);
}

export async function getOllamaModels() {
  const response = await fetch(`${OLLAMA_API_URL}/api/tags`);
  if (!response.ok) {
    throw new Error(`Ollama a répondu avec le statut HTTP ${response.status}.`);
  }
  const data = await response.json();
  if (!Array.isArray(data.models) ||
      !data.models.every(model => typeof model.name === 'string')) {
    throw new Error('La liste des modèles Ollama reçue est invalide.');
  }
  return data.models.map(model => model.name);
}
