import Component from '../component.js';

export default class SettingsModal extends Component {
    constructor(peik, uiManager) {
        super(peik, uiManager);
        this.confirmHandler = null;

        // تعریف هندلرها به صورت Arrow Function برای جلوگیری از خطای bind
        this.hide = () => {
            this.show(false);
        };

        this.show = (shouldShow) => {
            if (!this.modal) return;
            if (shouldShow === true) this.populateForm(); 
            else if (shouldShow && typeof shouldShow === 'object') this.populateForm();
            
            const isVisible = typeof shouldShow === 'boolean' ? shouldShow : true;
            this.modal.classList.toggle('hidden', !isVisible);
        };

        this.handleSave = async (e) => {
            e.preventDefault();
            const dialog = this.uiManager.getComponent('dialog');
            
            const settings = await this.getSettingsFromForm(); // اکنون async است چون alert ممکن است داشته باشد
            if (!settings) return;
            
            if (this.sessionOnlyCheckbox && this.sessionOnlyCheckbox.checked) {
                this.peik.settings = settings;
                this.show(false);
                await dialog.alert('تنظیمات موقت ذخیره شد.');
            } else {
                await this.peik.updateSettings(settings);
            }
        };

        this.handleAddCustomProvider = (e) => {
            if(e) e.preventDefault();
            this.renderCustomProvider({}, true);
        };

        this.handleCustomListClick = (e) => {
            const deleteButton = e.target.closest('.delete-custom-provider-button');
            if (deleteButton) {
                e.preventDefault();
                this.handleDeleteCustomProvider(deleteButton.closest('.custom-provider-item'));
                return;
            }
            const toggleButton = e.target.closest('.custom-provider-key-toggle');
            if (toggleButton) {
                const keyInput = toggleButton.closest('.custom-provider-item').querySelector('.custom-provider-key-input');
                this.togglePasswordVisibility(keyInput, toggleButton);
            }
        };

        this.handleCustomListInput = (e) => {
            const nameInput = e.target.closest('.custom-provider-name-input');
            if (nameInput) {
                const title = nameInput.closest('.custom-provider-item').querySelector('.custom-provider-title');
                if (title) title.textContent = nameInput.value || 'پیکربندی جدید';
            }
        };

        this.handleStaticInputValidation = (e) => {
            this.validateField(e.target, (val) => val.trim().length > 0);
        };

        this.handleCustomInputValidation = (e) => {
            const input = e.target;
            if (input.classList.contains('custom-provider-name-input')) {
                this.validateCustomProviderName(input);
            } else if (input.classList.contains('custom-provider-endpoint-input')) {
                this.validateField(input, (val) => { try { new URL(val); return true; } catch { return false; } });
            } else if (input.classList.contains('custom-provider-model-input')) {
                this.validateField(input, (val) => val.trim().length > 0);
            }
        };

        this.handleSettingsUpdated = () => {
            const dialog = this.uiManager.getComponent('dialog');
            // این متد alert برمی‌گرداند اما نیازی به await نداریم چون آخرین مرحله است
            dialog.alert('تنظیمات ذخیره شد.');
            this.show(false);
        };
        
        this.handleGeminiToggle = () => this.togglePasswordVisibility(this.geminiKeyInput, this.geminiKeyToggle);
        this.handleChatgptToggle = () => this.togglePasswordVisibility(this.chatgptKeyInput, this.chatgptKeyToggle);
    }

    async init() {
        this.cacheDOMElements();
        this.bindEvents();
        
        this.peik.on('settings:updated', this.handleSettingsUpdated);
    }

    cacheDOMElements() {
        this.modal = document.getElementById('settings-modal');
        this.form = document.getElementById('settings-form');
        this.cancelButton = document.getElementById('cancel-settings-button');
        this.editButton = document.getElementById('edit-settings-button');
        
        this.geminiModelInput = document.getElementById('gemini-model-input');
        this.geminiKeyInput = document.getElementById('gemini-key-input');
        this.geminiKeyToggle = document.getElementById('gemini-key-toggle');
        this.chatgptModelInput = document.getElementById('chatgpt-model-input');
        this.chatgptKeyInput = document.getElementById('chatgpt-key-input');
        this.chatgptKeyToggle = document.getElementById('chatgpt-key-toggle');

        this.addCustomProviderButton = document.getElementById('add-custom-provider-button');
        this.customProviderList = document.getElementById('custom-provider-list');
        this.customProviderTemplate = document.getElementById('custom-provider-template');

        this.sessionOnlyCheckbox = document.getElementById('session-only-checkbox');
        
        // مودال داخلی تأیید دیگر استفاده نمی‌شود
    }

