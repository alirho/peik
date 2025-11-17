import { fetchStreamWithRetries } from '../../services/apiService.js';
import { getErrorMessageForStatus } from '../../utils/apiErrors.js';
import { buildOpenAIRequestBody, getOpenAIErrorMessage, processOpenAIStream } from './openaiProvider.js';

// وارد کردن تایپ‌ها برای JSDoc
/** @typedef {import('../../types.js').ProviderHandler} ProviderHandler */

/**
 * پاسخ‌های استریم را از یک API سفارشی سازگار با OpenAI مدیریت می‌کند.
 * @type {ProviderHandler}
 */
export async function streamCustomResponse(settings, history, onChunk, signal) {
    const API_URL = settings.endpointUrl;

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
