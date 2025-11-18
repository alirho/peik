# راهنمای توسعه‌دهندگان گوگ (Goug AI Chat)

این سند به عنوان یک راهنمای عملی برای توسعه‌دهندگانی است که می‌خواهند با کدبیس پروژه گوگ کار کرده، آن را گسترش دهند یا از آن در پروژه‌های دیگر استفاده کنند.

## بخش ۱: API داخلی (Internal API)

این بخش APIهای عمومی و رویدادهای اصلی سیستم را تشریح می‌کند که برای تعامل با هسته برنامه ضروری هستند.

### `ChatEngine` API

`ChatEngine` ارکستراتور اصلی هسته برنامه است. تمام تعاملات UI با این کلاس انجام می‌شود.

**نحوه نمونه‌سازی:**
```javascript
import ChatEngine from './core/chatEngine.js';
import * as IndexedDBStorage from './services/indexedDBStorage.js';
import { streamGeminiResponse } from './core/providers/geminiProvider.js';

// فرض کنید config از فایل config.json بارگذاری شده است
const config = { defaultProvider: { /* ... */ } }; 

const chatEngine = new ChatEngine({
    storage: IndexedDBStorage,
    providers: {
        gemini: streamGeminiResponse,
        // ... other providers
    },
    defaultProvider: config?.defaultProvider
});
```

#### رویدادها (Events)

شما می‌توانید با استفاده از متد `chatEngine.on('eventName', callback)` به این رویدادها گوش دهید.

| رویداد                 | داده ارسالی (`data`)                                  | توضیحات                                                                                                  |
| ---------------------- | ----------------------------------------------------- | --------------------------------------------------------------------------------------------------------- |
| `init`                 | `{ settings, chats, activeChat, isDefaultProvider }`  | پس از بارگذاری اولیه تنظیمات و چت‌ها از حافظه، یک بار فراخوانی می‌شود. `isDefaultProvider` نشان می‌دهد که آیا از پیکربندی پیش‌فرض استفاده می‌شود یا خیر. |
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
| `sendMessage(userInput, image)` | `userInput: string`, `image?: {data, mimeType}` | پیام کاربر (و تصویر اختیاری) را ارسال می‌کند. این متد به صورت خودکار هر درخواست قبلی در حال اجرا را لغو می‌کند.|
| `registerProvider(name, handler)` | `name: string, handler: Function` | یک ارائه‌دهنده جدید را به صورت پویا ثبت می‌کند. |
| `startNewChat()`         | -                        | یک چت جدید و خالی ایجاد کرده و آن را به عنوان چت فعال تنظیم می‌کند.       |
| `switchActiveChat(chatId)`| `chatId: string`        | چت مشخص شده را به عنوان چت فعال تنظیم می‌کند.                         |
| `updateChatModel(chatId, providerConfig)` | `chatId: string`, `providerConfig: object` | پیکربندی مدل برای یک گپ خاص را به‌روزرسانی می‌کند. |
| `renameChat(chatId, newTitle)` | `chatId: string, newTitle: string` | عنوان یک چت مشخص را تغییر می‌دهد.                                     |
| `deleteChat(chatId)`     | `chatId: string`         | یک چت مشخص را از لیست حذف می‌کند.                                      |
| `destroy()`              | -                        | تمام منابع موتور (شنوندگان رویداد، تایمرها) را برای جلوگیری از نشت حافظه پاک‌سازی می‌کند. |


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

-   **`ChatModelInfo`**: یک **مرجع** به یک مدل است که در هر گپ ذخیره می‌شود. این آبجکت اطلاعات حساس (مانند کلید API) را شامل **نمی‌شود**.
    ```javascript
    /**
     * @typedef {object} ChatModelInfo
     * @property {'gemini' | 'openai' | 'custom'} provider - نوع ارائه‌دهنده
     * @property {string} [customProviderId] - شناسه یکتای پیکربندی ارائه‌دهنده سفارشی، در صورت وجود
     * @property {string} displayName - نام نمایشی برای ارائه‌دهنده (مثلاً "Gemini", "Ollama Llama3")
     * @property {string} modelName - نام مدل خاص (مثلاً "gemini-2.5-flash")
     */
    ```
