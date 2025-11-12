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
        this.settingsModal = document.getElementById('settings-modal');
        this.settingsForm = document.getElementById('settings-form');
        this.cancelSettingsButton = document.getElementById('cancel-settings-button');
        
        // Gemini fields
        this.geminiModelInput = document.getElementById('gemini-model-input');
        this.geminiKeyInput = document.getElementById('gemini-key-input');
        this.geminiKeyToggle = document.getElementById('gemini-key-toggle');

        // ChatGPT fields
        this.chatgptModelInput = document.getElementById('chatgpt-model-input');
        this.chatgptKeyInput = document.getElementById('chatgpt-key-input');
        this.chatgptKeyToggle = document.getElementById('chatgpt-key-toggle');

        // Custom fields
        this.customModelInput = document.getElementById('custom-model-input');
        this.customKeyInput = document.getElementById('custom-key-input');
        this.customKeyToggle = document.getElementById('custom-key-toggle');
        this.customEndpointInput = document.getElementById('custom-endpoint-input');
        
        this.appContainer = document.getElementById('app-container');
        this.editSettingsButton = document.getElementById('edit-settings-button');
        this.sidebar = document.querySelector('.sidebar');
        this.menuToggleButton = document.getElementById('menu-toggle-button');

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
        this.settingsForm.addEventListener('submit', this.handleSettingsSave.bind(this));
        this.editSettingsButton.addEventListener('click', () => this.showSettingsModal(true));
        this.cancelSettingsButton.addEventListener('click', () => this.showSettingsModal(false));
        this.menuToggleButton.addEventListener('click', this.toggleSidebar.bind(this));
        
        // Password visibility toggles
        this.geminiKeyToggle.addEventListener('click', () => this.togglePasswordVisibility(this.geminiKeyInput, this.geminiKeyToggle));
        this.chatgptKeyToggle.addEventListener('click', () => this.togglePasswordVisibility(this.chatgptKeyInput, this.chatgptKeyToggle));
        this.customKeyToggle.addEventListener('click', () => this.togglePasswordVisibility(this.customKeyInput, this.customKeyToggle));


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
            this.showSettingsModal(!settings || !settings.apiKey);
            if (settings && messages.length > 0) {
                this.renderHistory(messages);
            }
        });
        this.engine.on('settingsSaved', () => this.showSettingsModal(false));
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
            // Clear welcome message on first user message if it exists
            if (this.engine.messages.length === 0) {
                this.messageList.innerHTML = '';
            }
            this.engine.sendMessage(userInput);
            this.messageInput.value = '';
            this.handleTextareaInput();
        }
    }

    handleSettingsSave(e) {
        e.preventDefault();
        
        const geminiModel = this.geminiModelInput.value.trim();
        const geminiKey = this.geminiKeyInput.value.trim();
        const chatgptModel = this.chatgptModelInput.value.trim();
        const chatgptKey = this.chatgptKeyInput.value.trim();
        const customModel = this.customModelInput.value.trim();
        const customKey = this.customKeyInput.value.trim(); // Key can be optional
        const customEndpoint = this.customEndpointInput.value.trim();

        let settingsToSave = null;

        // Save based on the first section that is filled
        if (geminiModel && geminiKey) {
            settingsToSave = { provider: 'gemini', modelName: geminiModel, apiKey: geminiKey };
        } else if (chatgptModel && chatgptKey) {
            settingsToSave = { provider: 'openai', modelName: chatgptModel, apiKey: chatgptKey };
        } else if (customModel && customEndpoint) {
            if (!customEndpoint.startsWith('http')) {
                alert('لطفاً یک آدرس API معتبر برای حالت سفارشی وارد کنید.');
                return;
            }
            settingsToSave = { provider: 'custom', modelName: customModel, apiKey: customKey, endpointUrl: customEndpoint };
        } else {
            alert('لطفاً حداقل اطلاعات یکی از ارائه‌دهندگان را به طور کامل وارد کنید.');
            return;
        }

        if (settingsToSave) {
            this.engine.saveSettings(settingsToSave);
        }
    }

    handleTextareaInput() {
        this.messageInput.style.height = 'auto';
        this.messageInput.style.height = `${this.messageInput.scrollHeight}px`;
    }
    
    toggleSidebar() {
        this.sidebar.classList.toggle('open');
    }

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

    // --- DOM Rendering ---

    toggleLoading(isLoading) {
        this.messageInput.disabled = isLoading;
        this.sendButton.disabled = isLoading;
        if (isLoading) {
            this.sendButton.innerHTML = `<div class="spinner"></div>`;
        } else {
            this.sendButton.innerHTML = `<span class="material-symbols-outlined">send</span>`;
        }
    }
    
    showSettingsModal(show) {
        this.settingsModal.classList.toggle('hidden', !show);
        this.appContainer.classList.toggle('hidden', show);
        if(show) {
            this.populateSettingsForm();
        } else if (this.engine.messages.length === 0) {
             this.messageList.innerHTML = this.createWelcomeMessage();
        }
    }

    populateSettingsForm() {
        // Clear all fields first
        this.geminiModelInput.value = '';
        this.geminiKeyInput.value = '';
        this.chatgptModelInput.value = '';
        this.chatgptKeyInput.value = '';
        this.customModelInput.value = '';
        this.customKeyInput.value = '';
        this.customEndpointInput.value = '';

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
            // Default placeholder if no settings exist
            this.geminiModelInput.value = 'gemini-2.5-flash';
        }
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
                this.lastModelMessageElement.innerHTML = this.createTypingIndicator();
            }
        }
        this.messageList.appendChild(messageElement);
        this.scrollToBottom();
    }

    appendChunkToLastMessage(chunk) {
        if (this.lastModelMessageElement) {
            if (this.lastModelMessageElement.querySelector('.typing-indicator')) {
                this.lastModelMessageElement.innerHTML = '';
            }
            this.lastModelMessageElement.textContent += chunk;
            this.scrollToBottom();
        }
    }

    removeLastMessage() {
        if (this.messageList.lastChild) {
            this.messageList.removeChild(this.messageList.lastChild);
            this.lastModelMessageElement = null;
        }
    }

    displayTemporaryError(errorMessage) {
        const errorWrapper = document.createElement('div');
        errorWrapper.className = 'error-message-wrapper';
        const errorBubble = document.createElement('div');
        errorBubble.className = 'error-message-bubble';
        errorBubble.textContent = errorMessage;
        errorWrapper.appendChild(errorBubble);
        this.messageList.appendChild(errorWrapper);
        this.scrollToBottom();

        setTimeout(() => {
            errorWrapper.style.opacity = '0';
            errorWrapper.addEventListener('transitionend', () => errorWrapper.remove());
        }, 5000);
    }

    scrollToBottom() {
        const container = document.querySelector('.chat-area');
        container.scrollTop = container.scrollHeight;
    }

    // --- Element Creators ---
    
    createMessageElement(message) {
        const wrapper = document.createElement('div');
        wrapper.className = `message ${message.role === 'user' ? 'user' : 'assistant'}`;
    
        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
    
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content';
    
        const label = document.createElement('p');
        label.className = 'message-label';
        label.textContent = message.role === 'user' ? 'شما' : 'دستیار هوش مصنوعی';
    
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        bubble.textContent = message.content;
    
        contentWrapper.append(label, bubble);
    
        // In an RTL layout with `display: flex`, the first DOM element is placed on the right.
        if (message.role === 'user') {
            // User messages: Visual order [bubble] [avatar]. DOM order needs to be [avatar] [bubble].
            wrapper.append(avatar, contentWrapper);
        } else {
            // Assistant messages: Visual order [avatar] [bubble]. DOM order needs to be [bubble] [avatar].
            wrapper.append(contentWrapper, avatar);
        }
    
        return wrapper;
    }
    
    createTypingIndicator() {
        return `<div class="typing-indicator"><div class="dot-container"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    }

    createWelcomeMessage() {
        return `<div class="message assistant">
            <div class="message-content">
                <p class="message-label">دستیار هوش مصنوعی</p>
                <div class="message-bubble">
                    سلام! امروز چطور می‌توانم به شما کمک کنم؟
                </div>
            </div>
            <div class="message-avatar"></div>
        </div>`;
    }
}

export default ChatUI;