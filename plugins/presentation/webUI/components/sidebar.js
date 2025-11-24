import Component from '../component.js';

export default class Sidebar extends Component {
    constructor(peik, uiManager) {
        super(peik, uiManager);
        this.container = null;

        // Bind methods
        this.handleDocumentClick = this.handleDocumentClick.bind(this);
        this.handleContainerClick = this.handleContainerClick.bind(this);
        this.handleChatCreated = this.handleChatCreated.bind(this);
        this.handleChatUpdated = this.handleChatUpdated.bind(this);
        this.handleChatDeleted = this.handleChatDeleted.bind(this);
        this.handleNewChatClick = this.handleNewChatClick.bind(this);
        this.handleSettingsClick = this.handleSettingsClick.bind(this);
    }

    async init() {
        this.container = document.getElementById('chat-list-container');
        
        // دکمه‌های سایدبار
        this.newChatBtn = document.getElementById('new-chat-button');
        this.settingsBtn = document.getElementById('edit-settings-button');

        this.bindEvents();
        
        // رندر اولیه (اگر دیتایی هست)
        this.render(this.peik.chats, this.uiManager.activeChatId);
    }

    bindEvents() {
        document.addEventListener('click', this.handleDocumentClick);
        if (this.container) {
            this.container.addEventListener('click', this.handleContainerClick);
        }
        
        if (this.newChatBtn) this.newChatBtn.addEventListener('click', this.handleNewChatClick);
        if (this.settingsBtn) this.settingsBtn.addEventListener('click', this.handleSettingsClick);

        // گوش دادن به رویدادهای هسته به صورت مستقل
        this.peik.on('chat:created', this.handleChatCreated);
        this.peik.on('chat:updated', this.handleChatUpdated);
        this.peik.on('chat:deleted', this.handleChatDeleted);
    }

    // --- Core Event Handlers ---

    handleChatCreated(chat) {
        this.addChat(chat, true); // به صورت پیش‌فرض انتخاب شده در نظر نگیر، مگر اینکه سوییچ شود
        // نکته: خود UIManager مسئول سوییچ کردن گپ است، اینجا فقط UI آپدیت می‌شود
    }

    handleChatUpdated(chat) {
        this.updateChat(chat);
    }

    handleChatDeleted(chatId) {
        this.removeChat(chatId);
    }

    // --- Component Logic ---

    onChatChanged(newChat, oldChat) {
        if (newChat) {
            this.setActive(newChat.id);
        } else {
            this.setActive(null);
        }
    }

    handleDocumentClick(e) {
        if (!e.target.closest('.chat-actions-container')) {
            this.closeAllMenus();
        }
    }

    handleContainerClick(e) {
        const target = e.target;

        // سوییچ چت
        const chatItem = target.closest('.chat-list-item');
        if (chatItem && !target.closest('.chat-actions-container')) {
            const chatId = chatItem.dataset.id;
            this.uiManager.switchChat(chatId);
            return;
        }

        // منو
        const moreBtn = target.closest('.more-btn');
        if (moreBtn) {
            e.stopPropagation();
            const menu = moreBtn.nextElementSibling;
            if (menu) {
                const isHidden = menu.classList.contains('hidden');
                this.closeAllMenus();
                if (isHidden) menu.classList.remove('hidden');
            }
            return;
        }

        // ویرایش
        const editBtn = target.closest('.edit-btn');
        if (editBtn) {
            e.stopPropagation();
            this.closeAllMenus();
            const chatItem = editBtn.closest('.chat-list-item');
            const chatId = chatItem.dataset.id;
            const currentTitle = chatItem.querySelector('.chat-title').textContent;
            
            const newTitle = prompt('نام جدید گپ را وارد کنید:', currentTitle);
            if (newTitle && newTitle.trim() !== '') {
                this.peik.renameChat(chatId, newTitle.trim());
            }
            return;
        }

        // حذف
        const deleteBtn = target.closest('.delete-btn');
        if (deleteBtn) {
            e.stopPropagation();
            this.closeAllMenus();
            const chatItem = deleteBtn.closest('.chat-list-item');
            const chatId = chatItem.dataset.id;
            const currentTitle = chatItem.querySelector('.chat-title').textContent;

            if (confirm(`آیا از حذف گپ «${currentTitle}» مطمئن هستید؟`)) {
                this.peik.deleteChat(chatId);
            }
            return;
        }
    }

