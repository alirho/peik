// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').Chat} Chat */
/** @typedef {import('../../types.js').ProviderConfig} ProviderConfig */
/** @typedef {import('../chatEngine.js').default} ChatEngine */

/**
 * تمام عملیات مربوط به مدیریت گپ‌ها (ایجاد، حذف، تغییر نام، جابجایی) را مدیریت می‌کند.
 */
class ChatManager {
    /**
     * @param {ChatEngine} engine - نمونه اصلی موتور چت برای دسترسی به وضعیت و رویدادها.
     */
    constructor(engine) {
        /** @type {ChatEngine} */
        this.engine = engine;
    }

    /**
     * پیکربندی ارائه‌دهنده فعال را برای گپ‌های جدید تعیین می‌کند.
     * اولویت با تنظیمات فعال کاربر است، سپس به پیکربندی پیش‌فرض از config.json بازمی‌گردد.
     * @returns {ProviderConfig | null}
     * @private
     */
    _getDefaultProviderConfig() {
        const settings = this.engine.settings;
        
        // اولویت ۱: تنظیمات فعال کاربر
        if (settings && this.engine.isSettingsValid(settings)) {
            const id = settings.activeProviderId;
            const providers = settings.providers;
            
            if (id === 'gemini') {
                return { provider: 'gemini', ...providers.gemini, name: 'Gemini' };
            }
            if (id === 'openai') {
                return { provider: 'openai', ...providers.openai, name: 'ChatGPT' };
            }
            const customConfig = providers.custom.find(p => p.id === id);
            if (customConfig) {
                // یک کپی تمیز برای جلوگیری از جهش ایجاد کن
                return {
                    provider: 'custom',
                    name: customConfig.name,
                    modelName: customConfig.modelName,
                    apiKey: customConfig.apiKey,
                    endpointUrl: customConfig.endpointUrl,
                    customProviderId: customConfig.id,
                };
            }
        }
        
        // اولویت ۲: ارائه‌دهنده پیش‌فرض از config.json
        if (this.engine.defaultProvider) {
            // ساختار defaultProvider را اعتبارسنجی ساده کن
            const { provider, modelName, apiKey } = this.engine.defaultProvider;
            if (provider && modelName && apiKey) {
                return this.engine.defaultProvider;
            }
        }

        return null;
    }

    /**
     * یک گپ جدید ایجاد کرده و آن را به عنوان گپ فعال تنظیم می‌کند.
     * @param {boolean} [emitUpdate=true] - اگر true باشد، رویدادها برای UI منتشر می‌شوند.
     * @returns {Promise<Chat>}
     */
    async startNewChat(emitUpdate = true) {
        // لغو هرگونه استریم در حال اجرا قبل از شروع یک گپ جدید
        this.engine.messageHandler.cancelCurrentStream();

        const { maxChats } = this.engine.limits;
        if (maxChats !== Infinity && this.engine.chats.length >= maxChats) {
            this.engine.emit('error', `حداکثر تعداد ${maxChats} گپ مجاز است.`);
            return;
        }
        
        const defaultConfig = this._getDefaultProviderConfig();
        if (!defaultConfig && this.engine.chats.length === 0) {
            // اگر هیچ گپی وجود نداشته باشد و هیچ پیکربندی معتبری هم نباشد، کاری انجام نده.
            // UI باید مودال تنظیمات را نشان دهد.
            return;
        }
        
        const now = Date.now();
        const newChat = {
            id: `chat_${now}`,
            title: 'گپ جدید',
            messages: [], // گپ جدید با پیام‌های خالی شروع می‌شود (از قبل بارگذاری شده).
            createdAt: now,
            updatedAt: now,
            providerConfig: defaultConfig || { provider: 'unknown', modelName: 'unknown' }
        };

        this.engine.chats.push(newChat);
        this.engine.activeChatId = newChat.id;
        
        if (emitUpdate) {
            this.engine.emit('activeChatSwitched', newChat);
            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
            await this.engine.storageManager.save(newChat);
            this.engine.syncManager.broadcastUpdate();
        }
        return newChat;
    }
    
