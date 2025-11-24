export default class ProviderResolver {
    /**
     * @param {import('../peik.js').default} peik 
     */
    constructor(peik) {
        this.peik = peik;
    }

    /**
     * پیدا کردن افزونه ارائه‌دهنده (Provider) بر اساس اطلاعات مدل
     * @param {object} modelInfo 
     * @returns {object|undefined} افزونه Provider
     */
    getProvider(modelInfo) {
        const providerName = modelInfo.provider;
        const plugins = this.peik.pluginManager.getPluginsByCategory('provider');
        return plugins.find(p => p.constructor.metadata.name === providerName);
    }

    /**
     * منطق پیدا کردن پیکربندی کامل مدل
     * @param {object} modelInfo 
     */
    resolveProviderConfig(modelInfo) {
        if (!modelInfo) return null;
        
        const { provider, customProviderId } = modelInfo;
        const settings = this.peik.settingsManager.settings;
        const config = this.peik.config;
        
        if (settings.providers) {
            if (provider === 'custom') {
                return settings.providers.custom?.find(p => p.id === customProviderId);
            }
            if (settings.providers[provider]) {
                return { provider, ...settings.providers[provider] };
            }
        }
        
        // Fallback to default config
        if (config.defaultProvider && config.defaultProvider.provider === provider) {
             return config.defaultProvider;
        }

        return null;
    }

    /**
     * دریافت اطلاعات مدل پیش‌فرض بر اساس تنظیمات فعال
     */
    getDefaultModelInfo() {
        const settings = this.peik.settingsManager.settings;
        const config = this.peik.config;

        // منطق انتخاب مدل پیش‌فرض از تنظیمات کاربر
        if (settings.activeProviderId) {
            const id = settings.activeProviderId;
            if (id === 'gemini' || id === 'openai') {
                const p = settings.providers[id];
                return { provider: id, displayName: id === 'gemini' ? 'Gemini' : 'ChatGPT', modelName: p?.modelName };
            }
            const custom = settings.providers.custom?.find(c => c.id === id);
            if (custom) {
                return { provider: 'custom', customProviderId: custom.id, displayName: custom.name, modelName: custom.modelName };
            }
        }
        
        // Fallback به کانفیگ اولیه
        if (config.defaultProvider) {
            const def = config.defaultProvider;
            return { provider: def.provider, displayName: def.name || def.provider, modelName: def.modelName };
        }

        return { provider: 'unknown', displayName: 'نامشخص', modelName: '' };
    }
}