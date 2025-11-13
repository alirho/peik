const DB_NAME = 'GougDB';
const DB_VERSION = 1;
const CHATS_STORE_NAME = 'chats';
const SETTINGS_STORE_NAME = 'settings';
const SETTINGS_KEY = 'user_settings';
const STORAGE_WARNING_THRESHOLD_BYTES = 45 * 1024 * 1024; // 45 MB

let dbPromise = null;

/**
 * Initializes the IndexedDB database, handling potential errors.
 * @returns {Promise<IDBDatabase>} A promise that resolves with the database instance.
 */
function initDB() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            return reject(new Error("مرورگر شما از IndexedDB پشتیبانی نمی‌کند. امکان ذخیره تاریخچه وجود ندارد."));
        }

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
            console.error("خطای پایگاه داده:", event.target.error);
            if (event.target.error.name === 'VersionError') {
                 reject(new Error("نسخه جدیدی از برنامه در تب دیگری باز است. لطفاً تمام تب‌ها را بسته و دوباره امتحان کنید."));
            } else {
                 reject(new Error("امکان دسترسی به فضای ذخیره‌سازی مرورگر وجود ندارد."));
            }
        };

        request.onblocked = () => {
            // This event is fired when a version upgrade is needed but another tab has the DB open.
            console.warn("ارتقاء پایگاه داده مسدود شده است. لطفاً تب‌های دیگر برنامه را ببندید.");
            // We don't reject here because the user should be prompted to close other tabs.
            // The request will remain blocked until other connections are closed.
        };
    });

    return dbPromise;
}

/**
 * Handles database transaction errors, especially QuotaExceededError.
 * @param {Error} error - The error object from the transaction.
 * @throws {Error} Throws a user-friendly error.
 */
function handleTransactionError(error) {
    if (error.name === 'QuotaExceededError') {
        throw new Error("فضای ذخیره‌سازی مرورگر پر است. لطفاً گپ‌های قدیمی را حذف کنید.");
    } else {
        console.error("خطای ذخیره‌سازی:", error);
        throw new Error("خطایی در ذخیره‌سازی داده‌ها رخ داد.");
    }
}

/**
 * Estimates the size of an object in bytes.
 * @param {object} obj The object to measure.
 * @returns {number} The estimated size in bytes.
 */
function estimateSize(obj) {
    // A simple estimation using JSON string length.
    // Note: This is an approximation. Actual storage size may vary.
    return new TextEncoder().encode(JSON.stringify(obj)).length;
}

/**
 * Checks storage size and logs a warning if it's near the limit.
 * @param {object} data The data being saved.
 */
function checkStorageSize(data) {
    try {
        if (estimateSize(data) > STORAGE_WARNING_THRESHOLD_BYTES) {
            console.warn("هشدار: نزدیک به حد مجاز ذخیره‌سازی هستید.");
        }
    } catch (e) {
        // Ignore if sizing fails
    }
}

/**
 * Saves a single chat object to IndexedDB.
 * @param {object} chat - The chat object to save.
 */
export async function saveChat(chat) {
    checkStorageSize(chat);
    try {
        const db = await initDB();
        const transaction = db.transaction(CHATS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CHATS_STORE_NAME);
        store.put(chat);
        
        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        handleTransactionError(e);
    }
}

/**
 * Deletes a single chat from IndexedDB by its ID.
 * @param {string} chatId - The ID of the chat to delete.
 */
export async function deleteChatById(chatId) {
    try {
        const db = await initDB();
        const transaction = db.transaction(CHATS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CHATS_STORE_NAME);
        store.delete(chatId);

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        handleTransactionError(e);
    }
}

/**
 * Saves the entire array of chat objects to IndexedDB.
 * Kept for potential bulk operations or migrations.
 * @param {Array<object>} chats - The array of chat objects.
 */
export async function saveAllChats(chats) {
    checkStorageSize(chats);
    try {
        const db = await initDB();
        const transaction = db.transaction(CHATS_STORE_NAME, 'readwrite');
        const store = transaction.objectStore(CHATS_STORE_NAME);
        
        store.clear();
        chats.forEach(chat => store.put(chat));

        return new Promise((resolve, reject) => {
            transaction.oncomplete = () => resolve();
            transaction.onerror = (event) => reject(event.target.error);
        });
    } catch (e) {
        handleTransactionError(e);
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
            request.onerror = (event) => {
                console.error("Failed to load chats:", event.target.error);
                reject(new Error("خطا در خواندن تاریخچه گفتگوها."));
            };
        });
    } catch (e) {
        console.error("Failed to load chats from storage:", e);
        throw e; // Re-throw the user-friendly error from initDB
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
        handleTransactionError(e);
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
            request.onerror = (event) => {
                console.error("Failed to load settings:", event.target.error);
                reject(new Error("خطا در خواندن تنظیمات."));
            };
        });
    } catch (e) {
        console.error("Failed to load settings from storage:", e);
        throw e; // Re-throw the user-friendly error from initDB
    }
}