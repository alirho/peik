import { fetchStreamWithRetries } from '../../services/apiService.js';
import { getErrorMessageForStatus } from '../../utils/apiErrors.js';

// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').ProviderHandler} ProviderHandler */

/**
 * بدنه درخواست را برای Gemini API می‌سازد.
 * @param {Array<import('../../types.js').Message>} history - تاریخچه گفتگو.
 * @returns {object} بدنه درخواست.
 */
function buildGeminiRequestBody(history) {
    const contents = history.map(msg => {
        const parts = [];

        if (msg.role === 'user') {
            // بخش متنی باید قبل از بخش‌های تصویر برای مدل‌های چندرسانه‌ای بیاید
            if (msg.content) {
                parts.push({ text: msg.content });
            }
            if (msg.image && msg.image.data && msg.image.mimeType) {
                parts.push({
                    inlineData: {
                        mimeType: msg.image.mimeType,
                        data: msg.image.data
                    }
                });
            }
        } else { // model
            parts.push({ text: msg.content });
        }
        
        return {
            role: msg.role === 'model' ? 'model' : 'user',
            parts: parts
        };
    }).filter(c => c.parts.length > 0);

    return {
        contents: contents,
        systemInstruction: {
            parts: [{ text: 'You are a helpful assistant named Goug. Your responses should be in Persian.' }]
        }
    };
}

/**
 * یک خط از استریم SSE Gemini را پردازش می‌کند.
 * @param {string} line - یک خط از استریم.
 * @param {Function} onChunk - Callback برای مدیریت محتوای استخراج‌شده.
 */
function processGeminiStream(line, onChunk) {
    if (line.startsWith('data: ')) {
        try {
            const jsonStr = line.substring(6);
            if (jsonStr) {
                const parsed = JSON.parse(jsonStr);
                const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                if (content) onChunk(content);
            }
        } catch (e) {
            console.warn("خطا در تجزیه قطعه استریم Gemini:", line, e);
        }
    }
}

/**
 * یک پیام خطای دقیق از پاسخ Gemini API استخراج می‌کند.
 * @param {Response} response - آبجکت پاسخ fetch.
 * @returns {Promise<string>} یک Promise که به پیام خطا resolve می‌شود.
 */
async function getGeminiErrorMessage(response) {
    try {
        const errorData = await response.json();
        return errorData?.error?.message || getErrorMessageForStatus(response.status);
    } catch {
        return getErrorMessageForStatus(response.status);
    }
}

/**
 * پاسخ‌های استریم را از Google Gemini API مدیریت می‌کند.
 * @type {ProviderHandler}
 */
export async function streamGeminiResponse(settings, history, onChunk, signal) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${settings.modelName}:streamGenerateContent?key=${settings.apiKey}&alt=sse`;
    
    const requestBody = buildGeminiRequestBody(history);

    const fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
        signal,
    };

    await fetchStreamWithRetries(
        API_URL,
        fetchOptions,
        (line) => processGeminiStream(line, onChunk),
        getGeminiErrorMessage
    );
}
