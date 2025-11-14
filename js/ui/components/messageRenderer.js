import markdownService from '../../services/markdownService.js';

/**
 * Manages rendering messages, typing indicators, and errors in the chat UI.
 */
class MessageRenderer {
    /**
     * @param {HTMLElement} messageListContainer The DOM element where messages are displayed.
     */
    constructor(messageListContainer) {
        this.container = messageListContainer;
    }

    /**
     * Renders the entire chat history.
     * @param {Array<object>} messages An array of message objects.
     */
    renderHistory(messages) {
        this.clearMessages();
        messages.forEach(msg => this.appendMessage(msg));
    }
    
    /**
     * Clears all messages from the display.
     */
    clearMessages() {
        this.container.innerHTML = '';
    }

    /**
     * Creates and appends a single message element to the container.
     * @param {object} message The message object { role, content, image? }.
     * @param {boolean} isStreamingPlaceholder - If true, renders a typing indicator.
     * @returns {HTMLElement | null} The message bubble element if created, otherwise null.
     */
    appendMessage(message, isStreamingPlaceholder = false) {
        const { element, bubble } = this.createMessageElement(message);
        
        if (message.role === 'user') {
            bubble.innerHTML = ''; // Clear default content

            if (message.image && message.image.data && message.image.mimeType) {
                const img = document.createElement('img');
                img.src = `data:${message.image.mimeType};base64,${message.image.data}`;
                img.alt = 'تصویر بارگذاری شده';
                img.className = 'message-image';

                // Handle image loading errors
                img.onerror = () => {
                    const errorSpan = document.createElement('span');
                    errorSpan.textContent = '⚠️ خطا در بارگذاری تصویر';
                    errorSpan.style.fontStyle = 'italic';
                    img.replaceWith(errorSpan);
                };

                bubble.appendChild(img);
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
                bubble.innerHTML = markdownService.render(message.content);
            }
        }

        this.container.appendChild(element);
        this.scrollToBottom();
        return bubble;
    }
    
    /**
     * Appends a chunk of text to the last message bubble during streaming and re-renders it as Markdown.
     * @param {HTMLElement} bubbleElement The message bubble element to update.
     * @param {string} chunk The piece of text to append.
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
        bubbleElement.innerHTML = markdownService.render(newContent);
        
        this.scrollToBottom();
    }

    /**
     * Removes the last message element from the container.
     */
    removeLastMessage() {
        if (this.container.lastChild) {
            this.container.removeChild(this.container.lastChild);
        }
    }

    /**
     * Displays a temporary error message in the chat.
     * @param {string} errorMessage The error message to display.
     */
    displayTemporaryError(errorMessage) {
        const errorWrapper = document.createElement('div');
        errorWrapper.className = 'error-message-wrapper';

        const errorBubble = document.createElement('div');
        errorBubble.className = 'error-message-bubble';
        errorBubble.textContent = errorMessage; // Use textContent for security

        errorWrapper.appendChild(errorBubble);
        this.container.appendChild(errorWrapper);
        this.scrollToBottom();

        setTimeout(() => {
            errorWrapper.style.opacity = '0';
            errorWrapper.addEventListener('transitionend', () => errorWrapper.remove());
        }, 5000);
    }
    
    /**
     * Displays the initial welcome message, rendered as Markdown.
     */
    showWelcomeMessage() {
        const welcomeText = 'سلام! امروز چطور می‌توانم به شما کمک کنم؟';
        const { element, bubble } = this.createMessageElement({
            role: 'assistant',
            content: welcomeText,
        });
        bubble.innerHTML = markdownService.render(welcomeText);

        this.container.innerHTML = '';
        this.container.appendChild(element);
    }

    /**
     * Scrolls the message container to the bottom.
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
     * Creates the DOM elements for a single message.
     * @param {object} message The message object.
     * @returns {{element: HTMLElement, bubble: HTMLElement}} The wrapper element and bubble element.
     */
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
        // Content is now set by the calling function (appendMessage, renderHistory, etc.)
    
        contentWrapper.append(label, bubble);
    
        if (message.role === 'user') {
            wrapper.append(avatar, contentWrapper);
        } else {
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
}

export default MessageRenderer;