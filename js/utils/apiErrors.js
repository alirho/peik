/**
 * یک کلاس خطای سفارشی برای مدیریت بهتر خطاهای API.
 */
export class ApiError extends Error {
    /**
     * @param {string} message - پیام خطا.
     * @param {number} [status] - کد وضعیت HTTP.
     */
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/**
 * کدهای وضعیت HTTP را به پیام‌های کاربرپسند ترجمه می‌کند.
 * @param {number} status - کد وضعیت HTTP.
 * @returns {string} پیام خطا.
 */
export function getErrorMessageForStatus(status) {
    switch (status) {
        case 400:
            return "درخواست نامعتبر است. لطفاً ورودی خود را بررسی کنید.";
        case 401:
            return "کلید API نامعتبر یا منقضی شده است. لطفاً آن را بررسی کنید.";
        case 403:
            return "دسترسی به این مدل یا سرویس مجاز نیست. کلید API خود را بررسی کنید.";
        case 404:
            return "مدل یا اندپوینت مورد نظر یافت نشد.";
        case 429:
            return "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً یک دقیقه صبر کرده و دوباره تلاش کنید.";
        case 500:
        case 503:
            return "سرور با مشکل مواجه شده است. لطفاً کمی بعد دوباره تلاش کنید.";
        default:
            return `خطای غیرمنتظره‌ای رخ داد. (کد: ${status})`;
    }
}
