import EventEmitter from './eventEmitter.js';
import * as MemoryStorage from '../services/memoryStorage.js';
import ChatManager from './modules/chatManager.js';
import MessageHandler from './modules/messageHandler.js';
import StorageManager from './modules/storageManager.js';
import SyncManager from './modules/syncManager.js';


// JSDoc Type Imports
/** @typedef {import('../types.js').Settings} Settings */
/** @typedef {import('../types.js').Chat} Chat */
/** @typedef {import('../types.js').ImageData} ImageData */
/** @typedef {import('../types.js').StorageAdapter} StorageAdapter */
/** @typedef {import('../types.js').ProviderHandler} ProviderHandler */

/**
 * موتور اصلی برنامه که وضعیت گفتگوها، ارتباط با ارائه‌دهندگان و ذخیره‌سازی را مدیریت می‌کند.
 * این کلاس به عنوان یک "ارکستراتور" عمل می‌کند و وظایف را به ماژول‌های تخصصی واگذار می‌کند.
 * @extends {EventEmitter}
 */
class ChatEngine extends EventEmitter {
    /**
     * @param {object} [options] - Configuration options.
     * @param {StorageAdapter} [options.storage] - یک آداپتور ذخیره‌سازی که رابط StorageAdapter را پیاده‌سازی می‌کند.
     * @param {Object.<string, ProviderHandler>} [options.providers] - یک map از نام ارائه‌دهندگان به توابع مدیریت‌کننده آن‌ها.
     */
    constructor(options = {}) {
        super();
        // --- Core State ---
        /** @type {Array<Chat>} */
        this.chats = [];
        /** @type {string | null} */
        this.activeChatId = null;
        /** @type {boolean} */
        this.isLoading = false;
        /** @type {Settings | null} */
        this.settings = null;
        /** @type {StorageAdapter} */
        this.storage = options.storage || MemoryStorage;
        /** @type {Map<string, ProviderHandler>} */
        this.providers = new Map();
        
        // --- Modules ---
        this.chatManager = new ChatManager(this);
        this.messageHandler = new MessageHandler(this);
        this.storageManager = new StorageManager(this);
        this.syncManager = new SyncManager(this);

        if (options.providers) {
            for (const name in options.providers) {
                this.registerProvider(name, options.providers[name]);
            }
        }
    }

    /**
     * یک ارائه‌دهنده (Provider) جدید را در موتور ثبت می‌کند.
     * @param {string} name - نام ارائه‌دهنده (مانند 'gemini').
     * @param {ProviderHandler} handler - تابع async که پاسخ‌های استریم را مدیریت می‌کند.
     */
    registerProvider(name, handler) {
        this.providers.set(name, handler);
    }

    /**
     * موتور را راه‌اندازی می‌کند، داده‌ها را بارگذاری کرده و رویداد 'init' را منتشر می‌کند.
     * @returns {Promise<void>}
     */
    async init() {
        try {
            this.settings = await this.storage.loadSettings();
            this.chats = await this.storage.loadAllChats();
            
            if (this.chats.length === 0) {
                // Creates a new chat in memory, will be saved on first message
                await this.chatManager.startNewChat(false);
            } else {
                const lastActive = this.chats.sort((a,b) => b.updatedAt - a.updatedAt)[0];
                this.activeChatId = lastActive.id;
            }

            this.emit('init', {
                settings: this.settings,
                chats: this.chats,
                activeChat: this.chatManager.getActiveChat(),
            });
            
            this.syncManager.setup();

        } catch (error) {
            this.emit('error', error.message || 'خطا در بارگذاری تاریخچه گفتگوها.');
        }
    }

    /**
     * تنظیمات جدید کاربر را ذخیره می‌کند.
     * @param {Settings} settings - آبجکت تنظیمات جدید.
     * @returns {Promise<void>}
     */
    async saveSettings(settings) {
        if (settings) {
            try {
                this.settings = settings;
                await this.storage.saveSettings(settings);
                this.emit('settingsSaved', settings);
            } catch (error) {
                this.emit('error', error.message);
            }
        }
    }
    
    /**
     * وضعیت بارگذاری (loading) برنامه را تنظیم کرده و رویداد 'loading' را منتشر می‌کند.
     * @param {boolean} state - وضعیت جدید (true برای در حال بارگذاری).
     * @returns {void}
     */
    setLoading(state) {
        this.isLoading = state;
        this.emit('loading', this.isLoading);
    }

    // --- Delegated Methods ---

    /**
     * یک گپ جدید ایجاد کرده و آن را به عنوان گپ فعال تنظیم می‌کند.
     * @param {boolean} [emitUpdate=true] - اگر true باشد، رویدادها برای UI منتشر می‌شوند.
     * @returns {Promise<void>}
     */
    startNewChat(emitUpdate = true) {
        return this.chatManager.startNewChat(emitUpdate);
    }
    
    /**
     * گپ فعال فعلی را به گپ دیگری با شناسه مشخص تغییر می‌دهد.
     * @param {string} chatId - شناسه گپ مورد نظر.
     * @returns {void}
     */
    switchActiveChat(chatId) {
        return this.chatManager.switchActiveChat(chatId);
    }

    /**
     * عنوان یک گپ مشخص را تغییر می‌دهد.
     * @param {string} chatId - شناسه گپ.
     * @param {string} newTitle - عنوان جدید.
     * @returns {Promise<void>}
     */
    renameChat(chatId, newTitle) {
        return this.chatManager.renameChat(chatId, newTitle);
    }

    /**
     * یک گپ مشخص را حذف می‌کند.
     * @param {string} chatId - شناسه گپ برای حذف.
     * @returns {Promise<void>}
     */
    deleteChat(chatId) {
        return this.chatManager.deleteChat(chatId);
    }

    /**
     * آبجکت گپ فعال فعلی را برمی‌گرداند.
     * @returns {Chat | undefined} آبجکت گپ فعال.
     */
    getActiveChat() {
        return this.chatManager.getActiveChat();
    }

    /**
     * یک پیام جدید از کاربر دریافت کرده، به تاریخچه اضافه می‌کند و برای دریافت پاسخ به ارائه‌دهنده ارسال می‌کند.
     * @param {string} userInput - متن پیام کاربر.
     * @param {ImageData | null} [image=null] - داده‌های تصویر پیوست شده (اختیاری).
     * @returns {Promise<void>}
     */
    sendMessage(userInput, image = null) {
        return this.messageHandler.sendMessage(userInput, image);
    }
}

export default ChatEngine;