import { SYNC_CONFIG } from '../../utils/constants.js';

// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../chatEngine.js').default} ChatEngine */

/**
 * همگام‌سازی وضعیت برنامه بین تب‌های مختلف مرورگر را با استفاده از BroadcastChannel مدیریت می‌کند.
 */
class SyncManager {
    /**
     * @param {ChatEngine} engine - نمونه اصلی موتور چت.
     */
    constructor(engine) {
        /** @type {ChatEngine} */
        this.engine = engine;
        /** @type {BroadcastChannel | null} */
        this.syncChannel = null;
    }

    /**
     * کانال همگام‌سازی را راه‌اندازی می‌کند.
     */
    setup() {
        if ('BroadcastChannel' in window) {
            try {
                this.syncChannel = new BroadcastChannel(SYNC_CONFIG.CHANNEL_NAME);
                this.syncChannel.onmessage = (event) => {
                    if (event.data.type === 'update') {
                        this.handleSyncUpdate();
                    }
                };
            } catch (e) {
                console.error("امکان ایجاد BroadcastChannel وجود ندارد:", e);
                this.syncChannel = null;
            }
        }
    }

    /**
     * یک پیام به‌روزرسانی برای تمام تب‌های دیگر ارسال می‌کند.
     */
    broadcastUpdate() {
        if (this.syncChannel) {
            this.syncChannel.postMessage({ type: 'update' });
        }
    }

    /**
     * یک به‌روزرسانی از تب دیگر را مدیریت کرده و وضعیت فعلی را همگام می‌کند.
     */
    async handleSyncUpdate() {
        try {
            // به دلیل معماری جدید، فقط لیست گپ‌ها را دوباره بارگذاری می‌کنیم.
            // پیام‌های گپ فعال در صورت نیاز توسط chatManager بارگذاری خواهد شد.
            const chatList = await this.engine.storage.loadChatList();
            this.engine.chats = chatList;

            const activeChatExists = this.engine.chats.some(c => c.id === this.engine.activeChatId);
            const currentActiveChat = this.engine.getActiveChat();

            if (!activeChatExists) {
                // اگر گپ فعال فعلی حذف شده باشد
                if (this.engine.chats.length > 0) {
                    const newActiveChat = this.engine.chats.sort((a, b) => b.updatedAt - a.updatedAt)[0];
                    await this.engine.chatManager.switchActiveChat(newActiveChat.id);
                } else {
                    // اگر تمام گپ‌ها از تب دیگر حذف شده باشند
                    await this.engine.chatManager.startNewChat();
                }
            } else if (currentActiveChat && !currentActiveChat.messages) {
                // اگر گپ فعال وجود دارد اما پیام‌هایش بارگذاری نشده (مثلاً در یک تب جدید باز شده)
                // switchActiveChat آن را بارگذاری خواهد کرد.
                await this.engine.chatManager.switchActiveChat(this.engine.activeChatId);
            } else {
                // به‌روزرسانی لیست گپ‌ها و نمایشگر گپ فعلی
                this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
                // اگر گپ فعال پیام‌هایش را دارد، آن را دوباره منتشر کن تا UI به‌روز شود (مثلاً عنوان)
                if (currentActiveChat?.messages) {
                    this.engine.emit('activeChatSwitched', currentActiveChat);
                }
            }
        } catch (error) {
            this.engine.emit('error', error.message || 'خطا در همگام‌سازی با تب‌های دیگر.');
        }
    }

    /**
     * کانال پخش را برای آزاد کردن منابع می‌بندد.
     */
    destroy() {
        if (this.syncChannel) {
            this.syncChannel.onmessage = null;
            this.syncChannel.close();
            this.syncChannel = null;
        }
    }
}

export default SyncManager;
