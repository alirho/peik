import EventEmitter from './eventEmitter.js';
import * as Storage from './storageService.js';
import { streamGeminiResponse } from './apiService.js';

class ChatEngine extends EventEmitter {
    constructor() {
        super();
        this.messages = [];
        this.isLoading = false;
        this.apiKey = null;
    }

    /**
     * Initializes the engine by loading data from storage.
     */
    init() {
        this.apiKey = Storage.loadApiKey();
        this.messages = Storage.loadMessages();
        this.emit('init', {
            apiKey: this.apiKey,
            messages: this.messages,
        });
    }

    /**
     * Sets a new API key and saves it to storage.
     * @param {string} key The new API key.
     */
    setApiKey(key) {
        if (key && typeof key === 'string') {
            this.apiKey = key;
            Storage.saveApiKey(key);
            this.emit('apiKeySet', key);
        }
    }

    /**
     * Handles sending a message to the API.
     * @param {string} userInput The text message from the user.
     */
    async sendMessage(userInput) {
        if (!userInput || this.isLoading) return;
        if (!this.apiKey) {
            this.emit('error', 'کلید API تنظیم نشده است.');
            return;
        }

        this.setLoading(true);

        const userMessage = { role: 'user', content: userInput };
        this.messages.push(userMessage);
        this.emit('message', userMessage); // Let UI show user message immediately

        // Create and add the model message placeholder to the state
        const modelMessage = { role: 'model', content: '' };
        this.messages.push(modelMessage);
        this.emit('message', modelMessage); // Add an empty model message to UI for streaming

        let fullResponse = '';
        try {
            // Prepare the history for the API call (all messages except the empty model placeholder)
            const historyForApi = this.messages.slice(0, -1);
            const contents = historyForApi.map(msg => ({
                role: msg.role === 'model' ? 'model' : 'user', // Ensure correct role mapping
                parts: [{ text: msg.content }],
            }));
            
            const requestBody = {
                contents: contents,
                systemInstruction: {
                    parts: [{ text: 'You are a helpful assistant named Goug. Your responses should be in Persian.' }]
                }
            };

            await streamGeminiResponse(
                this.apiKey,
                requestBody,
                (chunk) => {
                    fullResponse += chunk;
                    this.emit('chunk', chunk); // Stream chunk to UI
                }
            );

            // Once streaming is done, update the last message in our state and save
            if (this.messages.length > 0) {
                this.messages[this.messages.length - 1].content = fullResponse;
            }
            Storage.saveMessages(this.messages);
            this.emit('streamEnd', fullResponse);

        } catch (error) {
            const errorMessage = `خطا: ${error.message}`;
            this.emit('error', errorMessage);
            // Replace the empty model message with an error message in the state
            if (this.messages.length > 0) {
                 this.messages[this.messages.length - 1].content = errorMessage;
            }
            this.emit('streamEnd', errorMessage); // End stream with error
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