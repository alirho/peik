import markdownService from '../../../../js/services/markdownService.js';

export default class MessageList {
    constructor(container) {
        this.container = container;
    }

    clear() {
        this.container.innerHTML = '';
    }

    renderHistory(messages) {
        this.clear();
        if (messages) {
            messages.forEach(msg => this.appendMessage(msg));
        }
    }

    appendMessage(message) {
        if (this.container.querySelector(`[data-id="${message.id}"]`)) return;

        const el = document.createElement('div');
        el.className = `message ${message.role}`;
        el.dataset.id = message.id;
        
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        
        let content = message.content || '';
        if (!content && message.role === 'model') {
            content = '<span class="typing-indicator">...</span>';
        } else {
            content = this._renderContent(content);
        }
        bubble.innerHTML = content;

        if (message.role === 'user' && message.image) {
            const img = document.createElement('img');
            img.src = `data:${message.image.mimeType};base64,${message.image.data}`;
            img.className = 'message-image';
            el.appendChild(img);
        }

        el.appendChild(bubble);
        this.container.appendChild(el);
        this.scrollToBottom();
    }

    appendChunk(messageId, chunk) {
        let el = this.container.querySelector(`[data-id="${messageId}"]`);
        if (!el) {
            this.appendMessage({ id: messageId, role: 'model', content: '' });
            el = this.container.querySelector(`[data-id="${messageId}"]`);
        }

        const bubble = el.querySelector('.message-bubble');
        const currentRaw = bubble.dataset.raw || '';
        const newRaw = currentRaw + chunk;
        bubble.dataset.raw = newRaw;
        
        bubble.innerHTML = this._renderContent(newRaw);
        this.scrollToBottom();
    }

    _renderContent(text) {
        return markdownService.render(text);
    }

    scrollToBottom() {
        if (this.container.parentElement) {
            this.container.parentElement.scrollTop = this.container.parentElement.scrollHeight;
        }
    }

    displayTemporaryError(msg) {
        const el = document.createElement('div');
        el.className = 'system-message-wrapper';
        el.innerHTML = `<div class="system-message-bubble error">${msg}</div>`;
        this.container.appendChild(el);
        this.scrollToBottom();
        setTimeout(() => el.remove(), 5000);
    }
}