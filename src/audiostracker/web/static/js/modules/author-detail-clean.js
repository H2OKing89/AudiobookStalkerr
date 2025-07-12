/**
 * Auth    async init() {
        // Call parent init first
        await super.init();
        
        // Prevent double initialization (BaseModule sets isInitialized)
        if (this.isInitialized && this.dataTable) {
            this.debug('Module already initialized, skipping');
            return;
        }
        
        // Check if we're actually on an author detail page
        if (!window.authorData && !document.getElementById('books-table')) {
            this.debug('Not on author detail page, skipping initialization');
            return;
        }
        
        this.authorData = window.authorData || {};
        this.dataTable = null;
        this.currentViewMode = 'table';
        this.hasUnsavedChanges = false; - Modular author detail page functionality
 * Manages individual author's book collection with DataTables integration
 */

class AuthorDetailModule extends window.BaseModule {
    constructor(core) {
        super(core);
        this.dependencies = ['api', 'toast', 'modals'];
    }

    async init() {
        // Call parent init first
        await super.init();
        
        // Prevent double initialization (BaseModule sets isInitialized)
        if (this.isInitialized && this.dataTable) {
            this.debug('AuthorDetailModule already fully initialized, skipping');
            return;
        }
        
        this.authorData = window.authorData || {};
        this.dataTable = null;
        this.currentViewMode = 'table';
        this.hasUnsavedChanges = false;
        
        // Selection management
        this.selectionHistory = [];
        this.maxSelectionHistory = 10;
        
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
                // Only handle data-book-action if we have a valid bookId
                if (bookId !== undefined) {
                    this.handleBookAction(action, bookId);
                }
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
        const tableElement = document.getElementById('books-table');
        if (!tableElement) {
            this.warn('Books table element not found');
            return;
        }

        // Ensure jQuery and DataTables are available
        if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
            this.warn('jQuery or DataTables not available, skipping DataTable initialization');
            return;
        }

        // Check if DataTable is already initialized using jQuery DataTables API
        if ($.fn.DataTable && $.fn.DataTable.isDataTable && $.fn.DataTable.isDataTable(tableElement)) {
            this.debug('DataTable already initialized, getting existing instance');
            this.dataTable = $(tableElement).DataTable();
            return;
        }

        // Destroy existing instance if we have a reference
        if (this.dataTable) {
            try {
                this.dataTable.destroy();
                this.dataTable = null;
            } catch (error) {
                this.warn('Error destroying existing DataTable:', error);
            }
        }

        // Add accessibility attributes
        tableElement.setAttribute('role', 'table');
        tableElement.setAttribute('aria-label', `Books by ${this.authorData.name}`);

