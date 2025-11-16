// JSDoc Type Imports
/** @typedef {import('../../types.js').ImageData} ImageData */
/** @typedef {import('../../core/chatEngine.js').default} ChatEngine */

/**
 * Handles file selection, validation, reading, and compression logic.
 */
class FileManager {
    /**
     * @param {ChatEngine} engine - The chat engine instance to emit errors.
     * @param {function(ImageData): void} onFileProcessed - Callback function executed with the processed image data.
     */
    constructor(engine, onFileProcessed) {
        this.engine = engine;
        this.onFileProcessed = onFileProcessed;
        this.fileInput = document.getElementById('file-input');
        this.bindEvents();
    }
    
    bindEvents() {
        this.fileInput.addEventListener('change', (e) => this.handleFileSelect(e));
    }
    
    /**
     * Programmatically triggers the file input dialog.
     */
    trigger() {
        this.fileInput.click();
    }

    /**
     * Handles the file selection event from the input element.
     * @param {Event} event - The file input change event.
     */
    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;
    
        const limits = this.engine.limits;
        
        // Reset input value to allow selecting the same file again
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
            // Compress if it's not a GIF and compression is not disabled via unlimited preset
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
     * Compresses an image by resizing and re-encoding it, with validation.
     * @param {string} dataUrl - The Base64 data URL of the image.
     * @param {string} originalMimeType - The original MIME type of the image.
     * @param {function(ImageData | null): void} callback - A function called with the compression result or null on error.
     */
    compressImage(dataUrl, originalMimeType, callback) {
        const limits = this.engine.limits;
        const outputMimeType = originalMimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        const img = new Image();
        const canvas = document.createElement('canvas');

        const cleanup = () => {
            img.onload = null;
            img.onerror = null;
            img.src = ''; // Detach source to free memory
            canvas.width = 1;
            canvas.height = 1; // Clear canvas context
        };

        img.onload = () => {
            // Validate original dimensions and aspect ratio
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
    
            // Resize if needed
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
            
            // Validate compressed size (approximate)
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
}

export default FileManager;