import { ApiError, getErrorMessageForStatus } from './utils/apiErrors.js';

// ثابت‌های مربوط به درخواست شبکه
const MAX_RETRIES = 3;
const INITIAL_DELAY_MS = 1000;
const TIMEOUT_MS = 30000;

/**
 * تابع اصلی برای ارسال درخواست استریم به API بر اساس تنظیمات
 * @param {object} settings - تنظیمات کاربر (ارائه‌دهنده، کلید و غیره)
 * @param {object} requestBody - بدنه درخواست
 * @param {Function} onChunk - کال‌بک برای هر قطعه از پاسخ
 */
export async function streamChatResponse(settings, requestBody, onChunk) {
    switch (settings.provider) {
        case 'gemini':
            return streamGeminiResponse(settings, requestBody, onChunk);
        case 'openai':
        case 'custom':
            return streamOpenAIResponse(settings, requestBody, onChunk);
        default:
            throw new Error(`ارائه‌دهنده ناشناخته: ${settings.provider}`);
    }
}

/**
 * پیاده‌سازی استریم برای Gemini
 * @param {object} settings - تنظیمات کاربر
 * @param {object} requestBody - بدنه درخواست
 * @param {Function} onChunk - کال‌بک برای هر قطعه
 */
async function streamGeminiResponse(settings, requestBody, onChunk) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/${settings.modelName}:streamGenerateContent?key=${settings.apiKey}&alt=sse`;

    const fetchOptions = {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(requestBody),
    };

    const processStream = (line) => {
        if (line.startsWith('data: ')) {
            try {
                const jsonStr = line.substring(6);
                if (jsonStr) {
                    const parsed = JSON.parse(jsonStr);
                    const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                    if (content) onChunk(content);
                }
            } catch (e) {
                console.warn("خطا در پارس کردن قطعه‌ای از استریم Gemini:", line, e);
            }
        }
    };

    await fetchStreamWithRetries(API_URL, fetchOptions, processStream, async (res) => getErrorMessageForStatus(res.status));
}

/**
 * پیاده‌سازی استریم برای API های سازگار با OpenAI
 * @param {object} settings - تنظیمات کاربر
 * @param {object} requestBody - بدنه درخواست
 * @param {Function} onChunk - کال‌بک برای هر قطعه
 */
async function streamOpenAIResponse(settings, requestBody, onChunk) {
    const API_URL = settings.provider === 'custom'
        ? settings.endpointUrl
        : 'https://api.openai.com/v1/chat/completions';
    
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
    };
    
    const processStream = (line) => {
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
                console.warn("خطا در پارس کردن قطعه‌ای از استریم OpenAI:", line, e);
            }
        }
    };

    const getOpenAIErrorMessage = async (response) => {
        try {
            const errorData = await response.json();
            return errorData?.error?.message || getErrorMessageForStatus(response.status);
        } catch {
            return getErrorMessageForStatus(response.status);
        }
    };

    await fetchStreamWithRetries(API_URL, fetchOptions, processStream, getOpenAIErrorMessage);
}

/**
 * یک تابع عمومی برای ارسال درخواست fetch با قابلیت تلاش مجدد، timeout و پردازش استریم
 * @param {string} url - آدرس API
 * @param {object} options - تنظیمات Fetch
 * @param {Function} processLine - تابع پردازش هر خط از استریم
 * @param {Function} getErrorMessage - تابع استخراج پیام خطا از پاسخ
 */
async function fetchStreamWithRetries(url, options, processLine, getErrorMessage) {
    let lastError = null;

    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(url, { ...options, signal: controller.signal });
            clearTimeout(timeoutId);

            if (!response.ok) {
                const message = await getErrorMessage(response);
                lastError = new ApiError(message, response.status);
                if ([400, 401, 403, 404].includes(response.status)) throw lastError;
                continue;
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // Keep incomplete line

                for (const line of lines) {
                    if (line.trim()) processLine(line);
                }
            }
            return; // Success

        } catch (error) {
            clearTimeout(timeoutId);
            if (error instanceof ApiError) throw error;
            if (error.name === 'AbortError') {
                lastError = new Error("پاسخ از سرور دریافت نشد (Timeout).");
                throw lastError;
            }
            lastError = new Error("اتصال به اینترنت برقرار نیست.");
        }
        
        if (attempt < MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, INITIAL_DELAY_MS * Math.pow(2, attempt)));
        }
    }

    throw lastError;
}
