import Sidebar from './components/sidebar.js';
import MessageList from './components/messageList.js';
import InputArea from './components/inputArea.js';
import SettingsModal from './components/settingsModal.js';
import LightboxManager from './components/lightboxManager.js';
import { loadTemplateWithPartials, loadTemplate } from './utils/templateLoader.js';

export default class UIManager {
    constructor(peik, rootId) {
        this.peik = peik;
        this.rootElement = document.getElementById(rootId);
        
        // Components
        this.sidebar = null;
        this.messageList = null;
        this.inputArea = null;
        this.settingsModal = null;
        this.lightboxManager = null;
        
        // State Management
        this.activeChatId = null;
        this.activeChatInstance = null; // Kept strictly for unbinding events

        // Bound handlers for core events
        this.handleReady = this.handleReady.bind(this);
        this.handleChatCreated = this.handleChatCreated.bind(this);
        this.handleChatUpdated = this.handleChatUpdated.bind(this);
        this.handleChatDeleted = this.handleChatDeleted.bind(this);
        this.handleSettingsUpdated = this.handleSettingsUpdated.bind(this);
        this.handleCoreError = this.handleCoreError.bind(this);
        this.handleMenuToggle = this.handleMenuToggle.bind(this);
        this.handleNewChatClick = this.handleNewChatClick.bind(this);
        this.handleEditSettingsClick = this.handleEditSettingsClick.bind(this);
        this.handleModelSelectorClick = this.handleModelSelectorClick.bind(this);
        this.handleDocumentClick = this.handleDocumentClick.bind(this);

        // Bound handlers for active chat events
        this.chatEventHandlers = {
            'message:sent': this.handleMessageSent.bind(this),
            'chunk': this.handleChunk.bind(this),
            'response:complete': this.handleResponseComplete.bind(this),
            'response:receiving': this.handleResponseReceiving.bind(this),
            'update': this.handleActiveChatUpdate.bind(this),
            'error': this.handleChatError.bind(this)
        };
    }

    async init() {
        await this.renderLayout();
        
        this.cacheGlobalElements();

        this.lightboxManager = new LightboxManager();
        this.sidebar = new Sidebar(this.peik, this);
        this.messageList = new MessageList(document.getElementById('message-list'), this.lightboxManager);
        this.inputArea = new InputArea(this.peik, this);
        this.settingsModal = new SettingsModal(this.peik);

        this.bindCoreEvents();
        this.bindGlobalEvents();
        
        const chats = this.peik.chats || [];
        if (chats.length > 0) {
            this.sidebar.render(chats, null);
        }
    }

    async renderLayout() {
        const [layoutHtml, modalHtml] = await Promise.all([
            loadTemplateWithPartials('plugins/presentation/webUI/templates/mainLayout.html'),
            loadTemplate('plugins/presentation/webUI/templates/settingsModal.html')
        ]);
        this.rootElement.innerHTML = layoutHtml + modalHtml;
    }

    cacheGlobalElements() {
        this.dom = {
            mainTitle: document.getElementById('main-title'),
            menuButton: document.getElementById('menu-toggle-button'),
            modelSelector: document.getElementById('model-selector'),
            modelSelectorButton: document.getElementById('model-selector-button'),
            modelSelectorDropdown: document.getElementById('model-selector-dropdown'),
            modelSelectorName: document.getElementById('model-selector-name'),
            modelSelectorIcon: document.getElementById('model-selector-icon')
        };
    }

    bindCoreEvents() {
        this.peik.on('ready', this.handleReady);
        this.peik.on('chat:created', this.handleChatCreated);
        this.peik.on('chat:updated', this.handleChatUpdated);
        this.peik.on('chat:deleted', this.handleChatDeleted);
        this.peik.on('settings:updated', this.handleSettingsUpdated);
        this.peik.on('error', this.handleCoreError);
    }

    bindGlobalEvents() {
        this.dom.menuButton?.addEventListener('click', this.handleMenuToggle);
        document.getElementById('new-chat-button')?.addEventListener('click', this.handleNewChatClick);
        document.getElementById('edit-settings-button')?.addEventListener('click', this.handleEditSettingsClick);
        this.dom.modelSelectorButton?.addEventListener('click', this.handleModelSelectorClick);
        document.addEventListener('click', this.handleDocumentClick);
    }

    // --- Event Handlers ---

    handleReady({ chats }) {
        this.sidebar.render(chats, null);
        if (chats.length > 0) {
            const lastChatId = chats[0].id;
            this.switchChat(lastChatId);
        } else if (!this.peik.config || !this.peik.config.defaultProvider) {
            this.settingsModal.show(true);
        }
    }

    handleChatCreated(chat) {
        this.sidebar.addChat(chat);
        this.switchChat(chat.id);
    }

    handleChatUpdated(chat) {
        this.sidebar.updateChat(chat);
        if (this.activeChatId === chat.id) {
            this.updateHeader(chat);
        }
    }

    handleChatDeleted(chatId) {
        this.sidebar.removeChat(chatId);
        if (this.activeChatId === chatId) {
            this._unbindActiveChatEvents();
            this.activeChatId = null;
            this.activeChatInstance = null;
            this.messageList.clear();
            this.updateHeader(null);
        }
    }

