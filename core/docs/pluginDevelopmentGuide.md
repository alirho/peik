# راهنمای توسعه افزونه برای پیک (Peik Plugin Development Guide)

هسته پیک بر اساس معماری افزونه‌محور طراحی شده است. این یعنی تقریباً هر قابلیتی، از ذخیره‌سازی داده‌ها گرفته تا اتصال به مدل‌های هوش مصنوعی جدید، از طریق **افزونه‌ها (Plugins)** انجام می‌شود.

این راهنما به شما کمک می‌کند تا افزونه‌های خود را بسازید.

---

## ۱. ساختار یک افزونه

هر افزونه یک کلاس جاوااسکریپت است که از کلاس پایه `Plugin` ارث‌بری می‌کند. یک افزونه باید دارای ویژگی‌های زیر باشد:

1.  **Metadata (متادیتا)**: اطلاعاتی مثل نام، نسخه و دسته‌بندی.
2.  **Lifecycle Methods (متدهای چرخه حیات)**: متدهایی که در زمان نصب یا فعال‌سازی اجرا می‌شوند.

### قالب کلی:

```javascript
import { Plugin } from '@peik/core';

export default class MyAwesomePlugin extends Plugin {
    // ۱. تعریف اطلاعات افزونه
    static get metadata() {
        return {
            name: 'my-awesome-plugin',
            version: '1.0.0',
            category: 'utility', 
            description: 'توضیحات کوتاه درباره کارکرد افزونه',
            author: 'Your Name',
            dependencies: [] // لیست نام افزونه‌هایی که به آن‌ها نیاز دارید
        };
    }

    // ۲. متد نصب (یک بار اجرا می‌شود)
    async install(context) {
        // context همان نمونه اصلی کلاس Peik است
        this.peik = context;
        console.log('افزونه نصب شد.');
    }

    // ۳. متد فعال‌سازی (بعد از نصب اجرا می‌شود)
    async activate() {
        console.log('افزونه فعال شد.');
    }
}
```

---

## ۲. دسته‌بندی افزونه‌ها (Categories)

هنگام تعریف `metadata`، باید `category` را مشخص کنید. هسته پیک بر اساس این دسته‌بندی رفتار متفاوتی خواهد داشت:

| دسته‌بندی | کاربرد | رابط الزامی (Interface) |
| :--- | :--- | :--- |
| `storage` | مدیریت ذخیره‌سازی و بازیابی داده‌ها | `StorageInterface` |
| `network` | برقراری ارتباطات HTTP | `HttpClientInterface` |
| `provider` | اتصال به مدل‌های هوش مصنوعی (LLM) | `ProviderInterface` |
| `utility` | ابزارهای عمومی (بدون وظیفه خاص سیستمی) | ندارد |

---

## ۳. مثال عملی: ساخت یک افزونه لاگر (Logger Plugin)

بیایید یک افزونه ساده بسازیم که هر بار که پیامی ارسال می‌شود، آن را در کنسول چاپ کند.

**مرحله ۱: تعریف کلاس**

```javascript
import { Plugin } from '@peik/core';

export default class ConsoleLoggerPlugin extends Plugin {
    static get metadata() {
        return {
            name: 'console-logger',
            version: '1.0.0',
            category: 'utility'
        };
    }

    async install(context) {
        this.context = context;
    }

    async activate() {
        // گوش دادن به رویداد سراسری ایجاد پیام
        // توجه: برای دسترسی به رویدادهای داخلی چت، باید از طریق هوک‌ها یا دسترسی مستقیم عمل کرد.
        // در اینجا ما به رویدادهای سطح سیستم گوش می‌دهیم.
        
        // مثال فرضی: اگر Peik رویداد 'message:sent' را در سطح جهانی منتشر کند
        this.context.on('chat:created', (chat) => {
            console.log(`[Logger] گپ جدیدی با عنوان "${chat.title}" ساخته شد.`);
            
            // می‌توانیم به رویدادهای خود گپ هم گوش دهیم
            chat.on('message', (msg) => {
                console.log(`[Logger] پیام جدید در گپ ${chat.id}:`, msg.content);
            });
        });
    }
}
```

**مرحله ۲: استفاده از افزونه**

```javascript
import { Peik } from '@peik/core';
import ConsoleLoggerPlugin from './ConsoleLoggerPlugin.js';

const peik = new Peik();
await peik.use(new ConsoleLoggerPlugin());
await peik.init();
```

---

## ۴. ساخت افزونه Provider (اتصال به مدل جدید)

برای اضافه کردن یک هوش مصنوعی جدید (مثلاً Claude)، باید افزونه‌ای بسازید که `ProviderInterface` را پیاده‌سازی کند.

```javascript
import { Plugin, ProviderInterface } from '@peik/core';

export default class ClaudeProvider extends Plugin {
    // ... metadata (category: 'provider', name: 'claude') ...

    async install(context) {
        super.install(context);
        // دریافت کلاینت شبکه از هسته
        this.http = context.pluginManager.getPluginsByCategory('network')[0];
    }

    // پیاده‌سازی متد الزامی رابط
    validateConfig(config) {
        if (!config.apiKey) throw new Error('API Key الزامی است');
    }

    // پیاده‌سازی متد ارسال پیام
    async sendMessage(config, messages, onChunk, options) {
        this.validateConfig(config);
        
        // تبدیل پیام‌ها به فرمت Claude
        const payload = { /* ... */ }; 
        
        // ارسال درخواست با استفاده از افزونه شبکه موجود
        await this.http.streamRequest(
            'https://api.anthropic.com/v1/messages',
            {
                method: 'POST',
                headers: { 'x-api-key': config.apiKey },
                body: JSON.stringify(payload)
            },
            (chunk) => {
                // پردازش استریم و فراخوانی onChunk
                const text = parseClaudeStream(chunk);
                if (text) onChunk(text);
            },
            options.signal
        );
    }
}
```

---

## ۵. نکات و بهترین روش‌ها

1.  **وابستگی‌ها را چک کنید**: همیشه در متد `install` بررسی کنید که آیا افزونه‌های پیش‌نیاز (مثل `network` برای یک `provider`) وجود دارند یا خیر.
2.  **مدیریت خطا**: از کلاس‌های خطای استاندارد پیک (`PeikError`, `PluginError`) استفاده کنید.
3.  **Async**: به یاد داشته باشید که `install` و `activate` ناهمگام (Async) هستند. اگر افزونه شما نیاز به راه‌اندازی اولیه (مثل باز کردن دیتابیس) دارد، آن را در `install` انجام دهید و `await` کنید.
4.  **نام‌گذاری**: برای نام افزونه از حروف کوچک و خط تیره استفاده کنید (kebab-case).