import { STORAGE_CONFIG } from '../../utils/constants.js';

// JSDoc Type Imports
/** @typedef {import('../../types.js').Chat} Chat */
/** @typedef {import('../chatEngine.js').default} ChatEngine */

/**
 * منطق ذخیره‌سازی هوشمند، شامل تلاش مجدد (retry) و صف موقت را مدیریت می‌کند.
 */
class StorageManager {
    /**
     * @param {ChatEngine} engine - نمونه اصلی موتور چت.
     */
    constructor(engine) {
        /** @type {ChatEngine} */
        this.engine = engine;
        /** @type {Array<Chat>} */
        this.unsavedChats = [];
        /** @type {number | null} */
        this.unsavedRetryInterval = null;
    }

    /**
     * سعی می‌کند یک گپ را با مکانیزم تلاش مجدد ذخیره کند.
     * @param {Chat} chat - آبجکت گپ برای ذخیره.
     * @returns {Promise<boolean>} - یک Promise که در صورت موفقیت به true و در صورت شکست به false resolve می‌شود.
     */
    async save(chat) {
        for (let attempt = 0; attempt < STORAGE_CONFIG.MAX_SAVE_RETRIES; attempt++) {
            try {
                await this.engine.storage.saveChat(chat);
                // On success, also remove it from the unsaved list if it was there
                const index = this.unsavedChats.findIndex(c => c.id === chat.id);
                if (index > -1) {
                    this.unsavedChats.splice(index, 1);
                    this.engine.emit('success', `گپ "${chat.title}" که قبلا ذخیره نشده بود، با موفقیت ذخیره شد.`);
                }
                return true; // Indicate success
            } catch (error) {
                console.error(`Save attempt ${attempt + 1} failed for chat ${chat.id}:`, error);
                if (attempt < STORAGE_CONFIG.MAX_SAVE_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, STORAGE_CONFIG.SAVE_RETRY_DELAY_MS));
                } else {
                    this.handleSaveFailure(chat, error);
                }
            }
        }
        return false; // Indicate failure
    }

    /**
     * شکست نهایی یک عملیات ذخیره‌سازی را با افزودن گپ به صف موقت مدیریت می‌کند.
     * @param {Chat} chat - گپی که ذخیره نشد.
     * @param {Error} error - آبجکت خطای نهایی.
     */
    handleSaveFailure(chat, error) {
        // Avoid adding duplicates
        if (!this.unsavedChats.some(c => c.id === chat.id)) {
            this.unsavedChats.push(chat);
        }
        
        this.engine.emit('error', `ذخیره‌سازی ناموفق بود. برنامه به صورت خودکار دوباره تلاش خواهد کرد. لطفاً صفحه را بازنشانی نکنید!`);

        // Start the retry interval if it's not already running
        if (!this.unsavedRetryInterval) {
            this.startUnsavedRetryInterval();
        }
    }

    /**
     * یک تایمر دوره‌ای برای تلاش مجدد برای ذخیره گپ‌های موجود در صف موقت راه‌اندازی می‌کند.
     */
    startUnsavedRetryInterval() {
        this.unsavedRetryInterval = setInterval(() => {
            this.retryUnsavedChats();
        }, STORAGE_CONFIG.UNSAVED_RETRY_INTERVAL_MS);
    }

    /**
     * گپ‌های ذخیره نشده را پیمایش کرده و دوباره برای ذخیره آن‌ها تلاش می‌کند.
     */
    async retryUnsavedChats() {
        if (this.unsavedChats.length === 0) {
            if (this.unsavedRetryInterval) {
                clearInterval(this.unsavedRetryInterval);
                this.unsavedRetryInterval = null;
            }
            return;
        }

        console.log(`Attempting to save ${this.unsavedChats.length} unsaved chat(s)...`);
        
        // Use a functional approach to avoid modifying the array while iterating
        const savePromises = this.unsavedChats.map(async (chat) => {
            try {
                await this.engine.storage.saveChat(chat);
                this.engine.syncManager.broadcastUpdate();
                this.engine.emit('success', `گپ "${chat.title}" با موفقیت ذخیره شد.`);
                return null; // Represents a successfully saved chat to be filtered out
            } catch (error) {
                return chat; // Represents a chat that failed again
            }
        });
        
        const results = await Promise.all(savePromises);
        this.unsavedChats = results.filter(chat => chat !== null);

        // If all chats are saved, the list will be empty and the interval will be cleared on the next run.
    }
}

export default StorageManager;
