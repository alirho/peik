import markdownService from '../../services/markdownService.js';
import { UI_TIMEOUTS } from '../../utils/constants.js';

// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').Message} Message */
/** @typedef {import('./lightboxManager.js').default} LightboxManager */

/**
 * رندر کردن پیام‌ها، نشانگر تایپ و خطاها را در UI چت مدیریت می‌کند.
 */
class MessageRenderer {
    /**
     * @param {HTMLElement} messageListContainer - المان DOM که پیام‌ها در آن نمایش داده می‌شوند.
     * @param {LightboxManager} lightboxManager - نمونه مدیریت لایت‌باکس.
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
            bubble.innerHTML = ''; // پاک کردن محتوای پیش‌فرض
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
                img.style.display = 'none'; // تا زمان بارگذاری پنهان بماند

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
                // اگر markdown در دسترس باشد با آن رندر کن، در غیر این صورت به صورت متن ساده رندر کن و برای رندر مجدد علامت‌گذاری کن
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
        // در اولین قطعه، نشانگر تایپ را حذف کن
        if (bubbleElement.querySelector('.typing-indicator')) {
            bubbleElement.innerHTML = '';
        }
        
        // متن جدید را به محتوای خام اضافه کن و کل حباب را دوباره رندر کن
        const currentContent = bubbleElement.dataset.rawContent || '';
        const newContent = currentContent + chunk;
        bubbleElement.dataset.rawContent = newContent;
        
        // اگر markdown در دسترس باشد با آن رندر کن، در غیر این صورت به صورت متن ساده و بارگذاری را فعال کن.
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
        bubble.textContent = errorMessage; // برای امنیت از textContent استفاده کن

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
        // اگر markdown-it هنوز بارگذاری نشده باشد، این به صورت متن ساده رندر می‌شود.
        // ما آن را برای رندر مجدد زمانی که کتابخانه در دسترس قرار گرفت، علامت‌گذاری می‌کنیم.
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
            // یک تأخیر کوچک می‌تواند در صورت بارگذاری تصاویر کمک‌کننده باشد
            setTimeout(() => {
                chatArea.scrollTop = chatArea.scrollHeight;
            }, 50);
        }
    }

    // --- سازندگان المان ---
    
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
        // محتوا اکنون توسط تابع فراخواننده (appendMessage, renderHistory, etc.) تنظیم می‌شود.
    
        contentWrapper.append(label, bubble);

        // دکمه کپی را ایجاد کن. برای پیام‌های کاربر، فقط اگر متن وجود داشته باشد.
        // برای پیام‌های دستیار، همیشه آن را ایجاد کن تا محتوای استریم شده را مدیریت کند.
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
     * رشته HTML برای نشانگر تایپ را ایجاد می‌کند.
     * @returns {string} رشته HTML.
     */
    createTypingIndicator() {
        return `<div class="typing-indicator"><div class="dot-container"><div class="dot"></div><div class="dot"></div><div class="dot"></div></div></div>`;
    }

    /**
     * رویداد کلیک برای دکمه کپی روی یک پیام را مدیریت می‌کند.
     * @param {HTMLButtonElement} button - المان دکمه‌ای که کلیک شده است.
     * @param {string} messageId - شناسه پیامی که باید کپی شود.
     */
    async handleCopy(button, messageId) {
        const wrapper = this.container.querySelector(`[data-message-id="${messageId}"]`);
        if (!wrapper) {
            console.error('المان پیام برای شناسه یافت نشد:', messageId);
            return;
        }

        const bubble = wrapper.querySelector('.message-bubble');
        if (!bubble) {
            console.error('حباب پیام برای شناسه یافت نشد:', messageId);
            return;
        }
        
        const textToCopy = bubble.dataset.rawContent;

        if (textToCopy === undefined || textToCopy === null || textToCopy.trim() === '') return;

        try {
            await navigator.clipboard.writeText(textToCopy);
            
            // بازخورد بصری
            button.innerHTML = `<span class="material-symbols-outlined">check</span>`;
            button.classList.add('copied');
            button.disabled = true;

            // پس از 3 ثانیه به حالت اول برگردان
            setTimeout(() => {
                button.innerHTML = `<span class="material-symbols-outlined">content_copy</span>`;
                button.classList.remove('copied');
                button.disabled = false;
            }, UI_TIMEOUTS.COPY_FEEDBACK_MS);

        } catch (err) {
            console.error('کپی کردن متن ناموفق بود: ', err);
            button.title = 'رونوشت ناموفق بود';
            setTimeout(() => { button.title = 'رونوشت'; }, 2000);
        }
    }

    /**
     * تمام پیام‌هایی را که به صورت متن ساده رندر شده‌اند پیدا کرده و با تجزیه‌گر کامل markdown دوباره رندر می‌کند.
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

        // اگر کاربر در انتهای چت بود، پس از رندر مجدد او را همانجا نگه دار.
        if (wasScrolledToBottom) {
            this.scrollToBottom();
        }
    }

    /**
     * بررسی می‌کند که آیا کاربر به انتهای ناحیه چت اسکرول کرده است.
     * @returns {boolean}
     */
    isScrolledToBottom() {
        const chatArea = this.container.parentElement;
        if (!chatArea) return false;
        // یک آستانه چند پیکسلی برای در نظر گرفتن خطاهای گرد کردن.
        const threshold = 10; 
        return chatArea.scrollHeight - chatArea.scrollTop - chatArea.clientHeight < threshold;
    }

    /**
     * اطمینان حاصل می‌کند که کتابخانه markdown در صورت نیاز بارگذاری شده و یک رندر مجدد را زمان‌بندی می‌کند.
     * @private
     */
    _ensureMarkdownIsLoadedAndRerender() {
        if (!markdownService.isLoaded()) {
            // تابع load idempotent است، بنابراین فراخوانی چندباره آن ایمن است.
            // این فقط یک بار import را فعال می‌کند.
            markdownService.load().then(() => {
                this.rerenderUnprocessedMessages();
            });
        }
    }
}

export default MessageRenderer;
