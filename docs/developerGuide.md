# راهنمای توسعه‌دهندگان گوگ (Goug AI Chat)

این سند به عنوان یک راهنمای عملی برای توسعه‌دهندگانی است که می‌خواهند با کدبیس پروژه گوگ کار کرده، آن را گسترش دهند یا از آن در پروژه‌های دیگر استفاده کنند.

## بخش ۱: API داخلی (Internal API)

این بخش APIهای عمومی و رویدادهای اصلی سیستم را تشریح می‌کند که برای تعامل با هسته برنامه ضروری هستند.

### `ChatEngine` API

`ChatEngine` مغز متفکر برنامه است. تمام تعاملات UI با این کلاس انجام می‌شود.

**نحوه نمونه‌سازی:**
```javascript
import ChatEngine from './core/chatEngine.js';
import * as IndexedDBStorage from './services/storageService.js';

// یک آداپتور ذخیره‌سازی را به constructor پاس دهید
const chatEngine = new ChatEngine({ storage: IndexedDBStorage });
```

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
| `init()`                 | -                        | موتور را راه‌اندازی کرده و داده‌ها را از آداپتور ذخیره‌سازی بارگذاری می‌کند. |
| `saveSettings(settings)` | `settings: object`       | تنظیمات جدید را دریافت و در حافظه ذخیره می‌کند.                        |
| `sendMessage(userInput, image)` | `userInput: string`, `image?: {data, mimeType}` | پیام کاربر (و تصویر اختیاری) را به چت فعال اضافه کرده و برای پردازش ارسال می‌کند.|
| `startNewChat()`         | -                        | یک چت جدید و خالی ایجاد کرده و آن را به عنوان چت فعال تنظیم می‌کند.       |
| `switchActiveChat(chatId)`| `chatId: string`        | چت مشخص شده را به عنوان چت فعال تنظیم می‌کند.                         |
| `renameChat(chatId, newTitle)` | `chatId: string, newTitle: string` | عنوان یک چت مشخص را تغییر می‌دهد.                                     |
| `deleteChat(chatId)`     | `chatId: string`         | یک چت مشخص را از لیست حذف می‌کند.                                      |


**مثال استفاده:**
```javascript
// Send a text message
chatEngine.sendMessage('سلام، حالت چطوره؟');

// Send an image with a caption
const imageObject = { data: 'base64_string...', mimeType: 'image/jpeg' };
chatEngine.sendMessage('این عکس را ببین', imageObject);
```

## بخش ۲: راهنمای توسعه

این بخش به شما نشان می‌دهد چگونه قابلیت‌های جدید به برنامه اضافه کنید.

### چگونه منطق تصویر کار می‌کند؟

جریان داده برای ارسال یک تصویر به شرح زیر است:

1.  **انتخاب فایل (`ChatUI`)**: کاربر روی دکمه پیوست کلیک می‌کند و `handleFileSelect` فراخوانی می‌شود.
2.  **اعتبارسنجی و خواندن (`ChatUI`)**: فایل از نظر نوع و حجم اعتبارسنجی می‌شود. سپس با استفاده از `FileReader` به صورت `Data URL` خوانده می‌شود.
3.  **فشرده‌سازی (`ChatUI`)**: اگر حجم فایل از ۲ مگابایت بیشتر باشد (و GIF نباشد)، متد `compressImage` فراخوانی می‌شود.
4.  **ذخیره در وضعیت UI (`ChatUI`)**: آبجکت تصویر (`{ data: base64, mimeType: '...' }`) در `this.attachedImage` ذخیره شده و `renderPreview` برای نمایش پیش‌نمایش فراخوانی می‌شود.
5.  **ارسال به موتور (`ChatUI` -> `ChatEngine`)**: هنگام ارسال، `handleSendMessage` آبجکت تصویر را به متد `chatEngine.sendMessage` پاس می‌دهد.
6.  **افزودن به تاریخچه (`ChatEngine`)**: `ChatEngine` یک آبجکت پیام جدید با پراپرتی `image` ایجاد کرده و آن را به تاریخچه چت فعال اضافه می‌کند، سپس رویداد `message` را برای UI منتشر می‌کند.
7.  **ارسال به Provider (`ChatEngine` -> `Provider`)**: تاریخچه پیام‌ها به `Provider` مربوطه ارسال می‌شود.
8.  **ساخت بدنه درخواست (`Provider`)**: هر `Provider` مسئول تبدیل آبجکت تصویر به فرمت مورد نیاز API خود است.

### چگونه یک Provider جدید اضافه کنیم؟

برای افزودن پشتیبانی از یک API جدید (مثلاً Anthropic Claude)، مراحل زیر را دنبال کنید:

**مرحله ۱: ایجاد فایل Provider**
یک فایل جدید در مسیر `js/core/providers/` بسازید. برای مثال: `anthropicProvider.js`.

