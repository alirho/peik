import EventEmitter from './eventEmitter.js';
import PluginManager from './pluginManager.js';
import Chat from './chat.js';
import { PeikError, StorageError } from './utils/errors.js';
import { Serializer } from './utils/serializer.js';

export default class Peik extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config; // تنظیمات اولیه (مثل defaultProvider)
        
        this.settings = { providers: { custom: [] } }; // تنظیمات کاربر
        this.pluginManager = new PluginManager(this);
        
        this.chats = []; // لیستی از خلاصه چت‌ها (بدون پیام)
        
        // activeChat حذف شد تا هسته بدون وضعیت (Stateless) باشد

        // نگهداری وضعیت Runtime چت‌ها (غیر قابل سریال‌سازی)
        // Key: chatId, Value: { isSending: boolean, abortController: AbortController }
        this.chatRuntimeStates = new Map();
    }

    /**
     * ثبت افزونه (زنجیره‌ای و Async)
     * @param {import('./plugin.js').default} plugin 
     * @returns {Promise<Peik>}
     */
    async use(plugin) {
        await this.pluginManager.register(plugin);
        return this;
    }

    /**
     * راه‌اندازی نهایی سیستم
     */
    async init() {
        // 1. بارگذاری تنظیمات از Storage
        const storage = this.getStorage();
        if (storage) {
            try {
                const loadedSettings = await storage.loadSettings();
                if (loadedSettings) {
                    this.settings = { ...this.settings, ...loadedSettings };
                }
                
                // 2. بارگذاری لیست چت‌ها
                this.chats = await storage.getAllChats();
                
                // 3. مقداردهی اولیه وضعیت Runtime برای چت‌های لود شده
                this.chats.forEach(chat => {
                    if (!this.chatRuntimeStates.has(chat.id)) {
                        this.chatRuntimeStates.set(chat.id, { isSending: false, abortController: null });
                    }
                });

            } catch (error) {
                console.error('خطا در بارگذاری اولیه:', error);
                this.emit('error', new StorageError('بارگذاری داده‌ها ناموفق بود.'));
            }
        } else {
            console.warn('هیچ افزونه ذخیره‌سازی (Storage) یافت نشد. داده‌ها ذخیره نخواهند شد.');
        }

        this.emit('ready', { settings: this.settings, chats: this.chats });
    }

    /**
     * دریافت افزونه ذخیره‌سازی فعال
     * (اولین افزونه‌ای که category='storage' داشته باشد)
     */
    getStorage() {
        const storages = this.pluginManager.getPluginsByCategory('storage');
        return storages.length > 0 ? storages[0] : null;
    }

    /**
     * پیدا کردن افزونه ارائه‌دهنده (Provider) بر اساس اطلاعات مدل
     * @param {object} modelInfo 
     * @returns {object|undefined} افزونه Provider
     */
    getProvider(modelInfo) {
        const providerName = modelInfo.provider;
        const plugins = this.pluginManager.getPluginsByCategory('provider');
        return plugins.find(p => p.constructor.metadata.name === providerName);
    }

    /**
     * ایجاد یک چت جدید
     */
    async createChat(title = 'گپ جدید') {
        const defaultModel = this._getDefaultModelInfo();
        
        const chatData = {
            id: `chat_${Date.now()}`,
            title,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            modelInfo: defaultModel
        };

        const chat = new Chat(this, chatData);
        
        // ایجاد رکورد وضعیت Runtime
        this.chatRuntimeStates.set(chat.id, { isSending: false, abortController: null });
        
        // افزودن به لیست خلاصه‌ها
        this.chats.unshift(chat.toJSON()); // فقط دیتا را نگه می‌داریم
        
        // ذخیره
        await chat.save();
        
        this.emit('chat:created', chat);
        return chat;
    }

    /**
     * دریافت یک چت کامل (با پیام‌ها)
     * @param {string} chatId 
     * @returns {Promise<Chat>}
     */
    async getChat(chatId) {
        const storage = this.getStorage();
        if (!storage) throw new StorageError('ذخیره‌سازی در دسترس نیست.');

        const chatData = await storage.loadChat(chatId);
        if (!chatData) throw new PeikError('چت یافت نشد.');

        // اطمینان از وجود وضعیت Runtime (برای چت‌هایی که شاید دستی لود شده‌اند)
        if (!this.chatRuntimeStates.has(chatId)) {
            this.chatRuntimeStates.set(chatId, { isSending: false, abortController: null });
        }

        // همیشه یک نمونه جدید می‌سازیم (Cache حذف شد)
        const chatInstance = new Chat(this, chatData);
        return chatInstance;
    }

    /**
     * تغییر نام گپ
     * @param {string} chatId 
     * @param {string} newTitle 
     */
    async renameChat(chatId, newTitle) {
        const chat = await this.getChat(chatId);
        if (chat) {
            await chat.updateTitle(newTitle);
            
            // به‌روزرسانی لیست خلاصه چت‌ها
            const chatIndex = this.chats.findIndex(c => c.id === chatId);
            if (chatIndex !== -1) {
                this.chats[chatIndex].title = newTitle;
                this.chats[chatIndex].updatedAt = Date.now();
                this.emit('chat:updated', this.chats[chatIndex]);
            }
        }
    }

    /**
     * حذف چت
     * @param {string} chatId 
     */
    async deleteChat(chatId) {
        const storage = this.getStorage();
        if (storage) {
            await storage.deleteChat(chatId);
        }
        
        this.chats = this.chats.filter(c => c.id !== chatId);
        
        // پاک کردن وضعیت Runtime
        this.chatRuntimeStates.delete(chatId);
        
        this.emit('chat:deleted', chatId);
    }

    /**
     * ذخیره تنظیمات سراسری
     * @param {object} newSettings 
     */
    async updateSettings(newSettings) {
        this.settings = newSettings;
        const storage = this.getStorage();
        if (storage) {
            await storage.saveSettings(this.settings);
        }
        this.emit('settings:updated', this.settings);
    }

    /**
     * ذخیره تنظیمات کاربر (نام مستعار برای updateSettings جهت سازگاری با کدهای موجود)
     * @param {object} settings 
     */
    async saveSettings(settings) {
        return this.updateSettings(settings);
    }

    /**
     * بررسی اعتبار تنظیمات
     * @param {object} settings 
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
     * منطق پیدا کردن پیکربندی کامل مدل (مشابه نسخه قبل)
     * @param {object} modelInfo 
     */
    resolveProviderConfig(modelInfo) {
        if (!modelInfo) return null;
        
        // منطق جستجو در settings.providers و config.defaultProvider
        // (کد ساده شده برای اختصار)
        const { provider, customProviderId } = modelInfo;
        
        if (this.settings.providers) {
            if (provider === 'custom') {
                return this.settings.providers.custom?.find(p => p.id === customProviderId);
            }
            if (this.settings.providers[provider]) {
                return { provider, ...this.settings.providers[provider] };
            }
        }
        
        // Fallback to default config
        if (this.config.defaultProvider && this.config.defaultProvider.provider === provider) {
             return this.config.defaultProvider;
        }

        return null;
    }

    /**
     * اطلاعات نمایشی مدل را برمی‌گرداند.
     * @param {object} modelInfo 
     */
    getModelDisplayInfo(modelInfo) {
        if (!modelInfo) {
            return { displayName: 'نامشخص', modelName: 'unknown', provider: 'custom' };
        }

        const resolvedConfig = this.resolveProviderConfig(modelInfo);
        
        if (resolvedConfig) {
            return {
                displayName: resolvedConfig.name || (resolvedConfig.provider === 'gemini' ? 'Gemini' : resolvedConfig.provider === 'openai' ? 'ChatGPT' : 'سفارشی'),
                modelName: resolvedConfig.modelName,
                provider: resolvedConfig.provider
            };
        } else {
            return {
                displayName: modelInfo.displayName || 'مدل حذف شده',
                modelName: modelInfo.modelName,
                provider: modelInfo.provider
            };
        }
    }

    _getDefaultModelInfo() {
        // منطق انتخاب مدل پیش‌فرض
        if (this.settings.activeProviderId) {
            // ... logic to find active provider info
            const id = this.settings.activeProviderId;
            if (id === 'gemini' || id === 'openai') {
                const p = this.settings.providers[id];
                return { provider: id, displayName: id === 'gemini' ? 'Gemini' : 'ChatGPT', modelName: p?.modelName };
            }
            const custom = this.settings.providers.custom?.find(c => c.id === id);
            if (custom) {
                return { provider: 'custom', customProviderId: custom.id, displayName: custom.name, modelName: custom.modelName };
            }
        }
        
        if (this.config.defaultProvider) {
            const def = this.config.defaultProvider;
            return { provider: def.provider, displayName: def.name || def.provider, modelName: def.modelName };
        }

        return { provider: 'unknown', displayName: 'نامشخص', modelName: '' };
    }
}