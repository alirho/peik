import { loadTemplate, loadTemplateWithPartials } from './templateLoader.js';
import MessageRenderer from './components/messageRenderer.js';
import SettingsModal from './components/settingsModal.js';
import SidebarManager from './components/sidebarManager.js';
import InputManager from './components/inputManager.js';
import FileManager from './components/fileManager.js';
import LightboxManager from './components/lightboxManager.js';

// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../types.js').Settings} Settings */
/** @typedef {import('../types.js').ImageData} ImageData */
/** @typedef {import('../types.js').ProviderConfig} ProviderConfig */
/** @typedef {import('../types.js').ChatModelInfo} ChatModelInfo */
/** @typedef {import('../core/chatEngine.js').default} ChatEngine */

/**
 * کل رابط کاربری برنامه را مدیریت کرده و به عنوان ارکستراتور برای تمام کامپوننت‌های UI عمل می‌کند.
 */
class ChatUI {
    /**
     * @param {ChatEngine} chatEngine - نمونه اصلی موتور چت.
     * @param {HTMLElement} rootElement - المان اصلی که UI در آن رندر می‌شود.
     */
    constructor(chatEngine, rootElement) {
        this.engine = chatEngine;
        this.rootElement = rootElement;
        
        this.messageRenderer = null;
        this.settingsModal = null;
        this.sidebarManager = null;
        this.inputManager = null;
        this.fileManager = null;
        this.lightboxManager = null;
        
        this.currentStreamingBubble = null;
        
        this.dom = {};
        
        this.engineListeners = {};
        this.handleNewChatClickBound = () => this.engine.startNewChat();
        this.handleGlobalClickBound = this._handleGlobalClick.bind(this);
    }

    /**
     * UI را با بارگذاری قالب‌ها، کش کردن المان‌ها و اتصال رویدادها راه‌اندازی می‌کند.
     * @returns {Promise<void>}
     */
    async init() {
        try {
            await this.loadLayout();
            this.cacheDOMElements();
            this.initComponents();
            this.bindCoreEvents();
            this.bindUIEvents();
        } catch (error) {
            this.rootElement.innerHTML = `<p style="color: red; padding: 1rem;">خطای مهلک: بارگذاری رابط کاربری ناموفق بود. لطفاً صفحه را رفرش کنید.</p>`;
            console.error('راه‌اندازی UI ناموفق بود:', error);
        }
    }

    async loadLayout() {
        const [layoutHtml, modalHtml] = await Promise.all([
            loadTemplateWithPartials('templates/mainLayout.html'),
            loadTemplate('templates/settingsModal.html')
        ]);
        this.rootElement.innerHTML = layoutHtml + modalHtml;
    }

    cacheDOMElements() {
        this.dom = {
            mainTitle: document.getElementById('main-title'),
            newChatButton: document.getElementById('new-chat-button'),
            modelSelector: document.getElementById('model-selector'),
            modelSelectorButton: document.getElementById('model-selector-button'),
            modelSelectorIcon: document.getElementById('model-selector-icon'),
            modelSelectorName: document.getElementById('model-selector-name'),
            modelSelectorDropdown: document.getElementById('model-selector-dropdown'),
        };
    }

    initComponents() {
        this.lightboxManager = new LightboxManager();
        this.messageRenderer = new MessageRenderer(document.getElementById('message-list'), this.lightboxManager);
        this.settingsModal = new SettingsModal(this.engine);
        this.sidebarManager = new SidebarManager(this.engine);
        
        this.fileManager = new FileManager(this.engine, (imageData) => {
            this.inputManager.setAndPreviewImage(imageData);
        });

        this.inputManager = new InputManager(this.fileManager, (userInput, image) => {
            this.handleSendMessage(userInput, image);
        });
    }

    isSettingsValid(settings) {
        return this.engine.isSettingsValid(settings);
    }

