import markdownService from '../../services/markdownService.js';
import { UI_TIMEOUTS } from '../../utils/constants.js';

// JSDoc Type Imports
/** @typedef {import('../../types.js').Message} Message */
/** @typedef {import('./lightboxManager.js').default} LightboxManager */

/**
 * رندر کردن پیام‌ها، نشانگر تایپ و خطاها را در UI چت مدیریت می‌کند.
 */
class MessageRenderer {
    /**
     * @param {HTMLElement} messageListContainer - المان DOM که پیام‌ها در آن نمایش داده می‌شوند.
     * @param {LightboxManager} lightboxManager - The lightbox manager instance.
     */
    constructor(messageListContainer, lightboxManager) {
        this.container = messageListContainer;
        this.lightboxManager = lightboxManager;
    }

    /**
     * کل تاریخچه چت را رندر می‌کند.
     * @param {Array<Message>} messages - آرایه‌ای از آبجکت‌های پیام.
     */
    renderHistory(messages) {
        this.clearMessages();
        messages.forEach(msg => this.appendMessage(msg));
    }
    
    /**
     * تمام پیام‌ها را از صفحه پاک می‌کند.
     */
    clearMessages() {
        this.container.innerHTML = '';
    }

    /**
     * یک المان پیام جدید ایجاد کرده و به انتهای لیست اضافه می‌کند.
     * @param {Message} message - آبجکت پیام.
     * @param {boolean} [isStreamingPlaceholder=false] - اگر true باشد، یک نشانگر تایپ رندر می‌کند.
     * @returns {HTMLElement | null} - المان حباب پیام در صورت ایجاد، در غیر این صورت null.
     */
    appendMessage(message, isStreamingPlaceholder = false) {
        const { element, bubble } = this.createMessageElement(message);
        
        if (message.role === 'user') {
            bubble.innerHTML = ''; // Clear default content
            bubble.dataset.rawContent = message.content || '';

            if (message.image && message.image.data && message.image.mimeType) {
                const imageWrapper = document.createElement('div');
                imageWrapper.className = 'message-image-wrapper';

                const placeholder = document.createElement('div');
                placeholder.className = 'message-image-placeholder shimmer';
                imageWrapper.appendChild(placeholder);

                const img = document.createElement('img');
                img.src = `data:${message.image.mimeType};base64,${message.image.data}`;
                img.alt = 'تصویر بارگذاری شده';
                img.className = 'message-image';
                img.style.display = 'none'; // Hide until loaded
                imageWrapper.appendChild(img);

                img.onload = () => {
                    placeholder.remove();
                    img.style.display = 'block';
                };

                img.onerror = () => {
                    const errorSpan = document.createElement('span');
                    errorSpan.textContent = '⚠️ خطا در بارگذاری تصویر';
                    errorSpan.className = 'message-image-error';
                    imageWrapper.innerHTML = '';
                    imageWrapper.appendChild(errorSpan);
                };

                img.addEventListener('click', () => {
                    if (this.lightboxManager) {
                        this.lightboxManager.show(img.src);
                    }
                });
                
                bubble.appendChild(imageWrapper);
            }
            
            if (message.content) {
                const textNode = document.createElement('div');
                textNode.textContent = message.content;
                textNode.style.whiteSpace = 'pre-wrap';
                bubble.appendChild(textNode);
            }
        } else { // assistant
            if (isStreamingPlaceholder) {
                bubble.innerHTML = this.createTypingIndicator();
                bubble.dataset.rawContent = '';
            } else {
                const content = message.content;
                bubble.dataset.rawContent = content;
                // Render with markdown if available, otherwise render plain text and mark for re-render
                bubble.innerHTML = markdownService.render(content);
                if (!markdownService.isLoaded()) {
                    bubble.dataset.needsMarkdown = 'true';
                    this._ensureMarkdownIsLoadedAndRerender();
                }
            }
        }

        this.container.appendChild(element);
        this.scrollToBottom();
        return bubble;
    }
    
