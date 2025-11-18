/**
 * @file This file contains the core JSDoc type definitions for the application.
 * These types are used across the project to provide better IntelliSense and type checking.
 */

/**
 * @typedef {object} Message
 * @property {string} id - شناسه یکتای پیام
 * @property {'user' | 'model'} role - نقش فرستنده پیام
 * @property {string} content - محتوای متنی پیام
 * @property {number} timestamp - مهر زمانی (Timestamp) ایجاد پیام
 * @property {ImageData} [image] - داده‌های تصویر پیوست شده (اختیاری)
 */

/**
 * @typedef {object} ImageData
 * @property {string} data - داده تصویر به صورت رشته Base64
 * @property {string} mimeType - نوع MIME تصویر (مانند 'image/jpeg')
 */

/**
 * @typedef {object} Chat
 * @property {string} id - شناسه یکتای گپ
 * @property {string} title - عنوان گپ
 * @property {Array<Message>} [messages] - آرایه‌ای از پیام‌های داخل گپ (می‌تواند برای بارگذاری درخواستی وجود نداشته باشد)
 * @property {number} createdAt - مهر زمانی ایجاد گپ
 * @property {number} updatedAt - مهر زمانی آخرین به‌روزرسانی گپ
 * @property {string} provider - نام ارائه‌دهنده استفاده شده در گپ
 * @property {string} modelName - نام مدل استفاده شده در گپ
 */

/**
 * @typedef {object} CustomProviderConfig
 * @property {string} id - یک شناسه یکتای سمت کاربر برای پیکربندی
 * @property {string} name - یک نام تعریف شده توسط کاربر برای این ارائه‌دهنده سفارشی
 * @property {string} modelName
 * @property {string} apiKey
 * @property {string} endpointUrl
 */

/**
 * @typedef {object} Settings
 * @property {'gemini' | 'openai' | 'custom'} provider - ارائه‌دهنده فعال
 * @property {string} modelName - نام مدل
 * @property {string} apiKey - کلید API
 * @property {string} [endpointUrl] - آدرس API برای ارائه‌دهنده سفارشی (اختیاری)
 * @property {string} [customProviderId] - شناسه یکتای ارائه‌دهنده سفارشی، اگر provider برابر با 'custom' باشد
 * @property {Array<CustomProviderConfig>} [customProviders] - لیست تمام پیکربندی‌های ارائه‌دهنده سفارشی
 */

/**
 * @typedef {object} StorageAdapter
 * @property {function(): Promise<Settings|null>} loadSettings - بارگذاری تنظیمات کاربر
 * @property {function(Settings): Promise<void>} saveSettings - ذخیره تنظیمات کاربر
 * @property {function(): Promise<Array<Chat>>} loadChatList - فقط لیست گپ‌ها را (بدون پیام‌ها) بارگذاری می‌کند
 * @property {function(string): Promise<Chat|null>} loadChatById - یک گپ کامل (با پیام‌ها) را با شناسه آن بارگذاری می‌کند
 * @property {function(Chat): Promise<void>} saveChat - ذخیره یا به‌روزرسانی یک گپ
 * @property {function(string): Promise<void>} deleteChatById - حذف یک گپ با شناسه آن
 */

/**
 * @callback ProviderHandler
 * @param {Settings} settings - تنظیمات کاربر برای این ارائه‌دهنده
 * @param {Array<Message>} history - تاریخچه پیام‌ها برای ارسال به API
 * @param {(chunk: string) => void} onChunk - تابعی که برای هر قطعه از پاسخ استریم فراخوانی می‌شود
 * @param {AbortSignal} [signal] - یک سیگنال اختیاری برای لغو درخواست
 * @returns {Promise<void>}
 */

export {};