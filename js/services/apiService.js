import { ApiError } from '../utils/apiErrors.js';
import { NetworkError } from '../utils/customErrors.js';
import { API_CONFIG } from '../utils/constants.js';

/**
 * یک تابع عمومی برای انجام درخواست‌های fetch با منطق تلاش مجدد و پردازش استریم.
 * @param {string} url - آدرس URL نقطه پایانی API.
 * @param {RequestInit} options - گزینه‌های مربوط به درخواست fetch، شامل `signal` برای لغو.
 * @param {(line: string) => void} processLine - یک callback برای پردازش هر خط از استریم.
 * @param {(response: Response) => Promise<string>} getErrorMessage - یک callback برای استخراج پیام خطا از پاسخ.
 * @returns {Promise<void>}
 * @throws {ApiError | Error} - در صورتی که درخواست پس از تمام تلاش‌ها ناموفق باشد، یک خطا پرتاب می‌کند.
 */
export async function fetchStreamWithRetries(url, options, processLine, getErrorMessage) {
    let lastError = null;

    for (let attempt = 0; attempt < API_CONFIG.MAX_RETRIES; attempt++) {
        try {
            const response = await fetch(url, options);

            if (!response.ok) {
                const message = await getErrorMessage(response);
                lastError = new ApiError(message, response.status);
                // برای خطاهای سمت کلاینت که احتمالاً تغییر نمی‌کنند، دوباره تلاش نکن
                if ([400, 401, 403, 404].includes(response.status)) throw lastError;
                continue; // برای خطاهای دیگر سمت سرور دوباره تلاش کن
            }

            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) break;

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                buffer = lines.pop(); // هر خط ناقص را برای قطعه بعدی نگه دار

                for (const line of lines) {
                    if (line.trim()) processLine(line);
                }
            }
            return; // موفقیت، از حلقه خارج شو

        } catch (error) {
            // اگر درخواست به صورت عمدی لغو شده باشد، خطا را مجدداً پرتاب کن تا توسط فراخواننده به درستی مدیریت شود.
            if (error.name === 'AbortError') {
                throw error;
            }
            if (error instanceof ApiError) throw error; // ApiError های غیرقابل تلاش مجدد را دوباره پرتاب کن
            
            lastError = new NetworkError();
        }
        
        // قبل از تلاش مجدد صبر کن
        if (attempt < API_CONFIG.MAX_RETRIES - 1) {
            await new Promise(resolve => setTimeout(resolve, API_CONFIG.INITIAL_DELAY_MS * Math.pow(2, attempt)));
        }
    }

    throw lastError;
}
