import Chat from '../chat.js';
import { PeikError, StorageError } from '../utils/errors.js';
import { Serializer } from '../utils/serializer.js';

export default class ChatManager {
    /**
     * @param {import('../peik.js').default} peik 
     */
    constructor(peik) {
        this.peik = peik;
        this.chats = []; // لیستی از خلاصه چت‌ها
        
        // نگهداری وضعیت Runtime چت‌ها (غیر قابل سریال‌سازی)
        // Key: chatId, Value: { isSending: boolean, abortController: AbortController }
        this.chatRuntimeStates = new Map();
    }

    /**
     * بارگذاری لیست چت‌ها از ذخیره‌ساز
     */
    async load() {
        const storage = this.peik.getStorage();
        if (storage) {
            this.chats = await storage.getAllChats();
            
            // مقداردهی اولیه وضعیت Runtime برای چت‌های لود شده
            this.chats.forEach(chat => {
                if (!this.chatRuntimeStates.has(chat.id)) {
                    this.chatRuntimeStates.set(chat.id, { isSending: false, abortController: null });
                }
            });
        }
        return this.chats;
    }

    /**
     * ایجاد یک چت جدید
     * @param {string} title 
     */
    async createChat(title = 'گپ جدید') {
        const defaultModel = this.peik.providerResolver.getDefaultModelInfo();
        
        const chatData = {
            id: `chat_${Date.now()}`,
            title,
            messages: [],
            createdAt: Date.now(),
            updatedAt: Date.now(),
            modelInfo: defaultModel
        };

        const chat = new Chat(this.peik, chatData);
        
        // ایجاد رکورد وضعیت Runtime
        this.chatRuntimeStates.set(chat.id, { isSending: false, abortController: null });
        
        // افزودن به لیست خلاصه‌ها
        this.chats.unshift(chat.toJSON()); 
        
        // ذخیره
        await chat.save();
        
        this.peik.emit('chat:created', chat);
        return chat;
    }

    /**
     * دریافت یک چت کامل
     * @param {string} chatId 
     */
    async getChat(chatId) {
        const storage = this.peik.getStorage();
        if (!storage) throw new StorageError('ذخیره‌سازی در دسترس نیست.');

        const chatData = await storage.loadChat(chatId);
        if (!chatData) throw new PeikError('چت یافت نشد.');

        // اطمینان از وجود وضعیت Runtime
        if (!this.chatRuntimeStates.has(chatId)) {
            this.chatRuntimeStates.set(chatId, { isSending: false, abortController: null });
        }

        return new Chat(this.peik, chatData);
    }

    /**
     * تغییر نام گپ
     * @param {string} chatId 
     * @param {string} newTitle 
     */
    async renameChat(chatId, newTitle) {
        const chat = await this.getChat(chatId);
        if (chat) {
            await chat.updateTitle(newTitle);
            
            // به‌روزرسانی لیست خلاصه چت‌ها
            const chatIndex = this.chats.findIndex(c => c.id === chatId);
            if (chatIndex !== -1) {
                this.chats[chatIndex].title = newTitle;
                this.chats[chatIndex].updatedAt = Date.now();
                this.peik.emit('chat:updated', this.chats[chatIndex]);
            }
        }
    }

    /**
     * حذف چت
     * @param {string} chatId 
     */
    async deleteChat(chatId) {
        const storage = this.peik.getStorage();
        if (storage) {
            await storage.deleteChat(chatId);
        }
        
        this.chats = this.chats.filter(c => c.id !== chatId);
        
        // پاک کردن وضعیت Runtime
        this.chatRuntimeStates.delete(chatId);
        
        this.peik.emit('chat:deleted', chatId);
    }
}