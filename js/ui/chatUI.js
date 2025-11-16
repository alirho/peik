import { loadTemplate } from './templateLoader.js';
import MessageRenderer from './components/messageRenderer.js';
import SettingsModal from './components/settingsModal.js';
import SidebarManager from './components/sidebarManager.js';
import InputManager from './components/inputManager.js';
import FileManager from './components/fileManager.js';
import LightboxManager from './components/lightboxManager.js';

// JSDoc Type Imports
/** @typedef {import('../types.js').Settings} Settings */
/** @typedef {import('../types.js').ImageData} ImageData */
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
        
        // Components will be initialized in init()
        this.messageRenderer = null;
        this.settingsModal = null;
        this.sidebarManager = null;
        this.inputManager = null;
        this.fileManager = null;
        this.lightboxManager = null;
        
        this.currentStreamingBubble = null;
        
        this.dom = {
            mainTitle: null,
            newChatButton: null
        };
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
            console.error('UI Initialization failed:', error);
        }
    }

    async loadLayout() {
        const [layoutHtml, modalHtml] = await Promise.all([
            loadTemplate('templates/mainLayout.html'),
            loadTemplate('templates/settingsModal.html')
        ]);
        this.rootElement.innerHTML = layoutHtml + modalHtml;
    }

    cacheDOMElements() {
        this.dom.mainTitle = document.getElementById('main-title');
        this.dom.newChatButton = document.getElementById('new-chat-button');
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

    /**
     * Checks if the API settings are valid for running the application.
     * @param {Settings | null} settings - The settings object from storage.
     * @returns {boolean} True if settings are valid, false otherwise.
     */
    isSettingsValid(settings) {
        if (!settings || !settings.provider) return false;
        if (settings.provider === 'custom') return !!settings.endpointUrl;
        return !!settings.apiKey;
    }

    bindCoreEvents() {
        this.engine.on('init', ({ settings, chats, activeChat }) => {
            if (!this.isSettingsValid(settings)) {
                this.settingsModal.show(true);
            }
            this.sidebarManager.render(chats, activeChat.id);
            this.updateChatView(activeChat);
        });

        this.engine.on('chatListUpdated', ({ chats, activeChatId }) => {
            this.sidebarManager.render(chats, activeChatId);
        });

        this.engine.on('activeChatSwitched', (activeChat) => {
            this.updateChatView(activeChat);
        });
        
        this.engine.on('message', (message) => {
            if (message.role === 'model' && message.content === '') {
                this.currentStreamingBubble = this.messageRenderer.appendMessage(message, true);
            } else {
                this.messageRenderer.appendMessage(message);
            }
        });
        
        this.engine.on('chunk', (chunk) => {
            if (this.currentStreamingBubble) this.messageRenderer.appendChunk(this.currentStreamingBubble, chunk);
        });
        
        this.engine.on('streamEnd', () => {
            this.currentStreamingBubble = null;
            this.inputManager.updateSendButtonState(false);
        });

        this.engine.on('loading', (isLoading) => this.inputManager.updateSendButtonState(isLoading));
        
        this.engine.on('settingsSaved', () => {
            this.settingsModal.show(false);
            alert('تنظیمات با موفقیت ذخیره شد.');
        });
        
        this.engine.on('error', (errorMessage) => this.messageRenderer.displayTemporaryError(errorMessage));
        this.engine.on('success', (successMessage) => this.messageRenderer.displayTemporarySuccess(successMessage));

        this.engine.on('messageRemoved', () => this.messageRenderer.removeLastMessage());
    }

    bindUIEvents() {
        this.dom.newChatButton.addEventListener('click', () => this.engine.startNewChat());
    }

    /**
     * Handles the logic of sending a message, called by the InputManager.
     * @param {string} userInput - The text from the input field.
     * @param {ImageData | null} image - The attached image data, if any.
     */
    handleSendMessage(userInput, image) {
        if (this.engine.isLoading) return;

        if (userInput || image) {
            this.engine.sendMessage(userInput, image);
            this.inputManager.reset();
        }
    }

    /**
     * Updates the main chat view with the content of a given chat.
     * @param {import('../types.js').Chat} chat - The chat object to display.
     */
    updateChatView(chat) {
        if (!chat) return;
        this.inputManager.clearPreview();
        this.dom.mainTitle.textContent = chat.title;
        if (chat.messages.length > 0) {
            this.messageRenderer.renderHistory(chat.messages);
        } else {
            this.messageRenderer.showWelcomeMessage();
        }
    }
}

export default ChatUI;
