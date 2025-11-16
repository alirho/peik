# راهنمای توسعه‌دهندگان گوگ (Goug AI Chat)

این سند به عنوان یک راهنمای عملی برای توسعه‌دهندگانی است که می‌خواهند با کدبیس پروژه گوگ کار کرده، آن را گسترش دهند یا از آن در پروژه‌های دیگر استفاده کنند.

## بخش ۱: API داخلی (Internal API)

این بخش APIهای عمومی و رویدادهای اصلی سیستم را تشریح می‌کند که برای تعامل با هسته برنامه ضروری هستند.

### `ChatEngine` API

`ChatEngine` ارکستراتور اصلی هسته برنامه است. تمام تعاملات UI با این کلاس انجام می‌شود.

**نحوه نمونه‌سازی:**
```javascript
import ChatEngine from './core/chatEngine.js';
import * as IndexedDBStorage from './services/storageService.js';
import { streamGeminiResponse } from './core/providers/geminiProvider.js';

const chatEngine = new ChatEngine({
    storage: IndexedDBStorage,
    providers: {
        gemini: streamGeminiResponse,
        // ... other providers
    }
});
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
| `streamEnd`            | `undefined`                                           | پس از اتمام کامل استریم پاسخ، فراخوانی می‌شود.                                                          |
| `error`                | `errorMessage: string`                                | در صورت بروز خطا (API، اعتبارسنجی، ذخیره‌سازی)، با پیام خطا فراخوانی می‌شود.                            |
| `success`              | `successMessage: string`                              | در صورت موفقیت یک عملیات پس‌زمینه‌ای (مانند ذخیره‌سازی مجدد) فراخوانی می‌شود.                             |
| `messageRemoved`       | `undefined`                                           | اگر یک درخواست با خطا مواجه شود و پیام موقت دستیار نیاز به حذف داشته باشد، فراخوانی می‌شود.              |
| `chatListUpdated`      | `{ chats, activeChatId }`                             | زمانی که لیست چت‌ها تغییر می‌کند (ایجاد، حذف، تغییر نام)، فراخوانی می‌شود.                                  |
| `activeChatSwitched`   | `activeChat: object`                                  | هنگامی که کاربر یک چت دیگر را به عنوان چت فعال انتخاب می‌کند، فراخوانی می‌شود.                            |


**مثال استفاده:**
```javascript
// Re-render chat list whenever it changes
chatEngine.on('chatListUpdated', ({ chats, activeChatId }) => {
    sidebarManager.render(chats, activeChatId);
});