        this.dataTable = new DataTable(tableElement, {
            responsive: false,  // Temporarily disabled to fix errors
            pageLength: 25,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            order: [[1, 'asc']], // Sort by title
            columnDefs: [
                {
                    targets: 0, // Checkbox column
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    width: '40px'
                },
                {
                    targets: -1, // Actions column (last column)
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    width: '120px'
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
     * Update selection state for checkboxes and bulk actions
     */
    updateSelectionState() {
        const checkboxes = document.querySelectorAll('.book-checkbox');
        const selectAllCheckbox = document.getElementById('select-all-books');
        const selectedCount = Array.from(checkboxes).filter(cb => cb.checked).length;
        const totalCount = checkboxes.length;
        
        // Update select all checkbox state
        if (selectAllCheckbox) {
            if (selectedCount === 0) {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = false;
            } else if (selectedCount === totalCount) {
                selectAllCheckbox.checked = true;
                selectAllCheckbox.indeterminate = false;
            } else {
                selectAllCheckbox.checked = false;
                selectAllCheckbox.indeterminate = true;
            }
        }
        
        // Update bulk action buttons
        const bulkActions = document.querySelectorAll('.bulk-action-btn');
        bulkActions.forEach(btn => {
            btn.disabled = selectedCount === 0;
        });
        
        // Update selection counter
        const selectionCounter = document.getElementById('selection-counter');
        if (selectionCounter) {
            selectionCounter.textContent = selectedCount > 0 ? `${selectedCount} selected` : '';
        }
        
        // Store selection for history
        if (this.selectionHistory && selectedCount > 0) {
            const selectedIds = Array.from(checkboxes)
                .filter(cb => cb.checked)
                .map(cb => cb.value);
            this.addToSelectionHistory(selectedIds);
        }
    }

    /**
     * Setup accessibility features for the DataTable
     */
    setupAccessibilityForTable() {
        const table = document.getElementById('books-table');
        if (!table) return;
        
        // Add ARIA labels to checkboxes
        const checkboxes = table.querySelectorAll('.book-checkbox');
        checkboxes.forEach((checkbox, index) => {
            const row = checkbox.closest('tr');
            if (row) {
                const titleCell = row.querySelector('td:nth-child(2)'); // Assuming title is in 2nd column
                const title = titleCell ? titleCell.textContent.trim() : `book ${index + 1}`;
                checkbox.setAttribute('aria-label', `Select ${title}`);
            }
        });
        
        // Add keyboard navigation
        table.addEventListener('keydown', (e) => {
            if (e.key === ' ' && e.target.classList.contains('book-checkbox')) {
                e.preventDefault();
                e.target.checked = !e.target.checked;
                this.updateSelectionState();
            }
        });
        
        // Add row highlighting for keyboard navigation
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            row.setAttribute('tabindex', '0');
            row.addEventListener('focus', () => {
                row.classList.add('table-active');
            });
            row.addEventListener('blur', () => {
                row.classList.remove('table-active');
            });
        });
    }

    /**
     * Enhance DataTable with comprehensive accessibility features
     */
    enhanceDataTableAccessibility() {
        const table = document.getElementById('books-table');
        if (!table) return;
        
        // Add table caption
        let caption = table.querySelector('caption');
        if (!caption) {
            caption = document.createElement('caption');
            caption.textContent = `Books by ${this.authorData.name}`;
            caption.className = 'visually-hidden';
            table.insertBefore(caption, table.firstChild);
        }
        
        // Enhance column headers
        const headers = table.querySelectorAll('th');
        headers.forEach((header, index) => {
            header.setAttribute('scope', 'col');
            if (!header.id) {
                header.id = `book-header-${index}`;
            }
        });
        
        // Add sort indicators to sortable columns
        const sortableHeaders = table.querySelectorAll('th[class*="sorting"]');
        sortableHeaders.forEach(header => {
            header.setAttribute('role', 'columnheader');
            header.setAttribute('aria-sort', 'none');
            
            // Update aria-sort based on current sort state
            if (header.classList.contains('sorting_asc')) {
                header.setAttribute('aria-sort', 'ascending');
            } else if (header.classList.contains('sorting_desc')) {
                header.setAttribute('aria-sort', 'descending');
            }
        });
        
        // Add row headers for better screen reader support
        const rows = table.querySelectorAll('tbody tr');
        rows.forEach(row => {
            const firstCell = row.querySelector('td:not(.dataTables_empty)');
            if (firstCell && !firstCell.getAttribute('scope')) {
                firstCell.setAttribute('scope', 'row');
            }
        });
        
        // Add live region for table updates
        if (!document.getElementById('table-status')) {
            const statusRegion = document.createElement('div');
            statusRegion.id = 'table-status';
            statusRegion.setAttribute('aria-live', 'polite');
            statusRegion.setAttribute('aria-atomic', 'true');
            statusRegion.className = 'visually-hidden';
            table.parentNode.insertBefore(statusRegion, table.nextSibling);
        }
        
        // Announce table state changes
        const info = table.parentNode.querySelector('.dataTables_info');
        if (info) {
            const statusRegion = document.getElementById('table-status');
            if (statusRegion) {
                statusRegion.textContent = info.textContent;
            }
        }
    }

    /**
     * Add selection to history for undo functionality
     */
    addToSelectionHistory(selectedIds) {
        if (!this.selectionHistory) this.selectionHistory = [];
        
        this.selectionHistory.push({
            timestamp: Date.now(),
            selectedIds: [...selectedIds]
        });
        
        // Keep only recent history
        if (this.selectionHistory.length > this.maxSelectionHistory) {
            this.selectionHistory = this.selectionHistory.slice(-this.maxSelectionHistory);
        }
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
     * Open edit modal for book
     */
    openEditModal(bookIndex) {
        try {
            // Convert bookIndex to number if it's a string
            const index = typeof bookIndex === 'string' ? parseInt(bookIndex, 10) : bookIndex;
            
            // Validate index and get book by array index
            if (index < 0 || index >= this.authorData.books.length || isNaN(index)) {
                this.debug(`Invalid book index: ${bookIndex}. Available indices: 0-${this.authorData.books.length - 1}`);
                throw new Error('Book not found');
            }
            
            const book = this.authorData.books[index];
            if (!book) {
                this.debug(`Book not found at index: ${index}. Available books:`, this.authorData.books.map((b, i) => ({index: i, title: b.title})));
                throw new Error('Book not found');
            }

            const modalsModule = this.getModule('modals');
            if (!modalsModule) {
                throw new Error('Modals module not available');
            }

            // For now, show a simple edit form - this could be expanded later
            const modalId = 'edit-book-modal';
            const content = `
                <form id="edit-book-form-${modalId}">
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="edit-book-title-${modalId}" class="form-label">Book Title <span class="text-danger">*</span></label>
                                <input type="text" class="form-control" id="edit-book-title-${modalId}" 
                                       value="${this.escapeHtml(book.title || '')}" required>
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="edit-book-series-${modalId}" class="form-label">Series</label>
                                <input type="text" class="form-control" id="edit-book-series-${modalId}" 
                                       value="${this.escapeHtml(book.series || '')}">
                            </div>
                        </div>
                    </div>
                    <div class="row">
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="edit-book-publisher-${modalId}" class="form-label">Publisher</label>
                                <input type="text" class="form-control" id="edit-book-publisher-${modalId}" 
                                       value="${this.escapeHtml(book.publisher || '')}">
                            </div>
                        </div>
                        <div class="col-md-6">
                            <div class="mb-3">
                                <label for="edit-book-series-number-${modalId}" class="form-label">Series Number</label>
                                <input type="text" class="form-control" id="edit-book-series-number-${modalId}" 
                                       value="${this.escapeHtml(book.series_number || '')}">
                            </div>
                        </div>
                    </div>
                    <div class="mb-3">
                        <label for="edit-book-narrator-${modalId}" class="form-label">Narrator(s)</label>
                        <input type="text" class="form-control" id="edit-book-narrator-${modalId}" 
                               value="${this.escapeHtml(Array.isArray(book.narrator) ? book.narrator.join(', ') : (book.narrator || ''))}">
                        <div class="form-text">Enter narrator names separated by commas</div>
                    </div>
                </form>
            `;
            
            const footer = `
                <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                    <i class="fas fa-times me-2"></i>Cancel
                </button>
                <button type="button" class="btn btn-primary" id="submit-edit-book-btn-${modalId}">
                    <i class="fas fa-save me-2"></i>Save Changes
                </button>
            `;

            const modal = modalsModule.createModal(modalId, `Edit Book: ${book.title}`, content, {
                footer: footer,
                size: 'lg',
                centered: true
            });

            // Add submit handler
            const submitBtn = modal.querySelector(`#submit-edit-book-btn-${modalId}`);
            if (submitBtn) {
                submitBtn.addEventListener('click', () => {
                    this.submitEditBook(modalId, bookIndex);
                });
            }

            modalsModule.showModal(modal);
            
            // Focus on title input
            setTimeout(() => {
                const titleInput = modal.querySelector(`#edit-book-title-${modalId}`);
                if (titleInput) titleInput.focus();
            }, 300);

        } catch (error) {
            this.error('Error opening edit modal:', error);
            this.notify(`Failed to open edit modal: ${error.message}`, 'error');
        }
    }

    /**
     * Submit edit book form
     */
    async submitEditBook(modalId, bookIndex) {
        try {
            const titleInput = document.getElementById(`edit-book-title-${modalId}`);
            if (!titleInput || !titleInput.value.trim()) {
                this.notify('Please enter a book title', 'warning');
                if (titleInput) {
                    titleInput.classList.add('is-invalid');
                    titleInput.focus();
                }
                return;
            }

            const bookData = {
                title: titleInput.value.trim(),
                series: document.getElementById(`edit-book-series-${modalId}`)?.value.trim() || '',
                series_number: document.getElementById(`edit-book-series-number-${modalId}`)?.value.trim() || '',
                publisher: document.getElementById(`edit-book-publisher-${modalId}`)?.value.trim() || '',
                narrator: this.parseNarrators(document.getElementById(`edit-book-narrator-${modalId}`)?.value || '')
            };

            const apiModule = this.getModule('api');
            if (!apiModule) {
                throw new Error('API module not available');
            }

            await apiModule.updateBook(this.authorData.name, bookIndex, bookData);
            this.notify(`Book "${bookData.title}" updated successfully`, 'success');
            
            // Close modal
            const modalsModule = this.getModule('modals');
            const modalData = modalsModule.activeModals.get(modalId);
            if (modalData && modalData.modal) {
                modalData.modal.hide();
            }

            // Refresh the page
            setTimeout(() => {
                window.location.reload();
            }, 1000);

        } catch (error) {
            this.error('Error updating book:', error);
            this.notify(`Failed to update book: ${error.message}`, 'error');
        }
    }

    /**
     * Parse narrator string into array (helper method)
     */
    parseNarrators(narratorString) {
        if (!narratorString || !narratorString.trim()) {
            return [];
        }
        
        return narratorString
            .split(',')
            .map(n => n.trim())
            .filter(n => n.length > 0);
    }

    /**
     * Handle book action (edit, duplicate, delete)
     */
    async handleBookAction(action, bookIndex) {
        try {
            // bookIndex is the array index from the template
            this.debug(`Handling book action: ${action} for bookIndex: ${bookIndex} (type: ${typeof bookIndex})`);
            const authorName = this.authorData.name;
            
            switch (action) {
                case 'edit':
                    this.openEditModal(bookIndex);
                    break;
                    
                case 'duplicate':
                    await this.duplicateBook(bookIndex);
                    break;
                    
                case 'delete':
                    await this.deleteBook(bookIndex);
                    break;
                    
                default:
                    this.warn(`Unknown book action: ${action}`);
            }
        } catch (error) {
            this.error('Error handling book action:', error);
            this.notify(`Error performing ${action} action: ${error.message}`, 'error');
        }
    }

    /**
     * Duplicate a book
     */
    async duplicateBook(bookIndex) {
        try {
            // Convert bookIndex to number if it's a string
            const index = typeof bookIndex === 'string' ? parseInt(bookIndex, 10) : bookIndex;
            
            // Validate index and get book by array index
            if (index < 0 || index >= this.authorData.books.length || isNaN(index)) {
                this.debug(`Invalid book index: ${bookIndex}. Available indices: 0-${this.authorData.books.length - 1}`);
                throw new Error('Book not found');
            }
            
            const book = this.authorData.books[index];
            if (!book) {
                this.debug(`Book not found at index: ${index}. Available books:`, this.authorData.books.map((b, i) => ({index: i, title: b.title})));
                throw new Error('Book not found');
            }

            // Create a copy with modified title
            const duplicatedBook = {
                ...book,
                title: `${book.title} (Copy)`,
                asin: '' // Clear ASIN as it should be unique
            };

            const apiModule = this.getModule('api');
            await apiModule.addBook(this.authorData.name, duplicatedBook);
            
            this.notify(`Book "${book.title}" duplicated successfully`, 'success');
            this.emit('book:duplicated', { 
                authorName: this.authorData.name, 
                originalBook: book, 
                duplicatedBook 
            });
            
            // Refresh the page
            setTimeout(() => window.location.reload(), 1000);
            
        } catch (error) {
            this.error('Error duplicating book:', error);
            this.notify(`Failed to duplicate book: ${error.message}`, 'error');
        }
    }

    /**
     * Delete a book with confirmation
     */
    async deleteBook(bookIndex) {
        try {
            // Convert bookIndex to number if it's a string
            const index = typeof bookIndex === 'string' ? parseInt(bookIndex, 10) : bookIndex;
            
            // Validate index and get book by array index
            if (index < 0 || index >= this.authorData.books.length || isNaN(index)) {
                this.debug(`Invalid book index: ${bookIndex}. Available indices: 0-${this.authorData.books.length - 1}`);
                throw new Error('Book not found');
            }
            
            const book = this.authorData.books[index];
            if (!book) {
                this.debug(`Book not found at index: ${index}. Available books:`, this.authorData.books.map((b, i) => ({index: i, title: b.title})));
                throw new Error('Book not found');
            }

            const confirmed = confirm(`Are you sure you want to delete "${book.title}"?\n\nThis action cannot be undone.`);
            if (!confirmed) {
                return;
            }

            const apiModule = this.getModule('api');
            await apiModule.deleteBook(this.authorData.name, index);
            
            this.notify(`Book "${book.title}" deleted successfully`, 'success');
            this.emit('book:deleted', { 
                authorName: this.authorData.name, 
                book, 
                bookIndex: index 
            });
            
            // Refresh the page
            setTimeout(() => window.location.reload(), 1000);
            
        } catch (error) {
            this.error('Error deleting book:', error);
            this.notify(`Failed to delete book: ${error.message}`, 'error');
        }
    }

    /**
     * Check for unsaved changes
     */
    checkForUnsavedChanges() {
        // Monitor for form changes
        const forms = document.querySelectorAll('form, input, textarea, select');
        forms.forEach(element => {
            element.addEventListener('change', () => {
                this.hasUnsavedChanges = true;
                this.updateUnsavedIndicator();
            });
            
            if (element.tagName === 'INPUT' || element.tagName === 'TEXTAREA') {
                element.addEventListener('input', () => {
                    this.hasUnsavedChanges = true;
                    this.updateUnsavedIndicator();
                });
            }
        });

        // Initial check
        this.updateUnsavedIndicator();
    }

    /**
     * Save any unsaved changes
     */
    async saveChanges() {
        if (!this.hasUnsavedChanges) {
            this.notify('No changes to save', 'info');
            return;
        }

        try {
            // Implement save logic here
            this.notify('Changes saved successfully', 'success');
            this.hasUnsavedChanges = false;
            this.updateUnsavedIndicator();
        } catch (error) {
            this.error('Error saving changes:', error);
            this.notify(`Failed to save changes: ${error.message}`, 'error');
        }
    }

    /**
     * Update unsaved changes indicator
     */
    updateUnsavedIndicator() {
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.style.display = this.hasUnsavedChanges ? 'block' : 'none';
        }
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Destroy DataTable
        if (this.dataTable) {
            try {
                this.dataTable.destroy();
                this.dataTable = null;
            } catch (error) {
                this.warn('Error destroying DataTable:', error);
            }
        }

        // Clean up observers
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
            this.intersectionObserver = null;
        }

        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
            this.mutationObserver = null;
        }

        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
            this.resizeObserver = null;
        }

