// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../types.js').StorageAdapter} StorageAdapter */
/** @typedef {import('../types.js').Chat} Chat */
/** @typedef {import('../types.js').Settings} Settings */

import {
    VersionError,
    StorageSupportError,
    StorageAccessError,
    QuotaExceededError,
    GenericStorageError,
} from '../utils/customErrors.js';

const DB_NAME = 'GougDB';
const DB_VERSION = 1;
const CHATS_STORE_NAME = 'chats';
const SETTINGS_STORE_NAME = 'settings';
const SETTINGS_KEY = 'user_settings';
const STORAGE_WARNING_THRESHOLD_BYTES = 45 * 1024 * 1024; // 45 MB

let dbPromise = null;

/**
 * پایگاه داده IndexedDB را راه‌اندازی کرده و خطاهای احتمالی را مدیریت می‌کند.
 * @returns {Promise<IDBDatabase>} یک Promise که با نمونه پایگاه داده resolve می‌شود.
 */
function initDB() {
    if (dbPromise) {
        return dbPromise;
    }

    dbPromise = new Promise((resolve, reject) => {
        if (!window.indexedDB) {
            return reject(new StorageSupportError());
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
                 reject(new VersionError());
            } else {
                 reject(new StorageAccessError());
            }
        };

        request.onblocked = () => {
            // این رویداد زمانی رخ می‌دهد که نیاز به ارتقاء نسخه باشد اما یک تب دیگر پایگاه داده را باز نگه داشته است.
            console.warn("ارتقاء پایگاه داده مسدود شده است. لطفاً تب‌های دیگر برنامه را ببندید.");
            // در اینجا reject نمی‌کنیم چون کاربر باید فرصت داشته باشد تب‌های دیگر را ببندد.
            // درخواست تا زمان بسته شدن اتصالات دیگر مسدود باقی می‌ماند.
        };
    });

    return dbPromise;
}

/**
 * خطاهای تراکنش پایگاه داده، به ویژه QuotaExceededError را مدیریت می‌کند.
 * @param {Error} error - آبجکت خطا از تراکنش.
 * @throws {Error} یک خطای کاربرپسند پرتاب می‌کند.
 */
function handleTransactionError(error) {
    if (error.name === 'QuotaExceededError') {
        throw new QuotaExceededError();
    } else {
        console.error("خطای ذخیره‌سازی:", error);
        throw new GenericStorageError();
    }
}

/**
 * اندازه یک آبجکت را به بایت تخمین می‌زند.
 * @param {object} obj - آبجکتی که باید اندازه‌گیری شود.
 * @returns {number} اندازه تخمینی به بایت.
 */
function estimateSize(obj) {
    // یک تخمین ساده با استفاده از طول رشته JSON.
    // توجه: این یک تقریب است. اندازه واقعی ذخیره‌سازی ممکن است متفاوت باشد.
    return new TextEncoder().encode(JSON.stringify(obj)).length;
}

/**
 * اندازه فضای ذخیره‌سازی را بررسی کرده و در صورت نزدیک شدن به حد مجاز، یک هشدار ثبت می‌کند.
 * @param {object} data - داده‌ای که در حال ذخیره شدن است.
 */
function checkStorageSize(data) {
    try {
        if (estimateSize(data) > STORAGE_WARNING_THRESHOLD_BYTES) {
            console.warn("هشدار: نزدیک به حد مجاز ذخیره‌سازی هستید.");
        }
    } catch (e) {
        // در صورت شکست در اندازه‌گیری، نادیده گرفته می‌شود.
    }
}

/**
 * یک آبجکت گپ را در IndexedDB ذخیره یا به‌روزرسانی می‌کند.
 * @type {StorageAdapter['saveChat']}
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
 * یک گپ را با شناسه آن از IndexedDB حذف می‌کند.
 * @type {StorageAdapter['deleteChatById']}
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
 * فقط لیست گپ‌ها (بدون پیام‌ها) را برای نمایش سریع اولیه بارگذاری می‌کند.
 * @type {StorageAdapter['loadChatList']}
 */
export async function loadChatList() {
    try {
        const db = await initDB();
        const transaction = db.transaction(CHATS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(CHATS_STORE_NAME);
        const request = store.getAll();
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => {
                const chats = request.result || [];
                // برای بهینه‌سازی، فیلد پیام‌ها را از هر گپ حذف می‌کنیم.
                const chatList = chats.map(chat => {
                    delete chat.messages;
                    return chat;
                });
                resolve(chatList);
            };
            request.onerror = (event) => {
                console.error("بارگذاری لیست گپ‌ها ناموفق بود:", event.target.error);
                reject(new GenericStorageError("خطا در خواندن لیست گفتگوها."));
            };
        });
    } catch (e) {
        console.error("خطا در بارگذاری لیست گپ‌ها از حافظه:", e);
        throw e; // پرتاب مجدد خطای کاربرپسند از initDB
    }
}

/**
 * یک گپ کامل (شامل پیام‌ها) را بر اساس شناسه آن بارگذاری می‌کند.
 * @type {StorageAdapter['loadChatById']}
 */
export async function loadChatById(chatId) {
    try {
        const db = await initDB();
        const transaction = db.transaction(CHATS_STORE_NAME, 'readonly');
        const store = transaction.objectStore(CHATS_STORE_NAME);
        const request = store.get(chatId);
        
        return new Promise((resolve, reject) => {
            request.onsuccess = () => resolve(request.result || null);
            request.onerror = (event) => {
                console.error(`بارگذاری گپ ${chatId} ناموفق بود:`, event.target.error);
                reject(new GenericStorageError("خطا در خواندن تاریخچه گفتگو."));
            };
        });
    } catch (e) {
        console.error(`خطا در بارگذاری گپ ${chatId} از حافظه:`, e);
        throw e;
    }
}

/**
 * تنظیمات کاربر را در IndexedDB ذخیره می‌کند.
 * @type {StorageAdapter['saveSettings']}
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
 * تنظیمات کاربر را از IndexedDB بارگذاری می‌کند.
 * @type {StorageAdapter['loadSettings']}
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
                console.error("بارگذاری تنظیمات ناموفق بود:", event.target.error);
                reject(new GenericStorageError("خطا در خواندن تنظیمات."));
            };
        });
    } catch (e) {
        console.error("خطا در بارگذاری تنظیمات از حافظه:", e);
        throw e;
    }
}
