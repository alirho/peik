// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').Chat} Chat */
/** @typedef {import('../../core/chatEngine.js').default} ChatEngine */

/**
 * رندر و تعاملات لیست گپ‌ها در سایدبار را مدیریت می‌کند.
 */
class SidebarManager {
    /**
     * @param {ChatEngine} engine - نمونه اصلی موتور چت.
     */
    constructor(engine) {
        this.engine = engine;
        this.container = document.getElementById('chat-list-container');
        this.mobileMenuButton = document.getElementById('menu-toggle-button');
        this.sidebar = document.querySelector('.sidebar');
        this.activeMenu = null;

        // کش کردن المان‌های مودال تأیید
        this.confirmationModal = document.getElementById('confirmation-modal');
        this.confirmationModalTitle = document.getElementById('confirmation-modal-title');
        this.confirmationModalBody = document.getElementById('confirmation-modal-body');
        this.confirmationModalCancel = document.getElementById('confirmation-modal-cancel');
        this.confirmationModalConfirm = document.getElementById('confirmation-modal-confirm');
        
        this.confirmHandler = null;

        // --- ثبت event handlerهای bind شده برای حذف آسان ---
        this.handleGlobalClickBound = this._handleGlobalClick.bind(this);
        this.handleMobileMenuClickBound = this._handleMobileMenuClick.bind(this);
        this.hideConfirmationModalBound = this.hideConfirmationModal.bind(this);
        this.handleConfirmBound = this._handleConfirm.bind(this);
        
        this.bindGlobalEvents();
        this.bindConfirmationModalEvents();
    }

    /**
     * لیست گپ‌ها را در سایدبار رندر می‌کند.
     * @param {Array<Chat>} chats - لیست آبجکت‌های گپ.
     * @param {string} activeChatId - شناسه گپ فعال فعلی.
     */
    render(chats, activeChatId) {
        this.container.innerHTML = '';
        if (!chats || chats.length === 0) return;

        // مرتب‌سازی گپ‌ها بر اساس تاریخ آخرین به‌روزرسانی، نزولی
        const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

        sortedChats.forEach(chat => {
            const item = this.createChatItemElement(chat, activeChatId);
            this.container.appendChild(item);
        });
    }
    
    /**
     * نام آیکون Material Symbols را برای یک ارائه‌دهنده برمی‌گرداند.
     * @param {string} provider 
     * @returns {string}
     */
    _getProviderIconName(provider) {
        switch (provider) {
            case 'gemini': return 'auto_awesome';
            case 'openai': return 'psychology';
            default: return 'hub';
        }
    }

    /**
     * یک المان آیتم گپ برای لیست سایدبار ایجاد می‌کند.
     * @param {Chat} chat - آبجکت گپ.
     * @param {string} activeChatId - شناسه گپ فعال.
     * @returns {HTMLElement} المان لیست آیتم ایجاد شده.
     */
    createChatItemElement(chat, activeChatId) {
        const item = document.createElement('div');
        item.className = 'chat-list-item';
        item.dataset.chatId = chat.id;
        if (chat.id === activeChatId) {
            item.classList.add('active');
        }

        const providerType = chat.providerConfig?.provider || 'custom';
        // افزودن آیکون ارائه‌دهنده
        const icon = document.createElement('span');
        icon.className = 'material-symbols-outlined provider-icon';
        icon.textContent = this._getProviderIconName(providerType);
        icon.title = chat.providerConfig?.name || providerType;
        icon.dataset.provider = providerType; // برای استایل‌دهی رنگی
        item.appendChild(icon);

        const title = document.createElement('span');
        title.className = 'chat-title';
        title.textContent = chat.title;
        item.appendChild(title);

        const menuButton = this.createActionsMenu(chat);
        item.appendChild(menuButton);

        // با کلیک، گپ را عوض کن، اما نه اگر روی دکمه منو کلیک شده باشد
        item.addEventListener('click', (e) => {
            if (!menuButton.contains(e.target)) {
                this.engine.switchActiveChat(chat.id);
                if (this.sidebar.classList.contains('open')) {
                    this.sidebar.classList.remove('open');
                }
            }
        });

        return item;
    }

    /**
     * منوی عملیات سه‌نقطه را برای یک آیتم گپ ایجاد می‌کند.
     * @param {Chat} chat - آبجکت گپ.
     * @returns {HTMLElement} المان دکمه منو.
     */
    createActionsMenu(chat) {
        const wrapper = document.createElement('div');
        wrapper.style.position = 'relative';

        const button = document.createElement('button');
        button.className = 'actions-button';
        button.innerHTML = `<span class="material-symbols-outlined">more_horiz</span>`;
        
        button.addEventListener('click', (e) => {
            e.stopPropagation();
            this.toggleMenu(e.currentTarget, chat);
        });

        wrapper.appendChild(button);
        return wrapper;
    }

