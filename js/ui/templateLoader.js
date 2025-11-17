import { TemplateLoadError } from '../utils/customErrors.js';

/**
 * یک قالب HTML را از مسیر داده شده بارگذاری می‌کند.
 * @param {string} path - مسیر فایل قالب HTML.
 * @returns {Promise<string>} یک Promise که با محتوای HTML به صورت رشته resolve می‌شود.
 * @throws {Error} اگر قالب قابل fetch نباشد.
 */
export async function loadTemplate(path) {
    try {
        const response = await fetch(path);
        if (!response.ok) {
            throw new Error(`خطای HTTP! وضعیت: ${response.status}`);
        }
        return await response.text();
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
    
    // از String.prototype.matchAll برای پیدا کردن همه مطابقت‌ها در یک حرکت استفاده کن.
    // Set به طور خودکار از تکراری بودن جلوگیری می‌کند.
    for (const match of mainTemplateContent.matchAll(partialRegex)) {
        partialsToLoad.add(match[1]);
    }

    if (partialsToLoad.size === 0) {
        return mainTemplateContent; // هیچ partialی یافت نشد، همانطور که هست برگردان.
    }

    const partialPromises = Array.from(partialsToLoad).map(name =>
        loadTemplate(`templates/partials/${name}.html`).then(content => ({ name, content }))
    );

    const loadedPartials = await Promise.all(partialPromises);

    const partialsMap = loadedPartials.reduce((acc, { name, content }) => {
        acc[name] = content;
        return acc;
    }, {});

    // تمام ocorrências هر placeholder partial را جایگزین کن.
    return mainTemplateContent.replace(partialRegex, (match, partialName) => {
        return partialsMap[partialName] || ''; // اگر partial یافت نشد، رشته خالی برگردان
    });
}
