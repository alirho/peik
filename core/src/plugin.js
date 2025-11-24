import { NotImplementedError } from './utils/errors.js';

export default class Plugin {
    static metadata = {
        name: 'unnamed-plugin',
        version: '0.0.0',
        category: 'utility', // utility, provider, storage, network
        description: '',
        dependencies: []
    };

    constructor() {
        this.context = null; // Context (Peik instance) will be injected
    }

    /**
     * زمانی که افزونه نصب می‌شود اجرا می‌گردد.
     * @param {object} context شیء اصلی Peik
     */
    async install(context) {
        this.context = context;
    }

    /**
     * زمانی که افزونه فعال می‌شود (مثلاً بعد از init)
     */
    async activate() {}

    /**
     * غیرفعال‌سازی افزونه
     */
    async deactivate() {}

    /**
     * حذف کامل افزونه و پاک‌سازی منابع
     */
    async uninstall() {
        this.context = null;
    }
}