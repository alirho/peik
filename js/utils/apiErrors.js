/**
 * A custom error class for better handling of API errors.
 */
export class ApiError extends Error {
    /**
     * @param {string} message The error message.
     * @param {number} [status] The HTTP status code.
     */
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/**
 * Translates HTTP status codes into user-friendly messages.
 * @param {number} status The HTTP status code.
 * @returns {string} The error message.
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
