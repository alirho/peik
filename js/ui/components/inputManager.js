// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').ImageData} ImageData */
/** @typedef {import('./fileManager.js').default} FileManager */

/**
 * ناحیه ورودی کاربر، شامل متن، پیوست‌ها، پیش‌نمایش‌ها و وضعیت دکمه ارسال را مدیریت می‌کند.
 */
class InputManager {
    /**
     * @param {FileManager} fileManager - نمونه مدیریت فایل.
     * @param {function(string, ImageData | null): void} onSendMessage - Callback برای ارسال پیام.
     */
    constructor(fileManager, onSendMessage) {
        this.fileManager = fileManager;
        this.onSendMessage = onSendMessage;
        
        /** @type {ImageData | null} */
        this.attachedImage = null;
        this.isSubmitting = false;

        this.cacheDOMElements();

        // --- ثبت event handlerهای bind شده برای حذف آسان ---
        this.handleSubmitBound = (e) => {
            e.preventDefault();
            this.submit();
        };
        this.handleKeyDownBound = (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submit();
            }
        };
        this.handleAttachClickBound = () => this.fileManager.trigger();
        this.handleInputBound = () => this.autoResizeTextarea();

        this.bindEvents();
    }

    cacheDOMElements() {
        this.dom = {
            chatForm: document.getElementById('chat-form'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            attachFileButton: document.getElementById('attach-file-button'),
            imagePreviewContainer: document.getElementById('image-preview-container'),
        };
    }

    bindEvents() {
        this.dom.chatForm.addEventListener('submit', this.handleSubmitBound);
        this.dom.messageInput.addEventListener('keydown', this.handleKeyDownBound);
        this.dom.attachFileButton.addEventListener('click', this.handleAttachClickBound);
        this.dom.messageInput.addEventListener('input', this.handleInputBound);
    }

    /**
     * تمام شنوندگان رویداد را حذف می‌کند.
     */
    destroy() {
        this.dom.chatForm.removeEventListener('submit', this.handleSubmitBound);
        this.dom.messageInput.removeEventListener('keydown', this.handleKeyDownBound);
        this.dom.attachFileButton.removeEventListener('click', this.handleAttachClickBound);
        this.dom.messageInput.removeEventListener('input', this.handleInputBound);
    }

    /**
     * ارسال فرم ورودی را مدیریت می‌کند.
     */
    submit() {
        if (this.isSubmitting) {
            return;
        }

        const userInput = this.dom.messageInput.value.trim();
        const image = this.attachedImage;
        
        if (!userInput && !image) {
            return; // از ارسال پیام‌های خالی جلوگیری کن
        }

        this.isSubmitting = true;
        this.updateSendButtonState(true); // وضعیت بارگذاری را فوراً به صورت بصری نشان بده

        // یک تایم‌اوت ایمنی برای جلوگیری از گیر کردن UI در حالت ارسال
        setTimeout(() => {
            if (this.isSubmitting) {
                console.warn('تایم‌اوت ایمنی ارسال فعال شد. ریست کردن وضعیت UI.');
                this.updateSendButtonState(false);
            }
        }, 30000); // 30 ثانیه

        this.onSendMessage(userInput, image);
    }

    /**
     * ناحیه ورودی را به حالت اولیه خود بازمی‌گرداند.
     */
    reset() {
        this.dom.messageInput.value = '';
        this.autoResizeTextarea();
        this.clearPreview();
        this.focus();
    }
    
    focus() {
        this.dom.messageInput.focus();
    }
    
    autoResizeTextarea() {
        const el = this.dom.messageInput;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }

    /**
     * تصویر پردازش‌شده را تنظیم کرده و پیش‌نمایش آن را رندر می‌کند.
     * @param {ImageData} imageData - داده‌های تصویر پردازش‌شده.
     */
    setAndPreviewImage(imageData) {
        this.attachedImage = imageData;
        this.renderPreview();
    }

    /**
     * پیش‌نمایش تصویر پیوست‌شده فعلی را رندر می‌کند.
     */
    renderPreview() {
        this.dom.imagePreviewContainer.innerHTML = '';
        
        if (!this.attachedImage) {
            this.dom.imagePreviewContainer.classList.add('hidden');
            return;
        }

        const img = document.createElement('img');
        img.src = `data:${this.attachedImage.mimeType};base64,${this.attachedImage.data}`;
        img.alt = 'Preview';
        img.className = 'preview-image';

        const removeButton = document.createElement('button');
        removeButton.className = 'preview-remove-button';
        removeButton.title = 'حذف تصویر';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => this.clearPreview());

        this.dom.imagePreviewContainer.appendChild(img);
        this.dom.imagePreviewContainer.appendChild(removeButton);
        this.dom.imagePreviewContainer.classList.remove('hidden');
    }

    /**
     * تصویر پیوست‌شده و پیش‌نمایش آن را پاک می‌کند.
     */
    clearPreview() {
        this.attachedImage = null;
        this.renderPreview();
    }

    /**
     * وضعیت دکمه ارسال را به‌روز می‌کند (مثلاً یک اسپینر نمایش می‌دهد).
     * @param {boolean} isLoading - آیا برنامه در حالت بارگذاری است.
     */
    updateSendButtonState(isLoading) {
        const button = this.dom.sendButton;
        const attachButton = this.dom.attachFileButton;
        this.isSubmitting = isLoading; // همگام‌سازی وضعیت ارسال با وضعیت بارگذاری

        if (isLoading) {
            button.disabled = true;
            attachButton.disabled = true;
            button.innerHTML = '<div class="spinner"></div>';
        } else {
            button.disabled = false;
            attachButton.disabled = false;
            button.innerHTML = '<span class="material-symbols-outlined">send</span>';
        }
    }
}

export default InputManager;
