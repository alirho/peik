/**
 * کلاس پایه برای تمام اجزای رابط کاربری.
 * این کلاس ساختار استانداردی برای چرخه حیات و دسترسی به هسته فراهم می‌کند.
 */
export default class Component {
    /**
     * @param {import('../../../core/src/peik.js').default} peik
     * @param {import('./uiManager.js').default} uiManager
     */
    constructor(peik, uiManager) {
        this.peik = peik;
        this.uiManager = uiManager;
    }

    /**
     * زمانی که کامپوننت ثبت می‌شود و UI آماده است فراخوانی می‌شود.
     * مکان مناسب برای کش کردن DOM و ثبت Event Listener های سراسری.
     */
    async init() {}

    /**
     * زمانی که گپ فعال تغییر می‌کند فراخوانی می‌شود.
     * @param {import('../../../core/src/chat.js').default | null} newChat
     * @param {import('../../../core/src/chat.js').default | null} oldChat
     */
    onChatChanged(newChat, oldChat) {}

    /**
     * زمانی که افزونه غیرفعال می‌شود فراخوانی می‌شود.
     * باید تمام Event Listener ها و رفرنس‌ها را پاکسازی کند.
     */
    destroy() {}
}