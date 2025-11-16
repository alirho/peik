import { SYNC_CONFIG } from '../../utils/constants.js';

// JSDoc Type Imports
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
                console.error("BroadcastChannel could not be created:", e);
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
            this.engine.chats = await this.engine.storage.loadAllChats();
            const activeChatExists = this.engine.chats.some(c => c.id === this.engine.activeChatId);

            if (!activeChatExists) {
                if (this.engine.chats.length > 0) {
                    const newActiveChat = this.engine.chats.sort((a, b) => b.updatedAt - a.updatedAt)[0];
                    this.engine.activeChatId = newActiveChat.id;
                } else {
                    // All chats were deleted from another tab
                    await this.engine.chatManager.startNewChat();
                    return; // startNewChat handles its own emissions
                }
            }

            this.engine.emit('chatListUpdated', { chats: this.engine.chats, activeChatId: this.engine.activeChatId });
            this.engine.emit('activeChatSwitched', this.engine.getActiveChat());

        } catch (error) {
            this.engine.emit('error', error.message || 'خطا در همگام‌سازی با تب‌های دیگر.');
        }
    }
}

export default SyncManager;