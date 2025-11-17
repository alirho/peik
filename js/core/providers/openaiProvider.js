import { fetchStreamWithRetries } from '../../services/apiService.js';
import { getErrorMessageForStatus } from '../../utils/apiErrors.js';

// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').ProviderHandler} ProviderHandler */

/**
 * بدنه درخواست را برای APIهای سازگار با OpenAI می‌سازد.
 * @param {Array<import('../../types.js').Message>} history - تاریخچه گفتگو.
 * @returns {object} بدنه درخواست.
 */
export function buildOpenAIRequestBody(history) {
    const messages = history.map(msg => {
        if (msg.role === 'user' && msg.image && msg.image.data && msg.image.mimeType) {
            const content = [];
            // بخش متنی را فقط در صورتی اضافه کن که محتوای واقعی داشته باشد.
            if (msg.content && msg.content.trim() !== '') {
                content.push({ type: 'text', text: msg.content });
            }
            content.push({
                type: 'image_url',
                image_url: {
                    url: `data:${msg.image.mimeType};base64,${msg.image.data}`
                }
            });
            return { role: 'user', content };
        }
        // پیام متنی کاربر یا پیام دستیار
        return {
            role: msg.role === 'model' ? 'assistant' : 'user',
            content: msg.content,
        };
    });
    messages.unshift({
        role: 'system',
        content: 'You are a helpful assistant named Goug. Your responses should be in Persian.'
    });
    return { messages };
}

/**
 * یک خط از استریم SSE سازگار با OpenAI را پردازش می‌کند.
 * @param {string} line - یک خط از استریم.
 * @param {Function} onChunk - Callback برای مدیریت محتوای استخراج‌شده.
 */
export function processOpenAIStream(line, onChunk) {
    if (line.startsWith('data: ')) {
        const jsonStr = line.substring(6).trim();
        if (jsonStr === '[DONE]') return;
        try {
            if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.choices?.[0]?.delta?.content;
                if (content) onChunk(content);
            }
        } catch (e) {
            console.warn("خطا در تجزیه قطعه استریم OpenAI:", line, e);
        }
    }
}

/**
 * یک پیام خطای دقیق از پاسخ OpenAI API استخراج می‌کند.
 * @param {Response} response - آبجکت پاسخ fetch.
 * @returns {Promise<string>} یک Promise که به پیام خطا resolve می‌شود.
 */
export async function getOpenAIErrorMessage(response) {
    try {
        const errorData = await response.json();
        return errorData?.error?.message || getErrorMessageForStatus(response.status);
    } catch {
        return getErrorMessageForStatus(response.status);
    }
}

/**
 * پاسخ‌های استریم را از OpenAI API مدیریت می‌کند.
 * @type {ProviderHandler}
 */
export async function streamOpenAIResponse(settings, history, onChunk, signal) {
    const API_URL = 'https://api.openai.com/v1/chat/completions';
    
    const requestBody = buildOpenAIRequestBody(history);
    const finalBody = {
        ...requestBody,
        model: settings.modelName,
        stream: true,
    };

    const fetchOptions = {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${settings.apiKey}`,
        },
        body: JSON.stringify(finalBody),
        signal,
    };

    await fetchStreamWithRetries(
        API_URL,
        fetchOptions,
        (line) => processOpenAIStream(line, onChunk),
        getOpenAIErrorMessage
    );
}
