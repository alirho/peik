import EventEmitter from './eventEmitter.js';
import ChatManager from './modules/chatManager.js';
import MessageHandler from './modules/messageHandler.js';
import StorageManager from './modules/storageManager.js';
import SyncManager from './modules/syncManager.js';
import { DEFAULT_LIMITS, PRESET_LIMITS } from '../utils/constants.js';

// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../types.js').Settings} Settings */
/** @typedef {import('../types.js').Chat} Chat */
/** @typedef {import('../types.js').ImageData} ImageData */
/** @typedef {import('../types.js').ProviderConfig} ProviderConfig */
/** @typedef {import('../types.js').StorageAdapter} StorageAdapter */
/** @typedef {import('../types.js').ProviderHandler} ProviderHandler */

/**
 * یک آداپتور ذخیره‌سازی ساده در حافظه ایجاد می‌کند که با رابط StorageAdapter سازگار است.
 * این به عنوان یک جایگزین در صورتی که هیچ ذخیره‌سازی پایداری به ChatEngine ارائه نشود، استفاده می‌شود.
 * @returns {StorageAdapter}
 */
const createInMemoryStorage = () => {
    let settings = null;
    const chats = new Map();

    // برای سادگی، این پیاده‌سازی از بارگذاری درخواستی پشتیبانی نمی‌کند و همیشه گپ کامل را برمی‌گرداند.
    return {
        async loadSettings() { return settings; },
        async saveSettings(newSettings) { settings = newSettings; },
        async loadChatList() { 
            // در حالت حافظه موقت، پیام‌ها همیشه در دسترس هستند، اما برای سازگاری API آنها را حذف می‌کنیم.
            const chatList = Array.from(chats.values()).map(chat => {
                const { messages, ...chatWithoutMessages } = chat;
                return chatWithoutMessages;
            });
            return chatList;
        },
        async loadChatById(chatId) { return chats.get(chatId) || null; },
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
     * @param {object} [options] - گزینه‌های پیکربندی.
     * @param {StorageAdapter} [options.storage] - یک آداپتور ذخیره‌سازی که رابط StorageAdapter را پیاده‌سازی می‌کند.
     * @param {Object.<string, ProviderHandler>} [options.providers] - یک map از نام ارائه‌دهندگان به توابع مدیریت‌کننده آن‌ها.
     * @param {string | object} [options.limits] - نام یک پیش‌تنظیم ('web', 'ide', 'mobile', 'unlimited') یا یک آبجکت محدودیت سفارشی.
     * @param {ProviderConfig} [options.defaultProvider] - یک ارائه‌دهنده پیش‌فرض که از `config.json` بارگذاری می‌شود.
     */
    constructor(options = {}) {
        super();
        // --- وضعیت اصلی ---
        /** @type {Array<Chat>} - لیستی از گپ‌ها (ممکن است شامل پیام‌ها نباشد) */
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
        /** @type {ProviderConfig | null} */
        this.defaultProvider = options.defaultProvider || null;

        if (!this.storage) {
            this.storage = createInMemoryStorage();
            console.warn(`
/******************************************************************\\
* هشدار GOUG: هیچ آداپتور ذخیره‌سازی ارائه نشده است.              *
* برنامه در حالت حافظه موقت (in-memory) اجرا خواهد شد.           *
* تمام گپ‌ها و تنظیمات پس از رفرش صفحه از بین خواهند رفت.       *
*                                                                *
* برای ذخیره پایدار داده‌ها، یک آداپتور ذخیره‌سازی در هنگام      *
* راه‌اندازی ChatEngine ارائه دهید.                              *
* مشاهده مستندات: docs/storageAdaptorGuide.md                   *
\\******************************************************************/
            `);
        }
        /** @type {Map<string, ProviderHandler>} */
        this.providers = new Map();
        
        // --- ماژول‌ها ---
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
        
        let mergedLimits = { ...DEFAULT_LIMITS };

        if (typeof limitsConfig === 'string' && PRESET_LIMITS[limitsConfig]) {
            const preset = PRESET_LIMITS[limitsConfig];
            mergedLimits = { ...mergedLimits, ...preset };
            mergedLimits.file = { ...DEFAULT_LIMITS.file, ...(preset.file || {}) };
            mergedLimits.image = { ...DEFAULT_LIMITS.image, ...(preset.image || {}) };

        } else if (typeof limitsConfig === 'object' && limitsConfig !== null) {
            const custom = limitsConfig;
            mergedLimits = { ...mergedLimits, ...custom };
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
     * بررسی می‌کند که آیا تنظیمات داده شده معتبر هستند یا خیر.
     * @param {Settings | null} settings - آبجکت تنظیمات برای بررسی.
     * @returns {boolean}
     */
    isSettingsValid(settings) {
        if (!settings || !settings.activeProviderId || !settings.providers) return false;
        
        const id = settings.activeProviderId;
        const providers = settings.providers;

        if (id === 'gemini') {
            return !!(providers.gemini?.apiKey && providers.gemini?.modelName);
        }
        if (id === 'openai') {
            return !!(providers.openai?.apiKey && providers.openai?.modelName);
        }
        if (providers.custom) {
            const activeCustom = providers.custom.find(p => p.id === id);
            return !!(activeCustom?.endpointUrl && activeCustom?.modelName);
        }
        return false;
    }

    /**
     * موتور را راه‌اندازی می‌کند، داده‌ها را بارگذاری کرده و رویداد 'init' را منتشر می‌کند.
     * @returns {Promise<void>}
     */
    async init() {
        try {
            this.settings = await this.storage.loadSettings();
            let isDefaultProvider = false;

            const emptySettings = { activeProviderId: null, providers: { gemini: {}, openai: {}, custom: [] } };
            
            // اگر تنظیمات ذخیره‌شده توسط کاربر وجود نداشته باشد یا خالی باشد
            if (!this.settings) {
                this.settings = emptySettings;
                if (this.defaultProvider) {
                    // ارائه‌دهنده پیش‌فرض را به عنوان تنظیمات اولیه اعمال کن
                    const { provider, ...config } = this.defaultProvider;
                    if (provider === 'custom') {
                        this.settings.providers.custom.push({ id: `default_${Date.now()}`, ...config });
                        this.settings.activeProviderId = this.settings.providers.custom[0].id;
                    } else if (provider === 'gemini' || provider === 'openai') {
                        this.settings.providers[provider] = config;
                        this.settings.activeProviderId = provider;
                    }
                    isDefaultProvider = this.isSettingsValid(this.settings);
                }
            } else {
                 // اطمینان از اینکه ساختار settings همیشه کامل است
                this.settings = { ...emptySettings, ...this.settings };
                this.settings.providers = { ...emptySettings.providers, ...this.settings.providers };
            }

            let loadedChatList = await this.storage.loadChatList();
            
            this.chats = loadedChatList.filter(chat => 
                chat && typeof chat.id === 'string' && typeof chat.updatedAt === 'number'
            );
            
            let activeChat;
            if (this.chats.length === 0) {
                activeChat = await this.chatManager.startNewChat(false); // ایجاد گپ اولیه بدون انتشار رویداد
            } else {
                // فعال کردن گپی که اخیراً به‌روزرسانی شده
                const latestChatStub = this.chats.sort((a,b) => b.updatedAt - a.updatedAt)[0];
                this.activeChatId = latestChatStub.id;

                // بارگذاری پیام‌های گپ فعال برای نمایش اولیه
                const fullActiveChat = await this.storage.loadChatById(this.activeChatId);
                if (fullActiveChat) {
                    const index = this.chats.findIndex(c => c.id === this.activeChatId);
                    if (index !== -1) this.chats[index] = fullActiveChat;
                    activeChat = fullActiveChat;
                } else {
                    // اگر گپ فعال یافت نشد (مثلاً به دلیل خرابی داده)، یک گپ جدید ایجاد کن
                    console.error(`گپ فعال با شناسه ${this.activeChatId} یافت نشد. یک گپ جدید ایجاد می‌شود.`);
                    activeChat = await this.chatManager.startNewChat(false);
                }
            }

            const initPayload = {
                settings: this.settings,
                chats: this.chats,
                activeChat: activeChat,
                isDefaultProvider: isDefaultProvider
            };
            this.emit('init', initPayload);
            
            this.syncManager.setup();

        } catch (error) {
            console.error('خطا در هنگام راه‌اندازی ChatEngine:', error);
            this.emit('error', error.message || 'خطا در بارگذاری تاریخچه گفتگوها.');
            // پرتاب مجدد خطا تا در لایه بالاتر مدیریت شود
            throw error;
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

    // --- متدهای واگذار شده (Delegated Methods) ---

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
     * @returns {Promise<void>}
     */
    async switchActiveChat(chatId) {
        await this.chatManager.switchActiveChat(chatId);
    }

    /**
     * پیکربندی مدل برای یک گپ خاص را به‌روزرسانی می‌کند.
     * @param {string} chatId - شناسه گپ برای به‌روزرسانی.
     * @param {ProviderConfig} providerConfig - پیکربندی جدید ارائه‌دهنده.
     * @returns {Promise<void>}
     */
    updateChatModel(chatId, providerConfig) {
        return this.chatManager.updateChatModel(chatId, providerConfig);
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

    /**
     * تمام منابع استفاده شده توسط موتور، از جمله شنوندگان و وظایف پس‌زمینه را پاک‌سازی می‌کند.
     * @returns {void}
     */
    destroy() {
        this.syncManager.destroy();
        this.storageManager.destroy();
        super.destroy(); // تمام شنوندگان رویداد پاک می‌شوند
        console.log('ChatEngine نابود شد.');
    }
}

export default ChatEngine;