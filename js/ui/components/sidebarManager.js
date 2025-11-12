/**
 * Manages the rendering and interactions of the chat list in the sidebar.
 */
class SidebarManager {
    /**
     * @param {import('../../core/chatEngine.js').default} engine The chat engine instance.
     */
    constructor(engine) {
        this.engine = engine;
        this.container = document.getElementById('chat-list-container');
        this.mobileMenuButton = document.getElementById('menu-toggle-button');
        this.sidebar = document.querySelector('.sidebar');
        this.activeMenu = null;

        // Cache confirmation modal elements
        this.confirmationModal = document.getElementById('confirmation-modal');
        this.confirmationModalTitle = document.getElementById('confirmation-modal-title');
        this.confirmationModalBody = document.getElementById('confirmation-modal-body');
        this.confirmationModalCancel = document.getElementById('confirmation-modal-cancel');
        this.confirmationModalConfirm = document.getElementById('confirmation-modal-confirm');
        
        this.confirmHandler = null;

        this.bindGlobalEvents();
        this.bindConfirmationModalEvents();
    }

    /**
     * Renders the list of chats in the sidebar.
     * @param {Array<object>} chats - The list of chat objects.
     * @param {string} activeChatId - The ID of the currently active chat.
     */
    render(chats, activeChatId) {
        this.container.innerHTML = '';
        if (!chats || chats.length === 0) return;

        // Sort chats by last updated date, descending
        const sortedChats = [...chats].sort((a, b) => b.updatedAt - a.updatedAt);

        sortedChats.forEach(chat => {
            const item = this.createChatItemElement(chat, activeChatId);
            this.container.appendChild(item);
        });
    }

    /**
     * Creates a single chat item element for the sidebar list.
     * @param {object} chat - The chat object.
     * @param {string} activeChatId - The ID of the active chat.
     * @returns {HTMLElement} The created list item element.
     */
    createChatItemElement(chat, activeChatId) {
        const item = document.createElement('div');
        item.className = 'chat-list-item';
        item.dataset.chatId = chat.id;
        if (chat.id === activeChatId) {
            item.classList.add('active');
        }

        const title = document.createElement('span');
        title.className = 'chat-title';
        title.textContent = chat.title;
        item.appendChild(title);

        const menuButton = this.createActionsMenu(chat);
        item.appendChild(menuButton);

        // Switch chat on click, but not if the menu button was clicked
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
     * Creates the three-dot action menu for a chat item.
     * @param {object} chat - The chat object.
     * @returns {HTMLElement} The menu button element.
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
     * Toggles the visibility of the actions menu.
     * @param {HTMLElement} buttonEl - The button that was clicked.
     * @param {object} chat - The associated chat object.
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
                const newTitle = input.value.trim();
                if (newTitle && newTitle !== chat.title) {
                    this.engine.renameChat(chat.id, newTitle);
                }
            }
        });

        // Securely set the input value after it has been rendered
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

    bindGlobalEvents() {
        document.addEventListener('click', (e) => {
            // Close actions menu on outside click
            if (this.activeMenu && !this.activeMenu.button.contains(e.target) && !this.activeMenu.element.contains(e.target)) {
                this.closeActiveMenu();
            }

            // Close confirmation modal on overlay click
            if (e.target === this.confirmationModal) {
                this.hideConfirmationModal();
            }
        });

        // Mobile sidebar toggle
        this.mobileMenuButton.addEventListener('click', (e) => {
            e.stopPropagation();
            this.sidebar.classList.toggle('open');
        });
    }
    
    bindConfirmationModalEvents() {
        this.confirmationModalCancel.addEventListener('click', () => this.hideConfirmationModal());
        this.confirmationModalConfirm.addEventListener('click', () => {
            if (this.confirmHandler) {
                this.confirmHandler();
            }
            this.hideConfirmationModal();
        });
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