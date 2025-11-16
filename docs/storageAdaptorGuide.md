# راهنمای آداپتور ذخیره‌سازی (Storage Adapter Guide)

یکی از ویژگی‌های کلیدی معماری `ChatEngine`، قابلیت جداسازی کامل آن از لایه ذخیره‌سازی است. این کار از طریق **الگوی آداپتور (Adapter Pattern)** و **تزریق وابستگی (Dependency Injection)** انجام می‌شود. `ChatEngine` به جای اینکه مستقیماً با یک مکانیزم خاص مانند `IndexedDB` کار کند، انتظار دارد یک "آداپتور ذخیره‌سازی" دریافت کند که یک API مشخص را پیاده‌سازی کرده باشد.

این به شما اجازه می‌دهد تا `ChatEngine` را در هر محیطی (مرورگر، Node.js، موبایل) با هر نوع مکانیزم ذخیره‌سازی (پایگاه داده مرورگر، فایل سیستم، API بک‌اند) استفاده کنید.

## 1. رابط API مورد نیاز (Required API Interface)

هر آداپتور ذخیره‌سازی باید یک آبجکت یا ماژول باشد که **۵ متد `async`** زیر را `export` می‌کند. تمام این متدها باید `Promise` برگردانند.

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

### `async function loadAllChats()`
- **وظیفه**: بارگذاری تمام گفتگوهای ذخیره شده.
- **پارامترها**: ندارد.
- **مقدار بازگشتی**: `Promise<Array<object>>` - آرایه‌ای از تمام آبجکت‌های چت. اگر هیچ چتی وجود نداشته باشد، باید یک آرایه خالی برگرداند.

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

export async function loadAllChats() {
    return Array.from(chats.values());
}

export async function saveChat(chat) {
    // Clone to prevent mutation issues, mimicking database behavior
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

const DB_NAME = 'GougDB';
const DB_VERSION = 1;

function initDB() {
    // ... منطق کامل برای باز کردن و ارتقاء پایگاه داده
    return dbPromise;
}

export async function saveChat(chat) {
    const db = await initDB();
    const transaction = db.transaction('chats', 'readwrite');
    const store = transaction.objectStore('chats');
    store.put(chat);
    // ... مدیریت oncomplete و onerror تراکنش
}

export async function loadAllChats() {
    const db = await initDB();
    const transaction = db.transaction('chats', 'readonly');
    const store = transaction.objectStore('chats');
    const request = store.getAll();
    // ... مدیریت onsuccess و onerror درخواست
}

// ... پیاده‌سازی سایر متدها (deleteChatById, saveSettings, loadSettings)
```

### مثال ۳: ذخیره‌سازی در فایل سیستم (برای Node.js)

این یک مثال مفهومی است که نشان می‌دهد چگونه می‌توان یک آداپتور برای محیط Node.js ساخت که داده‌ها را در فایل‌های JSON ذخیره می‌کند.

```javascript
// services/fileSystemStorage.js (مفهومی)

import { promises as fs } from 'fs';
import path from 'path';

const DATA_DIR = path.join(process.cwd(), 'data');
const SETTINGS_FILE = path.join(DATA_DIR, 'settings.json');
const CHATS_DIR = path.join(DATA_DIR, 'chats');

// اطمینان از وجود دایرکتوری‌ها
async function ensureDirs() {
    await fs.mkdir(DATA_DIR, { recursive: true });
    await fs.mkdir(CHATS_DIR, { recursive: true });
}

export async function loadSettings() {
    await ensureDirs();
    try {
        const data = await fs.readFile(SETTINGS_FILE, 'utf-8');
        return JSON.parse(data);
    } catch (error) {
        if (error.code === 'ENOENT') return null; // File not found
        throw error;
    }
}

export async function saveSettings(settings) {
    await ensureDirs();
    await fs.writeFile(SETTINGS_FILE, JSON.stringify(settings, null, 2));
}

export async function loadAllChats() {
    await ensureDirs();
    const files = await fs.readdir(CHATS_DIR);
    const chatPromises = files.map(async (file) => {
        if (file.endsWith('.json')) {
            const data = await fs.readFile(path.join(CHATS_DIR, file), 'utf-8');
            return JSON.parse(data);
        }
        return null;
    });
    return (await Promise.all(chatPromises)).filter(Boolean);
}

export async function saveChat(chat) {
    await ensureDirs();
    const filePath = path.join(CHATS_DIR, `${chat.id}.json`);
    await fs.writeFile(filePath, JSON.stringify(chat, null, 2));
}

export async function deleteChatById(chatId) {
    await ensureDirs();
    const filePath = path.join(CHATS_DIR, `${chatId}.json`);
    try {
        await fs.unlink(filePath);
    } catch (error) {
        if (error.code !== 'ENOENT') throw error; // Ignore if file doesn't exist
    }
}
```

## 3. نکات مهم

-   **همیشه از `async` استفاده کنید**: حتی اگر پیاده‌سازی شما همزمان (synchronous) باشد (مانند `MemoryStorage`)، متدها باید `async` تعریف شوند یا `Promise` برگردانند تا با رابط API سازگار باشند.
-   **ایمنی در برابر جهش (Mutation Safety)**: `ChatEngine` ممکن است آبجکت‌هایی را که از آداپتور شما دریافت می‌کند، تغییر دهد. یک پیاده‌سازی قوی باید قبل از برگرداندن داده‌ها، یک کپی از آن‌ها ایجاد کند (مثلاً با `JSON.parse(JSON.stringify(data))`) تا از تغییر ناخواسته داده‌های اصلی در منبع ذخیره‌سازی جلوگیری شود.
-   **مدیریت خطا**: پیاده‌سازی شما باید خطاهای مربوط به ذخیره‌سازی را به درستی مدیریت کرده و `Promise` را `reject` کند. `ChatEngine` این خطاها را گرفته و به UI اطلاع می‌دهد.