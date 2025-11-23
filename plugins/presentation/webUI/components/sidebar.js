export default class Sidebar {
    constructor(peik, uiManager) {
        this.peik = peik;
        this.uiManager = uiManager;
        this.container = document.getElementById('chat-list-container');
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
            <button class="actions-button" title="حذف">
                <span class="material-symbols-outlined">delete</span>
            </button>
        `;

        el.addEventListener('click', (e) => {
            if (!e.target.closest('.actions-button')) {
                this.uiManager.switchChat(chat.id);
            }
        });

        const deleteBtn = el.querySelector('.actions-button');
        deleteBtn.addEventListener('click', (e) => {
            e.stopPropagation();
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
}