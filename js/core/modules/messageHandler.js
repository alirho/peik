// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').ImageData} ImageData */
/** @typedef {import('../../types.js').ProviderConfig} ProviderConfig */
/** @typedef {import('../chatEngine.js').default} ChatEngine */

/**
 * یک شناسه یکتا برای پیام ایجاد می‌کند.
 * @returns {string} شناسه پیام یکتا.
 */
function generateMessageId() {
    const timestamp = Date.now();
    const randomPart = Math.random().toString(36).substring(2, 9);
    return `msg_${timestamp}_${randomPart}`;
}

/**
 * فرآیند ارسال پیام، از اعتبارسنجی ورودی تا ارتباط با ارائه‌دهنده API را مدیریت می‌کند.
 */
class MessageHandler {
    /**
     * @param {ChatEngine} engine - نمونه اصلی موتور چت.
     */
    constructor(engine) {
        /** @type {ChatEngine} */
        this.engine = engine;
        /** @type {AbortController | null} */
        this.abortController = null;
    }
    
    /**
     * هر درخواست استریم در حال اجرا را لغو می‌کند.
     */
    cancelCurrentStream() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
    }

    /**
     * یک پیام جدید از کاربر دریافت کرده، به تاریخچه اضافه می‌کند و برای دریافت پاسخ به ارائه‌دهنده ارسال می‌کند.
     * @param {string} userInput - متن پیام کاربر.
     * @param {ImageData | null} [image=null] - داده‌های تصویر پیوست شده (اختیاری).
     * @returns {Promise<void>}
     */
    async sendMessage(userInput, image = null) {
        this.cancelCurrentStream();
        const currentController = new AbortController();
        this.abortController = currentController;
        
        if (this.engine.isLoading || !this.engine.activeChatId) return;

        const { maxMessageLength, maxMessagesPerChat } = this.engine.limits;

        let activeChat = this.engine.getActiveChat();
        if (!activeChat || !activeChat.messages) {
            this.engine.emit('error', 'گپ فعال برای ارسال پیام در دسترس نیست.');
            return;
        }

        // --- اعتبارسنجی مدل ---
        // پیکربندی کامل را از مرجع مدل گپ دریافت کن.
        const providerConfig = this.engine.resolveProviderConfig(activeChat.modelInfo);

        // اگر پیکربندی پیدا نشد (یعنی مدل حذف شده است)، به کاربر خطا نمایش بده و متوقف شو.
        if (!providerConfig) {
            const modelName = activeChat.modelInfo?.displayName || activeChat.modelInfo?.modelName || 'ناشناخته';
            this.engine.emit('error', `مدل «${modelName}» در تنظیمات موجود نیست. لطفاً مدل دیگری انتخاب کنید.`);
            return;
        }

        const providerStreamer = this.engine.providers.get(providerConfig.provider);
        if (!providerStreamer) {
            this.engine.emit('error', `ارائه‌دهنده ${providerConfig.provider} پشتیبانی نمی‌شود.`);
            return;
        }

        // --- اعتبارسنجی ورودی ---
        const hasText = typeof userInput === 'string' && userInput.trim().length > 0;
        const hasImage = image && typeof image === 'object';
        if (!hasText && !hasImage) return;

        if (maxMessageLength !== Infinity && hasText && userInput.length > maxMessageLength) {
            this.engine.emit('error', `متن پیام نمی‌تواند بیشتر از ${maxMessageLength} کاراکتر باشد.`);
            return;
        }

        const userMessageCount = activeChat.messages.filter(m => m.role === 'user').length;
        if (maxMessagesPerChat !== Infinity && userMessageCount >= maxMessagesPerChat) {
            this.engine.emit('error', `حداکثر ${maxMessagesPerChat} پیام در هر گپ مجاز است.`);
            return;
        }

        this.engine.setLoading(true);
        
        const userMessage = { id: generateMessageId(), timestamp: Date.now(), role: 'user', content: userInput, ...(image && { image }) };
        activeChat.messages.push(userMessage);
        this.engine.emit('message', userMessage);
        
        if (activeChat.messages.length === 1 && (userInput || image)) {
            let title = userInput.substring(0, 30) || (image ? 'گپ با تصویر' : 'گپ جدید');
            if (userInput.length > 30) title += '...';
            await this.engine.chatManager.renameChat(activeChat.id, title);
        }

        const modelMessage = { id: generateMessageId(), timestamp: Date.now(), role: 'model', content: '' };
        activeChat.messages.push(modelMessage);
        this.engine.emit('message', modelMessage);

        let fullResponse = '';
        try {
            const historyForApi = activeChat.messages.slice(0, -1);
            
            await providerStreamer(
                providerConfig, // از پیکربندی کامل و معتبر استفاده کن
                historyForApi,
                (chunk) => {
                    fullResponse += chunk;
                    this.engine.emit('chunk', chunk);
                },
                currentController.signal
            );

            const lastMsg = activeChat.messages[activeChat.messages.length - 1];
            if (lastMsg) lastMsg.content = fullResponse;

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('درخواست به صورت عمدی لغو شد.');
                 if (activeChat.messages.length > 0 && activeChat.messages[activeChat.messages.length - 1].id === modelMessage.id) {
                    activeChat.messages.pop();
                    this.engine.emit('messageRemoved');
                }
            } else {
                console.error('فراخوانی API ناموفق بود:', error);
                const errorMessage = error.message || 'یک خطای ناشناخته رخ داد.';
                if (activeChat.messages.length > 0 && activeChat.messages[activeChat.messages.length - 1].role === 'model') {
                    activeChat.messages.pop();
                    this.engine.emit('messageRemoved');
                }
                this.engine.emit('error', errorMessage);
            }
        } finally {
            if (this.abortController === currentController) {
                this.abortController = null;
            }
            activeChat.updatedAt = Date.now();
            await this.engine.storageManager.save(activeChat);
            this.engine.syncManager.broadcastUpdate();
            this.engine.emit('streamEnd', fullResponse);
            this.engine.setLoading(false);
        }
    }
}

export default MessageHandler;