    bindCoreEvents() {
        this.engineListeners = {
            init: ({ settings, chats, activeChat }) => {
                if (!this.isSettingsValid(settings) && !this.engine.defaultProvider) {
                    this.settingsModal.show(true);
                } else if (!this.isSettingsValid(settings) && this.engine.defaultProvider) {
                    this.messageRenderer.displayTemporaryInfo('شما در حال استفاده از مدل پیش‌فرض هستید. برای افزودن کلید شخصی به تنظیمات مراجعه کنید.');
                }
                
                if (activeChat) {
                    this.sidebarManager.render(chats, activeChat.id);
                    this.updateChatView(activeChat);
                } else {
                    this.sidebarManager.render(chats, null);
                    this.messageRenderer.showWelcomeMessage();
                    this.dom.modelSelector.classList.add('hidden');
                }
            },
            chatListUpdated: ({ chats, activeChatId }) => {
                this.sidebarManager.render(chats, activeChatId);
            },
            activeChatSwitched: (activeChat) => {
                this.updateChatView(activeChat);
            },
            message: (message) => {
                if (message.role === 'model' && message.content === '') {
                    this.currentStreamingBubble = this.messageRenderer.appendMessage(message, true);
                } else {
                    this.messageRenderer.appendMessage(message);
                }
            },
            chunk: (chunk) => {
                if (this.currentStreamingBubble) this.messageRenderer.appendChunk(this.currentStreamingBubble, chunk);
            },
            streamEnd: () => {
                this.currentStreamingBubble = null;
                this.inputManager.updateSendButtonState(false);
            },
            loading: (isLoading) => this.inputManager.updateSendButtonState(isLoading),
            settingsSaved: () => {
                this.settingsModal.show(false);
                alert('تنظیمات با موفقیت ذخیره شد.');
                // Refresh the active chat to apply the new default model if needed
                const activeChat = this.engine.getActiveChat();
                if (activeChat) this.updateChatView(activeChat);
            },
            error: (errorMessage) => this.messageRenderer.displayTemporaryError(errorMessage),
            success: (successMessage) => this.messageRenderer.displayTemporarySuccess(successMessage),
            messageRemoved: () => this.messageRenderer.removeLastMessage(),
        };

        Object.keys(this.engineListeners).forEach(eventName => {
            this.engine.on(eventName, this.engineListeners[eventName]);
        });
    }

