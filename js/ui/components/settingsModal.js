// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').Settings} Settings */
/** @typedef {import('../../core/chatEngine.js').default} ChatEngine */

/**
 * رابط کاربری و منطق مودال تنظیمات را مدیریت می‌کند.
 */
class SettingsModal {
    /**
     * @param {ChatEngine} engine - نمونه اصلی موتور چت.
     */
    constructor(engine) {
        this.engine = engine;
        this.cacheDOMElements();

        // --- ثبت event handlerهای bind شده برای حذف آسان ---
        this.handleSaveBound = this.handleSave.bind(this);
        this.hideBound = () => this.show(false);
        this.showBound = () => this.show(true);
        this.toggleGeminiBound = () => this.togglePasswordVisibility(this.geminiKeyInput, this.geminiKeyToggle);
        this.toggleChatgptBound = () => this.togglePasswordVisibility(this.chatgptKeyInput, this.chatgptKeyToggle);
        this.toggleCustomBound = () => this.togglePasswordVisibility(this.customKeyInput, this.customKeyToggle);
        
        this.bindEvents();
    }

    /**
     * ارجاع به المان‌های DOM پرکاربرد در مودال را کش می‌کند.
     */
    cacheDOMElements() {
        this.modal = document.getElementById('settings-modal');
        this.form = document.getElementById('settings-form');
        this.cancelButton = document.getElementById('cancel-settings-button');
        this.editButton = document.getElementById('edit-settings-button');
        
        // فیلدهای ورودی
        this.geminiModelInput = document.getElementById('gemini-model-input');
        this.geminiKeyInput = document.getElementById('gemini-key-input');
        this.chatgptModelInput = document.getElementById('chatgpt-model-input');
        this.chatgptKeyInput = document.getElementById('chatgpt-key-input');
        this.customModelInput = document.getElementById('custom-model-input');
        this.customKeyInput = document.getElementById('custom-key-input');
        this.customEndpointInput = document.getElementById('custom-endpoint-input');
        
        // دکمه‌های نمایش/پنهان کلید
        this.geminiKeyToggle = document.getElementById('gemini-key-toggle');
        this.chatgptKeyToggle = document.getElementById('chatgpt-key-toggle');
        this.customKeyToggle = document.getElementById('custom-key-toggle');

        // چک‌باکس امنیتی
        this.sessionOnlyCheckbox = document.getElementById('session-only-checkbox');
    }

    /**
     * شنوندگان رویداد را به المان‌های تعاملی مودال متصل می‌کند.
     */
    bindEvents() {
        this.form.addEventListener('submit', this.handleSaveBound);
        this.cancelButton.addEventListener('click', this.hideBound);
        this.editButton.addEventListener('click', this.showBound);
        
        this.geminiKeyToggle.addEventListener('click', this.toggleGeminiBound);
        this.chatgptKeyToggle.addEventListener('click', this.toggleChatgptBound);
        this.customKeyToggle.addEventListener('click', this.toggleCustomBound);
    }

    /**
     * تمام شنوندگان رویداد متصل شده توسط این کامپوننت را حذف می‌کند.
     */
    destroy() {
        this.form.removeEventListener('submit', this.handleSaveBound);
        this.cancelButton.removeEventListener('click', this.hideBound);
        this.editButton.removeEventListener('click', this.showBound);
        
        this.geminiKeyToggle.removeEventListener('click', this.toggleGeminiBound);
        this.chatgptKeyToggle.removeEventListener('click', this.toggleChatgptBound);
        this.customKeyToggle.removeEventListener('click', this.toggleCustomBound);
    }

    /**
     * مودال تنظیمات را نمایش یا مخفی می‌کند.
     * @param {boolean} shouldShow - برای نمایش true و برای مخفی کردن false.
     */
    show(shouldShow) {
        this.modal.classList.toggle('hidden', !shouldShow);
        if (shouldShow) {
            this.populateForm();
        }
    }

