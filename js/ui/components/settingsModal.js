// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').Settings} Settings */
/** @typedef {import('../../types.js').CustomProviderConfig} CustomProviderConfig */
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
        
        this.confirmHandler = null;

        // --- ثبت event handlerهای bind شده برای حذف آسان ---
        this.handleSaveBound = this.handleSave.bind(this);
        this.hideBound = () => this.show(false);
        this.showBound = () => this.show(true);
        this.handleAddCustomProviderBound = this.handleAddCustomProvider.bind(this);
        this.handleCustomListClickBound = this.handleCustomListClick.bind(this);
        this.handleCustomListInputBound = this.handleCustomListInput.bind(this);
        this.hideConfirmationModalBound = this.hideConfirmationModal.bind(this);
        this.handleConfirmBound = this._handleConfirm.bind(this);
        
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
        
        // فیلدهای استاتیک
        this.geminiModelInput = document.getElementById('gemini-model-input');
        this.geminiKeyInput = document.getElementById('gemini-key-input');
        this.geminiKeyToggle = document.getElementById('gemini-key-toggle');
        this.chatgptModelInput = document.getElementById('chatgpt-model-input');
        this.chatgptKeyInput = document.getElementById('chatgpt-key-input');
        this.chatgptKeyToggle = document.getElementById('chatgpt-key-toggle');

        // بخش سفارشی
        this.addCustomProviderButton = document.getElementById('add-custom-provider-button');
        this.customProviderList = document.getElementById('custom-provider-list');
        this.customProviderTemplate = document.getElementById('custom-provider-template');

        // چک‌باکس امنیتی
        this.sessionOnlyCheckbox = document.getElementById('session-only-checkbox');
        
        // المان‌های مودال تأیید
        this.confirmationModal = document.getElementById('confirmation-modal');
        this.confirmationModalTitle = document.getElementById('confirmation-modal-title');
        this.confirmationModalBody = document.getElementById('confirmation-modal-body');
        this.confirmationModalCancel = document.getElementById('confirmation-modal-cancel');
        this.confirmationModalConfirm = document.getElementById('confirmation-modal-confirm');
    }

    /**
     * شنوندگان رویداد را به المان‌های تعاملی مودال متصل می‌کند.
     */
    bindEvents() {
        this.form.addEventListener('submit', this.handleSaveBound);
        this.cancelButton.addEventListener('click', this.hideBound);
        this.editButton.addEventListener('click', this.showBound);
        
        // Toggle visibility for static providers
        this.geminiKeyToggle.addEventListener('click', () => this.togglePasswordVisibility(this.geminiKeyInput, this.geminiKeyToggle));
        this.chatgptKeyToggle.addEventListener('click', () => this.togglePasswordVisibility(this.chatgptKeyInput, this.chatgptKeyToggle));
        
        // Dynamic custom provider events
        this.addCustomProviderButton.addEventListener('click', this.handleAddCustomProviderBound);
        this.customProviderList.addEventListener('click', this.handleCustomListClickBound);
        this.customProviderList.addEventListener('input', this.handleCustomListInputBound);

        // Confirmation modal events
        this.confirmationModalCancel.addEventListener('click', this.hideConfirmationModalBound);
        this.confirmationModalConfirm.addEventListener('click', this.handleConfirmBound);
    }

    /**
     * تمام شنوندگان رویداد متصل شده توسط این کامپوننت را حذف می‌کند.
     */
    destroy() {
        this.form.removeEventListener('submit', this.handleSaveBound);
        this.cancelButton.removeEventListener('click', this.hideBound);
        this.editButton.removeEventListener('click', this.showBound);
        
        this.addCustomProviderButton.removeEventListener('click', this.handleAddCustomProviderBound);
        this.customProviderList.removeEventListener('click', this.handleCustomListClickBound);
        this.customProviderList.removeEventListener('input', this.handleCustomListInputBound);
        
        this.confirmationModalCancel.removeEventListener('click', this.hideConfirmationModalBound);
        this.confirmationModalConfirm.removeEventListener('click', this.handleConfirmBound);
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
     * فیلدهای فرم را با تنظیمات فعلی از موتور پر می‌کند.
     */
    populateForm() {
        this.form.reset();
        this.sessionOnlyCheckbox.checked = false; // پیش‌فرض به ذخیره‌سازی پایدار
        
        const settings = this.engine.settings || { providers: {} };
        const providers = settings.providers || {};
        
        this.geminiModelInput.value = providers.gemini?.modelName || '';
        this.geminiKeyInput.value = providers.gemini?.apiKey || '';

        this.chatgptModelInput.value = providers.openai?.modelName || '';
        this.chatgptKeyInput.value = providers.openai?.apiKey || '';

        // رندر کردن لیست ارائه‌دهندگان سفارشی
        this.customProviderList.innerHTML = '';
        providers.custom?.forEach(p => this.renderCustomProvider(p));

        // انتخاب رادیوباتن فعال
        const activeRadio = this.form.querySelector(`input[name="active_provider"][value="${settings.activeProviderId}"]`);
        if (activeRadio) {
            activeRadio.checked = true;
        }
    }

    /**
     * یک المان جدید برای ارائه‌دهنده سفارشی در DOM ایجاد و رندر می‌کند.
     * @param {Partial<CustomProviderConfig>} providerData - داده‌های ارائه‌دهنده برای پر کردن فرم.
     * @param {boolean} [open = false] - آیا آکاردئون باید باز باشد یا خیر.
     */
    renderCustomProvider(providerData = {}, open = false) {
        const id = providerData.id || `custom_${Date.now()}`;
        const name = providerData.name || 'پیکربندی جدید';
        
        const template = this.customProviderTemplate.content.cloneNode(true);
        const detailsElement = template.querySelector('.custom-provider-item');
        detailsElement.dataset.id = id;
        detailsElement.open = open;

        const radio = template.querySelector('input[type="radio"]');
        radio.value = id;
        radio.id = `radio-${id}`;

        const label = template.querySelector('label');
        label.htmlFor = `radio-${id}`;
        
        const title = template.querySelector('.custom-provider-title');
        title.textContent = name;

        // پر کردن مقادیر ورودی‌ها
        template.querySelector('.custom-provider-name-input').value = providerData.name || '';
        template.querySelector('.custom-provider-model-input').value = providerData.modelName || '';
        template.querySelector('.custom-provider-key-input').value = providerData.apiKey || '';
        template.querySelector('.custom-provider-endpoint-input').value = providerData.endpointUrl || '';

        this.customProviderList.appendChild(template);
    }
    
    /**
     * یک ارائه‌دهنده سفارشی جدید اضافه می‌کند.
     */
    handleAddCustomProvider() {
        this.renderCustomProvider({}, true); // با آکاردئون باز
    }

    /**
     * رویدادهای کلیک روی لیست ارائه‌دهندگان سفارشی را با استفاده از تفویض رویداد مدیریت می‌کند.
     * @param {MouseEvent} e - رویداد کلیک.
     */
    handleCustomListClick(e) {
        // مدیریت حذف
        const deleteButton = e.target.closest('.delete-custom-provider-button');
        if (deleteButton) {
            e.preventDefault(); // جلوگیری از باز/بسته شدن آکاردئون
            const itemElement = deleteButton.closest('.custom-provider-item');
            this.handleDeleteCustomProvider(itemElement);
            return;
        }

        // مدیریت تغییر وضعیت نمایش کلید
        const toggleButton = e.target.closest('.custom-provider-key-toggle');
        if (toggleButton) {
            const itemElement = toggleButton.closest('.custom-provider-item');
            const keyInput = itemElement.querySelector('.custom-provider-key-input');
            this.togglePasswordVisibility(keyInput, toggleButton);
            return;
        }
    }

    /**
     * رویدادهای ورودی (input) را برای به‌روزرسانی UI مدیریت می‌کند.
     * @param {InputEvent} e - رویداد ورودی.
     */
    handleCustomListInput(e) {
        const nameInput = e.target.closest('.custom-provider-name-input');
        if (nameInput) {
            const itemElement = nameInput.closest('.custom-provider-item');
            const title = itemElement.querySelector('.custom-provider-title');
            title.textContent = nameInput.value || 'پیکربندی جدید';
        }
    }
    
    /**
     * فرآیند حذف یک ارائه‌دهنده سفارشی را مدیریت می‌کند.
     * @param {HTMLElement} itemElement - المان DOM آیتم سفارشی.
     */
    handleDeleteCustomProvider(itemElement) {
        const name = itemElement.querySelector('.custom-provider-title').textContent;
        this.showConfirmationModal({
            title: 'حذف پیکربندی',
            bodyHtml: `<p>آیا از حذف پیکربندی «<strong>${name}</strong>» مطمئن هستید؟</p>`,
            confirmText: 'حذف',
            confirmClass: 'btn-danger',
            onConfirm: () => {
                itemElement.remove();
            }
        });
    }

    /**
     * ارسال فرم برای ذخیره تنظیمات را مدیریت می‌کند.
     * @param {Event} e - رویداد submit.
     */
    async handleSave(e) {
        e.preventDefault();
        
        const settings = this.getSettingsFromForm();
        if (!settings) {
            return; // اعتبارسنجی ناموفق بود
        }
        
        if (this.sessionOnlyCheckbox.checked) {
            this.engine.settings = settings;
            this.show(false);
            alert('تنظیمات فقط برای این نشست اعمال شد و پس از بستن تب پاک خواهد شد.');
        } else {
            await this.engine.saveSettings(settings);
        }
    }
    
    /**
     * مقادیر ورودی را از فرم خوانده و یک آبجکت تنظیمات می‌سازد.
     * @returns {Settings|null} - آبجکت تنظیمات یا null در صورت شکست اعتبارسنجی.
     */
    getSettingsFromForm() {
        // ۱. ساختار پایه تنظیمات را ایجاد کن و تمام داده‌ها را جمع‌آوری کن
        const newSettings = {
            activeProviderId: null,
            providers: {
                gemini: {
                    modelName: this.geminiModelInput.value.trim(),
                    apiKey: this.geminiKeyInput.value.trim(),
                },
                openai: {
                    modelName: this.chatgptModelInput.value.trim(),
                    apiKey: this.chatgptKeyInput.value.trim(),
                },
                custom: Array.from(this.customProviderList.querySelectorAll('.custom-provider-item')).map(el => ({
                    id: el.dataset.id,
                    name: el.querySelector('.custom-provider-name-input').value.trim(),
                    modelName: el.querySelector('.custom-provider-model-input').value.trim(),
                    apiKey: el.querySelector('.custom-provider-key-input').value.trim(),
                    endpointUrl: el.querySelector('.custom-provider-endpoint-input').value.trim(),
                })),
            }
        };

        // ۲. اعتبارسنجی نام‌های منحصر به فرد برای ارائه‌دهندگان سفارشی
        const customNames = newSettings.providers.custom.map(p => p.name);
        if (customNames.some(n => !n)) {
            alert('هر پیکربندی سفارشی باید یک نام داشته باشد.');
            return null;
        }
        if (new Set(customNames).size !== customNames.length) {
            alert('نام پیکربندی‌های سفارشی باید منحصر به فرد باشد.');
            return null;
        }

        // ۳. تعیین و اعتبارسنجی ارائه‌دهنده فعال
        const activeRadio = this.form.querySelector('input[name="active_provider"]:checked');
        if (!activeRadio) {
            // اگر کاربر چیزی انتخاب نکرده، اما یک ارائه‌دهنده پیش‌فرض معتبر وجود دارد، اجازه بده ذخیره شود.
            if (this.engine.isSettingsValid(this.engine.settings)) {
                newSettings.activeProviderId = this.engine.settings.activeProviderId;
                return newSettings;
            }
            alert('لطفاً یک ارائه‌دهنده فعال را انتخاب کنید.');
            return null;
        }
        
        newSettings.activeProviderId = activeRadio.value;
        const id = newSettings.activeProviderId;

        if (id === 'gemini') {
            const config = newSettings.providers.gemini;
            if (!config.modelName || !config.apiKey) {
                alert('برای فعال کردن Gemini، لطفاً نام مدل و کلید API را وارد کنید.');
                return null;
            }
        } else if (id === 'openai') {
            const config = newSettings.providers.openai;
            if (!config.modelName || !config.apiKey) {
                alert('برای فعال کردن ChatGPT، لطفاً نام مدل و کلید API را وارد کنید.');
                return null;
            }
        } else {
            const customConfig = newSettings.providers.custom.find(p => p.id === id);
            if (!customConfig || !customConfig.modelName || !customConfig.endpointUrl) {
                alert(`برای فعال کردن پیکربندی "${customConfig?.name || 'سفارشی'}"، لطفاً نام مدل و آدرس نقطه پایانی را پر کنید.`);
                return null;
            }
            try {
                new URL(customConfig.endpointUrl);
            } catch (_) {
                alert(`لطفاً یک آدرس نقطه پایانی معتبر برای "${customConfig.name}" وارد کنید.`);
                return null;
            }
        }
        
        return newSettings;
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

    // --- توابع کمکی برای مودال تأیید ---

    _handleConfirm() {
        // فقط در صورتی این رویداد را مدیریت کن که خود مودال تنظیمات قابل مشاهده باشد.
        // این کار از تداخل با مودال تأییدی که توسط سایدبار باز می‌شود، جلوگیری می‌کند.
        if (this.modal && this.modal.classList.contains('hidden')) {
            return;
        }

        if (this.confirmHandler) {
            this.confirmHandler();
        }
        this.hideConfirmationModal();
    }

    showConfirmationModal({ title, bodyHtml, confirmText = 'تایید', confirmClass = 'btn-primary', onConfirm }) {
        this.confirmationModalTitle.textContent = title;
        this.confirmationModalBody.innerHTML = bodyHtml;
        this.confirmationModalConfirm.textContent = confirmText;
        
        this.confirmationModalConfirm.className = 'btn';
        this.confirmationModalConfirm.classList.add(confirmClass);
        
        this.confirmHandler = onConfirm;
        
        this.confirmationModal.classList.remove('hidden');
    }
    
    hideConfirmationModal() {
        this.confirmationModal.classList.add('hidden');
        this.confirmHandler = null;
        this.confirmationModalBody.innerHTML = '';
    }
}

export default SettingsModal;