// Load a new chat's history when switched
chatEngine.on('activeChatSwitched', (activeChat) => {
    messageRenderer.renderHistory(activeChat.messages);
});
```

#### متدهای عمومی (Public Methods)

| متد                      | پارامترها                | توضیحات                                                                |
| ------------------------ | ------------------------ | ---------------------------------------------------------------------- |
| `init()`                 | -                        | موتور را راه‌اندازی کرده و داده‌ها را از آداپتور ذخیره‌سازی بارگذاری می‌کند. |
| `saveSettings(settings)` | `settings: object`       | تنظیمات جدید را دریافت و در حافظه ذخیره می‌کند.                        |
| `sendMessage(userInput, image)` | `userInput: string`, `image?: {data, mimeType}` | پیام کاربر (و تصویر اختیاری) را به چت فعال اضافه کرده و برای پردازش ارسال می‌کند.|
| `registerProvider(name, handler)` | `name: string, handler: Function` | یک ارائه‌دهنده جدید را به صورت پویا ثبت می‌کند. |
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

## بخش ۲: تایپ‌های اصلی داده (Core Data Types)

برای بهبود خوانایی و قابلیت نگهداری کد، پروژه از JSDoc برای تعریف تایپ‌های اصلی داده استفاده می‌کند. این تایپ‌ها در فایل `js/types.js` تعریف شده‌اند و به IDE شما برای ارائه راهنمایی بهتر کمک می‌کنند.

-   **`Message`**: نماینده یک پیام در گفتگو.
-   **`ImageData`**: نماینده یک تصویر پیوست شده.
-   **`Chat`**: نماینده یک گفتگوی کامل.
-   **`Settings`**: نماینده تنظیمات کاربر.
-   **`StorageAdapter`**: رابط (Interface) برای ماژول‌های ذخیره‌سازی.
-   **`ProviderHandler`**: رابط (Interface) برای ماژول‌های ارائه‌دهنده API.

برای مشاهده جزئیات کامل هر تایپ، به فایل `js/types.js` مراجعه کنید.

## بخش ۳: راهنمای توسعه

این بخش به شما نشان می‌دهد چگونه قابلیت‌های جدید به برنامه اضافه کنید.

### چگونه منطق تصویر کار می‌کند؟

جریان داده برای ارسال یک تصویر پس از بازسازی UI به شرح زیر است:

1.  **راه‌اندازی (`InputManager`)**: کاربر روی دکمه پیوست کلیک می‌کند. `InputManager` این رویداد را گرفته و متد `fileManager.trigger()` را فراخوانی می‌کند.
2.  **انتخاب فایل (`FileManager`)**: `FileManager` پنجره انتخاب فایل را باز می‌کند. پس از انتخاب، فایل را اعتبارسنجی کرده، می‌خواند و در صورت نیاز فشرده‌سازی می‌کند.
3.  **ارسال داده به InputManager (`FileManager`)**: پس از پردازش موفقیت‌آمیز، `FileManager` یک `callback` را با آبجکت `ImageData` فراخوانی می‌کند که در `constructor` از `ChatUI` دریافت کرده است.
4.  **نمایش پیش‌نمایش (`InputManager`)**: این `callback` به متد `inputManager.setAndPreviewImage` متصل است. این متد آبجکت تصویر را در وضعیت داخلی خود ذخیره کرده و پیش‌نمایش را در UI رندر می‌کند.
5.  **ارسال نهایی (`InputManager` -> `ChatUI` -> `ChatEngine`)**: وقتی کاربر دکمه ارسال را می‌زند، `InputManager` با متن و آبجکت تصویر، `callback` مربوط به `onSendMessage` را فراخوانی می‌کند. این `callback` به متد `chatUI.handleSendMessage` متصل است که در نهایت `chatEngine.sendMessage` را فراخوانی می‌کند.
6.  **پردازش در هسته (`ChatEngine` -> `MessageHandler`)**: `ChatEngine` وظیفه را به `MessageHandler` واگذار می‌کند، که پیام را ساخته و فرآیند ارتباط با API را آغاز می‌کند.

### چگونه یک ارائه‌دهنده (Provider) جدید اضافه کنیم؟

به لطف معماری ماژولار، افزودن پشتیبانی از یک API جدید (مانند Anthropic Claude) نیازی به تغییر در هسته `ChatEngine` ندارد. شما باید یک **"آداپتور ارائه‌دهنده"** ایجاد کنید.

برای مشاهده جزئیات کامل API مورد نیاز، مراحل پیاده‌سازی و مثال‌های عملی، به **[راهنمای آداپتور ارائه‌دهنده (Provider Adapter Guide)](./providerAdaptorGuide.md)** مراجعه کنید.

### چگونه UI را سفارشی‌سازی کنیم؟

از آنجایی که `ChatEngine` کاملاً از UI جداست، شما می‌توانید هر رابط کاربری دلخواهی بسازید. تنها کاری که باید انجام دهید این است که:
1.  یک نمونه از `ChatEngine` با آداپتور ذخیره‌سازی دلخواه بسازید.
2.  به رویدادهای آن گوش دهید تا DOM را به‌روزرسانی کنید.
3.  متدهای عمومی آن را برای ارسال پیام یا ذخیره تنظیمات فراخوانی کنید.

### چگونه مکانیزم ذخیره‌سازی را تغییر دهیم؟

`ChatEngine` هر آبجکتی که **رابط ذخیره‌سازی (Storage Interface)** را پیاده‌سازی کند، می‌پذیرد.

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

## بخش ۴: بهترین شیوه‌ها (Best Practices)

### الگوهای طراحی استفاده شده

-   **Orchestrator/Module**: در لایه‌های `Core` و `UI` برای تقسیم مسئولیت‌ها استفاده شده است.
-   **Observer (Pub/Sub)**: از طریق `EventEmitter` پیاده‌سازی شده و ارتباط بین `Core` و `UI` را مدیریت می‌کند.
-   **Strategy**: در `MessageHandler` برای انتخاب `Provider` در زمان اجرا استفاده می‌شود.
-   **Adapter**: برای لایه ذخیره‌سازی و ارائه‌دهندگان استفاده شده است.
-   **Dependency Injection**: آداپتور ذخیره‌سازی و ارائه‌دهندگان به `ChatEngine` تزریق می‌شوند.

### نکات امنیتی

-   **محافظت از کلید API**: این یک برنامه کاملاً سمت کاربر (Client-Side) است. **کلیدهای API در `IndexedDB` ذخیره می‌شوند که اگرچه از `localStorage` امن‌تر است، اما همچنان در دسترس کاربر در مرورگر قرار دارد.** برای یک محیط پروداکشن واقعی، شما باید یک سرور واسط (Backend Proxy) ایجاد کنید که کلیدهای API را به صورت امن نگهداری کند. قابلیت **"فقط برای این نشست"** یک لایه امنیتی اضافه برای کاربران فراهم می‌کند.
-   **جلوگیری از XSS**: کتابخانه `markdown-it` برای رندر محتوای Markdown استفاده می‌شود. تنظیمات فعلی `html: false` است که از تزریق HTML توسط مدل جلوگیری می‌کند.