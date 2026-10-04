const DATABASE_NAME = 'strategeti';
const DATABASE_VERSION = 1;
const STORE_NAME = 'games';
const ACTIVE_GAME_KEY = 'active-game';

function openDatabase() {
  if (!('indexedDB' in window)) {
    return Promise.reject(new Error('Le stockage local de ce navigateur n’est pas disponible.'));
  }

  return new Promise((resolve, reject) => {
    const request = window.indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
    request.onupgradeneeded = () => {
      const database = request.result;
      if (!database.objectStoreNames.contains(STORE_NAME)) {
        database.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error || new Error('Impossible d’ouvrir la sauvegarde locale.'));
    request.onblocked = () => reject(new Error('La sauvegarde est bloquée par un autre onglet ouvert.'));
  });
}

export async function loadGame() {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readonly');
    const request = transaction.objectStore(STORE_NAME).get(ACTIVE_GAME_KEY);
    request.onsuccess = () => resolve(request.result || null);
    request.onerror = () => reject(request.error || new Error('Impossible de lire la sauvegarde.'));
    transaction.oncomplete = () => database.close();
    transaction.onerror = () => database.close();
    transaction.onabort = () => database.close();
  });
}

export async function saveGame(state) {
  const database = await openDatabase();
  return new Promise((resolve, reject) => {
    const transaction = database.transaction(STORE_NAME, 'readwrite');
    transaction.objectStore(STORE_NAME).put(state, ACTIVE_GAME_KEY);
    transaction.oncomplete = () => {
      database.close();
      resolve();
    };
    transaction.onerror = () => {
      const error = transaction.error || new Error('Impossible d’enregistrer la partie.');
      database.close();
      reject(error);
    };
    transaction.onabort = () => {
      const error = transaction.error || new Error('La sauvegarde de la partie a été interrompue.');
      database.close();
      reject(error);
    };
  });
}