-   **`Chat`**: نماینده یک گفتگوی کامل. به جای ذخیره پیکربندی کامل، فقط یک `modelInfo` را نگه می‌دارد.
    ```javascript
    /**
     * @typedef {object} Chat
     * @property {string} id - شناسه یکتای گپ
     * @property {string} title - عنوان گپ
     * @property {Array<Message>} [messages] - ...
     * @property {number} createdAt - ...
     * @property {number} updatedAt - ...
     * @property {ChatModelInfo} modelInfo - مرجعی به مدل استفاده شده توسط این گپ
     */
    ```

-   **`CustomProviderConfig`**: نماینده یک پیکربندی کامل برای ارائه‌دهنده سفارشی که در تنظیمات ذخیره می‌شود.
    ```javascript
    /**
     * @typedef {object} CustomProviderConfig
     * @property {string} id - یک شناسه یکتای سمت کاربر برای پیکربندی
     * @property {string} name - یک نام تعریف شده توسط کاربر برای این ارائه‌دهنده سفارشی
     * @property {string} modelName
     * @property {string} apiKey
     * @property {string} endpointUrl
     */
    ```

-   **`Settings`**: نماینده تنظیمات کاربر. این آبجکت شامل اطلاعات **تمام** ارائه‌دهندگان است تا بتوان لیست کاملی از مدل‌های موجود را نمایش داد.
    ```javascript
    /**
     * @typedef {object} Settings
     * @property {string | null} activeProviderId - شناسه ارائه‌دهنده فعال ('gemini', 'openai', یا شناسه سفارشی)
     * @property {{
     *   gemini: { modelName: string, apiKey: string },
     *   openai: { modelName: string, apiKey: string },
     *   custom: Array<CustomProviderConfig>
     * }} providers - آبجکت حاوی تمام پیکربندی‌ها
     */
    ```

-   **`StorageAdapter`**: رابط (Interface) برای ماژول‌های ذخیره‌سازی.
-   **`ProviderHandler`**: رابط (Interface) برای ماژول‌های ارائه‌دهنده API. ساختار کامل آن به شرح زیر است:
    ```javascript
    /**
     * @callback ProviderHandler
     * @param {object} providerConfig - پیکربندی **کامل** و استخراج شده برای این ارائه‌دهنده
     * @param {Array<Message>} history - تاریخچه پیام‌ها برای ارسال به API
     * @param {(chunk: string) => void} onChunk - تابعی که برای هر قطعه از پاسخ استریم فراخوانی می‌شود
     * @param {AbortSignal} [signal] - یک سیگنال اختیاری برای لغو درخواست
     * @returns {Promise<void>}
     */
    ```

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

## بخش 5: چرخه حیات و بهترین شیوه‌ها برای پاک‌سازی (Lifecycle & Cleanup Best Practices)

برای اطمینان از اینکه برنامه منابع را به درستی مدیریت کرده و دچار نشت حافظه نمی‌شود، تمام کلاس‌های اصلی (چه در لایه Core و چه در لایه UI) از یک الگوی چرخه حیات پیروی می‌کنند.

### الگوی `init()` و `destroy()`

-   **`constructor()`**: در سازنده، فقط وابستگی‌ها را تزریق کرده و وضعیت اولیه را تنظیم کنید. از انجام عملیات‌های سنگین یا دستکاری DOM در این مرحله خودداری کنید.
-   **`init()`**: این متد (معمولاً `async`) باید برای تمام عملیات‌های راه‌اندازی استفاده شود. این شامل موارد زیر است:
    -   کش کردن المان‌های DOM.
    -   اتصال شنوندگان رویداد (Event Listeners).
    -   بارگذاری داده‌های اولیه.
-   **`destroy()`**: این متد باید **معکوس** `init` باشد. مسئولیت اصلی آن پاک‌سازی کامل تمام منابعی است که کامپوننت ایجاد کرده است. **این مرحله برای جلوگیری از نشت حافظه حیاتی است.**
    -   **حذف تمام شنوندگان رویداد**: هر `addEventListener` باید یک `removeEventListener` متناظر در `destroy` داشته باشد.
    -   پاک کردن تایمرها: تمام `setInterval` یا `setTimeout` های فعال باید با `clearInterval` یا `clearTimeout` پاک شوند.
    -   آزاد کردن منابع دیگر: هر منبع دیگری مانند `BroadcastChannel` باید بسته (`close`) شود.

### مثال عملی: مدیریت شنوندگان رویداد

یک اشتباه رایج که منجر به نشت حافظه می‌شود، عدم توانایی در حذف شنوندگان رویداد است. برای اینکه بتوانید یک listener را حذف کنید، باید یک ارجاع (reference) به همان تابع داشته باشید.

