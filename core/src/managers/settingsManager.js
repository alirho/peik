import { Serializer } from '../utils/serializer.js';

export default class SettingsManager {
    /**
     * @param {import('../peik.js').default} peik 
     */
    constructor(peik) {
        this.peik = peik;
        this.settings = { providers: { custom: [] } };
    }

    /**
     * بارگذاری تنظیمات از ذخیره‌ساز
     */
    async load() {
        const storage = this.peik.getStorage();
        if (storage) {
            const loadedSettings = await storage.loadSettings();
            if (loadedSettings) {
                this.settings = { ...this.settings, ...loadedSettings };
            }
        }
        return this.settings;
    }

    /**
     * ذخیره تنظیمات سراسری
     * @param {object} newSettings 
     */
    async updateSettings(newSettings) {
        this.settings = newSettings;
        const storage = this.peik.getStorage();
        if (storage) {
            await storage.saveSettings(this.settings);
        }
        this.peik.emit('settings:updated', this.settings);
    }

    /**
     * ذخیره تنظیمات کاربر (نام مستعار)
     * @param {object} settings 
     */
    async saveSettings(settings) {
        return this.updateSettings(settings);
    }

    /**
     * بررسی اعتبار تنظیمات
     * @param {object} settings 
     */
    isValid(settings) {
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
}