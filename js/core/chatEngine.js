import EventEmitter from './eventEmitter.js';
import ChatManager from './modules/chatManager.js';
import MessageHandler from './modules/messageHandler.js';
import StorageManager from './modules/storageManager.js';
import SyncManager from './modules/syncManager.js';
import { DEFAULT_LIMITS, PRESET_LIMITS } from '../utils/constants.js';

// JSDoc Type Imports
/** @typedef {import('../types.js').Settings} Settings */
/** @typedef {import('../types.js').Chat} Chat */
/** @typedef {import('../types.js').ImageData} ImageData */
/** @typedef {import('../types.js').StorageAdapter} StorageAdapter */
/** @typedef {import('../types.js').ProviderHandler} ProviderHandler */

/**
 * Creates a simple in-memory storage adapter that conforms to the StorageAdapter interface.
 * This is used as a fallback when no persistent storage is provided to the ChatEngine.
 * @returns {StorageAdapter}
 */
const createInMemoryStorage = () => {
    let settings = null;
    const chats = new Map();

    return {
        async loadSettings() { return settings; },
        async saveSettings(newSettings) { settings = newSettings; },
        async loadAllChats() { return Array.from(chats.values()); },
        async saveChat(chat) { chats.set(chat.id, JSON.parse(JSON.stringify(chat))); },
        async deleteChatById(chatId) { chats.delete(chatId); }
    };
};

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
     * @param {string | object} [options.limits] - نام یک پیش‌تنظیم ('web', 'ide', 'mobile', 'unlimited') یا یک آبجکت محدودیت سفارشی.
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
        /** @type {object} */
        this.limits = this.mergeLimits(options.limits);
        /** @type {StorageAdapter} */
        this.storage = options.storage;
        if (!this.storage) {
            this.storage = createInMemoryStorage();
            console.warn(`
/******************************************************************\\
* GOUG WARNING: No storage adapter provided.                     *
* The application will run in-memory mode.                       *
* All chats and settings will be lost on page refresh.           *
*                                                                *
* To persist data, provide a storage adapter during              *
* ChatEngine initialization.                                     *
* See: docs/storageAdaptorGuide.md                               *
\\******************************************************************/
            `);
        }
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
     * محدودیت‌های تعریف‌شده توسط کاربر را با مقادیر پیش‌فرض یا پیش‌تنظیم‌ها ادغام می‌کند.
     * @param {string | object} [customLimits] - محدودیت‌های ارائه‌شده توسط کاربر.
     * @returns {object} - آبجکت نهایی و ادغام‌شده محدودیت‌ها.
     */
    mergeLimits(customLimits) {
        const limitsConfig = customLimits || 'web';
        
        // Start with a shallow copy of defaults.
        let mergedLimits = { ...DEFAULT_LIMITS };

        if (typeof limitsConfig === 'string' && PRESET_LIMITS[limitsConfig]) {
            const preset = PRESET_LIMITS[limitsConfig];
            // Merge preset properties over defaults.
            mergedLimits = { ...mergedLimits, ...preset };
            // Manually deep-merge nested objects.
            mergedLimits.file = { ...DEFAULT_LIMITS.file, ...(preset.file || {}) };
            mergedLimits.image = { ...DEFAULT_LIMITS.image, ...(preset.image || {}) };

        } else if (typeof limitsConfig === 'object' && limitsConfig !== null) {
            const custom = limitsConfig;
            // Merge custom properties over defaults.
            mergedLimits = { ...mergedLimits, ...custom };
            // Manually deep-merge nested objects.
            mergedLimits.file = { ...DEFAULT_LIMITS.file, ...(custom.file || {}) };
            mergedLimits.image = { ...DEFAULT_LIMITS.image, ...(custom.image || {}) };
        }
        
        return mergedLimits;
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
            let loadedChats = await this.storage.loadAllChats();
            
            // Add a data validation layer to prevent crashes from corrupted storage
            this.chats = loadedChats.filter(chat => 
                chat && typeof chat.id === 'string' && typeof chat.updatedAt === 'number'
            );
            
            let activeChat;
            if (this.chats.length === 0) {
                // Create the initial chat directly here to ensure state is set correctly.
                // This chat is only in memory and will be saved on the first message.
                const now = Date.now();
                const newChat = {
                    id: `chat_${now}`,
                    title: 'گپ جدید',
                    messages: [],
                    createdAt: now,
                    updatedAt: now,
                    provider: this.settings?.provider || 'unknown',
                    modelName: this.settings?.modelName || 'unknown'
                };
                this.chats.push(newChat);
                this.activeChatId = newChat.id;
                activeChat = newChat;
            } else {
                // If chats exist, set the most recently updated one as active.
                activeChat = this.chats.sort((a,b) => b.updatedAt - a.updatedAt)[0];
                this.activeChatId = activeChat.id;
            }

            const initPayload = {
                settings: this.settings,
                chats: this.chats,
                activeChat: activeChat,
            };
            this.emit('init', initPayload);
            
            this.syncManager.setup();

        } catch (error) {
            console.error('Error during ChatEngine init():', error);
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
     * @returns {Promise<Chat>}
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