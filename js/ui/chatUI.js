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
        
        // Cache for DOM elements that will be loaded from templates
        this.dom = {
            chatForm: null,
            messageInput: null,
            sendButton: null,
            messageList: null,
            newChatButton: null,
        };
    }

    /**
     * Initializes the UI by loading templates, caching elements, and binding events.
     */
    async init() {
        try {
            await this.loadLayout();
            this.cacheDOMElements();
            this.bindCoreEvents();
            this.bindUIEvents();
            this.initComponents();
        } catch (error) {
            this.rootElement.innerHTML = `<p style="color: red; padding: 1rem;">خطای مهلک: بارگذاری رابط کاربری ناموفق بود. لطفاً صفحه را رفرش کنید.</p>`;
            console.error('UI Initialization failed:', error);
        }
    }

    /**
     * Loads the main HTML layout and settings modal into the root element.
     */
    async loadLayout() {
        const [layoutHtml, modalHtml] = await Promise.all([
            loadTemplate('templates/mainLayout.html'),
            loadTemplate('templates/settingsModal.html')
        ]);
        this.rootElement.innerHTML = layoutHtml + modalHtml;
    }

    /**
     * Caches references to frequently used DOM elements.
     */
    cacheDOMElements() {
        this.dom.chatForm = document.getElementById('chat-form');
        this.dom.messageInput = document.getElementById('message-input');
        this.dom.sendButton = document.getElementById('send-button');
        this.dom.messageList = document.getElementById('message-list');
        this.dom.newChatButton = document.getElementById('new-chat-button');
    }

    /**
     * Binds listeners to events emitted from the ChatEngine.
     */
    bindCoreEvents() {
        this.engine.on('init', ({ settings, messages }) => {
            if (!settings) {
                this.settingsModal.show(true);
            }
            if (messages.length > 0) {
                this.messageRenderer.renderHistory(messages);
            } else {
                this.messageRenderer.showWelcomeMessage();
            }
        });

        this.engine.on('message', (message) => {
            if (message.role === 'model' && message.content === '') {
                // This is the placeholder for the streaming response
                this.currentStreamingBubble = this.messageRenderer.appendMessage(message, true);
            } else {
                this.messageRenderer.appendMessage(message);
            }
        });
        
        this.engine.on('chunk', (chunk) => {
            if (this.currentStreamingBubble) {
                this.messageRenderer.appendChunk(this.currentStreamingBubble, chunk);
            }
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
        
        this.engine.on('error', (errorMessage) => {
             this.messageRenderer.displayTemporaryError(errorMessage);
        });

        this.engine.on('messageRemoved', () => {
            this.messageRenderer.removeLastMessage();
        });

        this.engine.on('newChatStarted', () => {
            this.messageRenderer.clearMessages();
            this.messageRenderer.showWelcomeMessage();
        });
    }

    /**
     * Binds event listeners to user-interactive UI elements.
     */
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
        
        this.dom.newChatButton.addEventListener('click', () => this.handleNewChat());
        
        // Auto-resize textarea
        this.dom.messageInput.addEventListener('input', () => {
            const el = this.dom.messageInput;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        });
    }

    /**
     * Initializes all UI sub-components.
     */
    initComponents() {
        this.messageRenderer = new MessageRenderer(this.dom.messageList);
        this.settingsModal = new SettingsModal(this.engine);
        this.sidebarManager = new SidebarManager();
    }
    
    /**
     * Handles the logic for sending a message from the UI.
     */
    handleSendMessage() {
        const userInput = this.dom.messageInput.value.trim();
        if (userInput) {
            this.engine.sendMessage(userInput);
            this.dom.messageInput.value = '';
            this.dom.messageInput.style.height = 'auto'; // Reset height
            this.dom.messageInput.focus();
        }
    }

    /**
     * Handles the click on the 'New Chat' button.
     */
    handleNewChat() {
        if (confirm('آیا مطمئن هستید؟ تاریخچه چت فعلی پاک خواهد شد.')) {
            this.engine.startNewChat();
        }
    }
    
    /**
     * Updates the state of the send button (enabled/disabled/spinner).
     * @param {boolean} [isLoading=this.engine.isLoading] The current loading state.
     */
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