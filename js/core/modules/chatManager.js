import { VALIDATION_LIMITS } from '../../utils/constants.js';

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
        this.engine.activeChatId = chatId;
        const activeChat = this.getActiveChat();
        if (activeChat) {
            this.engine.emit('activeChatSwitched', activeChat);
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
        if (typeof newTitle !== 'string' || !newTitle.trim()) {
            this.engine.emit('error', 'نام گپ نمی‌تواند خالی باشد.');
            return;
        }

        const trimmedTitle = newTitle.trim();

        if (trimmedTitle.length > VALIDATION_LIMITS.MAX_CHAT_TITLE_LENGTH) {
            this.engine.emit('error', `نام گپ نمی‌تواند بیشتر از ${VALIDATION_LIMITS.MAX_CHAT_TITLE_LENGTH} کاراکتر باشد.`);
            return;
        }

        const chat = this.engine.chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = trimmedTitle;
            chat.updatedAt = Date.now();
            await this.engine.storageManager.save(chat);
            this.engine.syncManager.broadcastUpdate();
            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
            if (chat.id === this.engine.activeChatId) {
                 this.engine.emit('activeChatSwitched', chat);
            }
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
