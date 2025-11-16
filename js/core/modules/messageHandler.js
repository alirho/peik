// JSDoc Type Imports
/** @typedef {import('../../types.js').ImageData} ImageData */
/** @typedef {import('../chatEngine.js').default} ChatEngine */

/**
 * Generates a unique ID for a message.
 * @returns {string} The unique message ID.
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
    }

    /**
     * یک پیام جدید از کاربر دریافت کرده، به تاریخچه اضافه می‌کند و برای دریافت پاسخ به ارائه‌دهنده ارسال می‌کند.
     * @param {string} userInput - متن پیام کاربر.
     * @param {ImageData | null} [image=null] - داده‌های تصویر پیوست شده (اختیاری).
     * @returns {Promise<void>}
     */
    async sendMessage(userInput, image = null) {
        if (this.engine.isLoading || !this.engine.activeChatId) return;

        const { maxMessageLength, maxMessagesPerChat } = this.engine.limits;

        // --- Provider and Settings Validation ---
        if (!this.engine.settings || !this.engine.settings.provider || (!this.engine.settings.apiKey && this.engine.settings.provider !== 'custom')) {
            this.engine.emit('error', 'تنظیمات API صحیح نیست. لطفاً تنظیمات را بررسی کنید.');
            return;
        }
        const providerStreamer = this.engine.providers.get(this.engine.settings.provider);
        if (!providerStreamer) {
            this.engine.emit('error', `ارائه‌دهنده ${this.engine.settings.provider} پشتیبانی نمی‌شود.`);
            return;
        }

        // --- Input Validation ---
        const hasText = typeof userInput === 'string' && userInput.trim().length > 0;
        const hasImage = image && typeof image === 'object';
        if (!hasText && !hasImage) return;

        if (userInput && typeof userInput !== 'string') {
            this.engine.emit('error', 'ورودی پیام نامعتبر است.');
            return;
        }
        if (maxMessageLength !== Infinity && hasText && userInput.length > maxMessageLength) {
            this.engine.emit('error', `متن پیام نمی‌تواند بیشتر از ${maxMessageLength} کاراکتر باشد.`);
            return;
        }
        if (hasImage && (typeof image.data !== 'string' || !image.data || typeof image.mimeType !== 'string' || !image.mimeType)) {
             this.engine.emit('error', 'ساختار فایل تصویر پیوست شده نامعتبر است.');
            return;
        }

        const activeChat = this.engine.getActiveChat();
        if (!activeChat) return;

        // --- Chat Limits Validation ---
        const userMessageCount = activeChat.messages.filter(m => m.role === 'user').length;
        if (maxMessagesPerChat !== Infinity && userMessageCount >= maxMessagesPerChat) {
            this.engine.emit('error', `حداکثر ${maxMessagesPerChat} پیام در هر گپ مجاز است.`);
            return;
        }

        this.engine.setLoading(true);
        
        // --- Message Creation & UI Update ---
        const userMessage = {
            id: generateMessageId(),
            timestamp: Date.now(),
            role: 'user',
            content: userInput,
            ...(image && { image })
        };

        activeChat.messages.push(userMessage);
        this.engine.emit('message', userMessage);
        
        // --- Auto-titling Logic ---
        if (activeChat.messages.length === 1) {
            let title = userInput.substring(0, 30);
            if (!title && image) title = 'گپ با تصویر';
            if (userInput.length > 30) title += '...';
            activeChat.title = title;
            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
            this.engine.emit('activeChatSwitched', activeChat);
        }

        // --- API Call ---
        const modelMessage = { id: generateMessageId(), timestamp: Date.now(), role: 'model', content: '' };
        activeChat.messages.push(modelMessage);
        this.engine.emit('message', modelMessage);

        let fullResponse = '';
        try {
            const historyForApi = activeChat.messages.slice(0, -1);
            
            await providerStreamer(
                this.engine.settings,
                historyForApi,
                (chunk) => {
                    fullResponse += chunk;
                    this.engine.emit('chunk', chunk);
                }
            );

            const lastMsg = activeChat.messages[activeChat.messages.length - 1];
            if (lastMsg) lastMsg.content = fullResponse;

        } catch (error) {
            const errorMessage = error.message || 'یک خطای ناشناخته رخ داد.';
            // Remove the empty model message placeholder on error
            if (activeChat.messages.length > 0 && activeChat.messages[activeChat.messages.length - 1].role === 'model') {
                activeChat.messages.pop();
                this.engine.emit('messageRemoved');
            }
            this.engine.emit('error', errorMessage);
        } finally {
            activeChat.updatedAt = Date.now();
            await this.engine.storageManager.save(activeChat);
            this.engine.syncManager.broadcastUpdate();
            this.engine.emit('streamEnd', fullResponse);
            this.engine.setLoading(false);
        }
    }
}

export default MessageHandler;