const DB_NAME = 'GougDB';
const DB_VERSION = 1;
const CHATS_STORE_NAME = 'chats';
const SETTINGS_STORE_NAME = 'settings';
const SETTINGS_KEY = 'user_settings';

let dbPromise = null;

/**
 * Initializes the IndexedDB database.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
function initDB() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        const request = indexedDB.open(DB_NAME, DB_VERSION);

        request.onupgradeneeded = (event) => {
            const db = event.target.result;
            if (!db.objectStoreNames.contains(CHATS_STORE_NAME)) {
                const chatStore = db.createObjectStore(CHATS_STORE_NAME, { keyPath: 'id' });
                chatStore.createIndex('updatedAt', 'updatedAt');
            }
            if (!db.objectStoreNames.contains(SETTINGS_STORE_NAME)) {
                db.createObjectStore(SETTINGS_STORE_NAME);
            }
        };

        request.onsuccess = (event) => {
            resolve(event.target.result);
        };

        request.onerror = (event) => {
            console.error("Database error:", event.target.error);
            reject(event.target.error);
        };
    });

    return dbPromise;
}

/**
 * Saves the entire array of chat objects to IndexedDB.
 * This clears the existing store and writes all new chats.
 * @param {Array<object>} chats - The array of chat objects.
 */
export async function saveAllChats(chats) {
    try {
        const db = await initDB();
        const transaction = db.transaction(CHATS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CHATS_STORE_NAME);
        
        store.clear();
        chats.forEach(chat => {
            store.put(chat);
        });

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        console.error("Failed to save chats to storage:", e);
    }
}

/**
 * Loads all chat objects from IndexedDB.
 * @returns {Promise<Array<object>>} A promise that resolves with the array of chats.
 */
export async function loadAllChats() {
    try {
        const db = await initDB();
        const transaction = db.transaction(CHATS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(CHATS_STORE_NAME);
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || []);
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        console.error("Failed to load chats from storage:", e);
        return [];
    }
}

/**
 * Saves the user's settings to IndexedDB.
 * @param {object} settings - The settings object.
 */
export async function saveSettings(settings) {
    try {
        const db = await initDB();
        const transaction = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(SETTINGS_STORE_NAME);
        store.put(settings, SETTINGS_KEY);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        console.error("Failed to save settings:", e);
    }
}

/**
 * Loads the user's settings from IndexedDB.
 * @returns {Promise<object|null>} A promise that resolves with the settings object or null.
 */
export async function loadSettings() {
    try {
        const db = await initDB();
        const transaction = db.transaction(SETTINGS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(SETTINGS_STORE_NAME);
        const request = store.get(SETTINGS_KEY);

        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        console.error("Failed to load settings from storage:", e);
        return null;
    }
}