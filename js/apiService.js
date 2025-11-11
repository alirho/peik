// ثابت‌های مربوط به درخواست شبکه
const MAX_RETRIES = 3; // حداکثر تعداد تلاش مجدد
const INITIAL_DELAY_MS = 1000; // تاخیر اولیه برای تلاش مجدد
const TIMEOUT_MS = 30000; // محدودیت زمانی برای درخواست

/**
 * یک خطای سفارشی برای مدیریت بهتر خطاهای API
 */
class ApiError extends Error {
    constructor(message, status) {
        super(message);
        this.name = 'ApiError';
        this.status = status;
    }
}

/**
 * ترجمه کدهای وضعیت HTTP به پیام‌های قابل فهم برای کاربر
 * @param {number} status - کد وضعیت HTTP
 * @returns {string} پیام خطا
 */
function getErrorMessageForStatus(status) {
    switch (status) {
        case 400:
            return "درخواست نامعتبر است. لطفاً ورودی خود را بررسی کنید.";
        case 401:
            return "کلید API نامعتبر یا منقضی شده است. لطفاً آن را بررسی کنید.";
        case 429:
            return "تعداد درخواست‌ها بیش از حد مجاز است. لطفاً یک دقیقه صبر کرده و دوباره تلاش کنید.";
        case 500:
        case 503:
            return "سرور با مشکل مواجه شده است. لطفاً کمی بعد دوباره تلاش کنید.";
        default:
            return `خطای غیرمنتظره‌ای رخ داد. (کد: ${status})`;
    }
}

export async function streamGeminiResponse(apiKey, requestBody, onChunk) {
    const API_URL = `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:streamGenerateContent?key=${apiKey}&alt=sse`;

    let lastError = null;

    // حلقه تلاش مجدد با تاخیر افزایشی
    for (let attempt = 0; attempt < MAX_RETRIES; attempt++) {
        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), TIMEOUT_MS);

        try {
            const response = await fetch(API_URL, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: controller.signal,
            });

            clearTimeout(timeoutId); // درخواست موفق بود، تایمر را پاک کن

            if (!response.ok) {
                const errorStatus = response.status;
                const message = getErrorMessageForStatus(errorStatus);
                lastError = new ApiError(message, errorStatus);
                
                // برای خطاهای غیرقابل تلاش مجدد، حلقه را متوقف کن
                if (errorStatus === 400 || errorStatus === 401) {
                    throw lastError;
                }
                // برای سایر خطاها، به تلاش بعدی برو
                continue;
            }

            // پردازش موفقیت آمیز stream
            const reader = response.body.getReader();
            const decoder = new TextDecoder();
            let buffer = '';

            while (true) {
                const { value, done } = await reader.read();
                if (done) {
                    break;
                }

                buffer += decoder.decode(value, { stream: true });
                const lines = buffer.split('\n');
                
                // خط آخر ممکن است ناقص باشد، آن را برای chunk بعدی در بافر نگه دار
                buffer = lines.pop(); 

                for (const line of lines) {
                    if (line.startsWith('data: ')) {
                        try {
                            const jsonStr = line.substring(6);
                            if (jsonStr) {
                               const parsed = JSON.parse(jsonStr);
                               const content = parsed.candidates?.[0]?.content?.parts?.[0]?.text;
                               if (content) {
                                    onChunk(content);
                               }
                            }
                        } catch (e) {
                            console.warn("خطا در پارس کردن قطعه‌ای از استریم:", line);
                        }
                    }
                }
            }
            return; // در صورت موفقیت، از تابع خارج شو

        } catch (error) {
            clearTimeout(timeoutId);
            
            if (error.name === 'AbortError') {
                lastError = new Error("پاسخ از سرور دریافت نشد (Timeout). لطفاً دوباره تلاش کنید.");
                // Timeout یک خطای قابل تلاش مجدد نیست در این منطق، چون 30 ثانیه گذشته
                throw lastError;
            } else if (error instanceof ApiError) {
                // خطاهای دائمی که نباید مجددا تلاش شوند
                throw error;
            } else {
                // خطاهای شبکه
                lastError = new Error("اتصال به اینترنت برقرار نیست. لطفاً شبکه خود را بررسی کنید.");
            }
        }
        
        // اگر آخرین تلاش نبود، منتظر بمان
        if (attempt < MAX_RETRIES - 1) {
            const delay = INITIAL_DELAY_MS * Math.pow(2, attempt);
            await new Promise(resolve => setTimeout(resolve, delay));
        }
    }

    // اگر همه تلاش‌ها ناموفق بود، آخرین خطا را پرتاب کن
    throw lastError;
}
