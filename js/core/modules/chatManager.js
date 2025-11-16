// JSDoc Type Imports
/** @typedef {import('../../types.js').Chat} Chat */
/** @typedef {import('../chatEngine.js').default} ChatEngine */

/**
 * تمام عملیات مربوط به مدیریت چت‌ها (ایجاد، حذف، تغییر نام، جابجایی) را مدیریت می‌کند.
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
     * یک گپ جدید ایجاد کرده و آن را به عنوان گپ فعال تنظیم می‌کند.
     * @param {boolean} [emitUpdate=true] - اگر true باشد، رویدادها برای UI منتشر می‌شوند.
     * @returns {Promise<void>}
     */
    async startNewChat(emitUpdate = true) {
        const { maxChats } = this.engine.limits;
        if (maxChats !== Infinity && this.engine.chats.length >= maxChats) {
            this.engine.emit('error', `حداکثر تعداد ${maxChats} گپ مجاز است.`);
            return;
        }
        
        const now = Date.now();
        const newChat = {
            id: `chat_${now}`,
            title: 'گپ جدید',
            messages: [],
            createdAt: now,
            updatedAt: now,
            provider: this.engine.settings?.provider || 'unknown',
            modelName: this.engine.settings?.modelName || 'unknown'
        };
        this.engine.chats.push(newChat);
        this.engine.activeChatId = newChat.id;
        
        if (emitUpdate) {
            this.engine.emit('activeChatSwitched', newChat);
            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
            await this.engine.storageManager.save(newChat);
            this.engine.syncManager.broadcastUpdate();
        }
    }
    
    /**
     * گپ فعال فعلی را به گپ دیگری با شناسه مشخص تغییر می‌دهد.
     * @param {string} chatId - شناسه گپ مورد نظر.
     * @returns {void}
     */
    switchActiveChat(chatId) {
        if (chatId === this.engine.activeChatId) return;
        
        const chatToActivate = this.engine.chats.find(c => c.id === chatId);
        if (chatToActivate) {
            this.engine.activeChatId = chatId;
            this.engine.emit('activeChatSwitched', chatToActivate);
            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
        } else {
             console.warn(`Chat with ID ${chatId} not found for switching.`);
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
        this.engine.chats = this.engine.chats.filter(c => c.id !== chatId);
        try {
            await this.engine.storage.deleteChatById(chatId);
            this.engine.syncManager.broadcastUpdate();

            if (this.engine.activeChatId === chatId) {
                if (this.engine.chats.length > 0) {
                    const newActiveChat = this.engine.chats.sort((a,b) => b.updatedAt - a.updatedAt)[0];
                    this.switchActiveChat(newActiveChat.id);
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