**مرحله ۲: پیاده‌سازی تابع اصلی استریم**
در این فایل، یک تابع `export` شده با امضای زیر ایجاد کنید:
`async function streamAnthropicResponse(settings, history, onChunk)`

**مرحله ۳: ساخت بدنه درخواست و پردازش پاسخ**
1.  بدنه درخواست را مطابق با مستندات API بسازید.
2.  `fetchStreamWithRetries` را از `apiService.js` فراخوانی کنید.
3.  توابع callback برای پردازش هر خط از پاسخ و استخراج پیام خطا پیاده‌سازی کنید.

**مرحله ۴: ثبت Provider جدید**
در فایل `js/core/chatEngine.js`، Provider جدید خود را وارد (import) کرده و به مپ `this.providers` اضافه کنید.

**مرحله ۵ (اختیاری): به‌روزرسانی UI**
اگر Provider جدید نیاز به فیلدهای خاصی در تنظیمات دارد، فایل `templates/settingsModal.html` و `js/ui/components/settingsModal.js` را ویرایش کنید.

### چگونه UI را سفارشی‌سازی کنیم؟

از آنجایی که `ChatEngine` کاملاً از UI جداست، شما می‌توانید هر رابط کاربری دلخواهی بسازید. تنها کاری که باید انجام دهید این است که:
1.  یک نمونه از `ChatEngine` با آداپتور ذخیره‌سازی دلخواه بسازید.
2.  به رویدادهای آن گوش دهید تا DOM را به‌روزرسانی کنید.
3.  متدهای عمومی آن را برای ارسال پیام یا ذخیره تنظیمات فراخوانی کنید.

### چگونه مکانیزم ذخیره‌سازی را تغییر دهیم؟

به لطف معماری جدید، تغییر مکانیزم ذخیره‌سازی بسیار آسان است. `ChatEngine` دیگر به `IndexedDB` وابسته نیست و هر آبجکتی که **رابط ذخیره‌سازی (Storage Interface)** را پیاده‌سازی کند، می‌پذیرد.

**مراحل**:
1.  یک ماژول جاوااسکریپت جدید ایجاد کنید (مثلاً `myCustomStorage.js`).
2.  در این ماژول، ۵ متد `async` مورد نیاز را `export` کنید.
3.  در فایل ورودی اصلی برنامه (`main.js`)، ماژول خود را import کرده و آن را به `ChatEngine` تزریق کنید.

```javascript
// In main.js
import ChatEngine from './core/chatEngine.js';
import * as MyCustomStorage from './services/myCustomStorage.js';

const chatEngine = new ChatEngine({ storage: MyCustomStorage });
// ... rest of the initialization
```

برای مشاهده جزئیات کامل API مورد نیاز و مثال‌های پیاده‌سازی، به **[راهنمای آداپتور ذخیره‌سازی (Storage Adaptor Guide)](./storageAdaptorGuide.md)** مراجعه کنید.

### چگونه مفسر Markdown را تغییر دهیم؟

تمام منطق پردازش Markdown در فایل `js/services/markdownService.js` قرار دارد. برای استفاده از یک مفسر دیگر، کافی است این فایل را ویرایش کرده و متد `render(markdownText)` را با پیاده‌سازی جدید جایگزین کنید.

## بخش ۳: بهترین شیوه‌ها (Best Practices)

### الگوهای طراحی استفاده شده

-   **Observer (Pub/Sub)**: از طریق `EventEmitter` پیاده‌سازی شده و ارتباط بین `Core` و `UI` را مدیریت می‌کند.
-   **Strategy**: در `chatEngine.js` برای انتخاب `Provider` در زمان اجرا استفاده می‌شود.
-   **Adapter**: الگوی آداپتور برای لایه ذخیره‌سازی استفاده شده تا `ChatEngine` بتواند با هر مکانیزم ذخیره‌سازی کار کند.
-   **Dependency Injection**: آداپتور ذخیره‌سازی به `ChatEngine` تزریق می‌شود که باعث جداسازی بیشتر کد می‌شود.

### نکات امنیتی

-   **محافظت از کلید API**: این یک برنامه کاملاً سمت کاربر (Client-Side) است. **کلیدهای API در `IndexedDB` (یا هر مکانیزم ذخیره‌سازی دیگر در مرورگر) ذخیره می‌شوند که اگرچه از `localStorage` امن‌تر است، اما همچنان در دسترس کاربر در مرورگر قرار دارد.** برای یک محیط پروداکشن واقعی، شما باید یک سرور واسط (Backend Proxy) ایجاد کنید که کلیدهای API را به صورت امن نگهداری کند.
-   **جلوگیری از XSS**: کتابخانه `markdown-it` برای لینک‌ها و محتوای Markdown استفاده می‌شود. تنظیمات فعلی `html: false` است که از تزریق HTML توسط مدل جلوگیری می‌کند. همیشه به خروجی‌های کتابخانه‌های third-party با احتیاط نگاه کنید.