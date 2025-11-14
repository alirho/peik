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
        this.attachedImage = null;
        
        this.dom = {
            chatForm: null,
            messageInput: null,
            sendButton: null,
            messageList: null,
            newChatButton: null,
            mainTitle: null,
            attachFileButton: null,
            fileInput: null,
            imagePreviewContainer: null,
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
        this.dom.attachFileButton = document.getElementById('attach-file-button');
        this.dom.fileInput = document.getElementById('file-input');
        this.dom.imagePreviewContainer = document.getElementById('image-preview-container');
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
        
        this.dom.attachFileButton.addEventListener('click', () => this.dom.fileInput.click());
        this.dom.fileInput.addEventListener('change', this.handleFileSelect.bind(this));
        
        this.dom.messageInput.addEventListener('input', () => {
            const el = this.dom.messageInput;
            el.style.height = 'auto';
            el.style.height = `${el.scrollHeight}px`;
        });
    }

    handleFileSelect(event) {
        const file = event.target.files[0];
        if (!file) return;

        this.dom.fileInput.value = '';

        if (!file.type.startsWith('image/')) {
            this.engine.emit('error', 'لطفاً فقط فایل‌های تصویری را انتخاب کنید.');
            return;
        }

        const MAX_FILE_SIZE_MB = 10;
        if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
            this.engine.emit('error', `حجم فایل نباید بیشتر از ${MAX_FILE_SIZE_MB} مگابایت باشد.`);
            return;
        }

        const reader = new FileReader();
        reader.onload = (e) => {
            this.attachedImage = {
                data: e.target.result.split(',')[1],
                mimeType: file.type,
            };
            this.renderPreview();
        };
        reader.onerror = () => {
            this.engine.emit('error', 'خطایی در خواندن فایل رخ داد.');
            this.clearPreview();
        };
        reader.readAsDataURL(file);
    }
    
    renderPreview() {
        if (!this.attachedImage) {
            this.dom.imagePreviewContainer.classList.add('hidden');
            this.dom.imagePreviewContainer.innerHTML = '';
            return;
        }

        this.dom.imagePreviewContainer.innerHTML = ''; // Clear previous content

        const img = document.createElement('img');
        img.src = `data:${this.attachedImage.mimeType};base64,${this.attachedImage.data}`;
        img.alt = 'Preview';
        img.className = 'preview-image';

        img.onload = () => {
            // Image loaded successfully, show the preview
            const removeButton = document.createElement('button');
            removeButton.className = 'preview-remove-button';
            removeButton.title = 'حذف تصویر';
            removeButton.textContent = '×';
            removeButton.addEventListener('click', () => this.clearPreview());

            this.dom.imagePreviewContainer.appendChild(img);
            this.dom.imagePreviewContainer.appendChild(removeButton);
            this.dom.imagePreviewContainer.classList.remove('hidden');
        };

        img.onerror = () => {
            // Image failed to load
            this.clearPreview();
            this.engine.emit('error', 'خطا در نمایش پیش‌نمایش تصویر');
        };
    }

    clearPreview() {
        this.attachedImage = null;
        this.dom.fileInput.value = ''; // Ensure file can be re-selected
        this.renderPreview();
    }
    
    handleSendMessage() {
        const userInput = this.dom.messageInput.value.trim();
        const image = this.attachedImage;

        if (userInput || image) {
            this.engine.sendMessage(userInput, image);
            this.dom.messageInput.value = '';
            this.dom.messageInput.style.height = 'auto';
            this.dom.messageInput.focus();
            this.clearPreview();
        }
    }

    updateChatView(chat) {
        if (!chat) return;
        this.clearPreview();
        this.dom.mainTitle.textContent = chat.title;
        if (chat.messages.length > 0) {
            this.messageRenderer.renderHistory(chat.messages);
        } else {
            this.messageRenderer.showWelcomeMessage();
        }
    }
    
    updateSendButtonState(isLoading = this.engine.isLoading) {
        const button = this.dom.sendButton;
        const attachButton = this.dom.attachFileButton;
        if (isLoading) {
            button.disabled = true;
            attachButton.disabled = true;
            button.innerHTML = '<div class="spinner"></div>';
        } else {
            button.disabled = false;
            attachButton.disabled = false;
            button.innerHTML = '<span class="material-symbols-outlined">send</span>';
        }
    }
}

export default ChatUI;