import { getLegalActions, PIECES, PLAYERS } from './game.js';
import { OLLAMA_API_URL } from './llm-settings.js';

const GAME_RULES = [
  'La partie se joue sur un plateau de 4 lignes et 4 colonnes. Blanc joue en premier, puis les joueurs alternent.',
  'À son tour, le joueur pose une pièce de son stock sur une case autorisée ou déplace une de ses pièces selon sa règle.',
  'Sur le plateau classique, les quatre coins sont interdits à la pose. Sur le plateau avancé, les quatre cases centrales sont interdites à la pose. Les déplacements restent autorisés partout.',
  'Chaque joueur dispose de deux éléphants, deux lions, deux zèbres et deux gazelles.',
  'Éléphant : se déplace orthogonalement en poussant une chaîne d’animaux adjacents. Il ne peut pas pousser un éléphant. Tout animal poussé hors du plateau est mangé.',
  'Lion : se déplace sur une case adjacente en mangeant un zèbre ou une gazelle, quelle que soit sa couleur.',
  'Zèbre : se déplace en ligne droite horizontalement, verticalement ou en diagonale, sur toute distance, si le trajet jusqu’à une case vide est libre.',
  'Gazelle : saute par-dessus un ou plusieurs animaux adjacents en ligne droite (orthogonale ou diagonale), puis peut enchaîner d’autres sauts. Son trajet complet constitue un seul coup.',
  'Quatre pièces d’une même couleur alignées horizontalement, verticalement ou en diagonale font gagner leur joueur.',
  'Un joueur perd si cinq de ses pièces ont été mangées ou s’il ne dispose d’aucun coup légal à son tour.'
];
const REQUEST_TIMEOUT_MS = 120000;

function describeAction(action) {
  const pieceName = PIECES.find(piece => piece.id === action.pieceId).name;
  if (action.type === 'place') {
    return `Poser ${pieceName} en ligne ${Math.floor(action.cellIndex / 4) + 1}, colonne ${action.cellIndex % 4 + 1}.`;
  }
  if (action.pieceId === 'gazelle') {
    return `Déplacer la gazelle de la case ${action.fromIndex} en suivant le trajet ${action.path.join(' → ')}.`;
  }
  return `Déplacer ${pieceName} de la case ${action.fromIndex} à la case ${action.toIndex}.`;
}

export function buildLlmPrompt(state, actions) {
  return {
    task: 'Choisir le meilleur coup stratégique parmi la liste des coups légaux. Ne proposer aucun autre coup.',
    rules: GAME_RULES,
    state: {
      boardId: state.boardId,
      boardName: state.boardId === 'savanna-advanced' ? 'Savane avancée' : 'Savane classique',
      boardCoordinates: 'Les indices de case vont de 0 à 15, ligne par ligne de haut en bas.',
      board: Array.from({ length: 4 }, (_, row) =>
        state.board.slice(row * 4, row * 4 + 4).map(piece =>
          piece ? { player: piece.player, pieceId: piece.pieceId } : null
        )
      ),
      stocks: state.stocks,
      captured: state.captured,
      currentPlayer: state.currentPlayer,
      currentPlayerName: PLAYERS[state.currentPlayer].name,
      moveCount: state.moveCount
    },
    legalActions: actions.map((action, index) => ({
      index,
      action,
      description: describeAction(action)
    })),
    responseFormat: {
      actionIndex: 'integer index of one entry in legalActions',
      reasoning: 'short strategic explanation'
    }
  };
}

async function requestActionIndex(model, prompt) {
  const controller = new AbortController();
  const timeoutId = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const response = await fetch(`${OLLAMA_API_URL}/api/chat`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      signal: controller.signal,
      body: JSON.stringify({
        model,
        stream: false,
        format: {
          type: 'object',
          properties: {
            actionIndex: { type: 'integer', minimum: 0 },
            reasoning: { type: 'string' }
          },
          required: ['actionIndex', 'reasoning'],
          additionalProperties: false
        },
        options: { temperature: 0 },
        messages: [
          {
            role: 'system',
            content: 'Tu es LLMIA, une IA qui joue à Strategeti. Choisis uniquement un coup parmi legalActions. Réponds avec un objet JSON conforme au schéma demandé, sans texte hors JSON.'
          },
          {
            role: 'user',
            content: JSON.stringify(prompt)
          }
        ]
      })
    });
    if (!response.ok) {
      const details = await response.text();
      throw new Error(`Ollama a répondu avec le statut HTTP ${response.status}: ${details}`);
    }
    const data = await response.json();
    if (typeof data.message?.content !== 'string') {
      throw new Error('La réponse Ollama ne contient pas le JSON attendu dans message.content.');
    }
    let parsed;
    try {
      parsed = JSON.parse(data.message.content);
    } catch (error) {
      throw new Error(`LLMIA a renvoyé un JSON invalide : ${error.message}`);
    }
    if (!Number.isInteger(parsed.actionIndex) ||
        typeof parsed.reasoning !== 'string') {
      throw new Error('Le JSON de LLMIA doit contenir actionIndex et reasoning.');
    }
    return parsed;
  } catch (error) {
    if (error.name === 'AbortError') {
      throw new Error('Ollama n’a pas répondu.');
    }
    if (error instanceof TypeError) {
      throw new Error(
        `Connexion à Ollama impossible (${OLLAMA_API_URL}). Vérifiez qu’Ollama fonctionne et que son accès CORS autorise cette origine.`
      );
    }
    throw error;
  } finally {
    clearTimeout(timeoutId);
  }
}

export class LLMIA {
  async chooseMove(state, player = state.currentPlayer, model = 'gpt-oss:20b') {
    if (player !== 'white' && player !== 'black') {
      throw new Error('Le joueur LLMIA n’est pas défini.');
    }
    if (state.currentPlayer !== player || state.status !== 'playing') {
      throw new Error('Ce n’est pas au tour de LLMIA.');
    }
    if (typeof model !== 'string' || !/^[a-zA-Z0-9._:/-]{1,200}$/.test(model)) {
      throw new Error('Le modèle Ollama sélectionné n’est pas valide.');
    }

    const actions = getLegalActions(state, player);
    if (actions.length === 0) {
      throw new Error('LLMIA n’a trouvé aucun coup légal alors que la partie est en cours.');
    }
    const prompt = buildLlmPrompt(state, actions);
    const response = await requestActionIndex(model, prompt);
    if (response.actionIndex < 0 || response.actionIndex >= actions.length) {
      throw new Error(`LLMIA a choisi l’index ${response.actionIndex}, qui ne correspond à aucun coup légal.`);
    }
    return actions[response.actionIndex];
  }
}
