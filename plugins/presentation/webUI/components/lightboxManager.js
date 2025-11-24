import Component from '../component.js';

export default class LightboxManager extends Component {
    constructor(peik, uiManager) {
        super(peik, uiManager);
        this.hideBound = this.hide.bind(this);
        this.handleKeyDownBound = this.handleKeyDown.bind(this);
    }

    async init() {
        this.dom = {
            lightbox: document.getElementById('image-lightbox'),
            image: document.getElementById('lightbox-image'),
            closeBtn: document.getElementById('lightbox-close-button')
        };
        this.bindEvents();
    }

    bindEvents() {
        if (!this.dom.lightbox) return;

        this.dom.lightbox.addEventListener('click', (e) => {
            if (e.target === this.dom.lightbox) {
                this.hide();
            }
        });

        if (this.dom.closeBtn) {
            this.dom.closeBtn.addEventListener('click', this.hideBound);
        }

        document.addEventListener('keydown', this.handleKeyDownBound);
    }

    handleKeyDown(e) {
        if (e.key === 'Escape' && this.dom.lightbox && !this.dom.lightbox.classList.contains('hidden')) {
            this.hide();
        }
    }

    show(src) {
        if (!this.dom.lightbox || !this.dom.image) return;
        this.dom.image.src = src;
        this.dom.lightbox.classList.remove('hidden');
    }

    hide() {
        if (!this.dom.lightbox) return;
        this.dom.lightbox.classList.add('hidden');
        if (this.dom.image) {
            this.dom.image.src = ''; 
        }
    }

    destroy() {
        document.removeEventListener('keydown', this.handleKeyDownBound);
        if (this.dom.closeBtn) {
            this.dom.closeBtn.removeEventListener('click', this.hideBound);
        }
        this.dom = {};
    }
}