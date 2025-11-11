class ChatUI {
    constructor(engine) {
        this.engine = engine;
        this.cacheDOMElements();
        this.lastModelMessageElement = null;
    }

    /**
     * Caches references to frequently used DOM elements.
     */
    cacheDOMElements() {
        this.apiKeyModal = document.getElementById('api-key-modal');
        this.apiKeyForm = document.getElementById('api-key-form');
        this.apiKeyInput = document.getElementById('api-key-input');
        this.editApiKeyButton = document.getElementById('edit-api-key-button');
        this.appContainer = document.getElementById('app-container');
        this.messageList = document.getElementById('message-list');
        this.chatForm = document.getElementById('chat-form');
        this.messageInput = document.getElementById('message-input');
        this.sendButton = document.getElementById('send-button');
    }

    /**
     * Initializes the UI by binding event listeners.
     */
    init() {
        this.bindUserEvents();
        this.bindEngineEvents();
    }

    /**
     * Binds listeners to user-triggered DOM events.
     */
    bindUserEvents() {
        this.chatForm.addEventListener('submit', this.handleSendMessage.bind(this));
        this.apiKeyForm.addEventListener('submit', this.handleApiKeySave.bind(this));
        this.editApiKeyButton.addEventListener('click', () => this.showApiKeyModal(true));
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
        this.engine.on('init', ({ apiKey, messages }) => {
            this.showApiKeyModal(!apiKey);
            this.renderHistory(messages);
        });
        this.engine.on('apiKeySet', () => this.showApiKeyModal(false));
        this.engine.on('loading', this.toggleLoading.bind(this));
        this.engine.on('message', this.appendMessage.bind(this));
        this.engine.on('chunk', this.appendChunkToLastMessage.bind(this));
        this.engine.on('streamEnd', () => (this.lastModelMessageElement = null));
        this.engine.on('messageRemoved', this.removeLastMessage.bind(this));
        this.engine.on('error', this.displayTemporaryError.bind(this));
    }
    
    // --- Event Handlers ---

    handleSendMessage(e) {
        e.preventDefault();
        const userInput = this.messageInput.value.trim();
        if (userInput) {
            this.engine.sendMessage(userInput);
            this.messageInput.value = '';
            this.handleTextareaInput();
        }
    }

    handleApiKeySave(e) {
        e.preventDefault();
        const key = this.apiKeyInput.value.trim();
        if (key) {
            this.engine.setApiKey(key);
        }
    }

    handleTextareaInput() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = `${this.messageInput.scrollHeight}px`;
    }

    // --- DOM Rendering ---

    toggleLoading(isLoading) {
        this.messageInput.disabled = isLoading;
        this.sendButton.disabled = isLoading;
        if (isLoading) {
            this.sendButton.innerHTML = `<div class="spinner"></div>`;
        } else {
            this.sendButton.innerHTML = `<svg xmlns="http://www.w3.org/2000/svg" class="icon" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" /></svg>`;
        }
    }
    
    showApiKeyModal(show) {
        this.apiKeyModal.classList.toggle('hidden', !show);
        this.appContainer.classList.toggle('hidden', show);
        if(show) this.apiKeyInput.focus();
    }

    renderHistory(messages) {
        this.messageList.innerHTML = '';
        messages.forEach(msg => this.appendMessage(msg));
    }

    appendMessage(message) {
        const messageElement = this.createMessageElement(message);
        if (message.role === 'model') {
            this.lastModelMessageElement = messageElement.querySelector('.message-bubble');
            if (message.content.length === 0) {
                // This is a new, empty model message for streaming
                this.lastModelMessageElement.innerHTML = this.createTypingIndicator();
            }
        }
        this.messageList.appendChild(messageElement);
        this.scrollToBottom();
    }

    appendChunkToLastMessage(chunk) {
        if (this.lastModelMessageElement) {
            // First chunk replaces the typing indicator
            if (this.lastModelMessageElement.querySelector('.typing-indicator')) {
                this.lastModelMessageElement.innerHTML = '';
            }
            this.lastModelMessageElement.textContent += chunk;
            this.scrollToBottom();
        }
    }

    /**
     * آخرین پیام (معمولاً placeholder مدل) را از لیست پیام‌ها حذف می‌کند.
     */
    removeLastMessage() {
        if (this.messageList.lastChild) {
            this.messageList.removeChild(this.messageList.lastChild);
            this.lastModelMessageElement = null;
        }
    }

    /**
     * یک پیام خطا را به صورت موقت در UI نمایش می‌دهد.
     * @param {string} errorMessage - پیام خطا برای نمایش.
     */
    displayTemporaryError(errorMessage) {
        const errorWrapper = document.createElement('div');
        errorWrapper.className = 'error-message-wrapper';

        const errorBubble = document.createElement('div');
        errorBubble.className = 'error-message-bubble';
        errorBubble.textContent = errorMessage;

        errorWrapper.appendChild(errorBubble);
        this.messageList.appendChild(errorWrapper);
        this.scrollToBottom();

        // حذف پیام خطا پس از 5 ثانیه
        setTimeout(() => {
            errorWrapper.style.opacity = '0';
            errorWrapper.addEventListener('transitionend', () => {
                errorWrapper.remove();
            });
        }, 5000);
    }

    scrollToBottom() {
        const container = document.getElementById('chat-container');
        container.scrollTop = container.scrollHeight;
    }

    // --- Element Creators ---
    
    createMessageElement(message) {
        const wrapper = document.createElement('div');
        wrapper.className = `message-wrapper ${message.role}`;

        const icon = this.createIconElement(message.role);
        const bubble = document.createElement('div');
        bubble.className = `message-bubble ${message.role}`;
        bubble.textContent = message.content;
        
        if (message.role === 'user') {
            wrapper.append(bubble, icon);
        } else {
            wrapper.append(icon, bubble);
        }
        return wrapper;
    }

    createIconElement(role) {
        const iconWrapper = document.createElement('div');
        iconWrapper.className = `message-icon ${role}`;
        const userSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M16 7a4 4 0 11-8 0 4 4 0 018 0zM12 14a7 7 0 00-7 7h14a7 7 0 00-7-7z" /></svg>`;
        const modelSVG = `<svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" stroke="currentColor"><path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z" /></svg>`;
        iconWrapper.innerHTML = role === 'user' ? userSVG : modelSVG;
        return iconWrapper;
    }
    
    createTypingIndicator() {
        return `
            <div class="typing-indicator">
                <div class="dot-container">
                    <div class="dot"></div>
                    <div class="dot"></div>
                    <div class="dot"></div>
                </div>
            </div>`;
    }
}

export default ChatUI;