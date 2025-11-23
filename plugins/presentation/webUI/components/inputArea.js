export default class InputArea {
    constructor(peik, uiManager) {
        this.peik = peik;
        this.uiManager = uiManager;
        
        this.form = document.getElementById('chat-form');
        this.input = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-button');
        
        // المان‌های مربوط به تصویر
        this.attachBtn = document.getElementById('attach-file-button');
        this.fileInput = document.getElementById('file-input');
        this.previewContainer = document.getElementById('image-preview-container');
        
        this.currentImage = null; // { data: base64, mimeType: string }

        this.bindEvents();
    }

    bindEvents() {
        this.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        this.input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });

        // رویدادهای تصویر
        this.attachBtn?.addEventListener('click', () => {
            this.fileInput.click();
        });

        this.fileInput?.addEventListener('change', (e) => {
            this.handleFileSelect(e);
        });
    }

    handleFileSelect(e) {
        const file = e.target.files[0];
        if (!file) return;

        if (!file.type.startsWith('image/')) {
            alert('لطفاً فقط فایل تصویر انتخاب کنید.');
            return;
        }

        const reader = new FileReader();
        reader.onload = (event) => {
            const base64String = event.target.result; // Data URL
            // استخراج داده خالص Base64 و نوع MIME
            const mimeType = file.type;
            const data = base64String.split(',')[1];

            this.currentImage = { data, mimeType };
            this.showPreview(base64String);
            
            // پاک کردن اینپوت برای امکان انتخاب مجدد همان فایل
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
        
        // اگر نه متنی هست و نه تصویری، ارسال نکن
        if (!text && !this.currentImage) return;

        const chat = this.peik.activeChat;
        if (!chat) {
            alert('لطفاً ابتدا یک گپ ایجاد کنید.');
            return;
        }

        // ذخیره موقت برای ارسال
        const msgText = text;
        const msgImage = this.currentImage;

        // پاک‌سازی UI
        this.input.value = '';
        this.clearImage();
        
        try {
            await chat.sendMessage(msgText, msgImage);
        } catch (err) {
            console.error(err);
            // بازگرداندن متن در صورت خطا (اختیاری)
            this.input.value = msgText;
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
    }
}