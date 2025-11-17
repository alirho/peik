/**
 * یک کلاس ساده برای پیاده‌سازی الگوی pub/sub (انتشار/اشتراک).
 */
class EventEmitter {
    constructor() {
        this.events = {};
    }

    /**
     * یک تابع شنونده (listener) را برای یک رویداد ثبت می‌کند.
     * @param {string} eventName - نام رویداد.
     * @param {Function} listener - تابع callback که باید اجرا شود.
     */
    on(eventName, listener) {
        if (!this.events[eventName]) {
            this.events[eventName] = [];
        }
        this.events[eventName].push(listener);
    }

    /**
     * یک تابع شنونده را از یک رویداد حذف می‌کند.
     * @param {string} eventName - نام رویداد.
     * @param {Function} listenerToRemove - تابع callback مشخصی که باید حذف شود.
     */
    off(eventName, listenerToRemove) {
        if (!this.events[eventName]) {
            return;
        }
        this.events[eventName] = this.events[eventName].filter(
            listener => listener !== listenerToRemove
        );
    }

    /**
     * یک رویداد را منتشر کرده و تمام شنوندگان ثبت‌شده را با داده‌های ارائه‌شده فراخوانی می‌کند.
     * خطا در یک شنونده مانع از فراخوانی دیگران نمی‌شود.
     * @param {string} eventName - نام رویدادی که باید منتشر شود.
     * @param {*} data - داده‌ای که باید به شنوندگان ارسال شود.
     */
    emit(eventName, data) {
        if (this.events[eventName]) {
            this.events[eventName].forEach(listener => {
                try {
                    listener(data);
                } catch (error) {
                    console.error(`خطا در شنونده برای رویداد "${eventName}":`, error);
                }
            });
        }
    }

    /**
     * تمام شنوندگان برای تمام رویدادها را حذف می‌کند.
     */
    destroy() {
        this.events = {};
    }
}

export default EventEmitter;