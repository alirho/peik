# افزونه ارائه‌دهنده گوگل جمنای (GeminiProvider)

این افزونه امکان اتصال هسته پیک به مدل‌های قدرتمند **Gemini** شرکت گوگل را فراهم می‌کند.

## 🤖 درباره Google Gemini

جمنای خانواده‌ای از مدل‌های چندوجهی (Multimodal) گوگل است که قابلیت پردازش متن و تصویر را دارد.

## 🔑 دریافت کلید API

برای استفاده از این افزونه، باید یک کلید API رایگان یا پولی دریافت کنید:
1.  به [Google AI Studio](https://aistudio.google.com/) بروید.
2.  یک پروژه بسازید و روی "Get API key" کلیک کنید.

## 📦 نصب

```javascript
import GeminiProvider from './plugins/core/geminiProvider/index.js';

// پیش‌نیاز: باید قبل از این، یک افزونه Network (مثل FetchHttp) ثبت شده باشد.
await peik.use(new GeminiProvider());
```

## ⚙️ پیکربندی

در تنظیمات پیک (`peik.updateSettings`)، باید آبجکت زیر را فراهم کنید:

```javascript
providers: {
    gemini: {
        apiKey: 'YOUR_GEMINI_API_KEY', // کلید دریافت شده
        modelName: 'gemini-2.0-flash-exp' // یا gemini-pro, gemini-1.5-flash
    }
}
```

## 🌟 قابلیت‌ها

*   **چت متنی**: گفتگوهای هوشمند و طولانی.
*   **پردازش تصویر (Vision)**: می‌توانید تصاویر را برای مدل ارسال کنید و درباره آن‌ها سوال بپرسید.
*   **استریم (Streaming)**: دریافت پاسخ‌ها به صورت زنده.

## ⚠️ محدودیت‌ها

*   **تحریم**: دسترسی به API گوگل از برخی کشورها (مانند ایران) مسدود است و نیاز به تغییر IP دارد.
*   **Quota**: پلن رایگان گوگل محدودیت تعداد درخواست در دقیقه دارد.

## 💻 مثال استفاده

```javascript
// پس از نصب و پیکربندی
await peik.updateSettings({
    activeProviderId: 'gemini',
    // ... سایر تنظیمات
});

// ارسال پیام
await chat.sendMessage('یک شعر درباره پاییز بگو');
```
