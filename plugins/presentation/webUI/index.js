import { Plugin } from '../../../core/src/index.js';
import UIManager from './uiManager.js';

export default class WebUIPlugin extends Plugin {
    static metadata = {
        name: 'web-ui',
        version: '1.0.0',
        category: 'presentation',
        description: 'رابط کاربری وب استاندارد',
        author: 'Peik Team',
        dependencies: [] 
    };

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

    async deactivate() {
        if (this.uiManager) {
            this.uiManager.destroy();
            this.uiManager = null;
        }

        const styleLink = document.querySelector('link[href*="webUI/styles/main.css"]');
        if (styleLink) {
            styleLink.remove();
        }
        
        console.log('WebUI غیرفعال شد.');
    }

    _loadStyles() {
        if (document.querySelector('link[href*="webUI/styles/main.css"]')) return;

        const link = document.createElement('link');
        link.rel = 'stylesheet';
        link.href = 'plugins/presentation/webUI/styles/main.css'; 
        document.head.appendChild(link);
    }
}