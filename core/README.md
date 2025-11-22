# هسته پیک (Peik Core)

هسته پیک (`@peik/core`) مغز متفکر و مستقل از محیط (Environment-Agnostic) برای دستیار هوش مصنوعی پیک است. این پکیج تمام منطق مدیریت گفتگوها، ارتباط با مدل‌های زبانی (LLM) و مدیریت افزونه‌ها را بدون وابستگی به مرورگر یا DOM پیاده‌سازی می‌کند.

## ویژگی‌های کلیدی

-   **مستقل از محیط**: قابل اجرا در مرورگر، Node.js، Deno، Web Workers و افزونه‌های VS Code.
-   **معماری افزونه‌محور (Plugin-Based)**: تمام قابلیت‌های اصلی (ذخیره‌سازی، شبکه، مدل‌ها) از طریق افزونه‌ها اضافه می‌شوند.
-   **Async-First**: تمام عملیات برای عملکرد غیرمسدودکننده (Non-blocking) به صورت ناهمگام طراحی شده‌اند.
-   **رویداد-محور (Event-Driven)**: ارتباط بین اجزا از طریق یک سیستم رویداد سبک و کارآمد انجام می‌شود.

## نصب

اگر این پروژه را به عنوان یک پکیج مستقل استفاده می‌کنید:

```bash
npm install @peik/core
```

یا اگر در حال توسعه روی مخزن اصلی هستید، می‌توانید آن را مستقیماً import کنید.

## شروع سریع

یک مثال ساده از نحوه راه‌اندازی هسته با استفاده از حافظه موقت و مدل Gemini:

```javascript
import { Peik } from '@peik/core';
import MemoryStorage from './plugins/memoryStorage.js';
import FetchHttp from './plugins/fetchHttp.js';
import GeminiProvider from './plugins/geminiProvider.js';

async function main() {
    // ۱. ایجاد نمونه هسته
    const peik = new Peik();

    // ۲. ثبت افزونه‌های ضروری
    await peik.use(new MemoryStorage());
    await peik.use(new FetchHttp());
    await peik.use(new GeminiProvider());

    // ۳. راه‌اندازی و تنظیمات
    await peik.init();
    await peik.updateSettings({
        activeProviderId: 'gemini',
        providers: {
            gemini: { apiKey: 'YOUR_API_KEY', modelName: 'gemini-2.5-flash' }
        }
    });

    // ۴. ایجاد گپ و ارسال پیام
    const chat = await peik.createChat('گپ آزمایشی');
    
    chat.on('chunk', ({ chunk }) => process.stdout.write(chunk));
    
    await chat.sendMessage('سلام! یک بیت شعر بگو.');
}

main();
```

## مستندات

-   **[مرجع کامل API (API Reference)](./docs/apiReference.md)**: توضیحات دقیق تمام کلاس‌ها، متدها و رویدادها.
-   **[راهنمای ساخت افزونه (Plugin Development)](./docs/pluginDevelopmentGuide.md)**: آموزش گام‌به‌گام برای توسعه‌دهندگانی که می‌خواهند قابلیت‌های پیک را گسترش دهند.

## افزونه‌های استاندارد

هسته پیک برای کارکرد نیاز به افزونه‌هایی دارد که رابط‌های استاندارد (`Interfaces`) را پیاده‌سازی کنند:

1.  **Storage**: برای ذخیره تنظیمات و تاریخچه (مانند `MemoryStorage`, `IndexedDBStorage`).
2.  **Network**: برای برقراری ارتباط HTTP (مانند `FetchHttp`).
3.  **Provider**: برای اتصال به مدل‌های هوش مصنوعی (مانند `GeminiProvider`, `OpenAIProvider`).