    bindEvents() {
        if (this.form) this.form.addEventListener('submit', this.handleSave);
        if (this.cancelButton) this.cancelButton.addEventListener('click', this.hide);
        if (this.editButton) this.editButton.addEventListener('click', this.show);
        
        if (this.geminiKeyToggle) this.geminiKeyToggle.addEventListener('click', this.handleGeminiToggle);
        if (this.chatgptKeyToggle) this.chatgptKeyToggle.addEventListener('click', this.handleChatgptToggle);
        
        if (this.geminiKeyInput) this.geminiKeyInput.addEventListener('input', this.handleStaticInputValidation);
        if (this.geminiModelInput) this.geminiModelInput.addEventListener('input', this.handleStaticInputValidation);
        if (this.chatgptKeyInput) this.chatgptKeyInput.addEventListener('input', this.handleStaticInputValidation);
        if (this.chatgptModelInput) this.chatgptModelInput.addEventListener('input', this.handleStaticInputValidation);

        if (this.addCustomProviderButton) this.addCustomProviderButton.addEventListener('click', this.handleAddCustomProvider);
        if (this.customProviderList) {
            this.customProviderList.addEventListener('click', this.handleCustomListClick);
            this.customProviderList.addEventListener('input', this.handleCustomListInput);
            this.customProviderList.addEventListener('input', this.handleCustomInputValidation);
        }
    }

    validateField(inputElement, validatorFn) {
        const isValid = validatorFn(inputElement.value);
        inputElement.classList.toggle('invalid', !isValid);
        return isValid;
    }

    validateCustomProviderName(inputElement) {
        const value = inputElement.value.trim();
        if (!value) {
            inputElement.classList.add('invalid');
            return false;
        }
        const allNameInputs = Array.from(this.customProviderList.querySelectorAll('.custom-provider-name-input'));
        const otherNames = allNameInputs.filter(el => el !== inputElement).map(el => el.value.trim());
        if (otherNames.includes(value)) {
            inputElement.classList.add('invalid');
            return false;
        }
        inputElement.classList.remove('invalid');
        return true;
    }

    async handleDeleteCustomProvider(itemElement) {
        if (!itemElement) return;
        const name = itemElement.querySelector('.custom-provider-title')?.textContent || 'این پیکربندی';
        
        // استفاده از DialogManager به جای مودال داخلی
        const dialog = this.uiManager.getComponent('dialog');
        const confirmed = await dialog.confirm(`آیا از حذف پیکربندی «${name}» مطمئن هستید؟`);
        
        if (confirmed) {
            itemElement.remove();
        }
    }

    renderCustomProvider(providerData = {}, open = false) {
        if (!this.customProviderTemplate || !this.customProviderList) return;
        const id = providerData.id || `custom_${Date.now()}`;
        const name = providerData.name || 'پیکربندی جدید';
        try {
            const template = this.customProviderTemplate.content.cloneNode(true);
            const detailsElement = template.querySelector('.custom-provider-item');
            detailsElement.dataset.id = id;
            if (open) detailsElement.open = true;
            
            const radio = template.querySelector('input[type="radio"]');
            radio.value = id;
            radio.id = `radio-${id}`;
            template.querySelector('label').htmlFor = `radio-${id}`;
            template.querySelector('.custom-provider-title').textContent = name;
            
            template.querySelector('.custom-provider-name-input').value = providerData.name || '';
            template.querySelector('.custom-provider-model-input').value = providerData.modelName || '';
            template.querySelector('.custom-provider-key-input').value = providerData.apiKey || '';
            template.querySelector('.custom-provider-endpoint-input').value = providerData.endpointUrl || '';
            
            this.customProviderList.appendChild(template);
        } catch (e) { console.error(e); }
    }

