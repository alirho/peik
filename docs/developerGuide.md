# راهنمای توسعه‌دهندگان گوگ (Goug AI Chat)

این سند به عنوان یک راهنمای عملی برای توسعه‌دهندگانی است که می‌خواهند با کدبیس پروژه گوگ کار کرده، آن را گسترش دهند یا از آن در پروژه‌های دیگر استفاده کنند.

## بخش ۱: API داخلی (Internal API)

این بخش APIهای عمومی و رویدادهای اصلی سیستم را تشریح می‌کند که برای تعامل با هسته برنامه ضروری هستند.

### `ChatEngine` API

`ChatEngine` مغز متفکر برنامه است. تمام تعاملات UI با این کلاس انجام می‌شود.

#### رویدادها (Events)

شما می‌توانید با استفاده از متد `chatEngine.on('eventName', callback)` به این رویدادها گوش دهید.

| رویداد                 | داده ارسالی (`data`)                                  | توضیحات                                                                                                  |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `init`                 | `{ settings, chats, activeChat }`                     | پس از بارگذاری اولیه تنظیمات و چت‌ها از حافظه، یک بار فراخوانی می‌شود.                                    |
| `settingsSaved`        | `settings: object`                                    | زمانی که تنظیمات جدید با موفقیت ذخیره می‌شوند، فراخوانی می‌شود.                                           |
| `loading`              | `isLoading: boolean`                                  | هنگام شروع و پایان یک درخواست API، برای به‌روزرسانی وضعیت UI (مثلاً نمایش اسپینر) فراخوانی می‌شود.       |
| `message`              | `message: object`                                     | هنگامی که یک پیام جدید (توسط کاربر یا دستیار) به چت فعال اضافه می‌شود، فراخوانی می‌شود.                  |
| `chunk`                | `chunk: string`                                       | برای هر قطعه از متنی که از طریق استریم دریافت می‌شود، فراخوانی می‌شود.                                      |
| `streamEnd`            | `fullResponse: string`                                | پس از اتمام کامل استریم پاسخ، با متن کامل پاسخ فراخوانی می‌شود.                                         |
| `error`                | `errorMessage: string`                                | در صورت بروز خطا در ارتباط با API، با پیام خطا فراخوانی می‌شود.                                           |
| `messageRemoved`       | `undefined`                                           | اگر یک درخواست با خطا مواجه شود و پیام موقت دستیار نیاز به حذف داشته باشد، فراخوانی می‌شود.              |
| `chatListUpdated`      | `{ chats, activeChatId }`                             | زمانی که لیست چت‌ها تغییر می‌کند (ایجاد، حذف، تغییر نام)، فراخوانی می‌شود.                                  |
| `activeChatSwitched`   | `activeChat: object`                                  | هنگامی که کاربر یک چت دیگر را به عنوان چت فعال انتخاب می‌کند، فراخوانی می‌شود.                            |


**مثال استفاده:**
```javascript
const chatEngine = new ChatEngine();

// Re-render chat list whenever it changes
chatEngine.on('chatListUpdated', ({ chats, activeChatId }) => {
    renderSidebar(chats, activeChatId);
});

// Load a new chat's history when switched
chatEngine.on('activeChatSwitched', (activeChat) => {
    renderMessages(activeChat.messages);
});
```

#### متدهای عمومی (Public Methods)

| متد                      | پارامترها                | توضیحات                                                                |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| `init()`                 | -                        | موتور را راه‌اندازی کرده و داده‌ها را از `storageService` بارگذاری می‌کند. |
| `saveSettings(settings)` | `settings: object`       | تنظیمات جدید را دریافت و در حافظه ذخیره می‌کند.                        |
| `sendMessage(userInput)` | `userInput: string`      | پیام کاربر را به چت فعال اضافه کرده و برای پردازش به Provider ارسال می‌کند.|
| `startNewChat()`         | -                        | یک چت جدید و خالی ایجاد کرده و آن را به عنوان چت فعال تنظیم می‌کند.       |
| `switchActiveChat(chatId)`| `chatId: string`        | چت مشخص شده را به عنوان چت فعال تنظیم می‌کند.                         |
| `renameChat(chatId, newTitle)` | `chatId: string, newTitle: string` | عنوان یک چت مشخص را تغییر می‌دهد.                                     |
| `deleteChat(chatId)`     | `chatId: string`         | یک چت مشخص را از لیست حذف می‌کند.                                      |


**مثال استفاده:**
```javascript
// Switch to a different chat
chatEngine.switchActiveChat('chat_1678886400000');

// Start a new conversation
chatEngine.startNewChat();
```

## بخش ۲: راهنمای توسعه

این بخش به شما نشان می‌دهد چگونه قابلیت‌های جدید به برنامه اضافه کنید.

### چگونه یک Provider جدید اضافه کنیم؟

برای افزودن پشتیبانی از یک API جدید (مثلاً Anthropic Claude)، مراحل زیر را دنبال کنید:

**مرحله ۱: ایجاد فایل Provider**
یک فایل جدید در مسیر `js/core/providers/` بسازید. برای مثال: `anthropicProvider.js`.

**مرحله ۲: پیاده‌سازی تابع اصلی استریم**
در این فایل، یک تابع `export` شده با امضای زیر ایجاد کنید:
`async function streamAnthropicResponse(settings, history, onChunk)`

**مرحله ۳: ساخت بدنه درخواست و پردازش پاسخ**
درون این تابع، منطق زیر را پیاده‌سازی کنید:
1.  ساختن بدنه درخواست (Request Body) مطابق با مستندات API مورد نظر.
2.  فراخوانی `fetchStreamWithRetries` از `apiService.js` با URL، گزینه‌ها و Callbackهای مناسب.
3.  ایجاد یک تابع برای پردازش هر خط از پاسخ استریم (SSE).
4.  ایجاد یک تابع برای استخراج پیام خطا از پاسخ در صورت بروز مشکل.

