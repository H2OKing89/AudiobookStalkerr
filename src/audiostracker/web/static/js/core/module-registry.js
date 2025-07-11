/**
 * Module Registry and Dependency Manager
 * Handles module registration, initialization order, and dependency resolution
 */

class ModuleRegistry {
    constructor(core) {
        this.core = core;
        this.modules = new Map();
        this.dependencies = new Map();
        this.initOrder = [];
        this.initialized = new Set();
    }

    /**
     * Register a module with its dependencies
     */
    register(name, moduleClass, dependencies = []) {
        if (this.modules.has(name)) {
            console.warn(`Module ${name} already registered, replacing...`);
        }

        this.modules.set(name, {
            name,
            moduleClass,
            dependencies,
            instance: null
        });

        this.dependencies.set(name, dependencies);
        this.core.debug(`Registered module definition: ${name}`);
    }

    /**
     * Initialize all modules in dependency order
     */
    async initializeAll() {
        try {
            // Calculate initialization order
            this.calculateInitOrder();
            
            // Initialize modules in order
            for (const moduleName of this.initOrder) {
                await this.initializeModule(moduleName);
            }
            
            this.core.debug('All modules initialized successfully');
            return true;
            
        } catch (error) {
            console.error('Failed to initialize modules:', error);
            return false;
        }
    }

    /**
     * Initialize a specific module
     */
    async initializeModule(name) {
        if (this.initialized.has(name)) {
            this.core.debug(`Module ${name} already initialized, returning existing instance`);
            return this.getModuleInstance(name);
        }

        const moduleData = this.modules.get(name);
        if (!moduleData) {
            throw new Error(`Module ${name} not registered`);
        }

        this.core.debug(`Starting initialization of module: ${name}`);

        try {
            // Initialize dependencies first
            for (const depName of moduleData.dependencies) {
                await this.initializeModule(depName);
            }

            // Create and initialize the module
            const instance = new moduleData.moduleClass(this.core);
            moduleData.instance = instance;

            // Register with core
            this.core.registerModule(name, instance);

            // Initialize if it has an init method
            if (instance.init) {
                await instance.init();
            }

            this.initialized.add(name);
            this.core.debug(`Initialized module: ${name}`);
            
            return instance;

        } catch (error) {
            console.error(`Failed to initialize module ${name}:`, error);
            throw error;
        }
    }

    /**
     * Get a module instance
     */
    getModuleInstance(name) {
        const moduleData = this.modules.get(name);
        return moduleData ? moduleData.instance : null;
    }

    /**
     * Calculate the initialization order using topological sort
     */
    calculateInitOrder() {
        const visited = new Set();
        const visiting = new Set();
        const order = [];

        const visit = (name) => {
            if (visiting.has(name)) {
                throw new Error(`Circular dependency detected involving ${name}`);
            }
            if (visited.has(name)) {
                return;
            }

            visiting.add(name);
            
            const deps = this.dependencies.get(name) || [];
            for (const dep of deps) {
                if (!this.modules.has(dep)) {
                    throw new Error(`Module ${name} depends on ${dep}, but ${dep} is not registered`);
                }
                visit(dep);
            }
            
            visiting.delete(name);
            visited.add(name);
            order.push(name);
        };

        // Visit all modules
        for (const name of this.modules.keys()) {
            visit(name);
        }

        this.initOrder = order;
        this.core.debug('Module initialization order:', order);
    }

    /**
     * Get module registration status
     */
    getStatus() {
        const status = {
            registered: this.modules.size,
            initialized: this.initialized.size,
            modules: {}
        };

        for (const [name, moduleData] of this.modules) {
            status.modules[name] = {
                registered: true,
                initialized: this.initialized.has(name),
                dependencies: moduleData.dependencies,
                hasInstance: !!moduleData.instance
            };
        }

        return status;
   }

    /**
     * Cleanup all modules
     */
    destroy() {
        // Destroy modules in reverse order
        const reverseOrder = [...this.initOrder].reverse();
        
        for (const name of reverseOrder) {
            const instance = this.getModuleInstance(name);
            if (instance && instance.destroy) {
                try {
                    instance.destroy();
                } catch (error) {
                    console.error(`Error destroying module ${name}:`, error);
                }
            }
        }

        this.modules.clear();
        this.dependencies.clear();
        this.initialized.clear();
        this.initOrder = [];
    }

    /**
     * Check if a module is registered
     */
    isRegistered(name) {
        return this.modules.has(name);
    }
}

/**
 * Base Module Class
 * All modules should extend this for consistent interface
 */
class BaseModule {
    constructor(core) {
        this.core = core;
        this.isInitialized = false;
        this.moduleName = this.constructor.name;
    }

    /**
     * Initialize the module - override in subclasses
     */
    async init() {
        this.isInitialized = true;
        this.debug(`Base init for ${this.moduleName}`);
    }

    /**
     * Cleanup the module - override in subclasses
     */
    destroy() {
        this.isInitialized = false;
        this.debug(`Base destroy for ${this.moduleName}`);
    }

    /**
     * Emit an event through the core
     */
    emit(event, data) {
        if (this.core && this.core.emit) {
            this.core.emit(event, data);
        }
    }

    /**
     * Listen to events through the core
     */
    on(event, handler) {
        if (this.core && this.core.on) {
            this.core.on(event, handler);
        }
    }

    /**
     * Stop listening to events
     */
    off(event, handler) {
        if (this.core && this.core.off) {
            this.core.off(event, handler);
        }
    }

    /**
     * Get another module
     */
    getModule(name) {
        return this.core ? this.core.getModule(name) : null;
    }

    /**
     * API shortcut
     */
    async api(method, endpoint, data) {
        if (this.core && this.core.api) {
            return await this.core.api(method, endpoint, data);
        }
        throw new Error('Core not available');
    }

    /**
     * Notification shortcut
     */
    notify(message, type, duration) {
        if (this.core && this.core.notify) {
            this.core.notify(message, type, duration);
        }
    }

    /**
     * State shortcuts
     */
    setState(key, value) {
        if (this.core && this.core.setState) {
            this.core.setState(key, value);
        }
    }

    getState(key) {
        return this.core && this.core.getState ? this.core.getState(key) : undefined;
    }

    /**
     * Debug logging
     */
    debug(...args) {
        if (this.core && this.core.config && this.core.config.debug) {
            console.log(`[${this.moduleName}]`, ...args);
        }
    }

    /**
     * Warning logging
     */
    warn(...args) {
        console.warn(`[${this.moduleName}]`, ...args);
    }

    /**
     * Error logging
     */
    error(...args) {
        console.error(`[${this.moduleName}]`, ...args);
    }

    /**
     * Log message
     */
    log(...args) {
        console.log(`[${this.moduleName}]`, ...args);
    }

    /**
     * Utility method to generate unique IDs
     */
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Utility method to escape HTML
     */
    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Export classes
window.ModuleRegistry = ModuleRegistry;
window.BaseModule = BaseModule;

if (typeof module !== 'undefined' && module.exports) {
    module.exports = { ModuleRegistry, BaseModule };
}
