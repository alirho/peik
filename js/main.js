import ChatEngine from './core/chatEngine.js';
import ChatUI from './ui/chatUI.js';

/**
 * Initializes the application when the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', async () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        console.error('Fatal Error: Root element #root not found.');
        document.body.innerHTML = '<p style="color: red; padding: 1rem; text-align: center;">خطای مهلک: المان اصلی برنامه یافت نشد.</p>';
        return;
    }

    try {
        // Instantiate the core logic and the UI handler
        const chatEngine = new ChatEngine();
        const chatUI = new ChatUI(chatEngine, rootElement);

        // Ensure the UI is fully initialized before the engine starts emitting events
        await chatUI.init();
        await chatEngine.init();
    } catch (error) {
        console.error('Application failed to initialize:', error);
        rootElement.innerHTML = `<div style="padding: 2rem; text-align: center; color: #b91c1c;">
            <h2>خطا در بارگذاری برنامه</h2>
            <p>متاسفانه مشکلی در هنگام راه‌اندازی برنامه پیش آمده است. لطفاً صفحه را مجدداً بارگیری کنید.</p>
        </div>`;
    }
});