import markdownService from '../../services/markdownService.js';
import { UI_TIMEOUTS } from '../../utils/constants.js';

/**
 * Manages rendering messages, typing indicators, and errors in the chat UI.
 */
class MessageRenderer {
    /**
     * @param {HTMLElement} messageListContainer The DOM element where messages are displayed.
     * @param {import('../chatUI.js').default} chatUI The main UI controller instance.
     */
    constructor(messageListContainer, chatUI) {
        this.container = messageListContainer;
        this.chatUI = chatUI;
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
     * @param {object} message The message object { id, role, content, image?, timestamp? }.
     * @param {boolean} isStreamingPlaceholder - If true, renders a typing indicator.
     * @returns {HTMLElement | null} The message bubble element if created, otherwise null.
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
                    if (this.chatUI) {
                        this.chatUI.showLightbox(img.src);
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
                bubble.innerHTML = markdownService.render(message.content);
                bubble.dataset.rawContent = message.content;
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
        }, UI_TIMEOUTS.ERROR_DISPLAY_MS);
    }
    
    /**
     * Displays the initial welcome message, rendered as Markdown.
     */
    showWelcomeMessage() {
        const welcomeText = 'سلام! امروز چطور می‌توانم به شما کمک کنم؟';
        const { element, bubble } = this.createMessageElement({
            id: `msg_welcome_${Date.now()}`,
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
}

export default MessageRenderer;