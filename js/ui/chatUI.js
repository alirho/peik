import { loadTemplate } from './templateLoader.js';
import SettingsModal from './components/settingsModal.js';
import MessageRenderer from './components/messageRenderer.js';
import SidebarManager from './components/sidebarManager.js';

/**
 * Manages the overall chat user interface, orchestrating all UI components.
 */
class ChatUI {
    /**
     * @param {import('../chatEngine.js').default} engine The chat engine instance.
     * @param {HTMLElement} rootElement The main container element for the UI.
     */
    constructor(engine, rootElement) {
        this.engine = engine;
        this.rootElement = rootElement;
        this.lastModelMessageBubble = null;
    }

    /**
     * Initializes the UI by loading templates, creating components, and binding events.
     */
    async init() {
        await this.renderLayout();
        this.initComponents();
        this.bindUserEvents();
        this.bindEngineEvents();
    }

    /**
     * Loads main layout and settings modal templates and renders them.
     */
    async renderLayout() {
        const mainLayoutHtml = await loadTemplate('templates/mainLayout.html');
        const settingsModalHtml = await loadTemplate('templates/settingsModal.html');
        this.rootElement.innerHTML = mainLayoutHtml + settingsModalHtml;
    }

    /**
     * Caches DOM elements and initializes UI components.
     */
    initComponents() {
        // Cache main elements
        this.appContainer = document.getElementById('app-container');
        this.messageList = document.getElementById('message-list');
        this.chatForm = document.getElementById('chat-form');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');

        // Initialize components
        this.settingsModal = new SettingsModal(this.engine);
        this.messageRenderer = new MessageRenderer(this.messageList);
        this.sidebarManager = new SidebarManager();
    }

    /**
     * Binds listeners to user-triggered DOM events.
     */
    bindUserEvents() {
        this.chatForm.addEventListener('submit', this.handleSendMessage.bind(this));
        this.messageInput.addEventListener('input', this.handleTextareaInput.bind(this));
        this.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.chatForm.requestSubmit();
            }
        });
    }

    /**
     * Binds listeners to events emitted by the ChatEngine.
     */
    bindEngineEvents() {
        this.engine.on('init', ({ settings, messages }) => {
            this.appContainer.classList.toggle('hidden', !settings || !settings.apiKey);
            this.settingsModal.show(!settings || !settings.apiKey);
            if (settings) {
                if (messages.length > 0) {
                    this.messageRenderer.renderHistory(messages);
                } else {
                    this.messageRenderer.showWelcomeMessage();
                }
            }
        });
        this.engine.on('settingsSaved', (settings) => {
            this.settingsModal.show(false);
            this.appContainer.classList.remove('hidden');
            if (this.engine.messages.length === 0) {
                this.messageRenderer.showWelcomeMessage();
            }
        });
        this.engine.on('loading', this.toggleLoading.bind(this));
        this.engine.on('message', this.handleNewMessage.bind(this));
        this.engine.on('chunk', this.handleStreamChunk.bind(this));
        this.engine.on('streamEnd', () => (this.lastModelMessageBubble = null));
        this.engine.on('messageRemoved', () => this.messageRenderer.removeLastMessage());
        this.engine.on('error', (error) => this.messageRenderer.displayTemporaryError(error));
    }
    
    // --- Event Handlers ---

    /**
     * Handles the form submission for sending a message.
     * @param {Event} e The submit event.
     */
    handleSendMessage(e) {
        e.preventDefault();
        const userInput = this.messageInput.value.trim();
        if (userInput) {
            if (this.engine.messages.length === 0) {
                this.messageRenderer.clearMessages();
            }
            this.engine.sendMessage(userInput);
            this.messageInput.value = '';
            this.handleTextareaInput();
        }
    }

    /**
     * Handles a new message from the engine and renders it.
     * @param {object} message The message object.
     */
    handleNewMessage(message) {
        const isStreamingPlaceholder = message.role === 'model' && message.content.length === 0;
        const bubble = this.messageRenderer.appendMessage(message, isStreamingPlaceholder);
        if (isStreamingPlaceholder) {
            this.lastModelMessageBubble = bubble;
        }
    }

    /**
     * Handles an incoming chunk of a streaming response.
     * @param {string} chunk The text chunk.
     */
    handleStreamChunk(chunk) {
        if (this.lastModelMessageBubble) {
            this.messageRenderer.appendChunk(this.lastModelMessageBubble, chunk);
        }
    }

    /**
     * Adjusts the textarea height based on its content.
     */
    handleTextareaInput() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = `${this.messageInput.scrollHeight}px`;
    }

    /**
     * Toggles the loading state of the UI.
     * @param {boolean} isLoading The new loading state.
     */
    toggleLoading(isLoading) {
        this.messageInput.disabled = isLoading;
        this.sendButton.disabled = isLoading;
        if (isLoading) {
            this.sendButton.innerHTML = `<div class="spinner"></div>`;
        } else {
            this.sendButton.innerHTML = `<span class="material-symbols-outlined">send</span>`;
        }
    }
}

export default ChatUI;
