/**
 * Theme Module (Clean Version)
 * Handles theme switching and customization
 */

class ThemeModule extends BaseModule {
    constructor(core) {
        super(core);
        this.currentTheme = 'light';
        this.themes = {
            light: { name: 'Light', icon: 'fas fa-sun', class: 'light-theme' },
            dark: { name: 'Dark', icon: 'fas fa-moon', class: 'dark-theme' }
        };
    }

    async init() {
        await super.init();
        this.loadTheme();
        this.setupEventListeners();
        this.debug('Theme module initialized');
    }

    loadTheme() {
        const savedTheme = this.getState('ui.theme') || localStorage.getItem('theme') || 'light';
        this.setTheme(savedTheme);
    }

    setTheme(themeName) {
        if (!this.themes[themeName]) return;
        
        this.currentTheme = themeName;
        this.setState('ui.theme', themeName);
        this.applyTheme(themeName);
        localStorage.setItem('theme', themeName);
        
        this.emit('theme:changed', { theme: themeName });
        this.debug(`Theme changed to: ${themeName}`);
    }

    applyTheme(themeName) {
        const theme = this.themes[themeName];
        if (!theme) return;

        // Remove all theme classes
        Object.values(this.themes).forEach(t => {
            document.body.classList.remove(t.class);
        });

        // Apply new theme class
        document.body.classList.add(theme.class);
        
        // Update meta theme color
        const metaTheme = document.querySelector('meta[name="theme-color"]');
        if (metaTheme) {
            metaTheme.content = themeName === 'dark' ? '#1a1a1a' : '#6366f1';
        }
    }

    setupEventListeners() {
        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', () => {
                if (this.currentTheme === 'auto') {
                    this.applySystemTheme();
                }
            });
        }
    }

    toggleTheme() {
        const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
        this.setTheme(newTheme);
    }

    getCurrentTheme() {
        return this.currentTheme;
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.ThemeModule = ThemeModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ThemeModule;
}
