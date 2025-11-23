export default class Sidebar {
    constructor(peik, uiManager) {
        this.peik = peik;
        this.uiManager = uiManager;
        this.container = document.getElementById('chat-list-container');
        this.activeMenu = null;

        // بستن منوها با کلیک در هر جای دیگر صفحه
        document.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-actions-container')) {
                this.closeAllMenus();
            }
        });
    }

    render(chats, activeId) {
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

        // رویداد انتخاب گپ
        el.addEventListener('click', (e) => {
            if (!e.target.closest('.chat-actions-container')) {
                this.uiManager.switchChat(chat.id);
            }
        });

        // منطق منوی دراپ‌داون
        const moreBtn = el.querySelector('.more-btn');
        const menu = el.querySelector('.actions-menu');

        moreBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const isHidden = menu.classList.contains('hidden');
            this.closeAllMenus(); // بستن سایر منوها
            if (isHidden) {
                menu.classList.remove('hidden');
            }
        });

        // رویداد ویرایش نام
        const editBtn = el.querySelector('.edit-btn');
        editBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeAllMenus();
            const newTitle = prompt('نام جدید گپ را وارد کنید:', chat.title);
            if (newTitle && newTitle.trim() !== '') {
                this.peik.renameChat(chat.id, newTitle.trim());
            }
        });

        // رویداد حذف
        const deleteBtn = el.querySelector('.delete-btn');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            this.closeAllMenus();
            if (confirm(`آیا از حذف گپ «${chat.title}» مطمئن هستید؟`)) {
                this.peik.deleteChat(chat.id);
            }
        });

        this.container.prepend(el);
    }

    updateChat(chat) {
        const isActive = document.querySelector(`.chat-list-item[data-id="${chat.id}"]`)?.classList.contains('active');
        this.addChat(chat, isActive);
    }

    removeChat(chatId) {
        const el = this.container.querySelector(`[data-id="${chatId}"]`);
        if (el) el.remove();
    }

    setActive(chatId) {
        this.container.querySelectorAll('.chat-list-item').forEach(el => {
            el.classList.toggle('active', el.dataset.id === chatId);
        });
    }

    closeAllMenus() {
        this.container.querySelectorAll('.actions-menu').forEach(menu => {
            menu.classList.add('hidden');
        });
    }
}