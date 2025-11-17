// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').ImageData} ImageData */
/** @typedef {import('../../core/chatEngine.js').default} ChatEngine */

/**
 * منطق انتخاب فایل، اعتبارسنجی، خواندن و فشرده‌سازی را مدیریت می‌کند.
 */
class FileManager {
    /**
     * @param {ChatEngine} engine - نمونه موتور چت برای انتشار خطاها.
     * @param {function(ImageData): void} onFileProcessed - تابع callback که با داده‌های تصویر پردازش‌شده اجرا می‌شود.
     */
    constructor(engine, onFileProcessed) {
        this.engine = engine;
        this.onFileProcessed = onFileProcessed;
        this.fileInput = document.getElementById('file-input');
        
        this.handleFileSelectBound = (e) => this.handleFileSelect(e);
        this.bindEvents();
    }
    
    bindEvents() {
        if (this.fileInput) {
            this.fileInput.addEventListener('change', this.handleFileSelectBound);
        }
    }
    
    /**
     * به صورت برنامه‌ریزی شده، پنجره انتخاب فایل را باز می‌کند.
     */
    trigger() {
        if (this.fileInput) {
            this.fileInput.click();
        }
    }

    /**
     * رویداد انتخاب فایل از المان ورودی را مدیریت می‌کند.
     * @param {Event} event - رویداد change ورودی فایل.
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        const limits = this.engine.limits;
        
        // مقدار ورودی را ریست کن تا انتخاب مجدد همان فایل ممکن باشد
        this.fileInput.value = '';
    
        const extension = (file.name.split('.').pop() || '').toLowerCase();
        const isMimeAllowed = limits.file.allowedMimeTypes.includes('*/*') || limits.file.allowedMimeTypes.includes(file.type);
        const isExtAllowed = limits.file.allowedExtensions.includes('*') || limits.file.allowedExtensions.includes(extension);

        if (!isMimeAllowed || !isExtAllowed) {
            this.engine.emit('error', `فرمت فایل '${extension}' مجاز نیست.`);
            return;
        }
    
        if (limits.file.maxOriginalFileSizeBytes !== Infinity && file.size > limits.file.maxOriginalFileSizeBytes) {
            this.engine.emit('error', `حجم فایل نباید بیشتر از ${(limits.file.maxOriginalFileSizeBytes / 1024 / 1024).toFixed(1)} مگابایت باشد.`);
            return;
        }
    
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            // اگر فایل GIF نباشد و فشرده‌سازی غیرفعال نشده باشد، فشرده‌سازی کن
            const shouldCompress = file.type !== 'image/gif' && limits.file.maxCompressedSizeBytes !== Infinity;

            if (shouldCompress) {
                this.compressImage(dataUrl, file.type, (compressedResult) => {
                    if (compressedResult) {
                        this.onFileProcessed(compressedResult);
                    }
                });
            } else {
                this.onFileProcessed({
                    data: dataUrl.split(',')[1],
                    mimeType: file.type,
                });
            }
        };
        reader.onerror = () => {
            this.engine.emit('error', 'خطایی در خواندن فایل رخ داد.');
        };
        reader.readAsDataURL(file);
    }

    /**
     * یک تصویر را با تغییر اندازه و رمزگذاری مجدد، فشرده می‌کند و اعتبارسنجی می‌کند.
     * @param {string} dataUrl - داده URL Base64 تصویر.
     * @param {string} originalMimeType - نوع MIME اصلی تصویر.
     * @param {function(ImageData | null): void} callback - تابعی که با نتیجه فشرده‌سازی یا null در صورت خطا فراخوانی می‌شود.
     */
    compressImage(dataUrl, originalMimeType, callback) {
        const limits = this.engine.limits;
        const outputMimeType = originalMimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        const img = new Image();
        const canvas = document.createElement('canvas');

        const cleanup = () => {
            img.onload = null;
            img.onerror = null;
            img.src = ''; // منبع را جدا کن تا حافظه آزاد شود
            canvas.width = 1;
            canvas.height = 1; // زمینه canvas را پاک کن
        };

        img.onload = () => {
            // اعتبارسنجی ابعاد و نسبت ابعاد اصلی
            if (limits.image.maxOriginalDimension !== Infinity && (img.width > limits.image.maxOriginalDimension || img.height > limits.image.maxOriginalDimension)) {
                this.engine.emit('error', `ابعاد تصویر (${img.width}x${img.height}) نباید از ${limits.image.maxOriginalDimension} پیکسل بیشتر باشد.`);
                cleanup();
                return callback(null);
            }
            const aspectRatio = Math.max(img.width, img.height) / Math.min(img.width, img.height);
            if (limits.image.maxAspectRatio !== Infinity && aspectRatio > limits.image.maxAspectRatio) {
                 this.engine.emit('error', `نسبت ابعاد تصویر (${aspectRatio.toFixed(1)}) بیش از حد مجاز (${limits.image.maxAspectRatio}) است.`);
                 cleanup();
                 return callback(null);
            }

            let { width, height } = img;
    
            // در صورت نیاز تغییر اندازه بده
            if (limits.image.maxFinalDimension !== Infinity && (width > limits.image.maxFinalDimension || height > limits.image.maxFinalDimension)) {
                if (width > height) {
                    height = Math.round((height * limits.image.maxFinalDimension) / width);
                    width = limits.image.maxFinalDimension;
                } else {
                    width = Math.round((width * limits.image.maxFinalDimension) / height);
                    height = limits.image.maxFinalDimension;
                }
            }
    
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            const compressedDataUrl = canvas.toDataURL(outputMimeType, limits.image.compressionQuality);
            const base64Data = compressedDataUrl.split(',')[1];
            
            // اعتبارسنجی حجم فشرده‌شده (تقریبی)
            const compressedSizeBytes = base64Data.length * (3 / 4);
            if (limits.file.maxCompressedSizeBytes !== Infinity && compressedSizeBytes > limits.file.maxCompressedSizeBytes) {
                this.engine.emit('error', `حجم فایل فشرده شده (${(compressedSizeBytes / 1024 / 1024).toFixed(1)}MB) بیشتر از حد مجاز است.`);
                cleanup();
                return callback(null);
            }

            callback({ 
                data: base64Data, 
                mimeType: outputMimeType
            });
            cleanup();
        };
    
        img.onerror = () => {
            this.engine.emit('error', 'خطا در پردازش تصویر برای فشرده‌سازی.');
            cleanup();
            callback(null);
        };

        img.src = dataUrl;
    }

    /**
     * شنوندگان رویداد را حذف می‌کند.
     */
    destroy() {
        if (this.fileInput) {
            this.fileInput.removeEventListener('change', this.handleFileSelectBound);
        }
    }
}

export default FileManager;
