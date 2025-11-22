# مرجع API هسته پیک (Peik Core API Reference)

این سند جزئیات فنی تمام کلاس‌ها، متدها و رویدادهای موجود در پکیج `@peik/core` را شرح می‌دهد.

---

## فهرست مطالب
1. [Peik (کلاس اصلی)](#peik)
2. [Chat (مدیریت گفتگو)](#chat)
3. [Plugin & PluginManager](#plugin--pluginmanager)
4. [EventEmitter](#eventemitter)
5. [Interfaces (رابط‌ها)](#interfaces)

---

## <a name="peik"></a> 1. کلاس `Peik`

کلاس اصلی و نقطه ورود به سیستم. وظیفه هماهنگی بین افزونه‌ها و مدیریت چرخه حیات برنامه را بر عهده دارد.

### Constructor
```javascript
const peik = new Peik(config?);
```
-   `config` (اختیاری): تنظیمات اولیه مانند `defaultProvider`.

### متدها

#### `async use(plugin)`
یک افزونه را در سیستم ثبت و نصب می‌کند.
-   `plugin`: نمونه‌ای از کلاس `Plugin`.
-   **بازگشت**: `Promise<Peik>` (برای استفاده زنجیره‌ای).

#### `async init()`
سیستم را راه‌اندازی می‌کند. داده‌ها را از ذخیره‌سازی بارگذاری کرده و رویداد `ready` را منتشر می‌کند.

#### `async createChat(title?)`
یک گفتگوی جدید ایجاد می‌کند.
-   `title`: عنوان گفتگو (پیش‌فرض: "گپ جدید").
-   **بازگشت**: `Promise<Chat>`.

#### `async getChat(chatId)`
یک گفتگو را با تمام پیام‌هایش بارگذاری می‌کند.
-   `chatId`: شناسه یکتای گفتگو.
-   **بازگشت**: `Promise<Chat>`.

#### `async deleteChat(chatId)`
یک گفتگو را حذف می‌کند.

#### `async updateSettings(newSettings)`
تنظیمات سراسری سیستم را به‌روزرسانی و ذخیره می‌کند.

### رویدادها (Events)
-   `ready`: زمانی که سیستم کاملاً راه‌اندازی شد.
-   `chat:created`: زمانی که گپ جدیدی ساخته شد.
-   `chat:deleted`: زمانی که گپی حذف شد.
-   `error`: خطاهای عمومی سیستم.

---

## <a name="chat"></a> 2. کلاس `Chat`

نماینده یک جلسه گفتگو. مدیریت ارسال پیام و نگهداری تاریخچه را بر عهده دارد.

### ویژگی‌ها (Properties)
-   `id`: شناسه یکتا.
-   `title`: عنوان گفتگو.
-   `messages`: آرایه‌ای از پیام‌ها.
-   `modelInfo`: اطلاعات مدلی که این گپ از آن استفاده می‌کند.

### متدها

#### `async sendMessage(content, image?)`
یک پیام کاربر ارسال می‌کند و پاسخ مدل را دریافت می‌کند.
-   `content`: متن پیام.
-   `image` (اختیاری): آبجکت تصویر `{ data: string, mimeType: string }`.

#### `async updateTitle(newTitle)`
عنوان گپ را تغییر می‌دهد.

#### `async changeModel(newModelInfo)`
مدل مورد استفاده برای این گپ را تغییر می‌دهد.

#### `cancel()`
اگر پیامی در حال ارسال باشد (Stream)، آن را لغو می‌کند.

### رویدادها (Events)
-   `message`: وقتی پیام جدیدی (کاربر یا مدل) به لیست اضافه می‌شود.
-   `sending`: وقتی درخواست به سمت سرور ارسال می‌شود.
-   `chunk`: دریافت یک تکه از پاسخ استریم شده (`{ messageId, chunk }`).
-   `response:complete`: وقتی پاسخ مدل کامل شد.
-   `error`: بروز خطا در گپ.

---

## <a name="plugin--pluginmanager"></a> 3. کلاس `Plugin` و `PluginManager`

### کلاس `Plugin`
کلاس پایه‌ای که تمام افزونه‌ها باید از آن ارث‌بری کنند.

```javascript
class MyPlugin extends Plugin {
    static get metadata() {
        return {
            name: 'my-plugin',
            version: '1.0.0',
            category: 'utility', // 'storage' | 'network' | 'provider' | 'utility'
            dependencies: [] // نام افزونه‌های پیش‌نیاز
        };
    }

    async install(context) { /* دسترسی به نمونه peik */ }
    async activate() { /* کد راه‌اندازی */ }
}
```

---

## <a name="eventemitter"></a> 4. کلاس `EventEmitter`

سیستم مدیریت رویداد داخلی.

#### `on(eventName, listener)`
گوش دادن به یک رویداد.

#### `off(eventName, listener)`
حذف شنونده.

#### `emit(eventName, data)`
انتشار یک رویداد (به صورت Async).

---

## <a name="interfaces"></a> 5. Interfaces (رابط‌ها)

برای اینکه هسته بتواند با سرویس‌های خارجی کار کند، افزونه‌ها باید این رابط‌ها را پیاده‌سازی کنند.

### `StorageInterface`
برای افزونه‌های ذخیره‌سازی.
-   `saveSettings(settings)`
-   `loadSettings()`
-   `saveChat(chat)`
-   `loadChat(chatId)`
-   `getAllChats()`
-   `deleteChat(chatId)`

### `HttpClientInterface`
برای افزونه‌های شبکه.
-   `request(url, options)`
-   `streamRequest(url, options, onChunk, signal)`

### `ProviderInterface`
برای افزونه‌های مدل هوش مصنوعی (Provider).
-   `sendMessage(config, messages, onChunk, options)`
-   `validateConfig(config)`