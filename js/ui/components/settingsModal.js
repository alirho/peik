/**
 * Manages the settings modal UI and logic.
 */
class SettingsModal {
    /**
     * @param {import('../../core/chatEngine.js').default} engine The chat engine instance.
     */
    constructor(engine) {
        this.engine = engine;
        this.cacheDOMElements();
        this.bindEvents();
    }

    /**
     * Caches references to frequently used DOM elements within the modal.
     */
    cacheDOMElements() {
        this.modal = document.getElementById('settings-modal');
        this.form = document.getElementById('settings-form');
        this.cancelButton = document.getElementById('cancel-settings-button');
        this.editButton = document.getElementById('edit-settings-button');
        
        // Input fields
        this.geminiModelInput = document.getElementById('gemini-model-input');
        this.geminiKeyInput = document.getElementById('gemini-key-input');
        this.chatgptModelInput = document.getElementById('chatgpt-model-input');
        this.chatgptKeyInput = document.getElementById('chatgpt-key-input');
        this.customModelInput = document.getElementById('custom-model-input');
        this.customKeyInput = document.getElementById('custom-key-input');
        this.customEndpointInput = document.getElementById('custom-endpoint-input');
        
        // Key toggles
        this.geminiKeyToggle = document.getElementById('gemini-key-toggle');
        this.chatgptKeyToggle = document.getElementById('chatgpt-key-toggle');
        this.customKeyToggle = document.getElementById('custom-key-toggle');
    }

    /**
     * Binds event listeners to the modal's interactive elements.
     */
    bindEvents() {
        this.form.addEventListener('submit', this.handleSave.bind(this));
        this.cancelButton.addEventListener('click', () => this.show(false));
        this.editButton.addEventListener('click', () => this.show(true));
        
        this.geminiKeyToggle.addEventListener('click', () => this.togglePasswordVisibility(this.geminiKeyInput, this.geminiKeyToggle));
        this.chatgptKeyToggle.addEventListener('click', () => this.togglePasswordVisibility(this.chatgptKeyInput, this.chatgptKeyToggle));
        this.customKeyToggle.addEventListener('click', () => this.togglePasswordVisibility(this.customKeyInput, this.customKeyToggle));
    }

    /**
     * Shows or hides the settings modal.
     * @param {boolean} shouldShow True to show, false to hide.
     */
    show(shouldShow) {
        this.modal.classList.toggle('hidden', !shouldShow);
        if (shouldShow) {
            this.populateForm();
        }
    }

    /**
     * Handles the form submission to save settings.
     * @param {Event} e The submit event.
     */
    async handleSave(e) {
        e.preventDefault();
        
        const settings = this.getSettingsFromForm();
        if (settings) {
            await this.engine.saveSettings(settings);
        }
    }
    
    /**
     * Reads the input values from the form and constructs a settings object.
     * @returns {object|null} The settings object or null if validation fails.
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
     * Populates the form fields with the current settings from the engine.
     */
    populateForm() {
        this.form.reset();
        
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
     * Toggles the visibility of a password input field.
     * @param {HTMLInputElement} inputElement The password input field.
     * @param {HTMLButtonElement} buttonElement The toggle button.
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