    /**
     * یک قطعه متن را به آخرین حباب پیام در حین استریم اضافه کرده و آن را به صورت Markdown مجدداً رندر می‌کند.
     * @param {HTMLElement} bubbleElement - المان حباب پیام برای به‌روزرسانی.
     * @param {string} chunk - قطعه متنی برای اضافه کردن.
     */
    appendChunk(bubbleElement, chunk) {
        // On the first chunk, remove the typing indicator
        if (bubbleElement.querySelector('.typing-indicator')) {
            bubbleElement.innerHTML = '';
        }
        
        // Append new text to raw content and re-render the whole bubble
        const currentContent = bubbleElement.dataset.rawContent || '';
        const newContent = currentContent + chunk;
        bubbleElement.dataset.rawContent = newContent;
        
        // Render with markdown if available, otherwise plain text and trigger load.
        bubbleElement.innerHTML = markdownService.render(newContent);
        if (!markdownService.isLoaded()) {
            bubbleElement.dataset.needsMarkdown = 'true';
            this._ensureMarkdownIsLoadedAndRerender();
        }
        
        this.scrollToBottom();
    }

    /**
     * آخرین المان پیام را از کانتینر حذف می‌کند.
     */
    removeLastMessage() {
        if (this.container.lastChild) {
            this.container.removeChild(this.container.lastChild);
        }
    }

    /**
     * یک پیام خطای موقت در چت نمایش می‌دهد.
     * @param {string} errorMessage - پیام خطا برای نمایش.
     */
    displayTemporaryError(errorMessage) {
        const wrapper = document.createElement('div');
        wrapper.className = 'system-message-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'system-message-bubble error';
        bubble.textContent = errorMessage; // Use textContent for security

        wrapper.appendChild(bubble);
        this.container.appendChild(wrapper);
        this.scrollToBottom();

        setTimeout(() => {
            wrapper.style.opacity = '0';
            wrapper.addEventListener('transitionend', () => wrapper.remove());
        }, UI_TIMEOUTS.ERROR_DISPLAY_MS);
    }
    
    /**
     * یک پیام موفقیت‌آمیز موقت در چت نمایش می‌دهد.
     * @param {string} successMessage - پیام موفقیت برای نمایش.
     */
    displayTemporarySuccess(successMessage) {
        const wrapper = document.createElement('div');
        wrapper.className = 'system-message-wrapper';

        const bubble = document.createElement('div');
        bubble.className = 'system-message-bubble success';
        bubble.textContent = successMessage;

        wrapper.appendChild(bubble);
        this.container.appendChild(wrapper);
        this.scrollToBottom();

        setTimeout(() => {
            wrapper.style.opacity = '0';
            wrapper.addEventListener('transitionend', () => wrapper.remove());
        }, UI_TIMEOUTS.ERROR_DISPLAY_MS);
    }
    
    /**
     * پیام خوشامدگویی اولیه را نمایش می‌دهد.
     */
    showWelcomeMessage() {
        const welcomeText = 'سلام! امروز چطور می‌توانم به شما کمک کنم؟';
        const { element, bubble } = this.createMessageElement({
            id: `msg_welcome_${Date.now()}`,
            role: 'assistant',
            content: welcomeText,
        });
        
        this.clearMessages();
        this.container.appendChild(element);

        bubble.dataset.rawContent = welcomeText;
        bubble.innerHTML = markdownService.render(welcomeText);
        // If markdown-it isn't loaded yet, this will render as plain text.
        // We'll mark it for re-rendering when the library becomes available.
        if (!markdownService.isLoaded()) {
            bubble.dataset.needsMarkdown = 'true';
            this._ensureMarkdownIsLoadedAndRerender();
        }
    }

    /**
     * محفظه پیام‌ها را به پایین اسکرول می‌کند.
     */
    scrollToBottom() {
        const chatArea = this.container.parentElement;
        if (chatArea) {
            // A small delay can help if images are being loaded
            setTimeout(() => {
                chatArea.scrollTop = chatArea.scrollHeight;
            }, 50);
        }
    }

    // --- Element Creators ---
    
