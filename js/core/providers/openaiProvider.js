import { fetchStreamWithRetries } from '../../services/apiService.js';
import { getErrorMessageForStatus } from '../../utils/apiErrors.js';

/**
 * Builds the request body for OpenAI-compatible APIs.
 * @param {Array<object>} history - The chat history.
 * @returns {object} The request body.
 */
export function buildOpenAIRequestBody(history) {
    const messages = history.map(msg => {
        if (msg.role === 'user' && msg.image && msg.image.data && msg.image.mimeType) {
            const content = [];
            if (msg.content) {
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
        // Text-only user message or assistant message
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
 * Processes a single line from an OpenAI-compatible SSE stream.
 * @param {string} line - A line from the stream.
 * @param {Function} onChunk - Callback to handle the extracted content.
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
            console.warn("Error parsing OpenAI stream chunk:", line, e);
        }
    }
}

/**
 * Extracts a detailed error message from an OpenAI API response.
 * @param {Response} response - The fetch response object.
 * @returns {Promise<string>} A promise that resolves to the error message.
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
 * Handles streaming responses from the OpenAI API.
 * @param {object} settings - User settings including apiKey and modelName.
 * @param {Array<object>} history - The chat history.
 * @param {Function} onChunk - Callback function for each response chunk.
 */
export async function streamOpenAIResponse(settings, history, onChunk) {
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
    };

    await fetchStreamWithRetries(
        API_URL,
        fetchOptions,
        (line) => processOpenAIStream(line, onChunk),
        getOpenAIErrorMessage
    );
}