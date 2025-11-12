import ChatEngine from './chatEngine.js';
import ChatUI from './ui/chatUI.js';

/**
 * Initializes the application when the DOM is fully loaded.
 */
document.addEventListener('DOMContentLoaded', () => {
    const rootElement = document.getElementById('root');
    if (!rootElement) {
        console.error('Fatal Error: Root element #root not found.');
        return;
    }

    // Instantiate the core logic and the UI handler
    const chatEngine = new ChatEngine();
    const chatUI = new ChatUI(chatEngine, rootElement);

    // Initialize both components
    chatUI.init();
    chatEngine.init();
});
