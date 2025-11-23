import { Plugin } from '../../../core/src/index.js';
import UIManager from './uiManager.js';

export default class WebUIPlugin extends Plugin {
    static get metadata() {
        return {
            name: 'web-ui',
            version: '1.0.0',
            category: 'presentation',
            description: 'رابط کاربری وب استاندارد',
            author: 'Peik Team',
            dependencies: ['storage']
        };
    }

    constructor(rootElementId = 'root') {
        super();
        this.rootElementId = rootElementId;
        this.uiManager = null;
    }

    async install(context) {
        await super.install(context);
        this.uiManager = new UIManager(context, this.rootElementId);
    }

    async activate() {
        this._loadStyles();
        await this.uiManager.init();
        console.log('WebUI فعال شد.');
    }

    _loadStyles() {
        const link = document.createElement('link');
        link.rel = 'stylesheet';
        // مسیر فایل استایل اصلی در داخل افزونه
        link.href = 'plugins/presentation/webUI/styles/main.css'; 
        document.head.appendChild(link);
    }
}