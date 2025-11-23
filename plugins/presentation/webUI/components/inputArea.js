export default class InputArea {
    constructor(peik, uiManager) {
        this.peik = peik;
        this.uiManager = uiManager;
        
        this.form = document.getElementById('chat-form');
        this.input = document.getElementById('message-input');
        this.sendBtn = document.getElementById('send-button');
        
        this.bindEvents();
    }

    bindEvents() {
        this.form?.addEventListener('submit', (e) => {
            e.preventDefault();
            this.sendMessage();
        });
        
        this.input?.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                this.sendMessage();
            }
        });
    }

    async sendMessage() {
        const text = this.input.value.trim();
        if (!text) return;

        const chat = this.peik.activeChat;
        if (!chat) {
            alert('لطفاً ابتدا یک گپ ایجاد کنید.');
            return;
        }

        this.input.value = '';
        
        try {
            await chat.sendMessage(text);
        } catch (err) {
            console.error(err);
        }
    }

    setLoading(isLoading) {
        if (this.sendBtn) {
            this.sendBtn.disabled = isLoading;
            this.sendBtn.innerHTML = isLoading 
                ? '<div class="spinner"></div>' 
                : '<span class="material-symbols-outlined">send</span>';
        }
    }
}