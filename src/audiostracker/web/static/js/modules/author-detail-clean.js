/**
 * AuthorDetailModule - Modular author detail page functionality
 * Manages individual author's book collection with DataTables integration
 */

class AuthorDetailModule extends window.AudiobookStalkerrCore.BaseModule {
    constructor() {
        super('authorDetail', ['api', 'toast', 'modals']);
    }

    init() {
        this.authorData = window.authorData || {};
        this.dataTable = null;
        this.currentViewMode = 'table';
        this.hasUnsavedChanges = false;
        
        // Modern browser APIs
        this.abortController = new AbortController();
        this.intersectionObserver = null;
        this.mutationObserver = null;
        this.resizeObserver = null;
        
        // Performance tracking
        this.performanceMetrics = {
            renderTime: 0,
            lastUpdate: Date.now(),
            bulkOperationTimes: new Map()
        };
        
        // Selection state
        this.selectionHistory = [];
        this.maxSelectionHistory = 10;

        this.setupEventListeners();
        this.initDataTable();
        this.setupObservers();
        this.checkForUnsavedChanges();
        this.setupAccessibility();
        
        this.log('AuthorDetailModule initialized for:', this.authorData.name);
    }

    setupEventListeners() {
        // Book selection changes with debouncing for performance
        let selectionTimeout;
        document.addEventListener('change', (e) => {
            if (e.target.matches('.book-checkbox')) {
                clearTimeout(selectionTimeout);
                selectionTimeout = setTimeout(() => {
                    this.handleBookSelection();
                }, 100);
            }
        });

        // Bulk actions with accessibility
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-bulk-action]')) {
                const action = e.target.dataset.bulkAction;
                this.handleBulkAction(action);
            }
            
            if (e.target.matches('[data-book-action]')) {
                const action = e.target.dataset.bookAction;
                const bookId = e.target.dataset.bookId;
                this.handleBookAction(action, bookId);
            }
        });

        // View mode toggles with keyboard support
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-view-mode]')) {
                const viewMode = e.target.dataset.viewMode;
                this.setViewMode(viewMode);
            }
        });
        
        // Keyboard navigation
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('[data-view-mode]') && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const viewMode = e.target.dataset.viewMode;
                this.setViewMode(viewMode);
            }
            
            // Global keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'a':
                        if (e.target.closest('.books-container')) {
                            e.preventDefault();
                            this.selectAllBooks();
                        }
                        break;
                    case 'd':
                        e.preventDefault();
                        this.deselectAllBooks();
                        break;
                    case 'Delete':
                        if (this.getSelectedBooks().length > 0) {
                            e.preventDefault();
                            this.handleBulkAction('delete');
                        }
                        break;
                }
            }
            
            // Escape key to clear selection
            if (e.key === 'Escape') {
                this.deselectAllBooks();
            }
        });

        // Listen for data updates
        this.core.on('author:book-updated', (data) => {
            this.refreshBookData(data.bookId);
        });

        this.core.on('author:books-updated', () => {
            this.refreshDataTable();
        });

        // Handle unsaved changes warning
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });
        
        // Page visibility for performance optimization
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden && Date.now() - this.performanceMetrics.lastUpdate > 300000) {
                // Refresh if page has been hidden for more than 5 minutes
                this.refreshDataTable();
            }
        });
    }

    /**
     * Setup modern browser observers
     */
    setupObservers() {
        // Intersection Observer for lazy loading and performance optimizations
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Lazy load book cover images
                        const img = entry.target.querySelector('img[data-src]');
                        if (img) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                        
                        // Load additional book details on demand
                        const bookElement = entry.target;
                        if (bookElement.dataset.bookId && !bookElement.dataset.detailsLoaded) {
                            this.loadBookDetails(bookElement.dataset.bookId, bookElement);
                        }
                    }
                });
            }, {
                rootMargin: '50px',
                threshold: 0.1
            });
        }
        
        // Mutation Observer for dynamic content changes
        if ('MutationObserver' in window) {
            this.mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach(mutation => {
                    if (mutation.type === 'childList' && mutation.addedNodes.length > 0) {
                        // Re-setup accessibility for new elements
                        this.setupAccessibilityForNewElements(mutation.addedNodes);
                    }
                });
            });
            
            const container = document.getElementById('books-container');
            if (container) {
                this.mutationObserver.observe(container, {
                    childList: true,
                    subtree: true
                });
            }
        }
        
        // Resize Observer for responsive adjustments
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.target.id === 'books-container') {
                        this.adjustLayoutForSize(entry.contentRect);
                    }
                });
            });
            
            const container = document.getElementById('books-container');
            if (container) {
                this.resizeObserver.observe(container);
            }
        }
    }

    /**
     * Setup accessibility features
     */
    setupAccessibility() {
        // Add ARIA labels and roles
        const selectAllCheckbox = document.getElementById('select-all-books');
        if (selectAllCheckbox) {
            selectAllCheckbox.setAttribute('aria-label', `Select all books by ${this.authorData.name}`);
            selectAllCheckbox.setAttribute('role', 'checkbox');
        }
        
        // Setup screen reader announcements
        this.createAnnouncementRegion();
        
        // Add keyboard shortcuts help
        this.addKeyboardShortcutsHelp();
    }

    /**
     * Initialize DataTable for books
     */
    initDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        const tableElement = document.getElementById('books-table');
        if (!tableElement) {
            this.warn('Books table element not found');
            return;
        }

        // Add accessibility attributes
        tableElement.setAttribute('role', 'table');
        tableElement.setAttribute('aria-label', `Books by ${this.authorData.name}`);

        this.dataTable = new DataTable(tableElement, {
            responsive: true,
            pageLength: 25,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            order: [[1, 'asc']], // Sort by title
            columnDefs: [
                {
                    targets: 0, // Checkbox column
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    width: '40px',
                    render: function(data, type, row) {
                        return `<input type="checkbox" class="book-checkbox" value="${row.id}" 
                                       aria-label="Select ${row.title}">`;
                    }
                },
                {
                    targets: -1, // Actions column (last column)
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    width: '120px',
                    render: function(data, type, row) {
                        return `
                            <div class="btn-group" role="group" aria-label="Book actions for ${row.title}">
                                <button class="btn btn-sm btn-outline-primary" 
                                        data-book-action="edit" 
                                        data-book-id="${row.id}"
                                        aria-label="Edit ${row.title}">
                                    <i class="fas fa-edit" aria-hidden="true"></i>
                                </button>
                                <button class="btn btn-sm btn-outline-danger" 
                                        data-book-action="delete" 
                                        data-book-id="${row.id}"
                                        aria-label="Delete ${row.title}">
                                    <i class="fas fa-trash" aria-hidden="true"></i>
                                </button>
                            </div>
                        `;
                    }
                }
            ],
            language: {
                emptyTable: `No books found for ${this.authorData.name}`,
                info: 'Showing _START_ to _END_ of _TOTAL_ books',
                infoEmpty: 'No books to show',
                infoFiltered: '(filtered from _MAX_ total books)',
                search: 'Search books:',
                paginate: {
                    first: 'First page',
                    last: 'Last page',
                    next: 'Next page',
                    previous: 'Previous page'
                }
            },
            dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
                 '<"row"<"col-sm-12"tr>>' +
                 '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
            drawCallback: () => {
                const startTime = performance.now();
                this.updateSelectionState();
                this.setupAccessibilityForTable();
                this.performanceMetrics.renderTime = performance.now() - startTime;
                this.performanceMetrics.lastUpdate = Date.now();
                this.core.emit('author:table-drawn');
            },
            initComplete: () => {
                // Add ARIA attributes after DataTable initialization
                this.enhanceDataTableAccessibility();
            }
        });

        this.log('DataTable initialized with', this.dataTable.rows().count(), 'books');
    }

    /**
     * Handle book selection changes
     */
    handleBookSelection() {
        const selectedBooks = this.getSelectedBooks();
        const totalBooks = this.getTotalBooks();
        
        // Update bulk action buttons
        const bulkActionContainer = document.getElementById('bulk-actions');
        if (bulkActionContainer) {
            bulkActionContainer.style.display = selectedBooks.length > 0 ? 'block' : 'none';
        }

        // Update select all checkbox
        const selectAllCheckbox = document.getElementById('select-all-books');
        if (selectAllCheckbox) {
            if (selectedBooks.length === 0) {
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = false;
            } else if (selectedBooks.length === totalBooks) {
                selectAllCheckbox.indeterminate = false;
                selectAllCheckbox.checked = true;
            } else {
                selectAllCheckbox.indeterminate = true;
                selectAllCheckbox.checked = false;
            }
        }

        // Update selection count
        const selectionCount = document.getElementById('selection-count');
        if (selectionCount) {
            selectionCount.textContent = `${selectedBooks.length} selected`;
        }

        this.core.emit('author:selection-changed', {
            selectedBooks,
            totalBooks,
            selectedCount: selectedBooks.length
        });
    }

    /**
     * Handle bulk actions
     */
    async handleBulkAction(action) {
        const selectedBooks = this.getSelectedBooks();
        if (selectedBooks.length === 0) {
            this.getModule('toast')?.show('No books selected', 'warning');
            return;
        }

        const api = this.getModule('api');
        const toast = this.getModule('toast');

        try {
            switch (action) {
                case 'delete':
                    await this.confirmBulkDelete(selectedBooks);
                    break;
                case 'mark-read':
                    await this.bulkUpdateStatus(selectedBooks, 'read');
                    break;
                case 'mark-unread':
                    await this.bulkUpdateStatus(selectedBooks, 'unread');
                    break;
                case 'add-to-watchlist':
                    await this.bulkUpdateWatchlist(selectedBooks, true);
                    break;
                case 'remove-from-watchlist':
                    await this.bulkUpdateWatchlist(selectedBooks, false);
                    break;
                default:
                    this.warn('Unknown bulk action:', action);
            }
        } catch (error) {
            this.error('Bulk action failed:', error);
            toast?.show(`Bulk action failed: ${error.message}`, 'error');
        }
    }

    /**
     * Handle individual book actions
     */
    async handleBookAction(action, bookId) {
        const api = this.getModule('api');
        const toast = this.getModule('toast');

        try {
            switch (action) {
                case 'toggle-status':
                    await this.toggleBookStatus(bookId);
                    break;
                case 'toggle-watchlist':
                    await this.toggleBookWatchlist(bookId);
                    break;
                case 'edit':
                    this.openEditModal(bookId);
                    break;
                case 'delete':
                    await this.confirmDeleteBook(bookId);
                    break;
                case 'view-details':
                    this.openDetailsModal(bookId);
                    break;
                default:
                    this.warn('Unknown book action:', action);
            }
        } catch (error) {
            this.error('Book action failed:', error);
            toast?.show(`Action failed: ${error.message}`, 'error');
        }
    }

    /**
     * Confirm bulk delete
     */
    async confirmBulkDelete(selectedBooks) {
        const modals = this.getModule('modals');
        if (!modals) {
            if (!confirm(`Delete ${selectedBooks.length} books?`)) return;
        } else {
            const confirmed = await modals.confirm({
                title: 'Delete Books',
                message: `Are you sure you want to delete ${selectedBooks.length} books? This action cannot be undone.`,
                confirmText: 'Delete',
                confirmClass: 'btn-danger'
            });
            if (!confirmed) return;
        }

        await this.bulkDeleteBooks(selectedBooks);
    }

    /**
     * Bulk delete books
     */
    async bulkDeleteBooks(bookIds) {
        const api = this.getModule('api');
        const toast = this.getModule('toast');

        const response = await api.delete('/api/books/bulk', {
            book_ids: bookIds,
            author_id: this.authorData.id
        });

        toast?.show(`Deleted ${bookIds.length} books`, 'success');
        this.refreshDataTable();
        this.hasUnsavedChanges = true;
    }

    /**
     * Bulk update book status
     */
    async bulkUpdateStatus(bookIds, status) {
        const api = this.getModule('api');
        const toast = this.getModule('toast');

        await api.put('/api/books/bulk-status', {
            book_ids: bookIds,
            status: status,
            author_id: this.authorData.id
        });

        toast?.show(`Updated ${bookIds.length} books to ${status}`, 'success');
        this.refreshDataTable();
        this.hasUnsavedChanges = true;
    }

    /**
     * Bulk update watchlist status
     */
    async bulkUpdateWatchlist(bookIds, inWatchlist) {
        const api = this.getModule('api');
        const toast = this.getModule('toast');

        await api.put('/api/books/bulk-watchlist', {
            book_ids: bookIds,
            in_watchlist: inWatchlist,
            author_id: this.authorData.id
        });

        const action = inWatchlist ? 'added to' : 'removed from';
        toast?.show(`${bookIds.length} books ${action} watchlist`, 'success');
        this.refreshDataTable();
        this.hasUnsavedChanges = true;
    }

    /**
     * Get selected book IDs
     */
    getSelectedBooks() {
        const checkboxes = document.querySelectorAll('.book-checkbox:checked');
        return Array.from(checkboxes).map(cb => cb.value);
    }

    /**
     * Get total number of books
     */
    getTotalBooks() {
        return document.querySelectorAll('.book-checkbox').length;
    }

    /**
     * Update selection state UI
     */
    updateSelectionState() {
        this.handleBookSelection();
    }

    /**
     * Set view mode
     */
    setViewMode(mode) {
        this.currentViewMode = mode;
        
        // Update UI to show selected view mode
        document.querySelectorAll('[data-view-mode]').forEach(btn => {
            btn.classList.remove('active');
            if (btn.dataset.viewMode === mode) {
                btn.classList.add('active');
            }
        });

        // Toggle between table and card views
        const tableContainer = document.getElementById('table-view');
        const cardContainer = document.getElementById('card-view');

        if (mode === 'table') {
            if (tableContainer) tableContainer.style.display = 'block';
            if (cardContainer) cardContainer.style.display = 'none';
        } else {
            if (tableContainer) tableContainer.style.display = 'none';
            if (cardContainer) cardContainer.style.display = 'block';
            this.renderCardView();
        }

        this.core.emit('author:view-mode-changed', mode);
    }

    /**
     * Render card view
     */
    renderCardView() {
        const cardContainer = document.getElementById('card-view');
        if (!cardContainer) return;

        // Implementation would depend on your data structure
        // This is a placeholder for card view rendering
        cardContainer.innerHTML = '<p>Card view implementation needed</p>';
    }

    /**
     * Refresh DataTable data
     */
    refreshDataTable() {
        if (this.dataTable) {
            this.dataTable.ajax.reload(null, false);
        }
    }

    /**
     * Refresh specific book data
     */
    async refreshBookData(bookId) {
        // Implementation depends on your data structure
        this.log('Refreshing book data for:', bookId);
    }

    /**
     * Check for unsaved changes
     */
    checkForUnsavedChanges() {
        // Monitor form changes, selections, etc.
        document.addEventListener('change', () => {
            this.hasUnsavedChanges = true;
        });
    }

    /**
     * Open edit modal for book
     */
    openEditModal(bookId) {
        const modals = this.getModule('modals');
        if (modals) {
            modals.show('edit-book-modal', { bookId });
        }
    }

    /**
     * Open details modal for book
     */
    openDetailsModal(bookId) {
        const modals = this.getModule('modals');
        if (modals) {
            modals.show('book-details-modal', { bookId });
        }
    }

    /**
     * Public API methods
     */
    getAPI() {
        return {
            refreshData: this.refreshDataTable.bind(this),
            getSelectedBooks: this.getSelectedBooks.bind(this),
            setViewMode: this.setViewMode.bind(this),
            getAuthorData: () => ({ ...this.authorData }),
            selectAllBooks: this.selectAllBooks.bind(this),
            deselectAllBooks: this.deselectAllBooks.bind(this),
            getPerformanceMetrics: () => ({ ...this.performanceMetrics }),
            bulkAction: this.handleBulkAction.bind(this)
        };
    }

    /**
     * Select all books
     */
    selectAllBooks() {
        document.querySelectorAll('.book-checkbox').forEach(checkbox => {
            checkbox.checked = true;
        });
        this.handleBookSelection();
        this.announceToScreenReader(`All ${this.getTotalBooks()} books selected`);
    }

    /**
     * Deselect all books
     */
    deselectAllBooks() {
        document.querySelectorAll('.book-checkbox').forEach(checkbox => {
            checkbox.checked = false;
        });
        this.handleBookSelection();
        this.announceToScreenReader('All books deselected');
    }

    /**
     * Create announcement region for screen readers
     */
    createAnnouncementRegion() {
        let liveRegion = document.getElementById('author-announcements');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'author-announcements';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }
    }

    /**
     * Announce to screen readers
     */
    announceToScreenReader(message) {
        const liveRegion = document.getElementById('author-announcements');
        if (liveRegion) {
            liveRegion.textContent = message;
            setTimeout(() => {
                liveRegion.textContent = '';
            }, 1000);
        }
    }

    /**
     * Add keyboard shortcuts help
     */
    addKeyboardShortcutsHelp() {
        // This could be expanded to show a help modal or tooltip
        const helpText = 'Keyboard shortcuts: Ctrl+A (select all), Ctrl+D (deselect all), Escape (clear selection), Delete (delete selected)';
        this.log('Keyboard shortcuts available:', helpText);
    }

    /**
     * Setup accessibility for new elements
     */
    setupAccessibilityForNewElements(nodes) {
        nodes.forEach(node => {
            if (node.nodeType === Node.ELEMENT_NODE) {
                // Add ARIA labels to checkboxes
                const checkboxes = node.querySelectorAll('.book-checkbox');
                checkboxes.forEach(checkbox => {
                    if (!checkbox.getAttribute('aria-label')) {
                        const bookTitle = checkbox.closest('tr')?.querySelector('.book-title')?.textContent;
                        if (bookTitle) {
                            checkbox.setAttribute('aria-label', `Select ${bookTitle}`);
                        }
                    }
                });
                
                // Add focus management for buttons
                const buttons = node.querySelectorAll('button[data-book-action]');
                buttons.forEach(button => {
                    if (!button.getAttribute('aria-label')) {
                        const action = button.dataset.bookAction;
                        const bookTitle = button.closest('tr')?.querySelector('.book-title')?.textContent;
                        if (action && bookTitle) {
                            button.setAttribute('aria-label', `${action} ${bookTitle}`);
                        }
                    }
                });
            }
        });
    }

    /**
     * Setup accessibility for table
     */
    setupAccessibilityForTable() {
        // Enhance table accessibility after each draw
        const table = document.getElementById('books-table');
        if (table) {
            // Add table caption if not present
            if (!table.querySelector('caption')) {
                const caption = document.createElement('caption');
                caption.textContent = `Books by ${this.authorData.name}`;
                caption.className = 'sr-only';
                table.prepend(caption);
            }
        }
    }

    /**
     * Enhance DataTable accessibility
     */
    enhanceDataTableAccessibility() {
        // Add ARIA attributes to DataTable controls
        const searchInput = document.querySelector('.dataTables_filter input');
        if (searchInput) {
            searchInput.setAttribute('aria-label', `Search books by ${this.authorData.name}`);
        }
        
        const lengthSelect = document.querySelector('.dataTables_length select');
        if (lengthSelect) {
            lengthSelect.setAttribute('aria-label', 'Number of books per page');
        }
        
        // Enhance pagination
        const paginationButtons = document.querySelectorAll('.dataTables_paginate .paginate_button');
        paginationButtons.forEach(button => {
            if (!button.getAttribute('aria-label')) {
                button.setAttribute('aria-label', button.textContent);
            }
        });
    }

    /**
     * Adjust layout based on container size
     */
    adjustLayoutForSize(contentRect) {
        const container = document.getElementById('books-container');
        if (container) {
            if (contentRect.width < 768) {
                container.classList.add('mobile-layout');
            } else {
                container.classList.remove('mobile-layout');
            }
        }
    }

    /**
     * Load book details on demand
     */
    async loadBookDetails(bookId, element) {
        try {
            const api = this.getModule('api');
            const details = await api.get(`/api/books/${bookId}/details`, {
                signal: this.abortController.signal
            });
            
            // Add details to element
            element.dataset.detailsLoaded = 'true';
            element.dataset.bookDetails = JSON.stringify(details);
            
        } catch (error) {
            if (error.name !== 'AbortError') {
                this.warn('Failed to load book details:', error);
            }
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Cancel any pending requests
        if (this.abortController) {
            this.abortController.abort();
        }
        
        // Disconnect observers
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Destroy DataTable
        if (this.dataTable) {
            this.dataTable.destroy();
        }
        
        // Remove announcement region
        const liveRegion = document.getElementById('author-announcements');
        if (liveRegion) {
            liveRegion.remove();
        }
        
        // Clear performance metrics
        this.performanceMetrics = null;
        
        this.log('AuthorDetailModule destroyed');
        super.destroy();
    }
}

// Register the module
if (window.AudiobookStalkerrCore?.ModuleRegistry) {
    window.AudiobookStalkerrCore.ModuleRegistry.register('authorDetail', AuthorDetailModule);
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthorDetailModule;
}
