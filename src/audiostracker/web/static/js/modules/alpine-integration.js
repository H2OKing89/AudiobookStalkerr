/**
 * Alpine.js Integration Module
 * Bridges the existing modular architecture with Alpine.js reactive components
 */

class AlpineIntegrationModule extends window.BaseModule {
    constructor(core) {
        super(core);
        this.alpineComponents = new Map();
        this.isAlpineReady = false;
    }

    async init() {
        await super.init();
        
        // Wait for Alpine.js to be available
        await this.waitForAlpine();
        
        // Register core Alpine components
        this.registerCoreComponents();
        
        // Set up event bridges between Alpine and our module system
        this.setupEventBridges();
        
        this.debug('Alpine.js integration initialized');
    }

    /**
     * Wait for Alpine.js to be loaded and ready
     */
    async waitForAlpine() {
        return new Promise((resolve) => {
            if (window.Alpine) {
                this.isAlpineReady = true;
                resolve();
                return;
            }

            // Listen for Alpine initialization
            document.addEventListener('alpine:init', () => {
                this.isAlpineReady = true;
                resolve();
            });

            // Fallback: check periodically
            const checkAlpine = setInterval(() => {
                if (window.Alpine) {
                    clearInterval(checkAlpine);
                    this.isAlpineReady = true;
                    resolve();
                }
            }, 100);
        });
    }

    /**
     * Register core Alpine.js components that integrate with our modules
     */
    registerCoreComponents() {
        // Search component
        Alpine.data('searchComponent', () => ({
            query: '',
            isSearching: false,
            results: [],

            async performSearch() {
                if (!this.query.trim()) {
                    this.results = [];
                    return;
                }

                this.isSearching = true;
                
                // Use our existing search module
                const searchModule = this.core.getModule('search');
                if (searchModule) {
                    try {
                        this.results = await searchModule.performSearch(this.query);
                        this.core.emit('search:completed', { query: this.query, results: this.results });
                    } catch (error) {
                        console.error('Search failed:', error);
                        this.results = [];
                    }
                }
                
                this.isSearching = false;
            },

            clearSearch() {
                this.query = '';
                this.results = [];
                this.core.emit('search:cleared');
            }
        }));

        // View mode component
        Alpine.data('viewModeComponent', () => ({
            currentMode: 'grid',
            availableModes: ['grid', 'list', 'table'],

            setViewMode(mode) {
                if (this.availableModes.includes(mode)) {
                    this.currentMode = mode;
                    
                    // Update our existing state system
                    this.core.setState('ui.viewMode', mode);
                    this.core.emit('view:changed', mode);
                    
                    this.debug(`View mode changed to: ${mode}`);
                }
            },

            isActive(mode) {
                return this.currentMode === mode;
            }
        }));

        // Filter component
        Alpine.data('filterComponent', () => ({
            filters: {
                search: '',
                author: '',
                dateRange: '',
                status: ''
            },
            activeFilters: 0,

            updateFilter(key, value) {
                this.filters[key] = value;
                this.calculateActiveFilters();
                
                // Notify our existing filter module
                const filtersModule = this.core.getModule('filters');
                if (filtersModule) {
                    filtersModule.updateFilter(key, value);
                }
                
                this.core.emit('filter:changed', { key, value, filters: this.filters });
            },

            clearFilters() {
                Object.keys(this.filters).forEach(key => {
                    this.filters[key] = '';
                });
                this.activeFilters = 0;
                
                const filtersModule = this.core.getModule('filters');
                if (filtersModule) {
                    filtersModule.clearAllFilters();
                }
                
                this.core.emit('filters:cleared');
            },

            calculateActiveFilters() {
                this.activeFilters = Object.values(this.filters).filter(value => 
                    value && value.toString().trim() !== ''
                ).length;
            }
        }));

        // Theme toggle component
        Alpine.data('themeComponent', () => ({
            currentTheme: 'light',

            toggleTheme() {
                const newTheme = this.currentTheme === 'light' ? 'dark' : 'light';
                this.setTheme(newTheme);
            },

            setTheme(theme) {
                this.currentTheme = theme;
                
                // Use our existing theme module
                const themeModule = this.core.getModule('theme');
                if (themeModule) {
                    themeModule.setTheme(theme);
                }
                
                this.core.emit('theme:changed', theme);
            },

            init() {
                // Get initial theme from our existing theme module
                const themeModule = this.core.getModule('theme');
                if (themeModule) {
                    this.currentTheme = themeModule.getCurrentTheme();
                }
            }
        }));

        this.debug('Core Alpine components registered');
    }

    /**
     * Set up event bridges between Alpine and our module system
     */
    setupEventBridges() {
        // Listen to our core events and update Alpine components
        this.on('state:changed', (event) => {
            const { path, value } = event.detail;
            this.updateAlpineFromState(path, value);
        });

        // Listen to module events and broadcast to Alpine
        this.on('search:performed', (event) => {
            this.broadcastToAlpine('search-updated', event.detail);
        });

        this.on('filter:applied', (event) => {
            this.broadcastToAlpine('filters-updated', event.detail);
        });

        this.on('view:changed', (event) => {
            this.broadcastToAlpine('view-mode-changed', event.detail);
        });
    }

    /**
     * Update Alpine components when our state changes
     */
    updateAlpineFromState(path, value) {
        // This method can be used to sync state changes to Alpine components
        // For now, we'll rely on Alpine's reactivity and our event system
        this.debug(`State updated: ${path} = ${value}`);
    }

    /**
     * Broadcast events to Alpine components
     */
    broadcastToAlpine(eventName, data) {
        if (this.isAlpineReady) {
            document.dispatchEvent(new CustomEvent(`alpine:${eventName}`, { detail: data }));
        }
    }

    /**
     * Register a custom Alpine component
     */
    registerComponent(name, componentFunction) {
        if (this.isAlpineReady && window.Alpine) {
            Alpine.data(name, componentFunction);
            this.alpineComponents.set(name, componentFunction);
            this.debug(`Registered Alpine component: ${name}`);
        } else {
            // Queue for later registration
            document.addEventListener('alpine:init', () => {
                Alpine.data(name, componentFunction);
                this.alpineComponents.set(name, componentFunction);
                this.debug(`Registered Alpine component: ${name}`);
            });
        }
    }

    /**
     * Helper method to create Alpine-compatible data functions
     */
    createAlpineData(initialData, methods = {}) {
        return () => ({
            ...initialData,
            ...methods,
            
            // Add core reference for easy access
            get core() {
                return window.core;
            }
        });
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.AlpineIntegrationModule = AlpineIntegrationModule;
}
