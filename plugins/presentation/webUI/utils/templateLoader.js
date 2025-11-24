import { Errors } from '../../../../core/src/index.js';

// نگهداری کش قالب‌ها برای جلوگیری از درخواست‌های تکراری
const templateCache = new Map();

/**
 * خطای مخصوص بارگذاری قالب
 */
class TemplateLoadError extends Errors.PeikError {
    constructor(path) {
        super(`بارگذاری قالب از مسیر «${path}» با خطا مواجه شد.`, 'TEMPLATE_LOAD_ERROR');
    }
}

/**
 * کش قالب‌ها را پاک می‌کند.
 * کاربرد: برای زمان‌هایی که نیاز به رفرش قالب‌ها بدون ریلود صفحه است.
 */
export function clearTemplateCache() {
    templateCache.clear();
}

/**
 * یک قالب HTML را از مسیر داده شده بارگذاری می‌کند (با استفاده از کش).
 * @param {string} path - مسیر فایل قالب HTML.
 * @returns {Promise<string>} یک Promise که با محتوای HTML به صورت رشته resolve می‌شود.
 * @throws {Error} اگر قالب قابل fetch نباشد.
 */
export async function loadTemplate(path) {
    // بررسی وجود قالب در کش
    if (templateCache.has(path)) {
        return templateCache.get(path);
    }

    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`خطای HTTP! وضعیت: ${response.status}`);
        }
        const content = await response.text();
        
        // ذخیره در کش برای استفاده‌های بعدی
        templateCache.set(path, content);
        
        return content;
    } catch (error) {
        console.error(`بارگذاری قالب از ${path} ناموفق بود:`, error);
        throw new TemplateLoadError(path);
    }
}

/**
 * یک قالب اصلی را بارگذاری کرده و به صورت بازگشتی قطعات (partials) HTML را در آن تزریق می‌کند.
 * @param {string} path - مسیر فایل قالب اصلی HTML.
 * @returns {Promise<string>} یک Promise که با رشته HTML کاملاً مونتاژ شده resolve می‌شود.
 */
export async function loadTemplateWithPartials(path) {
    const mainTemplateContent = await loadTemplate(path);

    // Regex برای پیدا کردن تمام partial ها مانند {{> partialName }}
    const partialRegex = /{{\s*>\s*([a-zA-Z0-9_]+)\s*}}/g;
    const partialsToLoad = new Set();
    
    for (const match of mainTemplateContent.matchAll(partialRegex)) {
        partialsToLoad.add(match[1]);
    }

    if (partialsToLoad.size === 0) {
        return mainTemplateContent;
    }

    // مسیر partials نسبت به ریشه سرور تنظیم شده است تا با ساختار جدید افزونه هماهنگ باشد
    const partialPromises = Array.from(partialsToLoad).map(name =>
        loadTemplate(`plugins/presentation/webUI/templates/partials/${name}.html`).then(content => ({ name, content }))
    );

    const loadedPartials = await Promise.all(partialPromises);

    const partialsMap = loadedPartials.reduce((acc, { name, content }) => {
        acc[name] = content;
        return acc;
    }, {});

    return mainTemplateContent.replace(partialRegex, (match, partialName) => {
        return partialsMap[partialName] || '';
    });
}