**مثال اسکلت کد برای `anthropicProvider.js`:**
```javascript
import { fetchStreamWithRetries } from '../../services/apiService.js';
import { getErrorMessageForStatus } from '../../utils/apiErrors.js';

function buildAnthropicBody(history) { /* ... */ }
function processAnthropicStream(line, onChunk) { /* ... */ }
async function getAnthropicError(response) { /* ... */ }

export async function streamAnthropicResponse(settings, history, onChunk) {
    const API_URL = 'https://api.anthropic.com/v1/messages';
    const body = buildAnthropicBody(history);

    const options = { /* ... headers and method ... */ };

    await fetchStreamWithRetries(
        API_URL,
        options,
        processAnthropicStream,
        getAnthropicError
    );
}
```

**مرحله ۴: ثبت Provider جدید**
در فایل `js/core/chatEngine.js`، Provider جدید خود را وارد (import) کرده و به مپ `this.providers` اضافه کنید:
```javascript
// At the top
import { streamAnthropicResponse } from './providers/anthropicProvider.js';

// Inside constructor
this.providers = {
    gemini: streamGeminiResponse,
    openai: streamOpenAIResponse,
    custom: streamCustomResponse,
    anthropic: streamAnthropicResponse, // Add this line
};
```

**مرحله ۵ (اختیاری): به‌روزرسانی UI**
اگر Provider جدید نیاز به فیلدهای خاصی در تنظیمات دارد، فایل `templates/settingsModal.html` و `js/ui/components/settingsModal.js` را برای افزودن فیلدهای ورودی و منطق مربوطه ویرایش کنید.

### چگونه UI را سفارشی‌سازی کنیم؟

از آنجایی که `ChatEngine` کاملاً از UI جداست، شما می‌توانید هر رابط کاربری دلخواهی بسازید. تنها کاری که باید انجام دهید این است که:
1.  یک نمونه از `ChatEngine` بسازید.
2.  به رویدادهای آن گوش دهید تا DOM را به‌روزرسانی کنید.
3.  متدهای عمومی آن را برای ارسال پیام یا ذخیره تنظیمات فراخوانی کنید.

این جداسازی به شما اجازه می‌دهد که کل لایه UI را با یک فریمورک دیگر مانند React یا Vue جایگزین کنید، بدون اینکه نیازی به تغییر `ChatEngine` باشد.

### چگونه مکانیزم ذخیره‌سازی را تغییر دهیم؟

تمام منطق ذخیره‌سازی در `js/services/storageService.js` کپسوله شده است. این ماژول در حال حاضر از `localStorage` استفاده می‌کند.
اگر می‌خواهید از `IndexedDB`، `sessionStorage` یا حتی یک API در بک‌اند برای ذخیره‌سازی استفاده کنید، فقط کافی است توابع زیر را در این فایل بازنویسی کنید و مطمئن شوید که همان نوع داده را برمی‌گردانند:
-   `saveAllChats(chats)`
-   `loadAllChats()`
-   `saveSettings(settings)`
-   `loadSettings()`

هیچ بخش دیگری از برنامه نیاز به تغییر نخواهد داشت.

### چگونه مفسر Markdown را تغییر دهیم؟

تمام منطق پردازش Markdown در فایل `js/services/markdownService.js` قرار دارد. این سرویس در حال حاضر از کتابخانه `markdown-it` استفاده می‌کند.
اگر می‌خواهید از یک مفسر دیگر (مانند Marked.js یا یک مفسر سفارشی) استفاده کنید، کافی است این فایل را ویرایش کنید. تا زمانی که یک متد `render(markdownText)` را `export` کنید که یک رشته HTML برمی‌گرداند، بقیه برنامه بدون هیچ تغییری به کار خود ادامه خواهد داد.

## بخش ۳: بهترین شیوه‌ها (Best Practices)

### الگوهای طراحی استفاده شده

-   **Observer (Pub/Sub)**: از طریق `EventEmitter` پیاده‌سازی شده و ارتباط بین `Core` و `UI` را مدیریت می‌کند. این الگو باعث جداسازی کامل این دو لایه می‌شود.
-   **Strategy**: در `chatEngine.js` برای انتخاب `Provider` در زمان اجرا استفاده می‌شود. این الگو به ما اجازه می‌دهد به راحتی Providerهای جدید اضافه کنیم.
-   **Module**: استفاده گسترده از ماژول‌های ES6 برای تقسیم کد به بخش‌های کوچک و با مسئولیت واحد.

### نکات امنیتی

-   **محافظت از کلید API**: این یک برنامه کاملاً سمت کاربر (Client-Side) است. **کلیدهای API در `localStorage` ذخیره می‌شوند که امن نیست.** برای یک محیط پروداکشن واقعی، شما باید یک سرور واسط (Backend Proxy) ایجاد کنید که کلیدهای API را به صورت امن نگهداری کند. کلاینت با سرور شما ارتباط برقرار می‌کند و سرور شما درخواست را به API نهایی ارسال می‌کند.
-   **جلوگیری از XSS**: کتابخانه `markdown-it` به صورت پیش‌فرض تگ‌های HTML را پاک‌سازی (Sanitize) نمی‌کند. از آنجایی که گزینه `html: true` فعال است، باید به محتوایی که از API دریافت می‌شود اعتماد کرد. برای امنیت بیشتر در آینده، می‌توان یک پاک‌سازی‌کننده HTML مانند `DOMPurify` را به `markdownService` اضافه کرد.
