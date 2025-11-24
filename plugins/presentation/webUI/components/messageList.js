import Component from '../component.js';
import markdownService from '../utils/markdownService.js';

export default class MessageList extends Component {
    constructor(peik, uiManager) {
        super(peik, uiManager);
        this.container = null;
        this.unprocessedMessages = new Set();
        this.activeChat = null;

        // Bind handlers
        this.handleMessageSent = this.handleMessageSent.bind(this);
        this.handleChunk = this.handleChunk.bind(this);
        this.handleCoreError = this.handleCoreError.bind(this);
    }

    async init() {
        this.container = document.getElementById('message-list');
        
        // شروع بارگذاری سرویس مارک‌داون
        markdownService.load().then(() => {
            this.rerenderUnprocessedMessages();
        });

        // گوش دادن به خطاهای کلی برای نمایش
        this.peik.on('error', this.handleCoreError);
    }

    /**
     * وقتی چت تغییر می‌کند، باید لیسنرهای چت قبلی را حذف و به چت جدید متصل شویم.
     */
    onChatChanged(newChat, oldChat) {
        if (oldChat) {
            this._unbindChatEvents(oldChat);
        }

        this.clear();
        this.activeChat = newChat;

        if (newChat) {
            this.renderHistory(newChat.messages);
            this._bindChatEvents(newChat);
        }
    }

    _bindChatEvents(chat) {
        chat.on('message:sent', this.handleMessageSent);
        chat.on('chunk', this.handleChunk);
    }

    _unbindChatEvents(chat) {
        chat.off('message:sent', this.handleMessageSent);
        chat.off('chunk', this.handleChunk);
    }

    // --- Event Handlers ---

    handleMessageSent(msg) {
        this.appendMessage(msg);
    }

    handleChunk({ messageId, chunk }) {
        this.appendChunk(messageId, chunk);
    }

    handleCoreError(err) {
        this.displayTemporaryError(err.message || err.toString());
    }

    // --- Rendering Logic ---

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.unprocessedMessages.clear();
    }

    renderHistory(messages) {
        if (messages) {
            messages.forEach(msg => this.appendMessage(msg));
        }
    }

    appendMessage(message) {
        if (!this.container || this.container.querySelector(`[data-id="${message.id}"]`)) return;

        const { element, bubble } = this._createMessageElement(message);
        this.container.appendChild(element);
        
        if (!markdownService.isLoaded()) {
            this.unprocessedMessages.add(bubble);
        }

        this.scrollToBottom();
    }

    appendChunk(messageId, chunk) {
        if (!this.container) return;
        
        let el = this.container.querySelector(`[data-id="${messageId}"]`);
        if (!el) {
            this.appendMessage({ id: messageId, role: 'model', content: '' });
            el = this.container.querySelector(`[data-id="${messageId}"]`);
        }

        const bubble = el.querySelector('.message-bubble');
        const currentRaw = bubble.dataset.raw || '';
        const newRaw = currentRaw + chunk;
        bubble.dataset.raw = newRaw;
        
        if (currentRaw === '') {
            bubble.innerHTML = ''; 
        }

        const contentDiv = bubble.querySelector('.content-text');
        const target = contentDiv || bubble;
        
        target.innerHTML = this._renderContent(newRaw);
        
        if (!markdownService.isLoaded()) {
            bubble.dataset.needsMarkdown = 'true';
            this.unprocessedMessages.add(bubble);
        }
        
        this.scrollToBottom();
    }

    _createMessageElement(message) {
        const roleClass = message.role === 'model' ? 'assistant' : 'user';
        const labelText = message.role === 'user' ? 'شما' : 'دستیار هوش مصنوعی';
        
        const wrapper = document.createElement('div');
        wrapper.className = `message ${roleClass}`;
        wrapper.dataset.id = message.id;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';

        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content';

        const label = document.createElement('p');
        label.className = 'message-label';
        label.textContent = labelText;

        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        let content = message.content || '';
        bubble.dataset.raw = content;

        if (!content && message.role === 'model') {
            bubble.innerHTML = '<div class="typing-indicator"><div class="dot-container"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>';
        } else {
            const contentDiv = document.createElement('div');
            contentDiv.className = 'content-text';
            contentDiv.innerHTML = this._renderContent(content);
            bubble.appendChild(contentDiv);

            if (!markdownService.isLoaded()) {
                bubble.dataset.needsMarkdown = 'true';
            }
        }

        if (message.role === 'user' && message.image) {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'message-image-wrapper';
            
            const img = document.createElement('img');
            img.src = `data:${message.image.mimeType};base64,${message.image.data}`;
            img.className = 'message-image';
            
            // دریافت لایت‌باکس از UIManager (روش جدید)
            const lightbox = this.uiManager.getComponent('lightbox');
            if (lightbox) {
                img.style.cursor = 'zoom-in';
                img.addEventListener('click', () => {
                    lightbox.show(img.src);
                });
            }

            imgWrapper.appendChild(img);
            bubble.prepend(imgWrapper);
        }

        const copyBtn = document.createElement('button');
        copyBtn.className = 'copy-button';
        copyBtn.title = 'رونوشت پیام';
        copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.2rem;">content_copy</span>';
        
        copyBtn.addEventListener('click', async () => {
            const textToCopy = bubble.dataset.raw || '';
            if (!textToCopy) return;

            try {
                await navigator.clipboard.writeText(textToCopy);
                copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.2rem;">check</span>';
                copyBtn.classList.add('copied');
                
                setTimeout(() => {
                    copyBtn.innerHTML = '<span class="material-symbols-outlined" style="font-size: 1.2rem;">content_copy</span>';
                    copyBtn.classList.remove('copied');
                }, 2000);
            } catch (err) {
                console.error('Failed to copy:', err);
            }
        });

        contentWrapper.appendChild(label);
        contentWrapper.appendChild(bubble);
        contentWrapper.appendChild(copyBtn);

        if (message.role === 'user') {
            wrapper.appendChild(avatar);
            wrapper.appendChild(contentWrapper);
        } else {
            wrapper.appendChild(contentWrapper);
            wrapper.appendChild(avatar);
        }

        return { element: wrapper, bubble };
    }

    _renderContent(text) {
        return markdownService.render(text);
    }

    rerenderUnprocessedMessages() {
        if (!markdownService.isLoaded() || !this.container) return;

        const bubbles = this.container.querySelectorAll('[data-needs-markdown="true"]');
        bubbles.forEach(bubble => {
            const raw = bubble.dataset.raw;
            if (raw) {
                const target = bubble.querySelector('.content-text') || bubble;
                target.innerHTML = markdownService.render(raw);
                delete bubble.dataset.needsMarkdown;
            }
        });
    }

    scrollToBottom() {
        if (this.container && this.container.parentElement) {
            this.container.parentElement.scrollTop = this.container.parentElement.scrollHeight;
        }
    }

    displayTemporaryError(msg) {
        if (!this.container) return;
        const el = document.createElement('div');
        el.className = 'system-message-wrapper';
        el.innerHTML = `<div class="system-message-bubble error">${msg}</div>`;
        this.container.appendChild(el);
        this.scrollToBottom();
        setTimeout(() => el.remove(), 5000);
    }

    destroy() {
        if (this.activeChat) {
            this._unbindChatEvents(this.activeChat);
        }
        this.peik.off('error', this.handleCoreError);
        this.clear();
        this.container = null;
    }
}