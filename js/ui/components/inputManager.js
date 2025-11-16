// JSDoc Type Imports
/** @typedef {import('../../types.js').ImageData} ImageData */
/** @typedef {import('./fileManager.js').default} FileManager */

/**
 * Manages the user input area, including text, attachments, previews, and send button state.
 */
class InputManager {
    /**
     * @param {FileManager} fileManager - The file manager instance.
     * @param {function(string, ImageData | null): void} onSendMessage - Callback to send the message.
     */
    constructor(fileManager, onSendMessage) {
        this.fileManager = fileManager;
        this.onSendMessage = onSendMessage;
        
        /** @type {ImageData | null} */
        this.attachedImage = null;
        this.isSubmitting = false;

        this.cacheDOMElements();
        this.bindEvents();
    }

    cacheDOMElements() {
        this.dom = {
            chatForm: document.getElementById('chat-form'),
            messageInput: document.getElementById('message-input'),
            sendButton: document.getElementById('send-button'),
            attachFileButton: document.getElementById('attach-file-button'),
            imagePreviewContainer: document.getElementById('image-preview-container'),
        };
    }

    bindEvents() {
        this.dom.chatForm.addEventListener('submit', (e) => {
            e.preventDefault();
            this.submit();
        });

        this.dom.messageInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.submit();
            }
        });

        this.dom.attachFileButton.addEventListener('click', () => this.fileManager.trigger());

        this.dom.messageInput.addEventListener('input', () => {
            this.autoResizeTextarea();
        });
    }

    /**
     * Handles the submission of the input form.
     */
    submit() {
        if (this.isSubmitting) return;

        const userInput = this.dom.messageInput.value.trim();
        const image = this.attachedImage;
        
        if (!userInput && !image) {
            return; // Prevent sending empty messages
        }

        this.isSubmitting = true;
        this.updateSendButtonState(true); // Visually indicate loading immediately

        // Safety timeout to prevent the UI from getting stuck in a submitting state
        setTimeout(() => {
            if (this.isSubmitting) {
                console.warn('Submission safety timeout triggered. Resetting UI state.');
                this.updateSendButtonState(false);
            }
        }, 30000); // 30 seconds

        this.onSendMessage(userInput, image);
    }

    /**
     * Resets the input area to its initial state.
     */
    reset() {
        this.dom.messageInput.value = '';
        this.autoResizeTextarea();
        this.clearPreview();
        this.focus();
    }
    
    focus() {
        this.dom.messageInput.focus();
    }
    
    autoResizeTextarea() {
        const el = this.dom.messageInput;
        el.style.height = 'auto';
        el.style.height = `${el.scrollHeight}px`;
    }

    /**
     * Sets the processed image and renders its preview.
     * @param {ImageData} imageData - The processed image data.
     */
    setAndPreviewImage(imageData) {
        this.attachedImage = imageData;
        this.renderPreview();
    }

    /**
     * Renders the preview for the currently attached image.
     */
    renderPreview() {
        this.dom.imagePreviewContainer.innerHTML = '';
        
        if (!this.attachedImage) {
            this.dom.imagePreviewContainer.classList.add('hidden');
            return;
        }

        const img = document.createElement('img');
        img.src = `data:${this.attachedImage.mimeType};base64,${this.attachedImage.data}`;
        img.alt = 'Preview';
        img.className = 'preview-image';

        const removeButton = document.createElement('button');
        removeButton.className = 'preview-remove-button';
        removeButton.title = 'حذف تصویر';
        removeButton.textContent = '×';
        removeButton.addEventListener('click', () => this.clearPreview());

        this.dom.imagePreviewContainer.appendChild(img);
        this.dom.imagePreviewContainer.appendChild(removeButton);
        this.dom.imagePreviewContainer.classList.remove('hidden');
    }

    /**
     * Clears the attached image and its preview.
     */
    clearPreview() {
        this.attachedImage = null;
        this.renderPreview();
    }

    /**
     * Updates the state of the send button (e.g., shows a spinner).
     * @param {boolean} isLoading - Whether the app is in a loading state.
     */
    updateSendButtonState(isLoading) {
        const button = this.dom.sendButton;
        const attachButton = this.dom.attachFileButton;
        this.isSubmitting = isLoading; // Sync submission state with loading state

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

export default InputManager;