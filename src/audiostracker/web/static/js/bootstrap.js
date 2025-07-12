/**
 * AudiobookStalkerr Bootstrap
 * Initializes the application with the new modular architecture
 */

(function() {
    'use strict';

    // Prevent multiple initialization
    if (window.AudiobookStalkerrInitialized) {
        console.warn('AudiobookStalkerr already initialized, skipping');
        return;
    }

    console.log('AudiobookStalkerr Bootstrap starting...');
    
    // Set flag immediately to prevent race conditions
    window.AudiobookStalkerrInitialized = true;

    // Wait for DOM and dependencies to be ready
    function waitForDependencies() {
        return new Promise((resolve, reject) => {
            let attempts = 0;
            const maxAttempts = 50; // 5 seconds max wait
            
            function check() {
                attempts++;
                
                // Check for required dependencies
                const hasJQuery = typeof jQuery !== 'undefined';
                const hasBootstrap = typeof bootstrap !== 'undefined';
                const hasCore = typeof AudiobookStalkerrCore !== 'undefined';
                const hasRegistry = typeof ModuleRegistry !== 'undefined';
                const hasBaseModule = typeof BaseModule !== 'undefined';
                
                if (hasJQuery && hasBootstrap && hasCore && hasRegistry && hasBaseModule) {
                    resolve();
                    return;
                }
                
                if (attempts >= maxAttempts) {
                    reject(new Error('Required dependencies not loaded within timeout'));
                    return;
                }
                
                setTimeout(check, 100);
            }
            
            check();
        });
    }

    // Initialize the application
    async function initializeApp() {
        try {
            console.log('Initializing AudiobookStalkerr with modular architecture...');
            
            // Wait for dependencies
            await waitForDependencies();
            console.log('Dependencies loaded successfully');

            // Initialize the core
            await window.appCore.init();
            console.log('Core initialized');

            // Create module registry
            const registry = new ModuleRegistry(window.appCore);

            // Register core modules
            if (typeof StateModule !== 'undefined') {
                registry.register('state', StateModule, []);
            }
            if (typeof APIModule !== 'undefined') {
                registry.register('api', APIModule, []);
            }
            if (typeof ToastModule !== 'undefined') {
                registry.register('toast', ToastModule, []);
            }
            
            // Register UI modules  
            if (typeof ThemeModule !== 'undefined') {
                registry.register('theme', ThemeModule, ['state']);
            }
            if (typeof SearchModule !== 'undefined') {
                registry.register('search', SearchModule, ['state']);
            }
            if (typeof FiltersModule !== 'undefined') {
                registry.register('filters', FiltersModule, ['state']);
            }
            if (typeof ModalsModule !== 'undefined') {
                registry.register('modals', ModalsModule, ['api', 'toast']);
            }
            if (typeof TableViewModule !== 'undefined') {
                registry.register('tableView', TableViewModule, ['state']);
            }
            
            // Register Alpine.js integration
            if (typeof AlpineIntegrationModule !== 'undefined') {
                registry.register('alpine', AlpineIntegrationModule, ['state']);
            }
            
            // Register utility modules
            if (typeof ValidationModule !== 'undefined') {
                registry.register('validation', ValidationModule, []);
            }
            if (typeof ExportModule !== 'undefined') {
                registry.register('export', ExportModule, ['toast', 'api']);
            }
            
            // Register page-specific modules
            if (typeof UpcomingModule !== 'undefined') {
                // Only register UpcomingModule for non-Alpine pages
                const hasAlpineUpcoming = document.querySelector('[x-data="upcomingPageData()"]');
                if (!hasAlpineUpcoming) {
                    registry.register('upcoming', UpcomingModule, ['search', 'filters', 'api']);
                } else {
                    console.log('Alpine.js upcoming page detected - skipping traditional UpcomingModule');
                }
            }
            if (typeof AuthorDetailModule !== 'undefined') {
                registry.register('authorDetail', AuthorDetailModule, ['api', 'toast', 'modals']);
            }
            
            // Register main application
            if (typeof AudiobookStalkerrApp !== 'undefined') {
                registry.register('app', AudiobookStalkerrApp, ['state', 'api', 'toast']);
            }

            // Initialize all modules
            const success = await registry.initializeAll();
            
            // Initialize page-specific modules based on current page
            await initializePageSpecificModules(registry);
            
            if (success) {
                window.AudiobookStalkerrInitialized = true;
                console.log('AudiobookStalkerr initialized successfully with modular architecture');
                
                // Store registry for debugging
                window.moduleRegistry = registry;
                
                // Legacy compatibility - expose key modules globally
                window.app = window.appCore.getModule('app');
                window.api = window.appCore.getModule('api');
                window.state = window.appCore.getModule('state');
                window.toast = window.appCore.getModule('toast');
                window.modals = window.appCore.getModule('modals');
                
                // Emit initialization complete event
                window.appCore.emit('app:initialized');
                
                // Show success message
                const toastModule = window.appCore.getModule('toast');
                if (toastModule) {
                    toastModule.success('AudiobookStalkerr loaded successfully', 3000);
                }
                
            } else {
                throw new Error('Module initialization failed');
            }

        } catch (error) {
            console.error('Failed to initialize AudiobookStalkerr:', error);
            
            // Show user-friendly error
            const errorMsg = 'Failed to initialize AudiobookStalkerr. Please refresh the page.';
            if (typeof showToast === 'function') {
                showToast(errorMsg, 'error');
            } else {
                alert(errorMsg);
            }
        }
    }

    // Initialize page-specific modules
    async function initializePageSpecificModules(registry) {
        try {
            // Detect current page
            const currentPage = detectCurrentPage();
            console.log('Detected current page:', currentPage);
            
            // Initialize page-specific modules
            switch (currentPage) {
                case 'upcoming':
                    if (registry.isRegistered('upcoming')) {
                        console.log('✓ Upcoming module already initialized');
                    }
                    break;
                    
                case 'author-detail':
                    if (registry.isRegistered('authorDetail')) {
                        console.log('✓ AuthorDetail module already initialized');
                    }
                    if (registry.isRegistered('validation')) {
                        console.log('✓ Validation module already initialized');
                    }
                    break;
                    
                case 'authors':
                default:
                    // Authors page and default - already initialized by main app
                    break;
            }
            
            // Always check export module if available
            if (registry.isRegistered('export') && !window.appCore.getModule('export')) {
                console.log('Export module registered but not initialized');
            }
            
        } catch (error) {
            console.error('Failed to initialize page-specific modules:', error);
        }
    }

    // Detect current page based on URL and page content
    function detectCurrentPage() {
        const path = window.location.pathname;
        
        // Check URL patterns
        if (path.includes('/upcoming') || path.endsWith('/upcoming')) {
            return 'upcoming';
        }
        
        if (path.includes('/author/') || path.includes('/authors/') && path !== '/authors') {
            return 'author-detail';
        }
        
        if (path === '/' || path === '/authors' || path.endsWith('/authors')) {
            return 'authors';
        }
        
        // Check for page-specific elements or data
        if (document.getElementById('upcoming-container') || window.upcomingAudiobooks) {
            return 'upcoming';
        }
        
        if (document.getElementById('books-table') || window.authorData) {
            return 'author-detail';
        }
        
        if (document.getElementById('authors-table')) {
            return 'authors';
        }
        
        // Default to authors page
        return 'authors';
    }

    // Fallback to legacy initialization if new modules aren't available
    function initializeLegacy() {
        console.warn('Falling back to legacy initialization');
        
        // Initialize legacy modules that are available
        try {
            if (typeof AuthorsApp !== 'undefined') {
                window.authorsApp = new AuthorsApp();
                window.authorsApp.init();
            }
            
            if (typeof TableViewModule !== 'undefined') {
                window.tableView = new TableViewModule();
                window.tableView.init();
            }
            
            console.log('Legacy initialization complete');
        } catch (error) {
            console.error('Legacy initialization failed:', error);
        }
    }

    // Global functions for HTML compatibility
    window.showAddAuthorModal = function() {
        if (window.app && window.app.showAddAuthorModal) {
            window.app.showAddAuthorModal();
        } else if (window.modals && window.modals.showAddAuthorModal) {
            window.modals.showAddAuthorModal();
        } else {
            console.warn('Add author modal not available');
        }
    };

    window.exportCollection = function() {
        if (window.app && window.app.exportCollection) {
            window.app.exportCollection();
        } else if (window.api && window.api.exportCollection) {
            window.api.exportCollection();
        } else if (typeof simpleExport === 'function') {
            simpleExport();
        } else {
            console.warn('Export function not available');
        }
    };

    window.refreshData = function() {
        if (window.app && window.app.refreshData) {
            window.app.refreshData();
        } else {
            window.location.reload();
        }
    };

    window.setViewMode = function(mode) {
        if (window.app && window.app.setViewMode) {
            window.app.setViewMode(mode);
        } else {
            console.warn('setViewMode not available');
        }
    };

    // Module status checking for debugging
    window.checkModules = function() {
        if (window.moduleRegistry) {
            console.log('Module Registry Status:', window.moduleRegistry.getStatus());
        } else {
            console.log('Module registry not available');
        }
        
        if (window.appCore) {
            console.log('Available modules:', Array.from(window.appCore.modules.keys()));
        }
    };

    // Initialize when DOM is ready
    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => {
            console.log('DOM ready, starting initialization...');
            
            // Try new architecture first, fallback to legacy
            if (typeof AudiobookStalkerrCore !== 'undefined' && typeof ModuleRegistry !== 'undefined') {
                initializeApp();
            } else {
                console.warn('New architecture modules not available, trying legacy...');
                setTimeout(initializeLegacy, 1000);
            }
        });
    } else {
        // DOM already ready
        console.log('DOM already ready, starting initialization...');
        
        if (typeof AudiobookStalkerrCore !== 'undefined' && typeof ModuleRegistry !== 'undefined') {
            initializeApp();
        } else {
            setTimeout(initializeLegacy, 1000);
        }
    }

})();
