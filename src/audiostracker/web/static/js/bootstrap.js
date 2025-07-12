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

    // Detect current page based on URL and page content
    function detectCurrentPage() {
        const path = window.location.pathname;
        
        // Check URL patterns
        if (path.includes('/upcoming') || path.endsWith('/upcoming')) {
            return 'upcoming';
        }
        
        if (path.includes('/author/') || (path.includes('/authors/') && path !== '/authors')) {
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
            
            // Register page-specific modules based on current page
            const currentPage = detectCurrentPage();
            console.log('Current page detected as:', currentPage);
            
            if (typeof UpcomingModule !== 'undefined' && currentPage === 'upcoming') {
                // Only register UpcomingModule for upcoming pages
                const hasAlpineUpcoming = document.querySelector('[x-data="upcomingPageData()"]');
                if (!hasAlpineUpcoming) {
                    registry.register('upcoming', UpcomingModule, ['search', 'filters', 'api']);
                } else {
                    console.log('Alpine.js upcoming page detected - skipping traditional UpcomingModule');
                }
            }
            
            if (typeof AuthorDetailModule !== 'undefined' && currentPage === 'author-detail') {
                registry.register('authorDetail', AuthorDetailModule, ['api', 'toast', 'modals']);
                console.log('Registered AuthorDetailModule for author detail page');
            } else if (typeof AuthorDetailModule !== 'undefined') {
                console.log('Skipping AuthorDetailModule registration - not on author detail page, current page:', currentPage);
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
                
                // Hide loading overlay now that initialization is complete
                hideLoadingOverlay();
                
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
            
            // Hide loading overlay even in case of error
            hideLoadingOverlay();
            
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
            
            // Hide loading overlay after legacy initialization
            hideLoadingOverlay();
            
        } catch (error) {
            console.error('Legacy initialization failed:', error);
            
            // Hide loading overlay even if legacy initialization fails
            hideLoadingOverlay();
        }
    }

    // Utility functions for loading overlay
    function showLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.add('show');
        }
    }

    function hideLoadingOverlay() {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.classList.remove('show');
        }
    }

    // Global functions for HTML compatibility
    window.showAddAuthorModal = function() {
        const modalsModule = window.appCore?.getModule('modals');
        if (modalsModule && modalsModule.showAddAuthorModal) {
            modalsModule.showAddAuthorModal();
        } else if (window.app && window.app.showAddAuthorModal) {
            window.app.showAddAuthorModal();
        } else if (window.modals && window.modals.showAddAuthorModal) {
            window.modals.showAddAuthorModal();
        } else {
            console.warn('Add author modal not available - falling back to simple prompt');
            const authorName = prompt('Enter author name:');
            if (authorName && authorName.trim()) {
                fetch('/api/authors', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
                    body: `author_name=${encodeURIComponent(authorName.trim())}`
                })
                .then(response => response.json())
                .then(data => {
                    if (data.success) {
                        alert('Author added successfully!');
                        window.location.reload();
                    } else {
                        alert('Error: ' + (data.detail || data.message || 'Unknown error'));
                    }
                })
                .catch(error => {
                    console.error('Error adding author:', error);
                    alert('Error adding author: ' + error.message);
                });
            }
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

    // Global author management functions
    window.deleteAuthor = function(authorName) {
        const modalsModule = window.appCore?.getModule('modals');
        const apiModule = window.appCore?.getModule('api');
        
        if (!authorName) {
            console.error('Author name is required for deletion');
            return;
        }
        
        // Use modern modal if available, fallback to confirm dialog
        if (modalsModule && modalsModule.createModal) {
            showDeleteAuthorModal(authorName, apiModule);
        } else {
            // Fallback to confirm dialog
            const confirmDelete = confirm(`Are you sure you want to delete "${authorName}" and all their books? This action cannot be undone.`);
            
            if (confirmDelete && apiModule) {
                performAuthorDeletion(authorName, apiModule);
            }
        }
    };

    // Helper function to show delete confirmation modal
    function showDeleteAuthorModal(authorName, apiModule) {
        const modalsModule = window.appCore.getModule('modals');
        const modalId = 'delete-author-confirmation';
        
        const content = `
            <div class="text-center mb-4">
                <div class="avatar avatar-xl bg-danger text-white mx-auto mb-3">
                    <i class="fas fa-exclamation-triangle fa-2x"></i>
                </div>
                <h4 class="text-danger mb-2">Delete Author</h4>
                <p class="mb-4">
                    Are you sure you want to delete <strong>${modalsModule.escapeHtml(authorName)}</strong> and all their books?
                </p>
                <div class="alert alert-danger">
                    <i class="fas fa-warning me-2"></i>
                    <strong>Warning:</strong> This action cannot be undone. All book entries for this author will be permanently deleted.
                </div>
            </div>
        `;
        
        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                <i class="fas fa-times me-2"></i>Cancel
            </button>
            <button type="button" class="btn btn-danger" id="confirm-delete-author">
                <i class="fas fa-trash me-2"></i>Delete Author
            </button>
        `;

        const modal = modalsModule.createModal(modalId, 'Confirm Deletion', content, {
            footer: footer,
            centered: true,
            backdrop: 'static'
        });

        // Add delete confirmation handler
        const confirmBtn = modal.querySelector('#confirm-delete-author');
        if (confirmBtn) {
            confirmBtn.addEventListener('click', () => {
                // Close modal first
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
                
                // Perform deletion
                performAuthorDeletion(authorName, apiModule);
            });
        }

        modalsModule.showModal(modal, { backdrop: 'static' });
    }

    // Helper function to perform the actual deletion
    function performAuthorDeletion(authorName, apiModule) {
        const toastModule = window.appCore?.getModule('toast');
        
        // Show loading
        if (window.showLoading) window.showLoading(true);
        
        apiModule.deleteAuthor(authorName)
            .then(() => {
                if (toastModule) {
                    toastModule.success(`Author "${authorName}" deleted successfully`);
                }
                // Refresh the page to update the display
                setTimeout(() => window.location.reload(), 1000);
            })
            .catch(error => {
                console.error('Error deleting author:', error);
                if (toastModule) {
                    toastModule.error(`Failed to delete author: ${error.message}`);
                }
                // Hide loading on error
                if (window.showLoading) window.showLoading(false);
            });
    }

    window.deleteSelected = function() {
        console.warn('deleteSelected function not yet implemented');
        const toastModule = window.appCore?.getModule('toast');
        if (toastModule) {
            toastModule.warn('Bulk delete functionality coming soon');
        }
    };

    window.exportSelected = function() {
        console.warn('exportSelected function not yet implemented');
        const toastModule = window.appCore?.getModule('toast');
        if (toastModule) {
            toastModule.warn('Bulk export functionality coming soon');
        }
    };

    window.showQuickAddModal = function() {
        const modalsModule = window.appCore?.getModule('modals');
        if (modalsModule && modalsModule.showAddAuthorModal) {
            modalsModule.showAddAuthorModal();
        } else {
            console.warn('Modals module not available for quick add');
        }
    };

    window.showKeyboardShortcuts = function() {
        console.warn('showKeyboardShortcuts function not yet implemented');
        const toastModule = window.appCore?.getModule('toast');
        if (toastModule) {
            toastModule.info('Keyboard shortcuts: Ctrl+A (Add Author), Delete (Delete Selected), Esc (Cancel)');
        }
    };

    window.toggleSettingsPanel = function() {
        const panel = document.getElementById('settings-panel');
        const backdrop = document.getElementById('settings-backdrop');
        
        if (panel && backdrop) {
            const isVisible = panel.classList.contains('show');
            if (isVisible) {
                panel.classList.remove('show');
                backdrop.classList.remove('show');
            } else {
                panel.classList.add('show');
                backdrop.classList.add('show');
            }
        }
    };

    window.toggleAutoSave = function() {
        console.warn('toggleAutoSave function not yet implemented');
        const toastModule = window.appCore?.getModule('toast');
        if (toastModule) {
            toastModule.info('Auto-save toggle functionality coming soon');
        }
    };

    // Global loading control functions
    window.showLoading = function(show = true) {
        if (show) {
            showLoadingOverlay();
        } else {
            hideLoadingOverlay();
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

    // Safety mechanism: automatically hide loading overlay after 10 seconds
    setTimeout(() => {
        const overlay = document.getElementById('loading-overlay');
        if (overlay && (overlay.style.display === 'flex' || overlay.classList.contains('show'))) {
            console.warn('Loading overlay still visible after 10 seconds, forcing hide');
            hideLoadingOverlay();
        }
    }, 10000);

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
