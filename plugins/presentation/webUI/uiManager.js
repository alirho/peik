import Sidebar from './components/sidebar.js';
import MessageList from './components/messageList.js';
import InputArea from './components/inputArea.js';
import SettingsModal from './components/settingsModal.js';
import LightboxManager from './components/lightboxManager.js';
import Header from './components/header.js';
import DialogManager from './components/dialogManager.js';
import { loadTemplateWithPartials, loadTemplate } from './utils/templateLoader.js';

export default class UIManager {
    constructor(peik, rootId) {
        this.peik = peik;
        this.rootElementId = rootId;
        
        this.components = new Map();
        this.activeChatId = null;

        // هندلر رویداد ready برای راه‌اندازی اولیه
        this.handleReady = this.handleReady.bind(this);
    }

    async init() {
        await this.renderLayout();
        
        // ثبت کامپوننت‌ها
        this.registerComponent('dialog', new DialogManager(this.peik, this)); // باید زودتر از بقیه ثبت شود
        this.registerComponent('lightbox', new LightboxManager(this.peik, this));
        this.registerComponent('sidebar', new Sidebar(this.peik, this));
        this.registerComponent('messageList', new MessageList(this.peik, this));
        this.registerComponent('inputArea', new InputArea(this.peik, this));
        this.registerComponent('settingsModal', new SettingsModal(this.peik, this));
        this.registerComponent('header', new Header(this.peik, this));

        // راه‌اندازی کامپوننت‌ها
        for (const component of this.components.values()) {
            await component.init();
        }

        // گوش دادن به رویداد ready هسته برای سناریوی اولیه
        this.peik.on('ready', this.handleReady);
    }

    async renderLayout() {
        const root = document.getElementById(this.rootElementId);
        if (!root) throw new Error(`المان ریشه با شناسه ${this.rootElementId} یافت نشد.`);

        const [layoutHtml, settingsHtml] = await Promise.all([
            loadTemplateWithPartials('plugins/presentation/webUI/templates/mainLayout.html'),
            loadTemplate('plugins/presentation/webUI/templates/settingsModal.html')
        ]);
        
        // الحاق لی‌اوت اصلی (که شامل دیالوگ‌های عمومی است) و مودال تنظیمات
        root.innerHTML = layoutHtml + settingsHtml;
    }

    registerComponent(name, instance) {
        this.components.set(name, instance);
    }

    getComponent(name) {
        return this.components.get(name);
    }

    handleReady({ chats }) {
        // منطق اولیه: اگر گپی هست باز کن، اگر نه تنظیمات
        if (chats.length > 0) {
            this.switchChat(chats[0].id);
        } else if (!this.peik.config?.defaultProvider) {
            const settingsModal = this.getComponent('settingsModal');
            if (settingsModal) settingsModal.show(true);
        }
    }

    /**
     * سوییچ کردن به یک گپ جدید و اطلاع‌رسانی به تمام کامپوننت‌ها
     */
    async switchChat(chatId) {
        if (this.activeChatId === chatId) return;

        const newChat = await this.peik.getChat(chatId);
        if (!newChat) return;

        const oldChatId = this.activeChatId;
        // نکته: در اینجا ما Chat Instance قدیمی را نداریم (چون peik آن را کش نمی‌کند در نسخه فعلی)
        // اما کامپوننت‌ها ممکن است خودشان نگه داشته باشند. ما فقط ID قدیمی را می‌دانیم.
        // برای سادگی، فرض می‌کنیم کامپوننت‌ها مسئولیت پاکسازی خود را دارند.
        
        this.activeChatId = chatId;

        // اطلاع‌رسانی به تمام کامپوننت‌ها
        for (const component of this.components.values()) {
            // پاس دادن null به عنوان oldChat چون دسترسی مستقیم نداریم (یا مهم نیست)
            component.onChatChanged(newChat, null);
        }

        // بستن سایدبار در موبایل (رفتار خاص UI)
        const sidebarEl = document.querySelector('.sidebar');
        if(sidebarEl) sidebarEl.classList.remove('open');
    }

    destroy() {
        this.peik.off('ready', this.handleReady);
        
        for (const component of this.components.values()) {
            component.destroy();
        }
        this.components.clear();
        
        const root = document.getElementById(this.rootElementId);
        if (root) root.innerHTML = '';
    }
}