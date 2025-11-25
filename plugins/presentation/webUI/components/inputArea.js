import Component from '../component.js';

export default class InputArea extends Component {
    constructor(peik, uiManager) {
        super(peik, uiManager);
        this.currentImage = null; 
        this.activeChat = null;

        // Bind handlers
        this.handleSubmit = this.handleSubmit.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
        this.handleAttachClick = this.handleAttachClick.bind(this);
        this.handleFileChange = this.handleFileChange.bind(this);
        
        this.handleResponseReceiving = this.handleResponseReceiving.bind(this);
        this.handleResponseComplete = this.handleResponseComplete.bind(this);
        this.handleChatError = this.handleChatError.bind(this);
    }

    async init() {
        this.form = document.getElementById('chat-form');
        this.input = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-button');
        this.attachBtn = document.getElementById('attach-file-button');
        this.fileInput = document.getElementById('file-input');
        this.previewContainer = document.getElementById('image-preview-container');

        this.bindEvents();
    }

    bindEvents() {
        if (this.form) this.form.addEventListener('submit', this.handleSubmit);
        if (this.input) this.input.addEventListener('keydown', this.handleKeyDown);
        if (this.attachBtn) this.attachBtn.addEventListener('click', this.handleAttachClick);
        if (this.fileInput) this.fileInput.addEventListener('change', this.handleFileChange);
    }

    onChatChanged(newChat, oldChat) {
        // قطع اتصال از چت قبلی
        if (oldChat) {
            oldChat.off('response:receiving', this.handleResponseReceiving);
            oldChat.off('response:complete', this.handleResponseComplete);
            oldChat.off('error', this.handleChatError);
        }

        // نگهداری رفرنس به چت جدید
        this.activeChat = newChat;

        // اتصال به چت جدید
        if (newChat) {
            newChat.on('response:receiving', this.handleResponseReceiving);
            newChat.on('response:complete', this.handleResponseComplete);
            newChat.on('error', this.handleChatError);
            
            // بررسی وضعیت فعلی چت (برای زمانی که سوییچ می‌کنیم و چت در حال فعالیت است)
            // نکته: این بخش نیاز به دسترسی به Runtime State دارد که در نسخه جدید در ChatManager است
            // اما چون UI فقط به رویدادها واکنش نشان می‌دهد، فعلاً false می‌گذاریم.
            // اگر بخواهیم دقیق‌تر باشیم، Chat باید متد isSending() داشته باشد.
            this.setLoading(false);
        } else {
            this.setLoading(false);
        }
    }

    handleResponseReceiving() {
        this.setLoading(true);
    }

    handleResponseComplete() {
        this.setLoading(false);
    }

    handleChatError() {
        this.setLoading(false);
    }

    handleSubmit(e) {
        e.preventDefault();
        this.sendMessage();
    }

    handleKeyDown(e) {
        if (e.key === 'Enter' && !e.shiftKey) {
            e.preventDefault();
            this.sendMessage();
        }
    }

    handleAttachClick() {
        if (this.fileInput) this.fileInput.click();
    }

    handleFileChange(e) {
        this.handleFileSelect(e);
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            // استفاده از DialogManager اگر در دسترس باشد، وگرنه alert
            const dialog = this.uiManager.getComponent('dialog');
            if (dialog) dialog.alert('لطفاً فقط فایل تصویر انتخاب کنید.');
            else alert('لطفاً فقط فایل تصویر انتخاب کنید.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target.result; 
            const mimeType = file.type;
            const data = base64String.split(',')[1];

            this.currentImage = { data, mimeType };
            this.showPreview(base64String);
            
            this.fileInput.value = '';
        };
        reader.readAsDataURL(file);
    }

    showPreview(dataUrl) {
        this.previewContainer.innerHTML = '';
        this.previewContainer.classList.remove('hidden');

        const img = document.createElement('img');
        img.src = dataUrl;
        img.className = 'preview-image';
        
        const removeBtn = document.createElement('button');
        removeBtn.className = 'preview-remove-button';
        removeBtn.innerHTML = '×';
        removeBtn.onclick = () => this.clearImage();

        this.previewContainer.appendChild(img);
        this.previewContainer.appendChild(removeBtn);
    }

    clearImage() {
        this.currentImage = null;
        this.previewContainer.innerHTML = '';
        this.previewContainer.classList.add('hidden');
        this.fileInput.value = '';
    }

    async sendMessage() {
        const text = this.input.value.trim();
        
        if (!text && !this.currentImage) return;

        // اصلاح مهم: استفاده از this.activeChat به جای درخواست چت جدید از هسته
        if (!this.activeChat) {
            const dialog = this.uiManager.getComponent('dialog');
            if (dialog) await dialog.alert('لطفاً ابتدا یک گپ ایجاد کنید.');
            else alert('لطفاً ابتدا یک گپ ایجاد کنید.');
            return;
        }

        const msgText = text;
        const msgImage = this.currentImage;

        this.input.value = '';
        this.clearImage();
        
        try {
            // ارسال با استفاده از همان نمونه‌ای که MessageList به آن گوش می‌دهد
            await this.activeChat.sendMessage(msgText, msgImage);
        } catch (err) {
            console.error('Send failed:', err);
            this.input.value = msgText; // بازگرداندن متن در صورت خطا
            
            // نمایش خطا (اختیاری، چون MessageList هم به رویداد error گوش می‌دهد)
            // اما اگر خطا قبل از emit رخ دهد (مثلاً در validation)، اینجا مفید است
        }
    }

    setLoading(isLoading) {
        if (this.sendBtn) {
            this.sendBtn.disabled = isLoading;
            this.sendBtn.innerHTML = isLoading 
                ? '<div class="spinner"></div>' 
                : '<span class="material-symbols-outlined">send</span>';
        }
        if (this.attachBtn) {
            this.attachBtn.disabled = isLoading;
        }
        if (this.input) {
            // اختیاری: غیرفعال کردن ورودی هنگام ارسال
            // this.input.disabled = isLoading;
        }
    }

    destroy() {
        // پاکسازی Listener های چت فعال
        if (this.activeChat) {
            this.activeChat.off('response:receiving', this.handleResponseReceiving);
            this.activeChat.off('response:complete', this.handleResponseComplete);
            this.activeChat.off('error', this.handleChatError);
        }

        // پاکسازی Listener های DOM
        if (this.form) this.form.removeEventListener('submit', this.handleSubmit);
        if (this.input) this.input.removeEventListener('keydown', this.handleKeyDown);
        if (this.attachBtn) this.attachBtn.removeEventListener('click', this.handleAttachClick);
        if (this.fileInput) this.fileInput.removeEventListener('change', this.handleFileChange);

        this.form = null;
        this.input = null;
        this.sendBtn = null;
        this.attachBtn = null;
        this.fileInput = null;
        this.previewContainer = null;
        this.activeChat = null;
    }
}