    /**
     * نمایش منوی عملیات را تغییر می‌دهد.
     * @param {HTMLElement} buttonEl - دکمه‌ای که کلیک شده.
     * @param {Chat} chat - آبجکت گپ مرتبط.
     */
    toggleMenu(buttonEl, chat) {
        if (this.activeMenu && this.activeMenu.button === buttonEl) {
            this.closeActiveMenu();
            return;
        }
        this.closeActiveMenu(); 

        const menu = document.createElement('div');
        menu.className = 'actions-menu';
        
        menu.innerHTML = `
            <div class="actions-menu-item" data-action="rename">
                <span class="material-symbols-outlined">edit</span>
                <span>تغییر نام</span>
            </div>
            <div class="actions-menu-item delete" data-action="delete">
                <span class="material-symbols-outlined">delete</span>
                <span>حذف</span>
            </div>
        `;

        menu.addEventListener('click', (e) => {
            const action = e.target.closest('[data-action]')?.dataset.action;
            if (action === 'rename') this.handleRename(chat);
            if (action === 'delete') this.handleDelete(chat);
            this.closeActiveMenu();
        });
        
        this.activeMenu = { element: menu, button: buttonEl };
        document.body.appendChild(menu);
        this.positionMenu(buttonEl, menu);
    }
    
    positionMenu(buttonEl, menuEl) {
        const rect = buttonEl.getBoundingClientRect();
        menuEl.style.left = `${rect.left - menuEl.offsetWidth + rect.width}px`;
        menuEl.style.top = `${rect.bottom + 4}px`;
    }
    
    closeActiveMenu() {
        if (this.activeMenu) {
            this.activeMenu.element.remove();
            this.activeMenu = null;
        }
    }

    _escapeHtml(str) {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    handleRename(chat) {
        this.showConfirmationModal({
            title: 'تغییر نام گپ',
            bodyHtml: `<input id="rename-input" class="form-input" type="text" placeholder="نام جدید گپ..." style="text-align: right; direction: rtl;">`,
            confirmText: 'ذخیره',
            onConfirm: () => {
                const input = document.getElementById('rename-input');
                // بررسی وجود input قبل از دسترسی به value
                if (input) {
                    const newTitle = input.value.trim();
                    if (newTitle && newTitle !== chat.title) {
                        this.engine.renameChat(chat.id, newTitle);
                    }
                }
            }
        });
    
        // مقدار ورودی را به صورت امن پس از رندر شدن تنظیم کن
        const renameInput = document.getElementById('rename-input');
        if (renameInput) {
            renameInput.value = chat.title;
        }
    }
    
    handleDelete(chat) {
        const safeTitle = this._escapeHtml(chat.title);
        this.showConfirmationModal({
            title: 'حذف گپ',
            bodyHtml: `<p>آیا از حذف گپ «<strong>${safeTitle}</strong>» مطمئن هستید؟ این عمل قابل بازگشت نیست.</p>`,
            confirmText: 'حذف',
            confirmClass: 'btn-danger',
            onConfirm: () => {
                this.engine.deleteChat(chat.id);
            }
        });
    }

    _handleGlobalClick(e) {
        // بستن منوی عملیات با کلیک در بیرون
        if (this.activeMenu && !this.activeMenu.button.contains(e.target) && !this.activeMenu.element.contains(e.target)) {
            this.closeActiveMenu();
        }

        // بستن مودال تأیید با کلیک روی overlay
        if (e.target === this.confirmationModal) {
            this.hideConfirmationModal();
        }
    }

    _handleMobileMenuClick(e) {
        e.stopPropagation();
        this.sidebar.classList.toggle('open');
    }

    _handleConfirm() {
        // اگر مودال تنظیمات باز است، اجازه دهید کنترلر رویداد آن کار را انجام دهد.
        // این کار از اجرای همزمان دو کنترلر و ایجاد تداخل جلوگیری می‌کند.
        const settingsModalEl = document.getElementById('settings-modal');
        if (settingsModalEl && !settingsModalEl.classList.contains('hidden')) {
            return;
        }

        if (this.confirmHandler) {
            this.confirmHandler();
        }
        this.hideConfirmationModal();
    }

    bindGlobalEvents() {
        document.addEventListener('click', this.handleGlobalClickBound);
        this.mobileMenuButton.addEventListener('click', this.handleMobileMenuClickBound);
    }
    
    bindConfirmationModalEvents() {
        this.confirmationModalCancel.addEventListener('click', this.hideConfirmationModalBound);
        this.confirmationModalConfirm.addEventListener('click', this.handleConfirmBound);
    }

    destroy() {
        document.removeEventListener('click', this.handleGlobalClickBound);
        this.mobileMenuButton.removeEventListener('click', this.handleMobileMenuClickBound);
        this.confirmationModalCancel.removeEventListener('click', this.hideConfirmationModalBound);
        this.confirmationModalConfirm.removeEventListener('click', this.handleConfirmBound);
    }

    showConfirmationModal({ title, bodyHtml, confirmText = 'تایید', confirmClass = 'btn-primary', onConfirm }) {
        this.confirmationModalTitle.textContent = title;
        this.confirmationModalBody.innerHTML = bodyHtml;
        this.confirmationModalConfirm.textContent = confirmText;
        
        this.confirmationModalConfirm.className = 'btn';
        this.confirmationModalConfirm.classList.add(confirmClass);
        
        this.confirmHandler = onConfirm;
        
        this.confirmationModal.classList.remove('hidden');

        const input = this.confirmationModalBody.querySelector('input');
        if (input) {
            input.focus();
            input.select();
        }
    }
    
    hideConfirmationModal() {
        this.confirmationModal.classList.add('hidden');
        this.confirmHandler = null;
        this.confirmationModalBody.innerHTML = '';
    }
}

export default SidebarManager;