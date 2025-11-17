// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').ImageData} ImageData */
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
        // لغو هر درخواست قبلی قبل از شروع یک درخواست جدید.
        this.cancelCurrentStream();

        // ایجاد یک کنترلر جدید برای درخواست فعلی.
        const currentController = new AbortController();
        this.abortController = currentController;
        
        if (this.engine.isLoading || !this.engine.activeChatId) {
            return;
        }

        const { maxMessageLength, maxMessagesPerChat } = this.engine.limits;

        // --- اعتبارسنجی ارائه‌دهنده و تنظیمات ---
        if (!this.engine.settings || !this.engine.settings.provider || (!this.engine.settings.apiKey && this.engine.settings.provider !== 'custom')) {
            this.engine.emit('error', 'تنظیمات API صحیح نیست. لطفاً تنظیمات را بررسی کنید.');
            return;
        }
        const providerStreamer = this.engine.providers.get(this.engine.settings.provider);
        if (!providerStreamer) {
            this.engine.emit('error', `ارائه‌دهنده ${this.engine.settings.provider} پشتیبانی نمی‌شود.`);
            return;
        }

        // --- اعتبارسنجی ورودی ---
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
        if (!activeChat || !activeChat.messages) {
            // این حالت نباید رخ دهد چون پیام‌ها باید قبل از ارسال بارگذاری شده باشند
            this.engine.emit('error', 'گپ فعال برای ارسال پیام در دسترس نیست.');
            return;
        }

        // --- اعتبارسنجی محدودیت‌های گپ ---
        const userMessageCount = activeChat.messages.filter(m => m.role === 'user').length;
        if (maxMessagesPerChat !== Infinity && userMessageCount >= maxMessagesPerChat) {
            this.engine.emit('error', `حداکثر ${maxMessagesPerChat} پیام در هر گپ مجاز است.`);
            return;
        }

        this.engine.setLoading(true);
        
        // --- ایجاد پیام و به‌روزرسانی UI ---
        const userMessage = {
            id: generateMessageId(),
            timestamp: Date.now(),
            role: 'user',
            content: userInput,
            ...(image && { image })
        };

        activeChat.messages.push(userMessage);
        this.engine.emit('message', userMessage);
        
        // --- منطق عنوان‌دهی خودکار ---
        if (activeChat.messages.length === 1) {
            let title = userInput.substring(0, 30);
            if (!title && image) title = 'گپ با تصویر';
            if (userInput.length > 30) title += '...';
            activeChat.title = title;
            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
            this.engine.emit('activeChatSwitched', activeChat);
        }

        // --- فراخوانی API ---
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
                },
                currentController.signal // ارسال سیگنال به ارائه‌دهنده
            );

            const lastMsg = activeChat.messages[activeChat.messages.length - 1];
            if (lastMsg) lastMsg.content = fullResponse;

        } catch (error) {
            // مدیریت لغو عمدی درخواست
            if (error.name === 'AbortError') {
                console.log('درخواست به صورت عمدی لغو شد.');
                 // حذف پیام خالی مدل در صورت لغو
                 if (activeChat.messages.length > 0 && activeChat.messages[activeChat.messages.length - 1].id === modelMessage.id) {
                    activeChat.messages.pop();
                    this.engine.emit('messageRemoved');
                }
            } else {
                console.error('فراخوانی API ناموفق بود:', error);
                const errorMessage = error.message || 'یک خطای ناشناخته رخ داد.';
                // حذف پیام خالی مدل در صورت خطا
                if (activeChat.messages.length > 0 && activeChat.messages[activeChat.messages.length - 1].role === 'model') {
                    activeChat.messages.pop();
                    this.engine.emit('messageRemoved');
                }
                this.engine.emit('error', errorMessage);
            }
        } finally {
            // کنترلر را فقط در صورتی null کن که هنوز کنترلر فعال باشد
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
