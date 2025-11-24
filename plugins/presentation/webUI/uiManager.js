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
        
        this.sidebar = null;
        this.messageList = null;
        this.inputArea = null;
        this.settingsModal = null;
        this.lightboxManager = null;
        
        // مدیریت گپ فعال در لایه UI (چون هسته Stateless شده است)
        this.activeChat = null;
        this.activeChatListeners = {};
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
        this.peik.on('ready', ({ chats }) => {
            this.sidebar.render(chats, null);
            
            if (chats.length > 0) {
                const lastChatId = chats[0].id;
                this.switchChat(lastChatId);
            } else if (!this.peik.config || !this.peik.config.defaultProvider) {
                this.settingsModal.show(true);
            }
        });

        this.peik.on('chat:created', (chat) => {
            this.sidebar.addChat(chat);
            this.switchChat(chat.id);
        });

        this.peik.on('chat:updated', (chat) => {
            this.sidebar.updateChat(chat);
            // اگر گپِ به‌روز شده همان گپ فعال است، هدر را آپدیت کن
            if (this.activeChat && this.activeChat.id === chat.id) {
                this.updateHeader(chat);
            }
        });

        this.peik.on('chat:deleted', (chatId) => {
            this.sidebar.removeChat(chatId);
            if (this.activeChat && this.activeChat.id === chatId) {
                this._unbindActiveChatEvents();
                this.activeChat = null;
                this.messageList.clear();
                this.updateHeader(null);
            }
        });

        this.peik.on('settings:updated', () => {
            alert('تنظیمات ذخیره شد.');
            this.settingsModal.show(false);
            if (this.activeChat) {
                this.updateHeader(this.activeChat);
                this.sidebar.updateChat(this.activeChat);
            }
        });
        
        this.peik.on('error', (err) => {
            this.messageList.displayTemporaryError(err.message || err.toString());
        });
    }

    bindGlobalEvents() {
        this.dom.menuButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            document.querySelector('.sidebar').classList.toggle('open');
        });

        document.getElementById('new-chat-button')?.addEventListener('click', () => this.createNewChat());
        document.getElementById('edit-settings-button')?.addEventListener('click', () => this.settingsModal.show(true));

        this.dom.modelSelectorButton?.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dom.modelSelectorDropdown.classList.toggle('hidden');
        });

        document.addEventListener('click', () => {
            if (this.dom.modelSelectorDropdown && !this.dom.modelSelectorDropdown.classList.contains('hidden')) {
                this.dom.modelSelectorDropdown.classList.add('hidden');
            }
        });
    }

    async createNewChat() {
        await this.peik.createChat('گپ جدید');
    }

    async switchChat(chatId) {
        // اگر گپ درخواستی همین الان فعال است، کاری نکن
        if (this.activeChat && this.activeChat.id === chatId) return;

        const chat = await this.peik.getChat(chatId);
        if (!chat) return;

        this._unbindActiveChatEvents();

        // ذخیره گپ فعال در UIManager
        this.activeChat = chat;

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
        const onMessage = (msg) => this.messageList.appendMessage(msg);
        const onChunk = ({ messageId, chunk }) => this.messageList.appendChunk(messageId, chunk);
        const onComplete = () => this.inputArea.setLoading(false);
        const onReceiving = () => this.inputArea.setLoading(true);
        const onUpdate = (updatedChat) => {
            this.updateHeader(updatedChat);
            this.sidebar.updateChat(updatedChat);
        };
        const onError = (err) => {
            this.inputArea.setLoading(false);
            this.messageList.displayTemporaryError(err.message || 'خطا در گپ');
        };

        this.activeChatListeners = {
            'message:sent': onMessage,
            chunk: onChunk,
            'response:complete': onComplete,
            'response:receiving': onReceiving,
            update: onUpdate,
            error: onError
        };

        Object.entries(this.activeChatListeners).forEach(([evt, fn]) => chat.on(evt, fn));
    }

    _unbindActiveChatEvents() {
        const chat = this.activeChat;
        if (!chat || !this.activeChatListeners['message:sent']) return;

        Object.entries(this.activeChatListeners).forEach(([evt, fn]) => chat.off(evt, fn));
        this.activeChatListeners = {};
    }
}