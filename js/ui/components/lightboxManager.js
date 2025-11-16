/**
 * Manages the logic for displaying and hiding a full-screen image lightbox.
 */
class LightboxManager {
    constructor() {
        this.dom = {
            lightbox: document.getElementById('image-lightbox'),
            lightboxImage: document.getElementById('lightbox-image'),
        };
        this.bindEvents();
    }

    bindEvents() {
        if (!this.dom.lightbox) return;

        this.dom.lightbox.addEventListener('click', () => this.hide());
        this.dom.lightboxImage.addEventListener('click', (e) => e.stopPropagation());
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && !this.dom.lightbox.classList.contains('hidden')) {
                this.hide();
            }
        });
    }

    /**
     * Shows the lightbox modal with the specified image source.
     * @param {string} src The source URL of the image to display.
     */
    show(src) {
        if (!this.dom.lightbox) return;
        this.dom.lightboxImage.src = src;
        this.dom.lightbox.classList.remove('hidden');
    }

    /**
     * Hides the lightbox modal.
     */
    hide() {
        if (!this.dom.lightbox) return;
        this.dom.lightbox.classList.add('hidden');
        this.dom.lightboxImage.src = ''; // Clear src to stop loading
    }
}

export default LightboxManager;
