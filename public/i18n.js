// Simple i18n implementation
class I18n {
    constructor() {
        this.translations = {};
        this.currentLanguage = localStorage.getItem('language') || 'en';
        this.loadedLanguages = new Set();
    }

    async loadLanguage(lang) {
        if (this.loadedLanguages.has(lang)) {
            return;
        }

        try {
            const response = await fetch(`/translations/${lang}.json`);
            if (!response.ok) {
                throw new Error(`Failed to load language: ${lang}`);
            }
            this.translations[lang] = await response.json();
            this.loadedLanguages.add(lang);
        } catch (error) {
            console.error(`Error loading language ${lang}:`, error);
            // Fallback to English if language fails to load
            if (lang !== 'en') {
                await this.loadLanguage('en');
            }
        }
    }

    async setLanguage(lang) {
        await this.loadLanguage(lang);
        this.currentLanguage = lang;
        localStorage.setItem('language', lang);
        this.updatePageTranslations();
    }

    t(key, params = {}) {
        const keys = key.split('.');
        let value = this.translations[this.currentLanguage];
        
        // Fallback to English if current language doesn't have the key
        if (!value) {
            value = this.translations['en'];
        }

        for (const k of keys) {
            value = value?.[k];
        }

        if (!value) {
            console.warn(`Translation key not found: ${key}`);
            return key;
        }

        // Replace parameters like {{username}}
        return value.replace(/\{\{(\w+)\}\}/g, (match, param) => {
            return params[param] || match;
        });
    }

    updatePageTranslations() {
        // Update all elements with data-i18n attribute
        document.querySelectorAll('[data-i18n]').forEach(element => {
            const key = element.getAttribute('data-i18n');
            element.textContent = this.t(key);
        });

        // Update all elements with data-i18n-placeholder attribute
        document.querySelectorAll('[data-i18n-placeholder]').forEach(element => {
            const key = element.getAttribute('data-i18n-placeholder');
            element.placeholder = this.t(key);
        });

        // Update document direction for RTL languages
        document.dir = ['ar', 'he'].includes(this.currentLanguage) ? 'rtl' : 'ltr';
    }

    async init() {
        // Load current language and English as fallback
        await this.loadLanguage(this.currentLanguage);
        if (this.currentLanguage !== 'en') {
            await this.loadLanguage('en');
        }
        this.updatePageTranslations();
    }
}

// Create global instance
const i18n = new I18n();