import { Plugin } from '../../../core/src/index.js';

/**
 * افزونه کلاینت HTTP مبتنی بر Fetch API استاندارد.
 * این افزونه از HttpClientInterface پیروی می‌کند و برای محیط‌های مرورگر و Node.js 18+ مناسب است.
 */
export default class FetchHttpPlugin extends Plugin {
    static get metadata() {
        return {
            name: 'fetch-http',
            version: '1.0.0',
            category: 'network',
            description: 'کلاینت شبکه استاندارد با استفاده از Fetch API',
            author: 'Peik Team',
            dependencies: []
        };
    }

    /**
     * انجام یک درخواست HTTP ساده (غیر استریم).
     * @param {string} url - آدرس URL.
     * @param {object} options - گزینه‌های fetch (method, headers, body, ...).
     * @returns {Promise<object>} - پاسخ شامل وضعیت، هدرها و داده‌ها.
     */
    async request(url, options = {}) {
        try {
            const response = await fetch(url, options);
            
            const contentType = response.headers.get('content-type');
            let data;

            // تلاش برای پارس کردن خودکار بر اساس Content-Type
            if (contentType && contentType.includes('application/json')) {
                data = await response.json();
            } else {
                data = await response.text();
            }

            if (!response.ok) {
                // پرتاب خطا با جزئیات برای مدیریت در لایه‌های بالاتر
                const error = new Error(`HTTP Error: ${response.status}`);
                error.statusCode = response.status;
                error.responseBody = data;
                throw error;
            }

            return {
                status: response.status,
                headers: response.headers,
                data: data,
                ok: response.ok
            };

        } catch (error) {
            // اگر خطا از نوع HTTP نبود (مثلاً قطعی شبکه)
            if (!error.statusCode) {
                error.message = `Network Error: ${error.message}`;
            }
            throw error;
        }
    }

    /**
     * انجام یک درخواست HTTP با قابلیت دریافت استریم (SSE).
     * @param {string} url - آدرس URL.
     * @param {object} options - گزینه‌های fetch.
     * @param {function(string): void} onChunk - تابعی که برای هر خط کامل از استریم فراخوانی می‌شود.
     * @param {AbortSignal} [signal] - سیگنال برای لغو درخواست.
     */
    async streamRequest(url, options, onChunk, signal) {
        const fetchOptions = { ...options, signal };

        let response;
        try {
            response = await fetch(url, fetchOptions);
        } catch (error) {
            if (error.name === 'AbortError') {
                throw error; // لغو عمدی را دوباره پرتاب کن
            }
            throw new Error(`Network connection failed: ${error.message}`);
        }

        if (!response.ok) {
            let errorData;
            try {
                errorData = await response.json();
            } catch {
                errorData = await response.text();
            }
            const error = new Error(`Stream API Error: ${response.status}`);
            error.statusCode = response.status;
            error.responseBody = errorData;
            throw error;
        }

        if (!response.body) {
            throw new Error('ReadableStream not supported in this environment.');
        }

        const reader = response.body.getReader();
        const decoder = new TextDecoder('utf-8');
        let buffer = '';

        try {
            while (true) {
                const { done, value } = await reader.read();
                
                if (done) {
                    break;
                }

                // دیکود کردن باینری به متن
                const chunk = decoder.decode(value, { stream: true });
                buffer += chunk;

                // پردازش خط به خط (مناسب برای SSE)
                const lines = buffer.split('\n');
                
                // آخرین خط ممکن است ناقص باشد، آن را در بافر نگه دار
                buffer = lines.pop(); 

                for (const line of lines) {
                    if (line.trim() !== '') {
                        onChunk(line);
                    }
                }
            }

            // پردازش هر آنچه در بافر مانده است
            if (buffer.trim() !== '') {
                onChunk(buffer);
            }

        } catch (error) {
            if (error.name === 'AbortError') {
                throw error;
            }
            throw new Error(`Stream reading failed: ${error.message}`);
        } finally {
            // اطمینان از آزاد شدن قفل reader
            reader.releaseLock();
        }
    }
}