    handleSettingsUpdated() {
        alert('تنظیمات ذخیره شد.');
        this.settingsModal.show(false);
        if (this.activeChatId) {
            this.peik.getChat(this.activeChatId).then(chat => {
                this.updateHeader(chat);
                this.sidebar.updateChat(chat);
            });
        }
    }

    handleCoreError(err) {
        this.messageList.displayTemporaryError(err.message || err.toString());
    }

    handleMenuToggle(e) {
        e.stopPropagation();
        document.querySelector('.sidebar').classList.toggle('open');
    }

    async handleNewChatClick() {
        await this.peik.createChat('گپ جدید');
    }

    handleEditSettingsClick() {
        this.settingsModal.show(true);
    }

    handleModelSelectorClick(e) {
        e.stopPropagation();
        this.dom.modelSelectorDropdown.classList.toggle('hidden');
    }

    handleDocumentClick() {
        if (this.dom.modelSelectorDropdown && !this.dom.modelSelectorDropdown.classList.contains('hidden')) {
            this.dom.modelSelectorDropdown.classList.add('hidden');
        }
    }

    // --- Active Chat Handlers ---

    handleMessageSent(msg) {
        this.messageList.appendMessage(msg);
    }

    handleChunk({ messageId, chunk }) {
        this.messageList.appendChunk(messageId, chunk);
    }

    handleResponseComplete() {
        this.inputArea.setLoading(false);
    }

    handleResponseReceiving() {
        this.inputArea.setLoading(true);
    }

    handleActiveChatUpdate(updatedChat) {
        this.updateHeader(updatedChat);
        this.sidebar.updateChat(updatedChat);
    }

    handleChatError(err) {
        this.inputArea.setLoading(false);
        this.messageList.displayTemporaryError(err.message || 'خطا در گپ');
    }

    // --- Logic ---

    async switchChat(chatId) {
        if (this.activeChatId === chatId) return;

        const chat = await this.peik.getChat(chatId);
        if (!chat) return;

        this._unbindActiveChatEvents();

        this.activeChatId = chatId;
        this.activeChatInstance = chat;

        this.sidebar.setActive(chatId);
        this.messageList.renderHistory(chat.messages);
        this.updateHeader(chat);

        this._bindActiveChatEvents(chat);
        
        const sidebarEl = document.querySelector('.sidebar');
        if(sidebarEl) sidebarEl.classList.remove('open');
    }

    updateHeader(chat) {
        if (!chat) {
            this.dom.mainTitle.textContent = 'پیک';
            this.dom.modelSelector.classList.add('hidden');
            return;
        }

        this.dom.mainTitle.textContent = chat.title;
        
        const displayInfo = this.peik.getModelDisplayInfo(chat.modelInfo);
        const isModelValid = !!this.peik.resolveProviderConfig(chat.modelInfo);

        let displayName = displayInfo.displayName;
        if (!isModelValid) displayName = '⚠️ ' + displayName;

        this.dom.modelSelectorName.textContent = `${displayName}: ${displayInfo.modelName}`;
        this.dom.modelSelectorIcon.textContent = this._getProviderIconName(displayInfo.provider);
        this.dom.modelSelectorIcon.dataset.provider = displayInfo.provider;
        this.dom.modelSelector.classList.remove('hidden');

        this._populateModelDropdown(chat);
    }

    _populateModelDropdown(activeChat) {
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
                    this.updateHeader(activeChat);
                    this.sidebar.updateChat(activeChat);
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

    _bindActiveChatEvents(chat) {
        Object.entries(this.chatEventHandlers).forEach(([evt, fn]) => chat.on(evt, fn));
    }

    _unbindActiveChatEvents() {
        const chat = this.activeChatInstance;
        if (!chat) return;

        Object.entries(this.chatEventHandlers).forEach(([evt, fn]) => chat.off(evt, fn));
    }

    destroy() {
        // 1. Remove global DOM listeners
        this.dom.menuButton?.removeEventListener('click', this.handleMenuToggle);
        document.getElementById('new-chat-button')?.removeEventListener('click', this.handleNewChatClick);
        document.getElementById('edit-settings-button')?.removeEventListener('click', this.handleEditSettingsClick);
        this.dom.modelSelectorButton?.removeEventListener('click', this.handleModelSelectorClick);
        document.removeEventListener('click', this.handleDocumentClick);

        // 2. Remove core event listeners
        this.peik.off('ready', this.handleReady);
        this.peik.off('chat:created', this.handleChatCreated);
        this.peik.off('chat:updated', this.handleChatUpdated);
        this.peik.off('chat:deleted', this.handleChatDeleted);
        this.peik.off('settings:updated', this.handleSettingsUpdated);
        this.peik.off('error', this.handleCoreError);

        // 3. Remove active chat listeners
        this._unbindActiveChatEvents();

        // 4. Destroy child components
        if (this.sidebar) this.sidebar.destroy();
        if (this.messageList) this.messageList.destroy();
        if (this.inputArea) this.inputArea.destroy();
        if (this.settingsModal) this.settingsModal.destroy();
        if (this.lightboxManager) this.lightboxManager.destroy();

        // 5. Clear references
        this.peik = null;
        this.rootElement.innerHTML = '';
        this.rootElement = null;
        this.dom = null;
        this.activeChatInstance = null;
    }
}