    populateForm() {
        if (!this.form) return;
        this.form.reset();
        this.form.querySelectorAll('.invalid').forEach(el => el.classList.remove('invalid'));
        if (this.sessionOnlyCheckbox) this.sessionOnlyCheckbox.checked = false;

        const settings = this.peik.settings || { providers: {} };
        const providers = settings.providers || {};
        
        if (this.geminiModelInput) this.geminiModelInput.value = providers.gemini?.modelName || '';
        if (this.geminiKeyInput) this.geminiKeyInput.value = providers.gemini?.apiKey || '';
        if (this.chatgptModelInput) this.chatgptModelInput.value = providers.openai?.modelName || '';
        if (this.chatgptKeyInput) this.chatgptKeyInput.value = providers.openai?.apiKey || '';

        if (this.customProviderList) {
            this.customProviderList.innerHTML = '';
            providers.custom?.forEach(p => this.renderCustomProvider(p));
        }

        const activeRadio = this.form.querySelector(`input[name="active_provider"][value="${settings.activeProviderId}"]`);
        if (activeRadio) activeRadio.checked = true;
    }

    async getSettingsFromForm() {
        if (!this.form) return null;
        const dialog = this.uiManager.getComponent('dialog');

        const newSettings = {
            activeProviderId: null,
            providers: {
                gemini: { modelName: this.geminiModelInput.value.trim(), apiKey: this.geminiKeyInput.value.trim() },
                openai: { modelName: this.chatgptModelInput.value.trim(), apiKey: this.chatgptKeyInput.value.trim() },
                custom: Array.from(this.customProviderList.querySelectorAll('.custom-provider-item')).map(el => ({
                    id: el.dataset.id,
                    name: el.querySelector('.custom-provider-name-input').value.trim(),
                    modelName: el.querySelector('.custom-provider-model-input').value.trim(),
                    apiKey: el.querySelector('.custom-provider-key-input').value.trim(),
                    endpointUrl: el.querySelector('.custom-provider-endpoint-input').value.trim(),
                })),
            }
        };
        
        const activeRadio = this.form.querySelector('input[name="active_provider"]:checked');
        if (!activeRadio) {
            if (this.peik.config?.defaultProvider) return newSettings;
            await dialog.alert('لطفاً یک ارائه‌دهنده انتخاب کنید.');
            return null;
        }
        newSettings.activeProviderId = activeRadio.value;
        
        const id = newSettings.activeProviderId;
        if ((id === 'gemini' && !newSettings.providers.gemini.apiKey) || 
            (id === 'openai' && !newSettings.providers.openai.apiKey)) {
            await dialog.alert('اطلاعات ارائه‌دهنده انتخاب شده ناقص است.');
            return null;
        }
        return newSettings;
    }

    togglePasswordVisibility(input, btn) {
        if (!input) return;
        const icon = btn.querySelector('.material-symbols-outlined');
        if (input.type === 'password') {
            input.type = 'text';
            if (icon) icon.textContent = 'visibility_off';
        } else {
            input.type = 'password';
            if (icon) icon.textContent = 'visibility';
        }
    }

    destroy() {
        if (this.form) this.form.removeEventListener('submit', this.handleSave);
        if (this.cancelButton) this.cancelButton.removeEventListener('click', this.hide);
        if (this.editButton) this.editButton.removeEventListener('click', this.show);
        
        if (this.geminiKeyToggle) this.geminiKeyToggle.removeEventListener('click', this.handleGeminiToggle);
        if (this.chatgptKeyToggle) this.chatgptKeyToggle.removeEventListener('click', this.handleChatgptToggle);
        
        if (this.geminiKeyInput) this.geminiKeyInput.removeEventListener('input', this.handleStaticInputValidation);
        if (this.geminiModelInput) this.geminiModelInput.removeEventListener('input', this.handleStaticInputValidation);
        if (this.chatgptKeyInput) this.chatgptKeyInput.removeEventListener('input', this.handleStaticInputValidation);
        if (this.chatgptModelInput) this.chatgptModelInput.removeEventListener('input', this.handleStaticInputValidation);

        if (this.addCustomProviderButton) this.addCustomProviderButton.removeEventListener('click', this.handleAddCustomProvider);
        if (this.customProviderList) {
            this.customProviderList.removeEventListener('click', this.handleCustomListClick);
            this.customProviderList.removeEventListener('input', this.handleCustomListInput);
            this.customProviderList.removeEventListener('input', this.handleCustomInputValidation);
        }

        // مودال تایید داخلی حذف شده است

        this.peik.off('settings:updated', this.handleSettingsUpdated);
        
        this.modal = null;
    }
}