    /**
     * ارسال فرم برای ذخیره تنظیمات را مدیریت می‌کند.
     * @param {Event} e - رویداد submit.
     */
    async handleSave(e) {
        e.preventDefault();
        
        const settings = this.getSettingsFromForm();
        if (!settings) {
            return; // اعتبارسنجی در getSettingsFromForm ناموفق بود
        }
        
        if (this.sessionOnlyCheckbox.checked) {
            // تنظیمات را فقط برای نشست فعلی بدون ذخیره دائمی اعمال کن
            this.engine.settings = settings;
            this.show(false);
            alert('تنظیمات فقط برای این نشست اعمال شد و پس از بستن تب پاک خواهد شد.');
        } else {
            // تنظیمات را به طور معمول ذخیره کن
            await this.engine.saveSettings(settings);
        }
    }
    
    /**
     * مقادیر ورودی را از فرم خوانده و یک آبجکت تنظیمات می‌سازد.
     * @returns {Settings|null} - آبجکت تنظیمات یا null در صورت شکست اعتبارسنجی.
     */
    getSettingsFromForm() {
        const geminiModel = this.geminiModelInput.value.trim();
        const geminiKey = this.geminiKeyInput.value.trim();
        const chatgptModel = this.chatgptModelInput.value.trim();
        const chatgptKey = this.chatgptKeyInput.value.trim();
        const customModel = this.customModelInput.value.trim();
        const customKey = this.customKeyInput.value.trim();
        const customEndpoint = this.customEndpointInput.value.trim();

        if (geminiModel && geminiKey) {
            return { provider: 'gemini', modelName: geminiModel, apiKey: geminiKey };
        }
        if (chatgptModel && chatgptKey) {
            return { provider: 'openai', modelName: chatgptModel, apiKey: chatgptKey };
        }
        if (customModel && customEndpoint) {
            if (!customEndpoint.startsWith('http')) {
                alert('لطفاً یک آدرس API معتبر برای حالت سفارشی وارد کنید.');
                return null;
            }
            return { provider: 'custom', modelName: customModel, apiKey: customKey, endpointUrl: customEndpoint };
        }
        
        alert('لطفاً حداقل اطلاعات یکی از ارائه‌دهندگان را به طور کامل وارد کنید.');
        return null;
    }

    /**
     * فیلدهای فرم را با تنظیمات فعلی از موتور پر می‌کند.
     */
    populateForm() {
        this.form.reset();
        this.sessionOnlyCheckbox.checked = false; // پیش‌فرض به ذخیره‌سازی پایدار
        
        const settings = this.engine.settings;
        if (settings) {
            switch(settings.provider) {
                case 'gemini':
                    this.geminiModelInput.value = settings.modelName || '';
                    this.geminiKeyInput.value = settings.apiKey || '';
                    break;
                case 'openai':
                    this.chatgptModelInput.value = settings.modelName || '';
                    this.chatgptKeyInput.value = settings.apiKey || '';
                    break;
                case 'custom':
                    this.customModelInput.value = settings.modelName || '';
                    this.customKeyInput.value = settings.apiKey || '';
                    this.customEndpointInput.value = settings.endpointUrl || '';
                    break;
            }
        } else {
            this.geminiModelInput.value = 'gemini-2.5-flash';
        }
    }

    /**
     * قابلیت مشاهده یک فیلد ورودی رمز عبور را تغییر می‌دهد.
     * @param {HTMLInputElement} inputElement - فیلد ورودی رمز عبور.
     * @param {HTMLButtonElement} buttonElement - دکمه تغییر وضعیت.
     */
    togglePasswordVisibility(inputElement, buttonElement) {
        const icon = buttonElement.querySelector('.material-symbols-outlined');
        if (inputElement.type === 'password') {
            inputElement.type = 'text';
            icon.textContent = 'visibility_off';
        } else {
            inputElement.type = 'password';
            icon.textContent = 'visibility';
        }
    }
}

export default SettingsModal;
