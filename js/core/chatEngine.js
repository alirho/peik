import EventEmitter from './eventEmitter.js';
import * as Storage from '../services/storageService.js';
import { streamGeminiResponse } from './providers/geminiProvider.js';
import { streamOpenAIResponse } from './providers/openaiProvider.js';
import { streamCustomResponse } from './providers/customProvider.js';

class ChatEngine extends EventEmitter {
    constructor() {
        super();
        this.messages = [];
        this.isLoading = false;
        this.settings = null;
        this.providers = {
            gemini: streamGeminiResponse,
            openai: streamOpenAIResponse,
            custom: streamCustomResponse,
        };
    }

    /**
     * Initializes the engine by loading data from storage.
     */
    init() {
        this.settings = Storage.loadSettings();
        this.messages = Storage.loadMessages();
        this.emit('init', {
            settings: this.settings,
            messages: this.messages,
        });
    }

    /**
     * Sets new settings and saves them to storage.
     * @param {object} settings The new settings object.
     */
    saveSettings(settings) {
        if (settings) {
            this.settings = settings;
            Storage.saveSettings(settings);
            this.emit('settingsSaved', settings);
        }
    }

    /**
     * Clears the current chat history and starts a new session.
     */
    startNewChat() {
        this.messages = [];
        Storage.saveMessages([]); // Clear storage
        this.emit('newChatStarted');
    }

    /**
     * Handles sending a message by delegating to the appropriate provider.
     * @param {string} userInput The text message from the user.
     */
    async sendMessage(userInput) {
        if (!userInput || this.isLoading) return;
        if (!this.settings || !this.settings.apiKey) {
            this.emit('error', 'تنظیمات API صحیح نیست. لطفاً تنظیمات را بررسی کنید.');
            return;
        }

        const providerStreamer = this.providers[this.settings.provider];
        if (!providerStreamer) {
            this.emit('error', `ارائه‌دهنده ${this.settings.provider} پشتیبانی نمی‌شود.`);
            return;
        }

        this.setLoading(true);

        const userMessage = { role: 'user', content: userInput };
        this.messages.push(userMessage);
        this.emit('message', userMessage);

        const modelMessage = { role: 'model', content: '' };
        this.messages.push(modelMessage);
        this.emit('message', modelMessage);

        let fullResponse = '';
        try {
            const historyForApi = this.messages.slice(0, -1);
            
            await providerStreamer(
                this.settings,
                historyForApi,
                (chunk) => {
                    fullResponse += chunk;
                    this.emit('chunk', chunk);
                }
            );

            if (this.messages.length > 0) {
                this.messages[this.messages.length - 1].content = fullResponse;
            }
            Storage.saveMessages(this.messages);
            this.emit('streamEnd', fullResponse);

        } catch (error) {
            const errorMessage = error.message || 'یک خطای ناشناخته رخ داد.';
            if (this.messages.length > 0 && this.messages[this.messages.length - 1].role === 'model') {
                this.messages.pop();
                this.emit('messageRemoved');
            }
            this.emit('error', errorMessage);
            this.emit('streamEnd');
            Storage.saveMessages(this.messages);
        } finally {
            this.setLoading(false);
        }
    }

    /**
     * Updates the loading state and notifies listeners.
     * @param {boolean} state The new loading state.
     */
    setLoading(state) {
        this.isLoading = state;
        this.emit('loading', this.isLoading);
    }
}

export default ChatEngine;