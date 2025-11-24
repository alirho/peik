import markdownService from '../utils/markdownService.js';

export default class MessageList {
    constructor(container, lightboxManager) {
        this.container = container;
        this.lightboxManager = lightboxManager;
        this.unprocessedMessages = new Set();

        // شروع بارگذاری سرویس مارک‌داون
        markdownService.load().then(() => {
            this.rerenderUnprocessedMessages();
        });
    }

    clear() {
        if (this.container) {
            this.container.innerHTML = '';
        }
        this.unprocessedMessages.clear();
    }

    renderHistory(messages) {
        this.clear();
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
        }

        if (message.role === 'user' && message.image) {
            const imgWrapper = document.createElement('div');
            imgWrapper.className = 'message-image-wrapper';
            
            const img = document.createElement('img');
            img.src = `data:${message.image.mimeType};base64,${message.image.data}`;
            img.className = 'message-image';
            
            if (this.lightboxManager) {
                img.style.cursor = 'zoom-in';
                img.addEventListener('click', () => {
                    this.lightboxManager.show(img.src);
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
        if (!markdownService.isLoaded()) return;

        // استفاده از Set برای رندر فقط پیام‌های پردازش نشده بدون کوئری زدن به DOM
        this.unprocessedMessages.forEach(bubble => {
            const raw = bubble.dataset.raw;
            if (raw) {
                const target = bubble.querySelector('.content-text') || bubble;
                target.innerHTML = markdownService.render(raw);
            }
        });
        this.unprocessedMessages.clear();
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
        this.clear();
        this.container = null;
        this.lightboxManager = null;
        if (this.unprocessedMessages) {
            this.unprocessedMessages.clear();
            this.unprocessedMessages = null;
        }
    }
}