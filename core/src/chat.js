import EventEmitter from './eventEmitter.js';
import { Validator } from './utils/validator.js';
import { Serializer } from './utils/serializer.js';
import { PeikError } from './utils/errors.js';

export default class Chat extends EventEmitter {
    constructor(peikContext, data) {
        super();
        this.peik = peikContext;
        
        // داده‌های استاندارد گپ
        this.id = data.id;
        this.title = data.title || 'گپ جدید';
        this.messages = data.messages || [];
        this.modelInfo = data.modelInfo || {};
        this.createdAt = data.createdAt || Date.now();
        this.updatedAt = data.updatedAt || Date.now();
        
        // وضعیت داخلی (isSending و abortController) به peik.chatRuntimeStates منتقل شد
    }

    /**
     * تولید شناسه یکتا برای پیام
     */
    _generateMessageId() {
        return `msg_${Date.now()}_${Math.random().toString(36).substring(2, 9)}`;
    }

    /**
     * دریافت وضعیت Runtime گپ از Map مرکزی
     */
    _getRuntimeState() {
        let state = this.peik.chatRuntimeStates.get(this.id);
        if (!state) {
            console.warn(`⚠️ Runtime state برای چت ${this.id} وجود نداشت. ایجاد می‌شود.`);
            // ایجاد وضعیت پیش‌فرض اگر وجود نداشته باشد (Safety net)
            state = { isSending: false, abortController: null };
            this.peik.chatRuntimeStates.set(this.id, state);
        }
        return state;
    }

    /**
     * ارسال پیام جدید در این گپ
     * @param {string} content متن پیام
     * @param {object} [image] تصویر اختیاری { data, mimeType }
     */
    async sendMessage(content, image = null) {
        const runtimeState = this._getRuntimeState();

        if (runtimeState.isSending) {
            throw new PeikError('یک پیام در حال ارسال است.');
        }

        // 1. اعتبارسنجی
        if (!content && !image) return;
        
        // 2. آماده‌سازی پیام کاربر
        const userMsg = {
            id: this._generateMessageId(),
            role: 'user',
            content: content,
            timestamp: Date.now()
        };
        if (image) userMsg.image = image;

        // انتشار رویداد قبل از افزودن
        await this.emit('message:sending', { role: 'user', content });

        this.messages.push(userMsg);
        
        // انتشار رویداد پس از افزودن
        await this.emit('message:sent', userMsg);

        // 3. پیدا کردن ارائه‌دهنده (Provider) با استفاده از متد جدید Peik
        const providerPlugin = this.peik.getProvider(this.modelInfo);
        const providerConfig = this.peik.resolveProviderConfig(this.modelInfo);

        if (!providerPlugin || !providerConfig) {
            throw new PeikError(`مدل ${this.modelInfo.displayName} یافت نشد یا نامعتبر است.`);
        }

        // 4. آماده‌سازی پیام مدل (خالی)
        const modelMsg = {
            id: this._generateMessageId(),
            role: 'model',
            content: '',
            timestamp: Date.now()
        };

        // انتشار رویداد قبل از افزودن
        await this.emit('message:sending', { role: 'model' });

        this.messages.push(modelMsg);
        
        // انتشار رویداد پس از افزودن
        await this.emit('message:sent', modelMsg);

        // 5. ارسال به Provider
        runtimeState.isSending = true;
        runtimeState.abortController = new AbortController();

        try {
            // تغییر نام رویداد از sending به response:receiving
            await this.emit('response:receiving', { chatId: this.id });
            
            let fullResponse = '';
            
            // فقط پیام‌های قبل از پاسخ فعلی ارسال می‌شوند
            const history = this.messages.slice(0, -1);

            await providerPlugin.sendMessage(
                providerConfig,
                history,
                (chunk) => {
                    fullResponse += chunk;
                    this.emit('chunk', { messageId: modelMsg.id, chunk });
                },
                { signal: runtimeState.abortController.signal }
            );

            // به‌روزرسانی محتوای نهایی
            modelMsg.content = fullResponse;
            this.updatedAt = Date.now();
            
            await this.emit('response:complete', modelMsg);
            await this.save();

        } catch (error) {
            if (error.name === 'AbortError') {
                console.log('ارسال پیام لغو شد.');
                // حذف پیام ناقص مدل
                this.messages.pop();
                await this.emit('message:removed', modelMsg.id);
            } else {
                console.error('خطا در ارسال پیام:', error);
                this.emit('error', error);
                this.messages.pop(); // حذف پیام خطا دار
                await this.emit('message:removed', modelMsg.id);
            }
        } finally {
            runtimeState.isSending = false;
            runtimeState.abortController = null;
        }
    }

    /**
     * لغو درخواست جاری
     */
    cancel() {
        const runtimeState = this._getRuntimeState();
        if (runtimeState.isSending && runtimeState.abortController) {
            runtimeState.abortController.abort();
        }
    }

    /**
     * ذخیره وضعیت فعلی گپ
     */
    async save() {
        const storage = this.peik.getStorage();
        if (storage) {
            // تبدیل به فرمت Plain Object برای ذخیره
            const serialized = this.toJSON();
            await storage.saveChat(serialized);
        }
    }

    /**
     * تغییر عنوان گپ
     * @param {string} newTitle 
     */
    async updateTitle(newTitle) {
        this.title = newTitle;
        this.updatedAt = Date.now();
        await this.save();
        this.emit('update', this);
    }

    /**
     * تغییر مدل گپ
     * @param {object} newModelInfo 
     */
    async changeModel(newModelInfo) {
        this.modelInfo = newModelInfo;
        this.updatedAt = Date.now();
        await this.save();
        this.emit('update', this);
    }

    toJSON() {
        return Serializer.clone({
            id: this.id,
            title: this.title,
            messages: this.messages,
            modelInfo: this.modelInfo,
            createdAt: this.createdAt,
            updatedAt: this.updatedAt
        });
    }
}