import ChatEngine from './core/chatEngine.js';
import ChatUI from './ui/chatUI.js';
import { streamGeminiResponse } from './core/providers/geminiProvider.js';
import { streamOpenAIResponse } from './core/providers/openaiProvider.js';
import { streamCustomResponse } from './core/providers/customProvider.js';

// --- Storage Implementation ---
// The ChatEngine is designed to be storage-agnostic. We are injecting
// the IndexedDB adapter here to provide persistent storage for the web app.
// Another adapter (e.g., for a file system in Node.js) could be used
// without changing the core engine. See `docs/storageAdaptorGuide.md`.
import * as IndexedDBStorage from './services/indexedDBStorage.js';

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
        // Instantiate the core logic with injected storage and providers
        const chatEngine = new ChatEngine({
            storage: IndexedDBStorage,
            providers: {
                gemini: streamGeminiResponse,
                openai: streamOpenAIResponse,
                custom: streamCustomResponse,
            }
        });
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