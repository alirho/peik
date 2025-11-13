import { loadTemplate } from './templateLoader.js';
import MessageRenderer from './components/messageRenderer.js';
import SettingsModal from './components/settingsModal.js';
import SidebarManager from './components/sidebarManager.js';

/**
 * Manages the entire UI, acting as an orchestrator for all UI components.
 */
class ChatUI {
    /**
     * @param {import('../core/chatEngine.js').default} chatEngine The core chat engine instance.
     * @param {HTMLElement} rootElement The root element to render the UI into.
     */
    constructor(chatEngine, rootElement) {
        this.engine = chatEngine;
        this.rootElement = rootElement;
        this.messageRenderer = null;
        this.settingsModal = null;
        this.sidebarManager = null;
        this.currentStreamingBubble = null;
        
        this.dom = {
            chatForm: null,
            messageInput: null,
            sendButton: null,
            messageList: null,
            newChatButton: null,
            mainTitle: null,
        };
    }

    /**
     * Initializes the UI by loading templates, caching elements, and binding events.
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
        this.dom.chatForm = document.getElementById('chat-form');
        this.dom.messageInput = document.getElementById('message-input');
        this.dom.sendButton = document.getElementById('send-button');
        this.dom.messageList = document.getElementById('message-list');
        this.dom.newChatButton = document.getElementById('new-chat-button');
        this.dom.mainTitle = document.getElementById('main-title');
    }

    initComponents() {
        this.messageRenderer = new MessageRenderer(this.dom.messageList);
        this.settingsModal = new SettingsModal(this.engine);
        this.sidebarManager = new SidebarManager(this.engine);
    }

    /**
     * Checks if the API settings are valid enough to run the app.
     * @param {object | null} settings The settings object from storage.
     * @returns {boolean} True if settings are valid, false otherwise.
     */
    isSettingsValid(settings) {
        if (!settings || !settings.provider) {
            return false;
        }

        // For custom provider, the endpoint URL is the minimum requirement.
        if (settings.provider === 'custom') {
            return !!settings.endpointUrl;
        }
        
        // For standard providers (Gemini, OpenAI), an API key is required.
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
            this.updateSendButtonState();
        });

        this.engine.on('loading', (isLoading) => this.updateSendButtonState(isLoading));
        
        this.engine.on('settingsSaved', () => {
            this.settingsModal.show(false);
            alert('تنظیمات با موفقیت ذخیره شد.');
        });
        
        this.engine.on('error', (errorMessage) => this.messageRenderer.displayTemporaryError(errorMessage));

        this.engine.on('messageRemoved', () => this.messageRenderer.removeLastMessage());
    }

    bindUIEvents() {
        this.dom.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.handleSendMessage();
        });

        this.dom.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.handleSendMessage();
            }
        });
        
        this.dom.newChatButton.addEventListener('click', () => this.engine.startNewChat());
        
        this.dom.messageInput.addEventListener('input', () => {
            const el = this.dom.messageInput;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        });
    }
    
    handleSendMessage() {
        const userInput = this.dom.messageInput.value.trim();
        if (userInput) {
            this.engine.sendMessage(userInput);
            this.dom.messageInput.value = '';
            this.dom.messageInput.style.height = 'auto';
            this.dom.messageInput.focus();
        }
    }

    updateChatView(chat) {
        if (!chat) return;
        this.dom.mainTitle.textContent = chat.title;
        if (chat.messages.length > 0) {
            this.messageRenderer.renderHistory(chat.messages);
        } else {
            this.messageRenderer.showWelcomeMessage();
        }
    }
    
    updateSendButtonState(isLoading = this.engine.isLoading) {
        const button = this.dom.sendButton;
        if (isLoading) {
            button.disabled = true;
            button.innerHTML = '<div class="spinner"></div>';
        } else {
            button.disabled = false;
            button.innerHTML = '<span class="material-symbols-outlined">send</span>';
        }
    }
}

export default ChatUI;