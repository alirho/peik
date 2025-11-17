/**
 * منطق نمایش و پنهان کردن یک لایت‌باکس تصویر تمام‌صفحه را مدیریت می‌کند.
 */
class LightboxManager {
    constructor() {
        this.dom = {
            lightbox: document.getElementById('image-lightbox'),
            lightboxImage: document.getElementById('lightbox-image'),
        };

        // --- ثبت event handlerهای bind شده برای حذف آسان ---
        this.hideBound = this.hide.bind(this);
        this.stopPropagationBound = (e) => e.stopPropagation();
        this.handleKeyDownBound = (e) => {
            if (e.key === 'Escape' && this.dom.lightbox && !this.dom.lightbox.classList.contains('hidden')) {
                this.hide();
            }
        };

        this.bindEvents();
    }

    bindEvents() {
        if (!this.dom.lightbox) return;

        this.dom.lightbox.addEventListener('click', this.hideBound);
        this.dom.lightboxImage.addEventListener('click', this.stopPropagationBound);
        document.addEventListener('keydown', this.handleKeyDownBound);
    }

    /**
     * تمام شنوندگان رویداد را برای جلوگیری از نشت حافظه حذف می‌کند.
     */
    destroy() {
        if (!this.dom.lightbox) return;

        this.dom.lightbox.removeEventListener('click', this.hideBound);
        this.dom.lightboxImage.removeEventListener('click', this.stopPropagationBound);
        document.removeEventListener('keydown', this.handleKeyDownBound);
    }

    /**
     * مودال لایت‌باکس را با منبع تصویر مشخص شده نمایش می‌دهد.
     * @param {string} src - آدرس URL تصویری که باید نمایش داده شود.
     */
    show(src) {
        if (!this.dom.lightbox) return;
        this.dom.lightboxImage.src = src;
        this.dom.lightbox.classList.remove('hidden');
    }

    /**
     * مودال لایت‌باکس را پنهان می‌کند.
     */
    hide() {
        if (!this.dom.lightbox) return;
        this.dom.lightbox.classList.add('hidden');
        this.dom.lightboxImage.src = ''; // منبع را پاک کن تا بارگذاری متوقف شود
    }
}

export default LightboxManager;
