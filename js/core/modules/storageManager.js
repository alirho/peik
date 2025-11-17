import { STORAGE_CONFIG } from '../../utils/constants.js';

// وارد کردن تایپ‌ها برای JSDoc
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
                // در صورت موفقیت، اگر در لیست ذخیره‌نشده‌ها بود، آن را حذف کن
                const index = this.unsavedChats.findIndex(c => c.id === chat.id);
                if (index > -1) {
                    this.unsavedChats.splice(index, 1);
                    this.engine.emit('success', `گپ "${chat.title}" که قبلا ذخیره نشده بود، با موفقیت ذخیره شد.`);
                }
                return true; // نشان‌دهنده موفقیت
            } catch (error) {
                console.error(`تلاش برای ذخیره ${attempt + 1} برای گپ ${chat.id} ناموفق بود:`, error);
                if (attempt < STORAGE_CONFIG.MAX_SAVE_RETRIES - 1) {
                    await new Promise(resolve => setTimeout(resolve, STORAGE_CONFIG.SAVE_RETRY_DELAY_MS));
                } else {
                    this.handleSaveFailure(chat, error);
                }
            }
        }
        return false; // نشان‌دهنده شکست
    }

    /**
     * شکست نهایی یک عملیات ذخیره‌سازی را با افزودن گپ به صف موقت مدیریت می‌کند.
     * @param {Chat} chat - گپی که ذخیره نشد.
     * @param {Error} error - آبجکت خطای نهایی.
     */
    handleSaveFailure(chat, error) {
        // جلوگیری از افزودن موارد تکراری
        if (!this.unsavedChats.some(c => c.id === chat.id)) {
            this.unsavedChats.push(chat);
        }
        
        this.engine.emit('error', `ذخیره‌سازی ناموفق بود. برنامه به صورت خودکار دوباره تلاش خواهد کرد. لطفاً صفحه را بازنشانی نکنید!`);

        // اگر تایمر در حال اجرا نیست، آن را شروع کن
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

        console.log(`تلاش برای ذخیره ${this.unsavedChats.length} گپ ذخیره نشده...`);
        
        // استفاده از رویکرد تابعی برای جلوگیری از تغییر آرایه در حین پیمایش
        const savePromises = this.unsavedChats.map(async (chat) => {
            try {
                await this.engine.storage.saveChat(chat);
                this.engine.syncManager.broadcastUpdate();
                this.engine.emit('success', `گپ "${chat.title}" با موفقیت ذخیره شد.`);
                return null; // نشان‌دهنده گپ موفق برای فیلتر شدن
            } catch (error) {
                return chat; // نشان‌دهنده گپی که دوباره ناموفق بود
            }
        });
        
        const results = await Promise.all(savePromises);
        this.unsavedChats = results.filter(chat => chat !== null);

        // اگر تمام گپ‌ها ذخیره شوند، لیست خالی شده و تایمر در اجرای بعدی متوقف می‌شود.
    }

    /**
     * هرگونه بازه زمانی در حال اجرا را برای جلوگیری از نشت حافظه پاک می‌کند.
     */
    destroy() {
        if (this.unsavedRetryInterval) {
            clearInterval(this.unsavedRetryInterval);
            this.unsavedRetryInterval = null;
        }
    }
}

export default StorageManager;