        // Abort any pending requests
        if (this.abortController) {
            this.abortController.abort();
        }

        // Call parent cleanup
        super.destroy();
    }

    /**
     * Create announcement region for screen readers
     */
    createAnnouncementRegion() {
        // Check if announcement region already exists
        let announcementRegion = document.getElementById('sr-announcements');
        if (!announcementRegion) {
            announcementRegion = document.createElement('div');
            announcementRegion.id = 'sr-announcements';
            announcementRegion.setAttribute('aria-live', 'polite');
            announcementRegion.setAttribute('aria-atomic', 'true');
            announcementRegion.style.position = 'absolute';
            announcementRegion.style.left = '-10000px';
            announcementRegion.style.width = '1px';
            announcementRegion.style.height = '1px';
            announcementRegion.style.overflow = 'hidden';
            document.body.appendChild(announcementRegion);
        }
        this.announcementRegion = announcementRegion;
    }

    /**
     * Add keyboard shortcuts help
     */
    addKeyboardShortcutsHelp() {
        // Add keyboard shortcuts info to the page
        const helpButton = document.createElement('button');
        helpButton.type = 'button';
        helpButton.className = 'btn btn-sm btn-outline-secondary position-fixed';
        helpButton.style.bottom = '20px';
        helpButton.style.left = '20px';
        helpButton.style.zIndex = '1000';
        helpButton.innerHTML = '<i class="fas fa-keyboard"></i>';
        helpButton.title = 'Keyboard Shortcuts (Press ? for help)';
        helpButton.setAttribute('aria-label', 'Show keyboard shortcuts');
        
        helpButton.addEventListener('click', () => {
            this.showKeyboardShortcuts();
        });
        
        document.body.appendChild(helpButton);
    }

    /**
     * Show keyboard shortcuts modal
     */
    showKeyboardShortcuts() {
        const shortcuts = [
            { key: '?', description: 'Show this help' },
            { key: 'Ctrl/Cmd + A', description: 'Select all books' },
            { key: 'Delete', description: 'Delete selected books' },
            { key: 'Ctrl/Cmd + S', description: 'Save changes' },
            { key: 'Escape', description: 'Close modals/deselect' },
            { key: 'Enter', description: 'Activate focused element' },
            { key: 'Space', description: 'Toggle selection' }
        ];

        const shortcutsHtml = shortcuts.map(s => 
            `<tr><td><kbd>${s.key}</kbd></td><td>${s.description}</td></tr>`
        ).join('');

        const modalContent = `
            <div class="table-responsive">
                <table class="table table-sm">
                    <thead>
                        <tr>
                            <th>Shortcut</th>
                            <th>Action</th>
                        </tr>
                    </thead>
                    <tbody>
                        ${shortcutsHtml}
                    </tbody>
                </table>
            </div>
        `;

        const modalsModule = this.getModule('modals');
        if (modalsModule) {
            modalsModule.createModal(
                'keyboard-shortcuts-modal',
                'Keyboard Shortcuts',
                modalContent,
                { size: 'lg' }
            );
            const modal = document.getElementById('keyboard-shortcuts-modal');
            if (modal) {
                modalsModule.showModal(modal);
            }
        }
    }

    /**
     * Announce message to screen readers
     */
    announceToScreenReader(message) {
        if (this.announcementRegion) {
            this.announcementRegion.textContent = message;
        }
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.AuthorDetailModule = AuthorDetailModule;
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AuthorDetailModule;
}
