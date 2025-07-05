/**
 * Theme Module
 * Handles theme switching and customization
 */

class ThemeModule {
    constructor() {
        this.currentTheme = 'light';
        this.themes = {
            light: {
                name: 'Light',
                icon: 'fas fa-sun',
                class: 'light-theme'
            },
            dark: {
                name: 'Dark',
                icon: 'fas fa-moon',
                class: 'dark-theme'
            },
            highContrast: {
                name: 'High Contrast',
                icon: 'fas fa-adjust',
                class: 'high-contrast-theme'
            },
            colorblind: {
                name: 'Colorblind Friendly',
                icon: 'fas fa-eye',
                class: 'colorblind-theme'
            }
        };
        
        this.init();
    }

    init() {
        this.loadTheme();
        this.setupEventListeners();
        this.createThemeToggle();
        
        // Subscribe to state changes
        state.subscribe('ui.theme', (data) => {
            this.applyTheme(data.newValue);
        });
    }

    setupEventListeners() {
        // Listen for system theme changes
        if (window.matchMedia) {
            const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');
            mediaQuery.addEventListener('change', (e) => {
                if (this.currentTheme === 'auto') {
                    this.applySystemTheme();
                }
            });
        }
        
        // Keyboard shortcut for theme toggle
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey && e.shiftKey && e.key === 'T') {
                e.preventDefault();
                this.toggleTheme();
            }
        });
    }

    createThemeToggle() {
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            this.updateToggleButton(toggleButton);
            toggleButton.addEventListener('click', () => this.toggleTheme());
        }
    }

    loadTheme() {
        // Load from state or localStorage
        const savedTheme = state.get('ui.theme') || storage.get('theme', 'light');
        this.setTheme(savedTheme);
    }

    setTheme(themeName) {
        if (themeName === 'auto') {
            this.applySystemTheme();
        } else if (this.themes[themeName]) {
            this.currentTheme = themeName;
            this.applyTheme(themeName);
            state.update('ui.theme', themeName);
            storage.set('theme', themeName);
        }
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

        // Update meta theme-color for mobile browsers
        this.updateMetaThemeColor(themeName);

        // Update toggle button
        const toggleButton = document.getElementById('theme-toggle');
        if (toggleButton) {
            this.updateToggleButton(toggleButton);
        }

        // Trigger custom event
        document.dispatchEvent(new CustomEvent('themeChanged', {
            detail: { theme: themeName, themeConfig: theme }
        }));
    }

    toggleTheme() {
        const themeKeys = Object.keys(this.themes);
        const currentIndex = themeKeys.indexOf(this.currentTheme);
        const nextIndex = (currentIndex + 1) % themeKeys.length;
        const nextTheme = themeKeys[nextIndex];
        
        this.setTheme(nextTheme);
        
        // Show toast notification
        const theme = this.themes[nextTheme];
        showToast(`Switched to ${theme.name} theme`, 'info', 2000);
    }

    updateToggleButton(button) {
        const theme = this.themes[this.currentTheme];
        if (theme) {
            button.innerHTML = `<i class="${theme.icon}"></i>`;
            button.title = `Current theme: ${theme.name}. Click to switch.`;
        }
    }

    updateMetaThemeColor(themeName) {
        let themeColor = '#667eea'; // Default primary color
        
        switch (themeName) {
            case 'dark':
                themeColor = '#1a1a1a';
                break;
            case 'highContrast':
                themeColor = '#000000';
                break;
            default:
                themeColor = '#667eea';
        }

        let metaThemeColor = document.querySelector('meta[name="theme-color"]');
        if (!metaThemeColor) {
            metaThemeColor = document.createElement('meta');
            metaThemeColor.name = 'theme-color';
            document.getElementsByTagName('head')[0].appendChild(metaThemeColor);
        }
        metaThemeColor.content = themeColor;
    }

    applySystemTheme() {
        if (window.matchMedia) {
            const isDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
            this.currentTheme = 'auto';
            this.applyTheme(isDark ? 'dark' : 'light');
        }
    }

    // Get current theme info
    getCurrentTheme() {
        return {
            name: this.currentTheme,
            config: this.themes[this.currentTheme],
            isSystem: this.currentTheme === 'auto'
        };
    }

    // Check if user prefers reduced motion
    prefersReducedMotion() {
        return window.matchMedia && 
               window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    }

    // Apply accessibility preferences
    applyAccessibilityPreferences() {
        if (this.prefersReducedMotion()) {
            document.body.classList.add('reduced-motion-theme');
        }

        // Check for high contrast preference
        if (window.matchMedia && 
            window.matchMedia('(prefers-contrast: high)').matches) {
            this.setTheme('highContrast');
        }
    }

    // Custom theme creation
    createCustomTheme(name, config) {
        this.themes[name] = config;
        
        // Create CSS variables for custom theme
        if (config.colors) {
            const root = document.documentElement;
            Object.entries(config.colors).forEach(([key, value]) => {
                root.style.setProperty(`--custom-${key}`, value);
            });
        }
    }

    // Export theme preferences
    exportThemeConfig() {
        return {
            currentTheme: this.currentTheme,
            customThemes: Object.keys(this.themes)
                .filter(key => !['light', 'dark', 'highContrast', 'colorblind'].includes(key))
                .map(key => ({ name: key, config: this.themes[key] }))
        };
    }

    // Import theme preferences
    importThemeConfig(config) {
        if (config.customThemes) {
            config.customThemes.forEach(theme => {
                this.createCustomTheme(theme.name, theme.config);
            });
        }
        
        if (config.currentTheme) {
            this.setTheme(config.currentTheme);
        }
    }

    // Theme picker modal
    showThemePicker() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-palette me-2"></i>Choose Theme
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            ${Object.entries(this.themes).map(([key, theme]) => `
                                <div class="col-6 mb-3">
                                    <div class="card theme-option ${key === this.currentTheme ? 'border-primary' : ''}" 
                                         data-theme="${key}" style="cursor: pointer;">
                                        <div class="card-body text-center">
                                            <i class="${theme.icon} fa-2x mb-2"></i>
                                            <h6 class="card-title">${theme.name}</h6>
                                            ${key === this.currentTheme ? 
                                                '<small class="text-primary"><i class="fas fa-check"></i> Active</small>' : 
                                                ''
                                            }
                                        </div>
                                    </div>
                                </div>
                            `).join('')}
                        </div>
                        <hr>
                        <div class="form-check">
                            <input class="form-check-input" type="checkbox" id="auto-theme" 
                                   ${this.currentTheme === 'auto' ? 'checked' : ''}>
                            <label class="form-check-label" for="auto-theme">
                                <i class="fas fa-magic me-1"></i>
                                Follow system theme automatically
                            </label>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();

        // Handle theme selection
        modal.addEventListener('click', (e) => {
            const themeOption = e.target.closest('.theme-option');
            if (themeOption) {
                const themeName = themeOption.getAttribute('data-theme');
                this.setTheme(themeName);
                bsModal.hide();
            }
        });

        // Handle auto theme toggle
        const autoThemeCheckbox = modal.querySelector('#auto-theme');
        autoThemeCheckbox.addEventListener('change', (e) => {
            if (e.target.checked) {
                this.setTheme('auto');
            } else {
                this.setTheme('light');
            }
        });

        // Clean up modal on close
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });
    }
}

// Global theme functions
function toggleTheme() {
    if (window.theme) {
        window.theme.toggleTheme();
    }
}

function setTheme(themeName) {
    if (window.theme) {
        window.theme.setTheme(themeName);
    }
}

function showThemePicker() {
    if (window.theme) {
        window.theme.showThemePicker();
    }
}

// Initialize theme module
window.theme = new ThemeModule();

// Apply accessibility preferences on load
document.addEventListener('DOMContentLoaded', () => {
    window.theme.applyAccessibilityPreferences();
});