    handleNewChatClick() {
        this.peik.createChat('گپ جدید');
    }

    handleSettingsClick() {
        // فرض بر این است که SettingsModal به عنوان کامپوننت ثبت شده است
        // یا UIManager متدی برای باز کردن آن دارد.
        // راه حل تمیزتر: SettingsModal رویداد DOM را خودش هندل کند یا UIManager باز کند.
        // اینجا ما از متد عمومی UIManager استفاده می‌کنیم اگر وجود داشته باشد، یا مستقیم DOM
        const settingsModal = this.uiManager.getComponent('settingsModal');
        if (settingsModal) settingsModal.show(true);
    }

    render(chats, activeId) {
        if (!this.container) return;
        this.container.innerHTML = '';
        const chatArray = Array.isArray(chats) ? chats : [];
        const sortedChats = [...chatArray].sort((a, b) => b.updatedAt - a.updatedAt);
        sortedChats.forEach(chat => this.addChat(chat, chat.id === activeId));
    }

    addChat(chat, isActive = false) {
        this.removeChat(chat.id);

        const el = document.createElement('div');
        el.className = `chat-list-item ${isActive ? 'active' : ''}`;
        el.dataset.id = chat.id;
        
        const provider = chat.modelInfo?.provider || 'custom';
        let iconName = 'hub';
        if (provider === 'gemini') iconName = 'auto_awesome';
        if (provider === 'openai') iconName = 'psychology';

        el.innerHTML = `
            <span class="material-symbols-outlined provider-icon" data-provider="${provider}">${iconName}</span>
            <span class="chat-title">${chat.title}</span>
            <div class="chat-actions-container">
                <button class="actions-button more-btn" title="گزینه‌ها">
                    <span class="material-symbols-outlined">more_horiz</span>
                </button>
                <div class="actions-menu hidden">
                    <button class="actions-menu-item edit-btn">
                        <span class="material-symbols-outlined">edit</span>
                        <span>ویرایش نام</span>
                    </button>
                    <button class="actions-menu-item delete-btn">
                        <span class="material-symbols-outlined">delete</span>
                        <span>حذف</span>
                    </button>
                </div>
            </div>
        `;

        this.container.prepend(el);
    }

    updateChat(chat) {
        const isActive = document.querySelector(`.chat-list-item[data-id="${chat.id}"]`)?.classList.contains('active');
        this.addChat(chat, isActive);
    }

    removeChat(chatId) {
        if (!this.container) return;
        const el = this.container.querySelector(`[data-id="${chatId}"]`);
        if (el) el.remove();
    }

    setActive(chatId) {
        if (!this.container) return;
        this.container.querySelectorAll('.chat-list-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === chatId);
        });
    }

    closeAllMenus() {
        if (!this.container) return;
        this.container.querySelectorAll('.actions-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    }

    destroy() {
        document.removeEventListener('click', this.handleDocumentClick);
        if (this.container) {
            this.container.removeEventListener('click', this.handleContainerClick);
            this.container.innerHTML = '';
        }
        if (this.newChatBtn) this.newChatBtn.removeEventListener('click', this.handleNewChatClick);
        if (this.settingsBtn) this.settingsBtn.removeEventListener('click', this.handleSettingsClick);

        this.peik.off('chat:created', this.handleChatCreated);
        this.peik.off('chat:updated', this.handleChatUpdated);
        this.peik.off('chat:deleted', this.handleChatDeleted);

        this.container = null;
    }
}