    bindUIEvents() {
        this.dom.newChatButton.addEventListener('click', this.handleNewChatClickBound);
        this.dom.modelSelectorButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.dom.modelSelectorDropdown.classList.toggle('hidden');
        });
        this.dom.modelSelectorDropdown.addEventListener('click', (e) => {
            const item = e.target.closest('.model-selector-item');
            if (item && !item.classList.contains('invalid')) {
                const config = JSON.parse(item.dataset.config);
                const activeChat = this.engine.getActiveChat();
                if (activeChat) {
                    this.engine.updateChatModel(activeChat.id, config);
                }
                this.dom.modelSelectorDropdown.classList.add('hidden');
            }
        });
        document.addEventListener('click', this.handleGlobalClickBound);
    }
    
    _handleGlobalClick() {
        if (this.dom.modelSelectorDropdown && !this.dom.modelSelectorDropdown.classList.contains('hidden')) {
            this.dom.modelSelectorDropdown.classList.add('hidden');
        }
    }

    destroy() {
        Object.keys(this.engineListeners).forEach(eventName => {
            this.engine.off(eventName, this.engineListeners[eventName]);
        });
        this.engineListeners = {};

        if (this.dom.newChatButton) this.dom.newChatButton.removeEventListener('click', this.handleNewChatClickBound);
        document.removeEventListener('click', this.handleGlobalClickBound);

        if (this.lightboxManager) this.lightboxManager.destroy();
        if (this.settingsModal) this.settingsModal.destroy();
        if (this.sidebarManager) this.sidebarManager.destroy();
        if (this.inputManager) this.inputManager.destroy();
        if (this.fileManager) this.fileManager.destroy();

        this.rootElement.innerHTML = '';
        this.dom = {};
        console.log('ChatUI نابود شد.');
    }

    handleSendMessage(userInput, image) {
        if (this.engine.isLoading) return;
        if (userInput || image) {
            this.engine.sendMessage(userInput, image);
            this.inputManager.reset();
        }
    }

    updateChatView(chat) {
        if (!chat) return;
        this.inputManager.clearPreview();
        this.dom.mainTitle.textContent = chat.title;
        this.renderModelSelector(chat);
        if (chat.messages && chat.messages.length > 0) {
            this.messageRenderer.renderHistory(chat.messages);
        } else {
            this.messageRenderer.showWelcomeMessage();
        }
    }

    // --- توابع انتخاب مدل ---

    /**
     * دکمه و منوی کشویی انتخاب مدل را بر اساس گپ فعال رندر می‌کند.
     * @param {import('../types.js').Chat} chat 
     */
    renderModelSelector(chat) {
        if (!chat || !chat.modelInfo) {
            this.dom.modelSelector.classList.add('hidden');
            return;
        }

        const modelInfo = chat.modelInfo;
        const isModelValid = !!this.engine.resolveProviderConfig(modelInfo);
        
        const displayName = modelInfo.displayName || (modelInfo.provider === 'gemini' ? 'Gemini' : modelInfo.provider === 'openai' ? 'ChatGPT' : 'سفارشی');
        
        let buttonText = `${displayName}: ${modelInfo.modelName}`;
        if (!isModelValid) {
            buttonText = `⚠️ ${buttonText}`;
        }
        
        this.dom.modelSelectorName.textContent = buttonText;
        this.dom.modelSelectorIcon.textContent = this._getProviderIconName(modelInfo.provider);
        this.dom.modelSelectorIcon.dataset.provider = modelInfo.provider;
        
        this._populateModelDropdown(chat);
        this.dom.modelSelector.classList.remove('hidden');
    }

    /**
     * منوی کشویی مدل را با تمام ارائه‌دهندگان موجود پر می‌کند.
     * @param {import('../types.js').Chat} activeChat
     */
    _populateModelDropdown(activeChat) {
        const dropdown = this.dom.modelSelectorDropdown;
        dropdown.innerHTML = '';
        
        const availableModels = this._getAllAvailableModels();
        const activeModelInfo = activeChat.modelInfo;
        const isCurrentModelValid = !!this.engine.resolveProviderConfig(activeModelInfo);

        // اگر مدل فعلی گپ دیگر در تنظیمات موجود نیست، آن را به عنوان یک آیتم نامعتبر در بالای لیست نمایش بده
        if (!isCurrentModelValid && activeModelInfo) {
            const item = document.createElement('div');
            item.className = 'model-selector-item invalid';
            item.title = 'این مدل دیگر موجود نیست';
            
            const displayName = activeModelInfo.displayName || 'مدل حذف شده';

            item.innerHTML = `
                <div class="model-item-info">
                    <span class="material-symbols-outlined provider-icon" data-provider="${activeModelInfo.provider}">${this._getProviderIconName(activeModelInfo.provider)}</span>
                    <span class="model-item-name">⚠️ ${displayName}: ${activeModelInfo.modelName}</span>
                </div>
            `;
            dropdown.appendChild(item);
        }

        availableModels.forEach(modelConfig => {
            const item = document.createElement('div');
            item.className = 'model-selector-item';
            // ذخیره پیکربندی کامل برای استفاده در هنگام به‌روزرسانی
            item.dataset.config = JSON.stringify(modelConfig);
            
            let isActive = false;
            if (activeModelInfo) {
                if (modelConfig.provider === 'custom' && activeModelInfo.provider === 'custom') {
                    isActive = modelConfig.customProviderId === activeModelInfo.customProviderId;
                } else if (modelConfig.provider !== 'custom' && activeModelInfo.provider !== 'custom') {
                    // برای مدل‌های داخلی، مقایسه نوع و نام مدل
                    isActive = (modelConfig.provider === activeModelInfo.provider) && (modelConfig.modelName === activeModelInfo.modelName);
                }
            }

            if (isActive) {
                item.classList.add('active');
            }
            
            const displayName = modelConfig.name || (modelConfig.provider === 'gemini' ? 'Gemini' : modelConfig.provider === 'openai' ? 'ChatGPT' : 'سفارشی');

            item.innerHTML = `
                <div class="model-item-info">
                    <span class="material-symbols-outlined provider-icon" data-provider="${modelConfig.provider}">${this._getProviderIconName(modelConfig.provider)}</span>
                    <span class="model-item-name">${displayName}: ${modelConfig.modelName}</span>
                </div>
                ${isActive ? '<span class="material-symbols-outlined checkmark">check</span>' : ''}
            `;
            dropdown.appendChild(item);
        });
    }

    /**
     * لیستی از تمام پیکربندی‌های مدل موجود را از تنظیمات استخراج می‌کند.
     * @returns {Array<ProviderConfig>}
     */
    _getAllAvailableModels() {
        const models = [];
        const settings = this.engine.settings;
        
        if (!settings || !settings.providers) return models;

        // Gemini
        const geminiConfig = settings.providers.gemini;
        if (geminiConfig && geminiConfig.apiKey && geminiConfig.modelName) {
            models.push({
                provider: 'gemini',
                name: 'Gemini',
                modelName: geminiConfig.modelName,
                apiKey: geminiConfig.apiKey
            });
        }
        
        // OpenAI
        const openaiConfig = settings.providers.openai;
        if (openaiConfig && openaiConfig.apiKey && openaiConfig.modelName) {
            models.push({
                provider: 'openai',
                name: 'ChatGPT',
                modelName: openaiConfig.modelName,
                apiKey: openaiConfig.apiKey
            });
        }

        // Custom
        settings.providers.custom?.forEach(p => {
            if (p.name && p.modelName && p.endpointUrl) {
                models.push({
                    provider: 'custom',
                    name: p.name,
                    modelName: p.modelName,
                    apiKey: p.apiKey,
                    endpointUrl: p.endpointUrl,
                    customProviderId: p.id
                });
            }
        });
        
        return models;
    }

    /**
     * نام آیکون Material Symbols را برای یک ارائه‌دهنده برمی‌گرداند.
     * @param {string} provider 
     * @returns {string}
     */
    _getProviderIconName(provider) {
        switch (provider) {
            case 'gemini': return 'auto_awesome';
            case 'openai': return 'psychology';
            default: return 'hub';
        }
    }
}

export default ChatUI;
