import ChatEngine from './core/chatEngine.js';
import ChatUI from './ui/chatUI.js';
import { streamGeminiResponse } from './core/providers/geminiProvider.js';
import { streamOpenAIResponse } from './core/providers/openaiProvider.js';
import { streamCustomResponse } from './core/providers/customProvider.js';
import { VersionError, StorageSupportError, StorageAccessError } from './utils/customErrors.js';

// --- پیاده‌سازی ذخیره‌سازی ---
// ChatEngine به گونه‌ای طراحی شده که به نوع ذخیره‌سازی وابسته نباشد.
// ما در اینجا آداپتور IndexedDB را تزریق می‌کنیم تا ذخیره‌سازی پایدار برای برنامه وب فراهم شود.
// می‌توان از آداپتور دیگری (مثلاً برای فایل سیستم در Node.js) بدون تغییر در هسته اصلی استفاده کرد.
// برای اطلاعات بیشتر به `docs/storageAdaptorGuide.md` مراجعه کنید.
import * as IndexedDBStorage from './services/indexedDBStorage.js';

/**
 * یک پیام خطای مهلک و دقیق به کاربر نمایش می‌دهد تا به او در تشخیص مشکل کمک کند.
 * @param {HTMLElement} rootElement - المانی که خطا در آن رندر می‌شود.
 * @param {Error} error - آبجکت خطا.
 */
function displayFatalError(rootElement, error) {
    console.error('یک خطای مهلک در هنگام راه‌اندازی رخ داد:', error);

    let title = 'خطا در بارگذاری برنامه';
    let message = 'متاسفانه مشکلی در هنگام راه‌اندازی برنامه پیش آمده است. لطفاً صفحه را مجدداً بارگیری کنید.';
    let showReloadButton = true;

    // استفاده از instanceof برای بررسی نوع-امن خطا
    if (error instanceof VersionError) {
        title = 'نسخه دیگری از برنامه باز است';
        message = 'به نظر می‌رسد نسخه دیگری از «گوگ» در یک تب دیگر باز است که مانع از بارگذاری این صفحه می‌شود. لطفاً تمام تب‌های دیگر این برنامه را بسته و سپس صفحه را مجدداً بارگیری کنید.';
    } else if (error instanceof StorageSupportError) {
        title = 'مرورگر شما پشتیبانی نمی‌شود';
        message = 'متاسفانه مرورگر شما از قابلیت‌های لازم برای ذخیره‌سازی تاریخچه گفتگو پشتیبانی نمی‌کند. لطفاً از یک مرورگر مدرن مانند کروم، فایرفاکس یا اج استفاده کنید.';
        showReloadButton = false;
    } else if (error instanceof StorageAccessError) {
        title = 'مشکل در دسترسی به حافظه';
        message = 'برنامه نتوانست به فضای ذخیره‌سازی مرورگر شما دسترسی پیدا کند. این مشکل ممکن است به دلیل تنظیمات حریم خصوصی مرورگر یا استفاده از حالت ناشناس (Incognito) باشد. لطفاً تنظیمات خود را بررسی کرده و دوباره تلاش کنید.';
    }

    const reloadButtonHtml = showReloadButton
        ? `<div class="fatal-error-actions">
               <button id="reload-button" class="btn btn-primary" style="width: auto; padding: 0 1.5rem;">بارگیری مجدد</button>
           </div>`
        : '';
        
    // مرکز کردن کانتینر خطا به صورت افقی و عمودی
    rootElement.style.display = 'flex';
    rootElement.style.alignItems = 'center';
    rootElement.style.justifyContent = 'center';
    rootElement.style.height = '100vh';

    rootElement.innerHTML = `
        <div class="fatal-error-container">
            <div class="fatal-error-icon">
                <span class="material-symbols-outlined">error</span>
            </div>
            <h2 class="fatal-error-title">${title}</h2>
            <p class="fatal-error-message">${message}</p>
            ${reloadButtonHtml}
        </div>
    `;

    if (showReloadButton) {
        document.getElementById('reload-button').addEventListener('click', () => {
            window.location.reload();
        });
    }
}

/**
 * برنامه را هنگام بارگذاری کامل DOM راه‌اندازی می‌کند.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        console.error('خطای مهلک: المان اصلی برنامه #root یافت نشد.');
        document.body.innerHTML = '<p style="color: red; padding: 1rem; text-align: center;">خطای مهلک: المان اصلی برنامه یافت نشد.</p>';
        return;
    }

    try {
        // نمونه‌سازی از منطق اصلی با تزریق ذخیره‌سازی و ارائه‌دهندگان
        const chatEngine = new ChatEngine({
            storage: IndexedDBStorage,
            providers: {
                gemini: streamGeminiResponse,
                openai: streamOpenAIResponse,
                custom: streamCustomResponse,
            }
        });
        const chatUI = new ChatUI(chatEngine, rootElement);

        // اطمینان از راه‌اندازی کامل UI قبل از اینکه موتور شروع به انتشار رویدادها کند
        await chatUI.init();
        await chatEngine.init();

        // افزودن منطق پاک‌سازی برای زمانی که کاربر صفحه را ترک می‌کند
        window.addEventListener('beforeunload', () => {
            if (chatUI) chatUI.destroy();
            if (chatEngine) chatEngine.destroy();
        });

    } catch (error) {
        displayFatalError(rootElement, error);
    }
});