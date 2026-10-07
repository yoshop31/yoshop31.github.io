import { AI_TYPES, getAIName } from './ai-registry.js';
import {
  DEFAULT_OLLAMA_MODEL,
  getOllamaModels,
  getPreferredOllamaModel,
  savePreferredOllamaModel
} from './llm-settings.js';

const form = document.querySelector('#ai-test-form');
const firstLevelSelect = document.querySelector('#first-ai');
const secondLevelSelect = document.querySelector('#second-ai');
const llmModelField = document.querySelector('#test-llm-model-field');
const llmModelInput = document.querySelector('#test-llm-model');
const ollamaModelsList = document.querySelector('#test-ollama-models');
const llmModelStatus = document.querySelector('#test-llm-model-status');
const gameCountInput = document.querySelector('#game-count');
const runButton = document.querySelector('#run-tests');
const progressSection = document.querySelector('#ai-test-progress');
const progressBar = document.querySelector('#games-progress');
const progressLabel = document.querySelector('#progress-label');
const errorMessage = document.querySelector('#ai-test-error');
const resultsSection = document.querySelector('#ai-test-results');
const firstAiLabel = document.querySelector('#first-ai-label');
const secondAiLabel = document.querySelector('#second-ai-label');
const firstAiWins = document.querySelector('#first-ai-wins');
const secondAiWins = document.querySelector('#second-ai-wins');
const drawCount = document.querySelector('#draw-count');
const colorResults = document.querySelector('#color-results');

let activeWorker = null;

function populateAiChoices() {
  for (const select of [firstLevelSelect, secondLevelSelect]) {
    const selectedLevel = select.value;
    select.replaceChildren();
    for (const ai of AI_TYPES) {
      const option = document.createElement('option');
      option.value = ai.id;
      option.textContent = ai.label;
      select.append(option);
    }
    select.value = selectedLevel;
  }
}

function updateLlmModelVisibility() {
  const needsLlm = firstLevelSelect.value === 'llm' || secondLevelSelect.value === 'llm';
  llmModelField.hidden = !needsLlm;
  llmModelInput.required = needsLlm;
}

async function initializeOllamaModels() {
  try {
    const models = await getOllamaModels();
    ollamaModelsList.replaceChildren();
    for (const model of models) {
      const option = document.createElement('option');
      option.value = model;
      ollamaModelsList.append(option);
    }
    const preferredModel = getPreferredOllamaModel();
    llmModelInput.value = models.includes(preferredModel)
      ? preferredModel
      : models.includes(DEFAULT_OLLAMA_MODEL)
        ? DEFAULT_OLLAMA_MODEL
        : models[0] ?? preferredModel;
    llmModelStatus.textContent = models.length
      ? `${models.length} modèle(s) Ollama disponible(s).`
      : 'Aucun modèle Ollama installé.';
  } catch (error) {
    llmModelStatus.textContent = `Impossible de récupérer les modèles Ollama : ${error.message}`;
  }
}

function displayScores(scores) {
  firstAiWins.textContent = String(scores.firstWins);
  secondAiWins.textContent = String(scores.secondWins);
  drawCount.textContent = String(scores.draws);
  colorResults.textContent =
    `IA 1 : ${scores.firstWhiteWins} victoire(s) avec Blanc et ${scores.firstBlackWins} avec Noir. ` +
    `IA 2 : ${scores.secondWhiteWins} victoire(s) avec Blanc et ${scores.secondBlackWins} avec Noir.`;
}

function finishRun() {
  activeWorker?.terminate();
  activeWorker = null;
  runButton.disabled = false;
  firstLevelSelect.disabled = false;
  secondLevelSelect.disabled = false;
  gameCountInput.disabled = false;
  llmModelInput.disabled = false;
}

form.addEventListener('submit', event => {
  event.preventDefault();
  if (!form.reportValidity()) return;

  const gameCount = Number(gameCountInput.value);
  if (!Number.isInteger(gameCount) || gameCount < 1 || gameCount > 100) {
    gameCountInput.setCustomValidity('Choisissez un nombre entier entre 1 et 100.');
    gameCountInput.reportValidity();
    gameCountInput.setCustomValidity('');
    return;
  }

  errorMessage.hidden = true;
  errorMessage.textContent = '';
  resultsSection.hidden = true;
  progressSection.hidden = false;
  progressBar.max = gameCount;
  progressBar.value = 0;
  progressLabel.textContent = `0 / ${gameCount} parties jouées`;
  firstAiLabel.textContent = `IA 1 · ${getAIName(firstLevelSelect.value)}`;
  secondAiLabel.textContent = `IA 2 · ${getAIName(secondLevelSelect.value)}`;
  displayScores({
    firstWins: 0,
    secondWins: 0,
    draws: 0,
    firstWhiteWins: 0,
    firstBlackWins: 0,
    secondWhiteWins: 0,
    secondBlackWins: 0
  });

  runButton.disabled = true;
  firstLevelSelect.disabled = true;
  secondLevelSelect.disabled = true;
  gameCountInput.disabled = true;
  llmModelInput.disabled = true;

  try {
    savePreferredOllamaModel(llmModelInput.value.trim());
    activeWorker = new Worker(new URL('./ai-battle-worker.js', import.meta.url), { type: 'module' });
    activeWorker.addEventListener('message', event => {
      const message = event.data;
      if (message.type === 'progress') {
        progressBar.value = message.gameNumber;
        progressLabel.textContent =
          `${message.gameNumber} / ${message.gameCount} parties jouées`;
        displayScores(message.scores);
      } else if (message.type === 'thinking') {
        const aiName = getAIName(message.level);
        progressLabel.textContent =
          `${message.completedGames} / ${message.gameCount} parties jouées · ` +
          `Partie ${message.gameNumber}, coup ${message.moveNumber} : ` +
          `${aiName} (${message.player === 'white' ? 'Blanc' : 'Noir'}) réfléchit…`;
      } else if (message.type === 'complete') {
        progressBar.value = message.gameCount;
        progressLabel.textContent =
          `${message.gameCount} / ${message.gameCount} parties terminées`;
        displayScores(message.scores);
        resultsSection.hidden = false;
        finishRun();
      } else if (message.type === 'error') {
        errorMessage.textContent = `La simulation a échoué : ${message.message}`;
        errorMessage.hidden = false;
        finishRun();
      }
    });
    activeWorker.addEventListener('error', event => {
      errorMessage.textContent =
        `Impossible d’exécuter les simulations : ${event.message || 'erreur du worker.'}`;
      errorMessage.hidden = false;
      finishRun();
    }, { once: true });
    activeWorker.postMessage({
      firstLevel: firstLevelSelect.value,
      secondLevel: secondLevelSelect.value,
      gameCount,
      model: llmModelInput.value.trim()
    });
  } catch (error) {
    errorMessage.textContent = `Impossible de démarrer les simulations : ${error.message}`;
    errorMessage.hidden = false;
    finishRun();
  }
});

populateAiChoices();
firstLevelSelect.addEventListener('change', updateLlmModelVisibility);
secondLevelSelect.addEventListener('change', updateLlmModelVisibility);
llmModelInput.addEventListener('change', () => {
  if (llmModelInput.value.trim()) savePreferredOllamaModel(llmModelInput.value.trim());
});
updateLlmModelVisibility();
initializeOllamaModels();
