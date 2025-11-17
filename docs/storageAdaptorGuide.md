# راهنمای آداپتور ذخیره‌سازی (Storage Adapter Guide)

یکی از ویژگی‌های کلیدی معماری `ChatEngine`، قابلیت جداسازی کامل آن از لایه ذخیره‌سازی است. این کار از طریق **الگوی آداپتور (Adapter Pattern)** و **تزریق وابستگی (Dependency Injection)** انجام می‌شود. `ChatEngine` به جای اینکه مستقیماً با یک مکانیزم خاص مانند `IndexedDB` کار کند، انتظار دارد یک "آداپتور ذخیره‌سازی" دریافت کند که یک API مشخص را پیاده‌سازی کرده باشد.

این به شما اجازه می‌دهد تا `ChatEngine` را در هر محیطی (مرورگر، Node.js، موبایل) با هر نوع مکانیزم ذخیره‌سازی (پایگاه داده مرورگر، فایل سیستم، API بک‌اند) استفاده کنید.

## 1. رابط API مورد نیاز (Required API Interface)

هر آداپتور ذخیره‌سازی باید یک آبجکت یا ماژول باشد که **۶ متد `async`** زیر را `export` می‌کند. تمام این متدها باید `Promise` برگردانند.

---

### `async function loadSettings()`
- **وظیفه**: بارگذاری تنظیمات کاربر.
- **پارامترها**: ندارد.
- **مقدار بازگشتی**: `Promise<object | null>` - یک آبجکت حاوی تنظیمات کاربر یا `null` در صورتی که هیچ تنظیماتی ذخیره نشده باشد.

---

### `async function saveSettings(settings)`
- **وظیفه**: ذخیره کردن آبجکت تنظیمات کاربر.
- **پارامترها**: `settings: object` - آبجکت تنظیماتی که باید ذخیره شود.
- **مقدار بازگشتی**: `Promise<void>`

---

### `async function loadChatList()`
- **وظیفه**: بارگذاری **فقط لیست گفتگوها** (بدون پیام‌هایشان) برای نمایش سریع اولیه.
- **پارامترها**: ندارد.
- **مقدار بازگشتی**: `Promise<Array<object>>` - آرایه‌ای از آبجکت‌های چت که هر کدام **نباید** شامل فیلد `messages` باشند. اگر هیچ چتی وجود نداشته باشد، باید یک آرایه خالی برگرداند.

---

### `async function loadChatById(chatId)`
- **وظیفه**: بارگذاری **یک گفتگوی کامل** (شامل تمام پیام‌ها) بر اساس شناسه آن.
- **پارامترها**: `chatId: string` - شناسه چت مورد نظر.
- **مقدار بازگشتی**: `Promise<object | null>` - آبجکت کامل چت یا `null` اگر یافت نشد.

---

### `async function saveChat(chat)`
- **وظیفه**: ذخیره یا به‌روزرسانی یک گفتگوی خاص. اگر چتی با `id` مشابه وجود داشته باشد، باید بازنویسی شود (Upsert).
- **پارامترها**: `chat: object` - آبجکت چتی که باید ذخیره شود.
- **مقدار بازگشتی**: `Promise<void>`

---

### `async function deleteChatById(chatId)`
- **وظیفه**: حذف یک گفتگوی خاص بر اساس شناسه (`id`) آن.
- **پارامترها**: `chatId: string` - شناسه چتی که باید حذف شود.
- **مقدار بازگشتی**: `Promise<void>`

---

## 2. مثال‌های پیاده‌سازی

### مثال ۱: ذخیره‌سازی در حافظه موقت (MemoryStorage)

این ساده‌ترین پیاده‌سازی است که داده‌ها را در متغیرهای جاوااسکریپت نگه می‌دارد. با بستن تب، تمام داده‌ها از بین می‌روند. این آداپتور به عنوان پیاده‌سازی پیش‌فرض در `ChatEngine` استفاده می‌شود اگر هیچ آداپتور دیگری ارائه نشود.

```javascript
// js/services/memoryStorage.js

let settings = null;
const chats = new Map();

export async function loadSettings() {
    return settings;
}
export async function saveSettings(newSettings) {
    settings = newSettings;
}
export async function loadChatList() {
    const list = [];
    for (const chat of chats.values()) {
        const { messages, ...chatWithoutMessages } = chat;
        list.push(chatWithoutMessages);
    }
    return list;
}
export async function loadChatById(chatId) {
    return chats.get(chatId) || null;
}
export async function saveChat(chat) {
    chats.set(chat.id, JSON.parse(JSON.stringify(chat)));
}
export async function deleteChatById(chatId) {
    chats.delete(chatId);
}
```

### مثال ۲: ذخیره‌سازی در IndexedDB (برای مرورگر)

این پیاده‌سازی در برنامه وب اصلی استفاده شده است و داده‌ها را به صورت پایدار در مرورگر کاربر ذخیره می‌کند.

```javascript
// js/services/indexedDBStorage.js (خلاصه شده)

function initDB() { /* ... */ }

export async function loadChatList() {
    const db = await initDB();
    const store = db.transaction('chats').objectStore('chats');
    const allChats = await store.getAll();
    // حذف فیلد پیام‌ها قبل از بازگرداندن
    allChats.forEach(chat => delete chat.messages);
    return allChats;
}

export async function loadChatById(chatId) {
    const db = await initDB();
    const store = db.transaction('chats').objectStore('chats');
    return await store.get(chatId);
}

// ... پیاده‌سازی سایر متدها
```

## 3. نکات مهم

-   **همیشه از `async` استفاده کنید**: حتی اگر پیاده‌سازی شما همزمان (synchronous) باشد (مانند `MemoryStorage`)، متدها باید `async` تعریف شوند یا `Promise` برگردانند تا با رابط API سازگار باشند.
-   **ایمنی در برابر جهش (Mutation Safety)**: `ChatEngine` ممکن است آبجکت‌هایی را که از آداپتور شما دریافت می‌کند، تغییر دهد. یک پیاده‌سازی قوی باید قبل از برگرداندن داده‌ها، یک کپی از آن‌ها ایجاد کند (مثلاً با `JSON.parse(JSON.stringify(data))`) تا از تغییر ناخواسته داده‌های اصلی در منبع ذخیره‌سازی جلوگیری شود.
-   **مدیریت خطا**: پیاده‌سازی شما باید خطاهای مربوط به ذخیره‌سازی را به درستی مدیریت کرده و `Promise` را `reject` کند. `ChatEngine` این خطاها را گرفته و به UI اطلاع می‌دهد.
