import { FILE_LIMITS, IMAGE_SETTINGS } from '../../utils/constants.js';

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
    
        // Reset input value to allow selecting the same file again
        this.fileInput.value = '';
    
        if (!file.type.startsWith('image/')) {
            this.engine.emit('error', 'لطفاً فقط فایل‌های تصویری را انتخاب کنید.');
            return;
        }
    
        if (file.size > FILE_LIMITS.MAX_ORIGINAL_FILE_SIZE_MB * 1024 * 1024) {
            this.engine.emit('error', `حجم فایل نباید بیشتر از ${FILE_LIMITS.MAX_ORIGINAL_FILE_SIZE_MB} مگابایت باشد.`);
            return;
        }
    
        const reader = new FileReader();
        reader.onload = (e) => {
            const dataUrl = e.target.result;
            const COMPRESSION_THRESHOLD_BYTES = FILE_LIMITS.COMPRESSION_THRESHOLD_MB * 1024 * 1024;
    
            if (file.size > COMPRESSION_THRESHOLD_BYTES && file.type !== 'image/gif') {
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
     * Compresses an image by resizing and re-encoding it.
     * @param {string} dataUrl - The Base64 data URL of the image.
     * @param {string} originalMimeType - The original MIME type of the image.
     * @param {function(ImageData | null): void} callback - A function called with the compression result or null on error.
     */
    compressImage(dataUrl, originalMimeType, callback) {
        const outputMimeType = originalMimeType === 'image/png' ? 'image/png' : 'image/jpeg';
        const img = new Image();
        img.src = dataUrl;
    
        img.onload = () => {
            let { width, height } = img;
    
            if (width > IMAGE_SETTINGS.MAX_DIMENSION || height > IMAGE_SETTINGS.MAX_DIMENSION) {
                if (width > height) {
                    height = Math.round((height * IMAGE_SETTINGS.MAX_DIMENSION) / width);
                    width = IMAGE_SETTINGS.MAX_DIMENSION;
                } else {
                    width = Math.round((width * IMAGE_SETTINGS.MAX_DIMENSION) / height);
                    height = IMAGE_SETTINGS.MAX_DIMENSION;
                }
            }
    
            const canvas = document.createElement('canvas');
            canvas.width = width;
            canvas.height = height;
            const ctx = canvas.getContext('2d');
            ctx.drawImage(img, 0, 0, width, height);
            
            let compressedDataUrl;
            if (outputMimeType === 'image/png') {
                compressedDataUrl = canvas.toDataURL(outputMimeType);
            } else {
                compressedDataUrl = canvas.toDataURL('image/jpeg', IMAGE_SETTINGS.COMPRESSION_QUALITY);
            }
    
            callback({ 
                data: compressedDataUrl.split(',')[1], 
                mimeType: outputMimeType
            });
        };
    
        img.onerror = () => {
            this.engine.emit('error', 'خطا در پردازش تصویر برای فشرده‌سازی.');
            callback(null);
        };
    }
}

export default FileManager;