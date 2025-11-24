export default class ModelInfoHelper {
    /**
     * @param {import('../peik.js').default} peik 
     */
    constructor(peik) {
        this.peik = peik;
    }

    /**
     * اطلاعات نمایشی مدل را برمی‌گرداند.
     * @param {object} modelInfo 
     */
    getDisplayInfo(modelInfo) {
        if (!modelInfo) {
            return { displayName: 'نامشخص', modelName: 'unknown', provider: 'custom' };
        }

        // استفاده از سرویس دیگر برای رزولیو کردن کانفیگ
        const resolvedConfig = this.peik.providerResolver.resolveProviderConfig(modelInfo);
        
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
}