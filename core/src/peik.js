import EventEmitter from './eventEmitter.js';
import PluginManager from './pluginManager.js';
import ChatManager from './managers/chatManager.js';
import SettingsManager from './managers/settingsManager.js';
import ProviderResolver from './services/providerResolver.js';
import ModelInfoHelper from './services/modelInfoHelper.js';
import { StorageError } from './utils/errors.js';

export default class Peik extends EventEmitter {
    constructor(config = {}) {
        super();
        this.config = config;

        // راه‌اندازی ماژول‌های داخلی
        this.pluginManager = new PluginManager(this);
        this.settingsManager = new SettingsManager(this);
        this.chatManager = new ChatManager(this);
        this.providerResolver = new ProviderResolver(this);
        this.modelInfoHelper = new ModelInfoHelper(this);
    }

    // --- Accessors for backward compatibility or easier access ---
    get settings() { return this.settingsManager.settings; }
    set settings(val) { this.settingsManager.settings = val; } // Caution: direct set bypasses save
    get chats() { return this.chatManager.chats; }
    get chatRuntimeStates() { return this.chatManager.chatRuntimeStates; }

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
        const storage = this.getStorage();
        if (!storage) {
            console.warn('هیچ افزونه ذخیره‌سازی (Storage) یافت نشد. داده‌ها ذخیره نخواهند شد.');
        }

        try {
            // ۱. بارگذاری تنظیمات
            await this.settingsManager.load();
            
            // ۲. بارگذاری چت‌ها
            await this.chatManager.load();

        } catch (error) {
            console.error('خطا در بارگذاری اولیه:', error);
            this.emit('error', new StorageError('بارگذاری داده‌ها ناموفق بود.'));
        }

        this.emit('ready', { 
            settings: this.settingsManager.settings, 
            chats: this.chatManager.chats 
        });
    }

    /**
     * دریافت افزونه ذخیره‌سازی فعال
     */
    getStorage() {
        const storages = this.pluginManager.getPluginsByCategory('storage');
        return storages.length > 0 ? storages[0] : null;
    }

    // --- Proxy Methods for ChatManager ---

    async createChat(title) {
        return this.chatManager.createChat(title);
    }

    async getChat(chatId) {
        return this.chatManager.getChat(chatId);
    }

    async deleteChat(chatId) {
        return this.chatManager.deleteChat(chatId);
    }

    async renameChat(chatId, newTitle) {
        return this.chatManager.renameChat(chatId, newTitle);
    }

    // --- Proxy Methods for SettingsManager ---

    async updateSettings(newSettings) {
        return this.settingsManager.updateSettings(newSettings);
    }

    async saveSettings(settings) {
        return this.settingsManager.saveSettings(settings);
    }

    isSettingsValid(settings) {
        return this.settingsManager.isValid(settings);
    }

    // --- Proxy Methods for Services ---

    getProvider(modelInfo) {
        return this.providerResolver.getProvider(modelInfo);
    }

    resolveProviderConfig(modelInfo) {
        return this.providerResolver.resolveProviderConfig(modelInfo);
    }

    getModelDisplayInfo(modelInfo) {
        return this.modelInfoHelper.getDisplayInfo(modelInfo);
    }
}