**روش اشتباه (حافظه نشت می‌کند):**
```javascript
// در init()
this.button.addEventListener('click', () => this.doSomething());

// در destroy()
// ؟؟؟ چگونه این تابع بی‌نام را حذف کنیم؟ نمی‌توانیم!
this.button.removeEventListener('click', () => this.doSomething()); // این کار نمی‌کند!
```

**روش صحیح (استفاده از توابع `bind` شده):**

```javascript
class MyComponent {
    constructor() {
        this.button = document.getElementById('my-button');
        // 1. یک نسخه bind شده از handler را در constructor ایجاد کنید.
        this.handleClickBound = this.handleClick.bind(this);
    }

    init() {
        // 2. از نسخه bind شده برای اضافه کردن listener استفاده کنید.
        this.button.addEventListener('click', this.handleClickBound);
    }

    destroy() {
        // 3. از همان نسخه برای حذف listener استفاده کنید.
        this.button.removeEventListener('click', this.handleClickBound);
        console.log('MyComponent destroyed and listeners cleaned up.');
    }

    handleClick() {
        console.log('Button was clicked!');
    }
}
```

پیروی از این الگو در سراسر پروژه تضمین می‌کند که برنامه پایدار باقی مانده و منابع سیستم را به طور مؤثر مدیریت می‌کند.

## بخش ۶: راهنمای مدیریت خطا (Error Handling Guide)

برنامه از یک سیستم خطای سفارشی قوی برای مدیریت بهتر خطاها و ارائه بازخورد دقیق‌تر به کاربر و توسعه‌دهنده استفاده می‌کند. این رویکرد از بررسی محتوای متنی پیام خطا (string matching) که شکننده است، جلوگیری می‌کند.

### فلسفه طراحی

-   **نوع-امن (Type-Safe)**: با استفاده از `instanceof` می‌توان نوع دقیق خطا را تشخیص داد.
-   **متمرکز**: تمام خطاهای سفارشی در یک فایل واحد (`js/utils/customErrors.js`) تعریف شده‌اند.
-   **قابل گسترش**: افزودن انواع خطاهای جدید آسان است.

### کلاس‌های خطای اصلی

تمام خطاهای سفارشی از کلاس پایه `AppError` ارث‌بری می‌کنند. برخی از خطاهای کلیدی عبارتند از:

| کلاس خطا               | توضیحات                                                                                    |
| ----------------------- | ------------------------------------------------------------------------------------------ |
| `VersionError`          | زمانی که نسخه دیگری از برنامه در تب دیگر باز است و باعث تداخل IndexedDB می‌شود.             |
| `StorageSupportError`   | زمانی که مرورگر از قابلیت‌های لازم (مانند IndexedDB) پشتیبانی نمی‌کند.                       |
| `StorageAccessError`    | زمانی که دسترسی به حافظه مرورگر به دلایل امنیتی یا حالت ناشناس مسدود شده است.               |
| `QuotaExceededError`    | زمانی که فضای ذخیره‌سازی مرورگر پر شده است.                                               |
| `NetworkError`          | در صورت بروز خطای شبکه (مانند عدم اتصال به اینترنت).                                        |
| `ApiError`              | برای خطاهای خاص بازگشتی از API (مانند کلید نامعتبر). این خطا شامل `status` کد HTTP است.      |
| `TemplateLoadError`     | زمانی که بارگذاری یک فایل قالب HTML با شکست مواجه می‌شود.                                   |

### نحوه استفاده

**پرتاب کردن خطا (Throwing):**
در لایه‌های سرویس، به جای `throw new Error("...")`، از خطای سفارشی مناسب استفاده کنید.
```javascript
// در js/services/indexedDBStorage.js
if (!window.indexedDB) {
    return reject(new StorageSupportError());
}
```

**گرفتن خطا (Catching):**
در لایه‌های بالاتر (مانند `main.js` یا ماژول‌های UI)، از `try...catch` و `instanceof` برای مدیریت خطا استفاده کنید.
```javascript
// در js/main.js
try {
    await chatEngine.init();
} catch (error) {
    if (error instanceof VersionError) {
        // نمایش پیام مخصوص خطای نسخه
    } else if (error instanceof StorageSupportError) {
        // نمایش پیام عدم پشتیبانی مرورگر
    } else {
        // مدیریت خطای عمومی
    }
}
```