export default class EventEmitter {
    constructor() {
        this.events = new Map();
    }

    /**
     * ثبت شنونده رویداد
     * @param {string} eventName 
     * @param {Function} listener 
     */
    on(eventName, listener) {
        if (!this.events.has(eventName)) {
            this.events.set(eventName, []);
        }
        this.events.get(eventName).push(listener);
        return this;
    }

    /**
     * حذف شنونده رویداد
     * @param {string} eventName 
     * @param {Function} listenerToRemove 
     */
    off(eventName, listenerToRemove) {
        if (!this.events.has(eventName)) return this;
        
        const listeners = this.events.get(eventName).filter(
            listener => listener !== listenerToRemove
        );
        this.events.set(eventName, listeners);
        return this;
    }

    /**
     * انتشار رویداد (به صورت Async برای جلوگیری از بلاک شدن)
     * @param {string} eventName 
     * @param {any} data 
     */
    async emit(eventName, data) {
        if (!this.events.has(eventName)) return;

        const listeners = this.events.get(eventName);
        // اجرای تمام شنوندگان بدون انتظار برای همدیگر، اما مدیریت خطا
        await Promise.all(listeners.map(async listener => {
            try {
                await listener(data);
            } catch (error) {
                console.error(`خطا در شنونده رویداد "${eventName}":`, error);
                // جلوگیری از حلقه بی‌نهایت: اگر خطا در رویداد error رخ داد، دیگر emit نکن
                if (eventName !== 'error') {
                    this.emit('error', error);
                }
            }
        }));
    }

    destroy() {
        this.events.clear();
    }
}