/**
 * @file این فایل شامل کلاس‌های خطای سفارشی برای مدیریت بهتر خطاها در برنامه است.
 */

/**
 * کلاس پایه برای خطاهای مخصوص برنامه.
 */
export class AppError extends Error {
    constructor(message) {
        super(message);
        this.name = this.constructor.name;
    }
}

/**
 * خطایی که زمانی رخ می‌دهد که نسخه دیگری از برنامه در تب دیگر باز باشد و باعث خطای VersionError در IndexedDB شود.
 */
export class VersionError extends AppError {
    constructor(message = "نسخه جدیدی از برنامه در تب دیگری باز است. لطفاً تمام تب‌ها را بسته و دوباره امتحان کنید.") {
        super(message);
    }
}

/**
 * خطایی که زمانی رخ می‌دهد که مرورگر از یک ویژگی مورد نیاز مانند IndexedDB پشتیبانی نمی‌کند.
 */
export class StorageSupportError extends AppError {
    constructor(message = "مرورگر شما از IndexedDB پشتیبانی نمی‌کند. امکان ذخیره تاریخچه وجود ندارد.") {
        super(message);
    }
}

/**
 * خطایی که زمانی رخ می‌دهد که دسترسی به حافظه مرورگر (IndexedDB) به دلایل نامشخص رد یا ناموفق می‌شود.
 */
export class StorageAccessError extends AppError {
    constructor(message = "امکان دسترسی به فضای ذخیره‌سازی مرورگر وجود ندارد.") {
        super(message);
    }
}

/**
 * خطایی که زمانی رخ می‌دهد که یک تراکنش ذخیره‌سازی به دلیل پر شدن سهمیه مرورگر با شکست مواجه می‌شود.
 */
export class QuotaExceededError extends AppError {
    constructor(message = "فضای ذخیره‌سازی مرورگر پر است. لطفاً گپ‌های قدیمی را حذف کنید.") {
        super(message);
    }
}

/**
 * خطایی که برای شکست‌های عمومی و غیراختصاصی تراکنش‌های ذخیره‌سازی رخ می‌دهد.
 */
export class GenericStorageError extends AppError {
    constructor(message = "خطایی در ذخیره‌سازی داده‌ها رخ داد.") {
        super(message);
    }
}

/**
 * خطایی که زمانی رخ می‌دهد که یک درخواست شبکه با شکست مواجه می‌شود، احتمالاً به دلیل مشکلات اتصال.
 */
export class NetworkError extends AppError {
    constructor(message = "اتصال به اینترنت برقرار نیست.") {
        super(message);
    }
}

/**
 * خطایی که زمانی رخ می‌دهد که بارگذاری یک فایل قالب HTML با شکست مواجه می‌شود.
 */
export class TemplateLoadError extends AppError {
    constructor(path) {
        super(`بارگذاری قالب ${path} ناموفق بود.`);
        this.path = path;
    }
}
