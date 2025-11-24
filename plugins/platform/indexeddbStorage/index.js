import { Plugin, Errors, Serializer } from '../../../core/src/index.js';

const { StorageError } = Errors;

const DB_NAME = 'PeikDB';
const DB_VERSION = 1;
const CHATS_STORE_NAME = 'chats';
const SETTINGS_STORE_NAME = 'settings';
const SETTINGS_KEY = 'user_settings';

export default class IndexedDBStoragePlugin extends Plugin {
    static metadata = {
        name: 'indexeddb-storage',
        version: '1.0.0',
        category: 'storage',
        description: 'ذخیره‌سازی پایدار با استفاده از IndexedDB',
        author: 'Peik Team',
        dependencies: []
    };

    constructor() {
        super();
        this.dbPromise = null;
    }

    _initDB() {
        if (this.dbPromise) {
            return this.dbPromise;
        }

        this.dbPromise = new Promise((resolve, reject) => {
            if (typeof indexedDB === 'undefined') {
                return reject(new StorageError("مرورگر شما از IndexedDB پشتیبانی نمی‌کند."));
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
                this.dbPromise = null;
                reject(new StorageError(`خطا در باز کردن پایگاه داده: ${event.target.error?.message}`));
            };

            request.onblocked = () => {
                console.warn("ارتقاء پایگاه داده مسدود شده است. لطفاً تب‌های دیگر برنامه را ببندید.");
            };
        });

        return this.dbPromise;
    }

    async deactivate() {
        if (this.dbPromise) {
            const db = await this.dbPromise;
            db.close();
            this.dbPromise = null;
        }
    }

    async saveSettings(settings) {
        try {
            const db = await this._initDB();
            const transaction = db.transaction(SETTINGS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(SETTINGS_STORE_NAME);
            
            const safeSettings = Serializer.clone(settings);
            store.put(safeSettings, SETTINGS_KEY);

            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject(new StorageError(`خطا در ذخیره تنظیمات: ${event.target.error?.message}`));
                transaction.onabort = () => reject(new StorageError('Transaction was aborted'));
            });
        } catch (error) {
            throw error instanceof StorageError ? error : new StorageError(error.message);
        }
    }

    async loadSettings() {
        try {
            const db = await this._initDB();
            const transaction = db.transaction(SETTINGS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(SETTINGS_STORE_NAME);
            const request = store.get(SETTINGS_KEY);

            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = (event) => reject(new StorageError(`خطا در خواندن تنظیمات: ${event.target.error?.message}`));
                transaction.onabort = () => reject(new StorageError('Transaction was aborted'));
            });
        } catch (error) {
            throw error instanceof StorageError ? error : new StorageError(error.message);
        }
    }

    async saveChat(chat) {
        try {
            const db = await this._initDB();
            const transaction = db.transaction(CHATS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(CHATS_STORE_NAME);
            
            const safeChat = Serializer.clone(chat);
            store.put(safeChat);
            
            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject(new StorageError(`خطا در ذخیره چت: ${event.target.error?.message}`));
                transaction.onabort = () => reject(new StorageError('Transaction was aborted'));
            });
        } catch (error) {
            throw error instanceof StorageError ? error : new StorageError(error.message);
        }
    }

    async loadChat(chatId) {
        try {
            const db = await this._initDB();
            const transaction = db.transaction(CHATS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(CHATS_STORE_NAME);
            const request = store.get(chatId);
            
            return new Promise((resolve, reject) => {
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = (event) => reject(new StorageError(`خطا در بارگذاری چت: ${event.target.error?.message}`));
                transaction.onabort = () => reject(new StorageError('Transaction was aborted'));
            });
        } catch (error) {
            throw error instanceof StorageError ? error : new StorageError(error.message);
        }
    }

    async getAllChats() {
        try {
            const db = await this._initDB();
            const transaction = db.transaction(CHATS_STORE_NAME, 'readonly');
            const store = transaction.objectStore(CHATS_STORE_NAME);
            
            // استفاده از Index برای مرتب‌سازی نزولی
            const index = store.index('updatedAt');
            const request = index.openCursor(null, 'prev');
            
            return new Promise((resolve, reject) => {
                const chats = [];
                request.onsuccess = (event) => {
                    const cursor = event.target.result;
                    if (cursor) {
                        const chat = cursor.value;
                        // Projection: فقط فیلدهای ضروری (بدون پیام‌ها)
                        chats.push({
                            id: chat.id,
                            title: chat.title,
                            createdAt: chat.createdAt,
                            updatedAt: chat.updatedAt,
                            modelInfo: chat.modelInfo
                        });
                        cursor.continue();
                    } else {
                        resolve(chats);
                    }
                };
                request.onerror = (event) => {
                    reject(new StorageError(`خطا در دریافت لیست چت‌ها: ${event.target.error?.message}`));
                };
                transaction.onabort = () => reject(new StorageError('Transaction was aborted'));
            });
        } catch (error) {
            throw error instanceof StorageError ? error : new StorageError(error.message);
        }
    }

    async deleteChat(chatId) {
        try {
            const db = await this._initDB();
            const transaction = db.transaction(CHATS_STORE_NAME, 'readwrite');
            const store = transaction.objectStore(CHATS_STORE_NAME);
            store.delete(chatId);

            return new Promise((resolve, reject) => {
                transaction.oncomplete = () => resolve();
                transaction.onerror = (event) => reject(new StorageError(`خطا در حذف چت: ${event.target.error?.message}`));
                transaction.onabort = () => reject(new StorageError('Transaction was aborted'));
            });
        } catch (error) {
            throw error instanceof StorageError ? error : new StorageError(error.message);
        }
    }
}