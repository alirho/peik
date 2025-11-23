export default class SettingsModal {
    constructor(peik) {
        this.peik = peik;
        this.modal = document.getElementById('settings-modal');
        this.form = document.getElementById('settings-form');
        
        this.form?.addEventListener('submit', (e) => this.save(e));
        document.getElementById('cancel-settings-button')?.addEventListener('click', () => this.show(false));
    }

    show(visible) {
        if (!this.modal) return;
        this.modal.classList.toggle('hidden', !visible);
        if (visible) this.loadValues();
    }

    loadValues() {
        const p = this.peik.settings?.providers || {};
        
        const geminiKey = document.getElementById('gemini-key-input');
        if (geminiKey) geminiKey.value = p.gemini?.apiKey || '';
        
        const geminiModel = document.getElementById('gemini-model-input');
        if (geminiModel) geminiModel.value = p.gemini?.modelName || '';

        const openaiKey = document.getElementById('chatgpt-key-input');
        if (openaiKey) openaiKey.value = p.openai?.apiKey || '';

        const activeId = this.peik.settings?.activeProviderId;
        if (activeId) {
            const radio = this.form.querySelector(`input[value="${activeId}"]`);
            if (radio) radio.checked = true;
        }
    }

    async save(e) {
        e.preventDefault();
        
        const activeRadio = this.form.querySelector('input[name="active_provider"]:checked');
        const activeId = activeRadio ? activeRadio.value : 'gemini';

        const newSettings = {
            activeProviderId: activeId,
            providers: {
                gemini: {
                    apiKey: document.getElementById('gemini-key-input').value,
                    modelName: document.getElementById('gemini-model-input').value
                },
                openai: {
                    apiKey: document.getElementById('chatgpt-key-input').value,
                    modelName: document.getElementById('chatgpt-model-input').value
                },
                custom: this.peik.settings?.providers?.custom || []
            }
        };
        
        await this.peik.updateSettings(newSettings);
    }
}