    /**
     * المان‌های DOM برای یک پیام واحد را ایجاد می‌کند.
     * @param {Message} message - آبجکت پیام.
     * @returns {{element: HTMLElement, bubble: HTMLElement}} - المان کلی و المان حباب پیام.
     */
    createMessageElement(message) {
        const wrapper = document.createElement('div');
        wrapper.className = `message ${message.role === 'user' ? 'user' : 'assistant'}`;
        wrapper.dataset.messageId = message.id;

        const avatar = document.createElement('div');
        avatar.className = 'message-avatar';
    
        const contentWrapper = document.createElement('div');
        contentWrapper.className = 'message-content';
    
        const label = document.createElement('p');
        label.className = 'message-label';
        label.textContent = message.role === 'user' ? 'شما' : 'دستیار هوش مصنوعی';
    
        const bubble = document.createElement('div');
        bubble.className = 'message-bubble';
        // Content is now set by the calling function (appendMessage, renderHistory, etc.)
    
        contentWrapper.append(label, bubble);

        // Create the copy button. For user messages, only if there's text.
        // For assistant messages, always create it to handle streamed content.
        let copyButton = null;
        if (message.content || message.role !== 'user') {
            copyButton = document.createElement('button');
            copyButton.className = 'copy-button';
            copyButton.title = 'رونوشت';
            copyButton.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
            copyButton.addEventListener('click', () => this.handleCopy(copyButton, message.id));
        }
    
        if (message.role === 'user') {
            wrapper.append(avatar, contentWrapper);
            if (copyButton) wrapper.append(copyButton);
        } else {
            if (copyButton) wrapper.append(copyButton);
            wrapper.append(contentWrapper, avatar);
        }
    
        return { element: wrapper, bubble };
    }
    
    /**
     * Creates the HTML string for the typing indicator.
     * @returns {string} HTML string.
     */
    createTypingIndicator() {
        return `<div class="typing-indicator"><div class="dot-container"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    }

    /**
     * Handles the click event for the copy button on a message.
     * @param {HTMLButtonElement} button The button element that was clicked.
     * @param {string} messageId The ID of the message to copy.
     */
    async handleCopy(button, messageId) {
        const wrapper = this.container.querySelector(`[data-message-id="${messageId}"]`);
        if (!wrapper) {
            console.error('Could not find message element for ID:', messageId);
            return;
        }

        const bubble = wrapper.querySelector('.message-bubble');
        if (!bubble) {
            console.error('Could not find message bubble for ID:', messageId);
            return;
        }
        
        const textToCopy = bubble.dataset.rawContent;

        if (textToCopy === undefined || textToCopy === null || textToCopy.trim() === '') return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            
            // Visual feedback
            button.innerHTML = `<span class="material-symbols-outlined">check</span>`;
            button.classList.add('copied');
            button.disabled = true;

            // Revert after 3 seconds
            setTimeout(() => {
                button.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
                button.classList.remove('copied');
                button.disabled = false;
            }, UI_TIMEOUTS.COPY_FEEDBACK_MS);

        } catch (err) {
            console.error('Failed to copy text: ', err);
            button.title = 'رونوشت ناموفق بود';
            setTimeout(() => { button.title = 'رونوشت'; }, 2000);
        }
    }

    /**
     * Finds all messages that were rendered as plain text and re-renders them
     * with the fully loaded markdown parser.
     */
    rerenderUnprocessedMessages() {
        if (!markdownService.isLoaded()) return;

        const messagesToUpdate = this.container.querySelectorAll('[data-needs-markdown="true"]');
        if (messagesToUpdate.length === 0) return;

        const wasScrolledToBottom = this.isScrolledToBottom();

        messagesToUpdate.forEach(bubble => {
            const rawContent = bubble.dataset.rawContent;
            if (rawContent) {
                bubble.innerHTML = markdownService.render(rawContent);
                delete bubble.dataset.needsMarkdown;
            }
        });

        // If the user was at the bottom of the chat, keep them there after re-render.
        if (wasScrolledToBottom) {
            this.scrollToBottom();
        }
    }

    /**
     * Checks if the user is scrolled to the bottom of the chat area.
     * @returns {boolean}
     */
    isScrolledToBottom() {
        const chatArea = this.container.parentElement;
        if (!chatArea) return false;
        // A threshold of a few pixels to account for rounding errors.
        const threshold = 10; 
        return chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight < threshold;
    }

    /**
     * Ensures the markdown library is loaded if needed, and schedules a re-render.
     * @private
     */
    _ensureMarkdownIsLoadedAndRerender() {
        if (!markdownService.isLoaded()) {
            // The load function is idempotent, so it's safe to call multiple times.
            // It will only trigger the import once.
            markdownService.load().then(() => {
                this.rerenderUnprocessedMessages();
            });
        }
    }
}

export default MessageRenderer;