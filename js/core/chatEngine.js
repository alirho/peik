import EventEmitter from './eventEmitter.js';
import * as Storage from '../services/storageService.js';
import { streamGeminiResponse } from './providers/geminiProvider.js';
import { streamOpenAIResponse } from './providers/openaiProvider.js';
import { streamCustomResponse } from './providers/customProvider.js';

const SYNC_CHANNEL_NAME = 'goug-chat-sync';

class ChatEngine extends EventEmitter {
    constructor() {
        super();
        this.chats = [];
        this.activeChatId = null;
        this.isLoading = false;
        this.settings = null;
        this.syncChannel = null;
        this.providers = {
            gemini: streamGeminiResponse,
            openai: streamOpenAIResponse,
            custom: streamCustomResponse,
        };
    }

    async init() {
        try {
            this.settings = await Storage.loadSettings();
            this.chats = await Storage.loadAllChats();
            
            if (this.chats.length === 0) {
                // Creates a new chat in memory, will be saved on first message
                this.startNewChat(false);
            } else {
                const lastActive = this.chats.sort((a,b) => b.updatedAt - a.updatedAt)[0];
                this.activeChatId = lastActive.id;
            }

            this.emit('init', {
                settings: this.settings,
                chats: this.chats,
                activeChat: this.getActiveChat(),
            });
            
            this.setupSyncChannel();

        } catch (error) {
            this.emit('error', error.message || 'خطا در بارگذاری تاریخچه گفتگوها.');
        }
    }

    setupSyncChannel() {
        if ('BroadcastChannel' in window) {
            try {
                this.syncChannel = new BroadcastChannel(SYNC_CHANNEL_NAME);
                this.syncChannel.onmessage = (event) => {
                    if (event.data.type === 'update') {
                        this.handleSyncUpdate();
                    }
                };
            } catch (e) {
                console.error("BroadcastChannel could not be created:", e);
                this.syncChannel = null;
            }
        }
    }

    broadcastUpdate() {
        if (this.syncChannel) {
            this.syncChannel.postMessage({ type: 'update' });
        }
    }

    async handleSyncUpdate() {
        try {
            this.chats = await Storage.loadAllChats();
            const activeChatExists = this.chats.some(c => c.id === this.activeChatId);

            if (!activeChatExists) {
                if (this.chats.length > 0) {
                    const newActiveChat = this.chats.sort((a, b) => b.updatedAt - a.updatedAt)[0];
                    this.activeChatId = newActiveChat.id;
                } else {
                    // All chats were deleted from another tab
                    await this.startNewChat();
                    return; // startNewChat handles its own emissions
                }
            }

            this.emit('chatListUpdated', { chats: this.chats, activeChatId: this.activeChatId });
            this.emit('activeChatSwitched', this.getActiveChat());

        } catch (error) {
            this.emit('error', error.message || 'خطا در همگام‌سازی با تب‌های دیگر.');
        }
    }

    async saveSettings(settings) {
        if (settings) {
            try {
                this.settings = settings;
                await Storage.saveSettings(settings);
                this.emit('settingsSaved', settings);
            } catch (error) {
                this.emit('error', error.message);
            }
        }
    }

    async startNewChat(emitUpdate = true) {
        const now = Date.now();
        const newChat = {
            id: `chat_${now}`,
            title: 'گپ جدید',
            messages: [],
            createdAt: now,
            updatedAt: now,
            provider: this.settings?.provider || 'unknown',
            modelName: this.settings?.modelName || 'unknown'
        };
        this.chats.push(newChat);
        this.activeChatId = newChat.id;
        
        if (emitUpdate) {
            this.emit('activeChatSwitched', newChat);
            this.emit('chatListUpdated', { chats: this.chats, activeChatId: this.activeChatId });
            try {
                await Storage.saveChat(newChat);
                this.broadcastUpdate();
            } catch (error) {
                this.emit('error', error.message);
            }
        }
    }
    
