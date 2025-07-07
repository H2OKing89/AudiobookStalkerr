/**
 * AudiobookStalkerr Application Core
 * Central application controller that manages all modules and provides
 * a clean, unified interface for inter-module communication.
 */

class AudiobookStalkerrCore {
    constructor() {
        this.modules = new Map();
        this.eventBus = new EventTarget();
        this.isInitialized = false;
        this.config = {
            debug: true,
            autoSave: true,
            autoSaveDelay: 5000
        };
        
        // Bind methods to preserve context
        this.emit = this.emit.bind(this);
        this.on = this.on.bind(this);
        this.off = this.off.bind(this);
    }

    /**
     * Initialize the application core
     */
    async init() {
        if (this.isInitialized) {
            this.debug('Core already initialized');
            return;
        }

        try {
            this.debug('Initializing AudiobookStalkerr Core...');
            
            // Load configuration
            this.loadConfig();
            
            // Initialize core modules in order
            await this.initializeCoreModules();
            
            // Set up global error handlers
            this.setupErrorHandlers();
            
            this.isInitialized = true;
            this.emit('core:initialized');
            this.debug('Core initialization complete');
            
        } catch (error) {
            console.error('Failed to initialize AudiobookStalkerr Core:', error);
            throw error;
        }
    }

    /**
     * Register a module with the core
     */
    registerModule(name, moduleInstance) {
        if (this.modules.has(name)) {
            this.debug(`Module ${name} already registered, replacing...`);
        }
        
        this.modules.set(name, moduleInstance);
        this.debug(`Registered module: ${name}`);
        
        // If module has init method and core is already initialized, init the module
        if (this.isInitialized && moduleInstance.init) {
            moduleInstance.init();
        }
        
        this.emit('module:registered', { name, module: moduleInstance });
    }

    /**
     * Get a registered module
     */
    getModule(name) {
        return this.modules.get(name);
    }

    /**
     * Check if a module is registered
     */
    hasModule(name) {
        return this.modules.has(name);
    }

    /**
     * Event system for inter-module communication
     */
    emit(event, data = null) {
        this.eventBus.dispatchEvent(new CustomEvent(event, { detail: data }));
        this.debug(`Event emitted: ${event}`, data);
    }

    on(event, handler) {
        this.eventBus.addEventListener(event, handler);
    }

    off(event, handler) {
        this.eventBus.removeEventListener(event, handler);
    }

    /**
     * Global state management
     */
    setState(key, value) {
        const stateModule = this.getModule('state');
        if (stateModule && stateModule.set) {
            stateModule.set(key, value);
            this.emit('state:changed', { key, value });
        } else {
            console.warn('State module not available');
        }
    }

    getState(key) {
        const stateModule = this.getModule('state');
        return stateModule ? stateModule.get(key) : undefined;
    }

    /**
     * API calls through the core
     */
    async api(method, endpoint, data = null) {
        const apiModule = this.getModule('api');
        if (!apiModule) {
            throw new Error('API module not available');
        }
        
        return await apiModule.request(method, endpoint, data);
    }

    /**
     * Show notifications through the core
     */
    notify(message, type = 'info', duration = 5000) {
        const toastModule = this.getModule('toast');
        if (toastModule && toastModule.show) {
            toastModule.show(message, type, duration);
        } else {
            // Fallback to console
            console.log(`[${type.toUpperCase()}] ${message}`);
        }
    }

    /**
     * Load user configuration
     */
    loadConfig() {
        const saved = localStorage.getItem('AudiobookStalkerr_config');
        if (saved) {
            try {
                this.config = { ...this.config, ...JSON.parse(saved) };
            } catch (e) {
                console.warn('Failed to load saved config:', e);
            }
        }
    }

    /**
     * Save configuration
     */
    saveConfig() {
        localStorage.setItem('AudiobookStalkerr_config', JSON.stringify(this.config));
    }

    /**
     * Update configuration
     */
    updateConfig(updates) {
        this.config = { ...this.config, ...updates };
        this.saveConfig();
        this.emit('config:updated', this.config);
    }

    /**
     * Initialize core modules in the correct order
     */
    async initializeCoreModules() {
        const coreModules = ['state', 'api', 'toast', 'theme'];
        
        for (const moduleName of coreModules) {
            const module = this.getModule(moduleName);
            if (module && module.init) {
                try {
                    await module.init();
                    this.debug(`Initialized core module: ${moduleName}`);
                } catch (error) {
                    console.error(`Failed to initialize core module ${moduleName}:`, error);
                }
            }
        }
    }

