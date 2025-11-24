import Component from '../component.js';

export default class Header extends Component {
    constructor(peik, uiManager) {
        super(peik, uiManager);
        
        this.dom = {};
        
        // Bind handlers
        this.handleMenuToggle = this.handleMenuToggle.bind(this);
        this.handleNewChatClick = this.handleNewChatClick.bind(this);
        this.handleModelSelectorClick = this.handleModelSelectorClick.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
    }

    async init() {
        this.cacheDOMElements();
        this.bindEvents();
    }

    cacheDOMElements() {
        this.dom = {
            mainTitle: document.getElementById('main-title'),
            menuButton: document.getElementById('menu-toggle-button'),
            newChatBtn: document.getElementById('new-chat-button'), // دکمه هدر (اگر وجود داشته باشد)
            modelSelector: document.getElementById('model-selector'),
            modelSelectorButton: document.getElementById('model-selector-button'),
            modelSelectorDropdown: document.getElementById('model-selector-dropdown'),
            modelSelectorName: document.getElementById('model-selector-name'),
            modelSelectorIcon: document.getElementById('model-selector-icon')
        };
    }

    bindEvents() {
        this.dom.menuButton?.addEventListener('click', this.handleMenuToggle);
        // توجه: دکمه new-chat-button ممکن است در سایدبار باشد، اما اگر در هدر هم بود اینجا مدیریت می‌شود
        // یا می‌توانیم به رویدادهای DOM گلوبال گوش دهیم اگر ID یکتا باشد.
        
        this.dom.modelSelectorButton?.addEventListener('click', this.handleModelSelectorClick);
        document.addEventListener('click', this.handleDocumentClick);
    }

    onChatChanged(newChat, oldChat) {
        this.updateHeader(newChat);
    }

    updateHeader(chat) {
        if (!chat) {
            if (this.dom.mainTitle) this.dom.mainTitle.textContent = 'پیک';
            this.dom.modelSelector?.classList.add('hidden');
            return;
        }

        if (this.dom.mainTitle) this.dom.mainTitle.textContent = chat.title;
        
        const displayInfo = this.peik.getModelDisplayInfo(chat.modelInfo);
        const isModelValid = !!this.peik.resolveProviderConfig(chat.modelInfo);

        let displayName = displayInfo.displayName;
        if (!isModelValid) displayName = '⚠️ ' + displayName;

        if (this.dom.modelSelectorName) this.dom.modelSelectorName.textContent = `${displayName}: ${displayInfo.modelName}`;
        
        if (this.dom.modelSelectorIcon) {
            this.dom.modelSelectorIcon.textContent = this._getProviderIconName(displayInfo.provider);
            this.dom.modelSelectorIcon.dataset.provider = displayInfo.provider;
        }
        
        this.dom.modelSelector?.classList.remove('hidden');

        this._populateModelDropdown(chat);
    }

    _populateModelDropdown(activeChat) {
        if (!this.dom.modelSelectorDropdown) return;
        const dropdown = this.dom.modelSelectorDropdown;
        dropdown.innerHTML = '';
        
        const settings = this.peik.settings;
        const models = [];
        
        if (settings?.providers?.gemini?.apiKey) models.push({ provider: 'gemini', name: 'Gemini', modelName: settings.providers.gemini.modelName });
        if (settings?.providers?.openai?.apiKey) models.push({ provider: 'openai', name: 'ChatGPT', modelName: settings.providers.openai.modelName });
        settings?.providers?.custom?.forEach(c => models.push({ provider: 'custom', name: c.name, modelName: c.modelName, id: c.id }));

        if (this.peik.config && this.peik.config.defaultProvider) {
             const def = this.peik.config.defaultProvider;
             models.push({ provider: def.provider, name: def.name || 'پیش‌فرض', modelName: def.modelName, id: 'default' });
        }

        models.forEach(model => {
            const item = document.createElement('div');
            item.className = 'model-selector-item';
            item.innerHTML = `
                <div class="model-item-info">
                    <span class="material-symbols-outlined provider-icon" data-provider="${model.provider}">${this._getProviderIconName(model.provider)}</span>
                    <span class="model-item-name">${model.name}: ${model.modelName}</span>
                </div>
            `;
            item.addEventListener('click', () => {
                const newModelInfo = model.provider === 'custom' 
                    ? { provider: 'custom', customProviderId: model.id, displayName: model.name, modelName: model.modelName }
                    : { provider: model.provider, displayName: model.name, modelName: model.modelName };
                
                activeChat.changeModel(newModelInfo).then(() => {
                    // تغییر مدل باعث رویداد chat:updated می‌شود که UIManager آن را هندل می‌کند
                    // اما می‌توانیم هدر را دستی هم آپدیت کنیم
                    this.updateHeader(activeChat);
                });
            });
            dropdown.appendChild(item);
        });
    }

    _getProviderIconName(provider) {
        switch (provider) {
            case 'gemini': return 'auto_awesome';
            case 'openai': return 'psychology';
            default: return 'hub';
        }
    }

    handleMenuToggle(e) {
        e.stopPropagation();
        const sidebar = document.querySelector('.sidebar');
        if (sidebar) sidebar.classList.toggle('open');
    }

    handleNewChatClick() {
        this.peik.createChat('گپ جدید');
    }

    handleModelSelectorClick(e) {
        e.stopPropagation();
        this.dom.modelSelectorDropdown?.classList.toggle('hidden');
    }

    handleDocumentClick() {
        if (this.dom.modelSelectorDropdown && !this.dom.modelSelectorDropdown.classList.contains('hidden')) {
            this.dom.modelSelectorDropdown.classList.add('hidden');
        }
    }

    destroy() {
        this.dom.menuButton?.removeEventListener('click', this.handleMenuToggle);
        this.dom.modelSelectorButton?.removeEventListener('click', this.handleModelSelectorClick);
        document.removeEventListener('click', this.handleDocumentClick);
        this.dom = {};
    }
}