    switchActiveChat(chatId) {
        if (chatId === this.activeChatId) return;
        this.activeChatId = chatId;
        const activeChat = this.getActiveChat();
        if (activeChat) {
            this.emit('activeChatSwitched', activeChat);
            this.emit('chatListUpdated', { chats: this.chats, activeChatId: this.activeChatId });
        }
    }

    async renameChat(chatId, newTitle) {
        const chat = this.chats.find(c => c.id === chatId);
        if (chat) {
            chat.title = newTitle;
            chat.updatedAt = Date.now();
            try {
                await Storage.saveChat(chat);
                this.broadcastUpdate();
                this.emit('chatListUpdated', { chats: this.chats, activeChatId: this.activeChatId });
                if (chat.id === this.activeChatId) {
                     this.emit('activeChatSwitched', chat);
                }
            } catch (error) {
                this.emit('error', error.message);
            }
        }
    }

    async deleteChat(chatId) {
        this.chats = this.chats.filter(c => c.id !== chatId);
        try {
            await Storage.deleteChatById(chatId);
            this.broadcastUpdate();

            if (this.activeChatId === chatId) {
                if (this.chats.length > 0) {
                    const newActiveChat = this.chats.sort((a,b) => b.updatedAt - a.updatedAt)[0];
                    this.switchActiveChat(newActiveChat.id);
                } else {
                    await this.startNewChat();
                }
            } else {
                this.emit('chatListUpdated', { chats: this.chats, activeChatId: this.activeChatId });
            }
        } catch (error) {
            this.emit('error', error.message);
        }
    }

    getActiveChat() {
        return this.chats.find(c => c.id === this.activeChatId);
    }

    async sendMessage(userInput) {
        if (!userInput || this.isLoading || !this.activeChatId) return;
        if (!this.settings || (!this.settings.apiKey && this.settings.provider !== 'custom')) {
            this.emit('error', 'تنظیمات API صحیح نیست. لطفاً تنظیمات را بررسی کنید.');
            return;
        }

        const activeChat = this.getActiveChat();
        if (!activeChat) return;

        const providerStreamer = this.providers[this.settings.provider];
        if (!providerStreamer) {
            this.emit('error', `ارائه‌دهنده ${this.settings.provider} پشتیبانی نمی‌شود.`);
            return;
        }

        this.setLoading(true);

        const userMessage = { role: 'user', content: userInput };
        activeChat.messages.push(userMessage);
        this.emit('message', userMessage);
        
        // Auto-title new chat on first message
        if (activeChat.messages.length === 1) {
            activeChat.title = userInput.substring(0, 30) + (userInput.length > 30 ? '...' : '');
            this.emit('chatListUpdated', { chats: this.chats, activeChatId: this.activeChatId });
            this.emit('activeChatSwitched', activeChat);
        }

        const modelMessage = { role: 'model', content: '' };
        activeChat.messages.push(modelMessage);
        this.emit('message', modelMessage);

        let fullResponse = '';
        try {
            const historyForApi = activeChat.messages.slice(0, -1);
            
            await providerStreamer(
                this.settings,
                historyForApi,
                (chunk) => {
                    fullResponse += chunk;
                    this.emit('chunk', chunk);
                }
            );

            const lastMsg = activeChat.messages[activeChat.messages.length - 1];
            if (lastMsg) lastMsg.content = fullResponse;

        } catch (error) {
            const errorMessage = error.message || 'یک خطای ناشناخته رخ داد.';
            if (activeChat.messages.length > 0 && activeChat.messages[activeChat.messages.length - 1].role === 'model') {
                activeChat.messages.pop();
                this.emit('messageRemoved');
            }
            this.emit('error', errorMessage);
        } finally {
            activeChat.updatedAt = Date.now();
            try {
                await Storage.saveChat(activeChat);
                this.broadcastUpdate();
            } catch (storageError) {
                this.emit('error', storageError.message);
            }
            this.emit('streamEnd', fullResponse);
            this.setLoading(false);
        }
    }

    setLoading(state) {
        this.isLoading = state;
        this.emit('loading', this.isLoading);
    }
}

export default ChatEngine;