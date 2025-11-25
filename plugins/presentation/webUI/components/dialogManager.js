import Component from '../component.js';

export default class DialogManager extends Component {
    constructor(peik, uiManager) {
        super(peik, uiManager);
        
        this.resolvePromise = null;
        
        // Bind handlers
        this.handleConfirm = this.handleConfirm.bind(this);
        this.handleCancel = this.handleCancel.bind(this);
        this.handleKeyDown = this.handleKeyDown.bind(this);
    }

    async init() {
        this.dom = {
            overlay: document.getElementById('generic-dialog'),
            title: document.getElementById('generic-dialog-title'),
            message: document.getElementById('generic-dialog-message'),
            inputContainer: document.getElementById('generic-dialog-input-container'),
            input: document.getElementById('generic-dialog-input'),
            cancelBtn: document.getElementById('generic-dialog-cancel'),
            confirmBtn: document.getElementById('generic-dialog-confirm')
        };

        this.bindEvents();
    }

    bindEvents() {
        if (!this.dom.overlay) return;

        this.dom.confirmBtn.addEventListener('click', this.handleConfirm);
        this.dom.cancelBtn.addEventListener('click', this.handleCancel);
        
        // هندل کردن Enter در اینپوت
        this.dom.input.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.handleConfirm();
            }
        });

        // هندل کردن ESC و Enter سراسری وقتی دیالوگ باز است
        document.addEventListener('keydown', this.handleKeyDown);
    }

    handleKeyDown(e) {
        if (this.dom.overlay.classList.contains('hidden')) return;

        if (e.key === 'Escape') {
            this.handleCancel();
        }
        // Enter فقط برای Alert و Confirm (اگر فوکوس روی دکمه کنسل نباشد)
        // برای Prompt در ایونت لیسنر خود اینپوت هندل شده است
        else if (e.key === 'Enter' && this.dom.inputContainer.classList.contains('hidden')) {
            // جلوگیری از تداخل اگر فوکوس روی دکمه‌هاست
            if (document.activeElement !== this.dom.cancelBtn) {
                e.preventDefault();
                this.handleConfirm();
            }
        }
    }

    reset() {
        this.dom.title.textContent = '';
        this.dom.message.textContent = '';
        this.dom.input.value = '';
        this.dom.inputContainer.classList.add('hidden');
        this.dom.cancelBtn.classList.remove('hidden');
        this.dom.confirmBtn.textContent = 'تایید';
        this.dom.confirmBtn.className = 'btn btn-primary';
        this.resolvePromise = null;
    }

    show() {
        this.dom.overlay.classList.remove('hidden');
    }

    hide() {
        this.dom.overlay.classList.add('hidden');
    }

    /**
     * نمایش پیام هشدار (جایگزین window.alert)
     * @param {string} message 
     * @returns {Promise<void>}
     */
    alert(message) {
        return new Promise((resolve) => {
            this.reset();
            this.dom.title.textContent = 'پیام';
            this.dom.message.textContent = message;
            this.dom.cancelBtn.classList.add('hidden'); // Alert دکمه لغو ندارد
            
            this.resolvePromise = () => resolve();
            this.show();
            this.dom.confirmBtn.focus();
        });
    }

    /**
     * نمایش پیام تایید (جایگزین window.confirm)
     * @param {string} message 
     * @returns {Promise<boolean>}
     */
    confirm(message) {
        return new Promise((resolve) => {
            this.reset();
            this.dom.title.textContent = 'تایید';
            this.dom.message.textContent = message;
            
            this.resolvePromise = (result) => resolve(result === true);
            this.show();
            this.dom.confirmBtn.focus();
        });
    }

    /**
     * دریافت ورودی از کاربر (جایگزین window.prompt)
     * @param {string} message 
     * @param {string} defaultValue 
     * @returns {Promise<string|null>}
     */
    prompt(message, defaultValue = '') {
        return new Promise((resolve) => {
            this.reset();
            this.dom.title.textContent = 'ورودی';
            this.dom.message.textContent = message;
            this.dom.inputContainer.classList.remove('hidden');
            this.dom.input.value = defaultValue;
            
            this.resolvePromise = (result) => {
                if (result === true) {
                    resolve(this.dom.input.value);
                } else {
                    resolve(null);
                }
            };
            
            this.show();
            // فوکوس و انتخاب متن
            setTimeout(() => {
                this.dom.input.focus();
                this.dom.input.select();
            }, 50);
        });
    }

    handleConfirm() {
        if (this.resolvePromise) {
            this.resolvePromise(true);
        }
        this.hide();
    }

    handleCancel() {
        if (this.resolvePromise) {
            this.resolvePromise(false);
        }
        this.hide();
    }

    destroy() {
        document.removeEventListener('keydown', this.handleKeyDown);
        this.dom.confirmBtn?.removeEventListener('click', this.handleConfirm);
        this.dom.cancelBtn?.removeEventListener('click', this.handleCancel);
        this.dom = {};
    }
}