    /**
     * گپ فعال فعلی را به گپ دیگری با شناسه مشخص تغییر می‌دهد.
     * در صورت لزوم، پیام‌های گپ مقصد را به صورت درخواستی بارگذاری می‌کند.
     * @param {string} chatId - شناسه گپ مورد نظر.
     * @returns {Promise<void>}
     */
    async switchActiveChat(chatId) {
        if (chatId === this.engine.activeChatId && this.getActiveChat()?.messages) {
            return; // اگر گپ از قبل فعال و بارگذاری شده است، کاری انجام نده.
        }

        // لغو هرگونه استریم در حال اجرا از گپ قبلی قبل از جابجایی
        this.engine.messageHandler.cancelCurrentStream();
        
        const chatIndex = this.engine.chats.findIndex(c => c.id === chatId);
        if (chatIndex === -1) {
            console.warn(`گپ با شناسه ${chatId} برای جابجایی یافت نشد.`);
            return;
        }

        let chatToActivate = this.engine.chats[chatIndex];
        this.engine.activeChatId = chatId;
        
        // اگر پیام‌ها هنوز بارگذاری نشده‌اند، آنها را از حافظه دریافت کن
        if (!chatToActivate.messages) {
            this.engine.setLoading(true);
            try {
                const fullChat = await this.engine.storage.loadChatById(chatId);
                if (fullChat) {
                    this.engine.chats[chatIndex] = fullChat; // جایگزینی گپ ناقص با گپ کامل
                    chatToActivate = fullChat;
                } else {
                    throw new Error(`گپ ${chatId} در حافظه یافت نشد.`);
                }
            } catch (error) {
                console.error("خطا در بارگذاری پیام‌های گپ:", error);
                this.engine.emit('error', 'خطا در بارگذاری تاریخچه گپ.');
                return;
            } finally {
                this.engine.setLoading(false);
            }
        }
        
        this.engine.emit('activeChatSwitched', chatToActivate);
        this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
    }

    /**
     * پیکربندی مدل برای یک گپ خاص را به‌روزرسانی می‌کند.
     * @param {string} chatId - شناسه گپ برای به‌روزرسانی.
     * @param {ProviderConfig} providerConfig - پیکربندی جدید ارائه‌دهنده.
     * @returns {Promise<void>}
     */
    async updateChatModel(chatId, providerConfig) {
        const chat = this.engine.chats.find(c => c.id === chatId);
        if (chat) {
            chat.providerConfig = providerConfig;
            chat.updatedAt = Date.now();
            await this.engine.storageManager.save(chat);
            this.engine.syncManager.broadcastUpdate();
            // به UI اطلاع بده که گپ فعال تغییر کرده تا هدر و سایر بخش‌ها به‌روز شوند
            if (chat.id === this.engine.activeChatId) {
                this.engine.emit('activeChatSwitched', chat);
            }
            // سایدبار را نیز به‌روز کن تا آیکون جدید نمایش داده شود
            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
        }
    }

    /**
     * عنوان یک گپ مشخص را تغییر می‌دهد.
     * @param {string} chatId - شناسه گپ.
     * @param {string} newTitle - عنوان جدید.
     * @returns {Promise<void>}
     */
    async renameChat(chatId, newTitle) {
        const sanitizedTitle = (newTitle || '').trim().replace(/[\r\n\0]/g, '').replace(/\s+/g, ' ');

        if (!sanitizedTitle) {
            this.engine.emit('error', 'نام گپ نمی‌تواند خالی باشد.');
            return;
        }
        
        const { maxChatTitleLength } = this.engine.limits;
        if (maxChatTitleLength !== Infinity && sanitizedTitle.length > maxChatTitleLength) {
            this.engine.emit('error', `نام گپ نمی‌تواند بیشتر از ${maxChatTitleLength} کاراکتر باشد.`);
            return;
        }

        const chat = this.engine.chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = sanitizedTitle;
            chat.updatedAt = Date.now();
            await this.engine.storageManager.save(chat);
            this.engine.syncManager.broadcastUpdate();
            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
            if (chat.id === this.engine.activeChatId) {
                 this.engine.emit('activeChatSwitched', chat);
            }
        } else {
            this.engine.emit('error', 'گپ مورد نظر برای تغییر نام یافت نشد.');
        }
    }

    /**
     * یک گپ مشخص را حذف می‌کند.
     * @param {string} chatId - شناسه گپ برای حذف.
     * @returns {Promise<void>}
     */
    async deleteChat(chatId) {
        // اگر گپی که قرار است حذف شود، گپ فعال است، ابتدا استریم آن را لغو کن.
        if (this.engine.activeChatId === chatId) {
            this.engine.messageHandler.cancelCurrentStream();
        }

        this.engine.chats = this.engine.chats.filter(c => c.id !== chatId);
        try {
            await this.engine.storage.deleteChatById(chatId);
            this.engine.syncManager.broadcastUpdate();

            if (this.engine.activeChatId === chatId) {
                if (this.engine.chats.length > 0) {
                    const newActiveChat = this.engine.chats.sort((a,b) => b.updatedAt - a.updatedAt)[0];
                    await this.switchActiveChat(newActiveChat.id);
                } else {
                    await this.startNewChat();
                }
            } else {
                this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
            }
        } catch (error) {
            this.engine.emit('error', error.message);
        }
    }

    /**
     * آبجکت گپ فعال فعلی را برمی‌گرداند.
     * @returns {Chat | undefined} آبجکت گپ فعال.
     */
    getActiveChat() {
        return this.engine.chats.find(c => c.id === this.engine.activeChatId);
    }
}

export default ChatManager;