    /**
     * Set up global error handlers with better error reporting
     */
    setupErrorHandlers() {
        // Enhanced error handler with user feedback
        window.addEventListener('error', (event) => {
            console.error('Global error:', event.error);
            this.handleGlobalError(event.error, 'Global Error');
            this.emit('error:global', event.error);
        });

        // Enhanced unhandled promise rejection handler
        window.addEventListener('unhandledrejection', (event) => {
            console.error('Unhandled promise rejection:', event.reason);
            this.handleGlobalError(event.reason, 'Promise Rejection');
            this.emit('error:unhandled-promise', event.reason);
            
            // Prevent default browser behavior (console logging)
            event.preventDefault();
        });
        
        // Set up performance monitoring
        this.setupPerformanceMonitoring();
    }

    /**
     * Handle global errors with user-friendly messages
     */
    handleGlobalError(error, context) {
        // Don't show user notifications for certain error types
        const silentErrors = ['ResizeObserver loop limit exceeded', 'Non-Error promise rejection captured'];
        
        if (silentErrors.some(msg => error.message?.includes(msg))) {
            return;
        }
        
        // Show user-friendly error message
        let userMessage = 'An unexpected error occurred. Please try refreshing the page.';
        
        if (error.name === 'ChunkLoadError' || error.message?.includes('Loading chunk')) {
            userMessage = 'Failed to load application resources. Please refresh the page.';
        } else if (error.name === 'NetworkError' || error.message?.includes('fetch')) {
            userMessage = 'Network connection issue. Please check your connection and try again.';
        }
        
        this.notify(userMessage, 'error', 8000);
    }

    /**
     * Set up performance monitoring
     */
    setupPerformanceMonitoring() {
        // Use Performance Observer API if available
        if ('PerformanceObserver' in window) {
            try {
                const observer = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (entry.entryType === 'navigation') {
                            this.debug(`Page load time: ${entry.loadEventEnd - entry.loadEventStart}ms`);
                        } else if (entry.entryType === 'measure') {
                            this.debug(`Performance measure ${entry.name}: ${entry.duration}ms`);
                        }
                    });
                });
                
                observer.observe({ entryTypes: ['navigation', 'measure'] });
                this.performanceObserver = observer;
            } catch (error) {
                this.debug('Performance monitoring not available:', error);
            }
        }
        
        // Monitor long tasks if supported
        if ('PerformanceObserver' in window) {
            try {
                const longTaskObserver = new PerformanceObserver((list) => {
                    list.getEntries().forEach((entry) => {
                        if (entry.duration > 50) {
                            this.debug(`Long task detected: ${entry.duration}ms`);
                        }
                    });
                });
                
                longTaskObserver.observe({ entryTypes: ['longtask'] });
                this.longTaskObserver = longTaskObserver;
            } catch (error) {
                this.debug('Long task monitoring not available:', error);
            }
        }
    }

    /**
     * Performance measurement utilities
     */
    startPerformanceMeasure(name) {
        if ('performance' in window && 'mark' in performance) {
            performance.mark(`${name}-start`);
        }
    }

    endPerformanceMeasure(name) {
        if ('performance' in window && 'mark' in performance && 'measure' in performance) {
            performance.mark(`${name}-end`);
            performance.measure(name, `${name}-start`, `${name}-end`);
        }
    }

    /**
     * Memory usage monitoring
     */
    getMemoryUsage() {
        if ('memory' in performance) {
            return {
                used: Math.round(performance.memory.usedJSHeapSize / 1048576), // MB
                total: Math.round(performance.memory.totalJSHeapSize / 1048576), // MB
                limit: Math.round(performance.memory.jsHeapSizeLimit / 1048576) // MB
            };
        }
        return null;
    }

    /**
     * Enhanced cleanup with performance observer cleanup
     */
    destroy() {
        // Clean up performance observers
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        if (this.longTaskObserver) {
            this.longTaskObserver.disconnect();
        }

        // Clean up modules
        this.modules.forEach(module => {
            if (module && typeof module.destroy === 'function') {
                try {
                    module.destroy();
                } catch (error) {
                    console.error('Error destroying module:', error);
                }
            }
        });
        
        this.modules.clear();
        this.debug('AudiobookStalkerrCore destroyed');
    }

    /**
     * Debug logging
     */
    debug(...args) {
        if (this.config.debug) {
            console.log('[AudiobookStalkerr Core]', ...args);
        }
    }
}

// Create and export the core instance
window.AudiobookStalkerrCore = AudiobookStalkerrCore;
window.appCore = new AudiobookStalkerrCore();

// Also make it available as a module export for modern environments
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudiobookStalkerrCore;
}
