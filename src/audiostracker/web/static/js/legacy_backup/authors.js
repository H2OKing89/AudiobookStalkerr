/**
 * Authors Management Page App
 * Handles display and management of audiobook authors watchlist
 */

class AuthorsApp {
    constructor() {
        this.authors = [];
        this.filteredAuthors = [];
        this.filters = {
            search: '',
            publisher: 'all'
        };
        this.viewMode = 'grid'; // 'grid', 'list', or 'table'
        this.sortBy = 'author';
        this.sortOrder = 'asc';
        this.isInitialized = false;
    }

    async init() {
        console.log('Initializing Authors Management App...');
        
        if (this.isInitialized) {
            console.log('Authors app already initialized, skipping...');
            return;
        }
        
        try {
            // Load initial data with defensive programming
            let initialData = window.initialData || [];
            
            // Handle case where data might be an object instead of array
            if (initialData && typeof initialData === 'object' && !Array.isArray(initialData)) {
                console.log('Converting object data to array format');
                initialData = [];
            }
            
            this.authors = Array.isArray(initialData) ? initialData : [];
            this.filteredAuthors = [...this.authors];
            
            console.log('Loaded authors data:', this.authors);
            
            // Setup event listeners
            this.setupEventListeners();
            this.setupKeyboardShortcuts();
            
            // Initial render
            this.render();
            this.updateFilters();
            this.updateStats();
            
            this.isInitialized = true;
            console.log(`Loaded ${this.authors.length} authors in management system`);
        } catch (error) {
            this.handleError(error, 'initialization');
        }
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.debouncedSearch(e.target.value);
            });
        }

        // Publisher filter
        const publisherFilter = document.getElementById('publisher-filter');
        if (publisherFilter) {
            publisherFilter.addEventListener('change', (e) => {
                this.filters.publisher = e.target.value;
                this.applyFilters();
            });
        }

        // View mode toggles
        const viewButtons = document.querySelectorAll('.view-btn');
        viewButtons.forEach(btn => {
            btn.addEventListener('click', (e) => {
                const view = e.currentTarget.dataset.view;
                this.setViewMode(view);
            });
        });
    }

    /**
     * Setup keyboard shortcuts
     */
    setupKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Only handle shortcuts when not in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA') {
                return;
            }
            
            switch (e.key) {
                case '/':
                    e.preventDefault();
                    document.getElementById('search-input')?.focus();
                    break;
                case 'g':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.setViewMode('grid');
                    }
                    break;
                case 't':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.setViewMode('table');
                    }
                    break;
                case 'l':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.setViewMode('list');
                    }
                    break;
                case 'r':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        this.refresh();
                    }
                    break;
                case 'n':
                    if (e.ctrlKey || e.metaKey) {
                        e.preventDefault();
                        if (window.showAddAuthorModal) {
                            window.showAddAuthorModal();
                        }
                    }
                    break;
            }
        });
    }

    updateFilters() {
        // Update publisher filter options
        const publisherFilter = document.getElementById('publisher-filter');
        if (publisherFilter && this.authors.length > 0) {
            // Get unique publishers from all books across all authors
            const publishers = new Set();
            this.authors.forEach(author => {
                if (author.books) {
                    author.books.forEach(book => {
                        if (book.publisher) {
                            publishers.add(book.publisher);
                        }
                    });
                }
            });
            
            const sortedPublishers = [...publishers].sort();
            
            // Clear existing options except "All Publishers"
            publisherFilter.innerHTML = '<option value="all">All Publishers</option>';
            
            sortedPublishers.forEach(publisher => {
                const option = document.createElement('option');
                option.value = publisher;
                option.textContent = publisher;
                publisherFilter.appendChild(option);
            });
        }
    }

    applyFilters() {
        let filtered = [...this.authors];

        // Apply search filter
        if (this.filters.search) {
            filtered = filtered.filter(author => {
                // Search in author name
                if (author.name.toLowerCase().includes(this.filters.search)) {
                    return true;
                }
                
                // Search in book titles
                if (author.books) {
                    return author.books.some(book => 
                        book.title.toLowerCase().includes(this.filters.search) ||
                        (book.series && book.series.toLowerCase().includes(this.filters.search))
                    );
                }
                
                return false;
            });
        }

        // Apply publisher filter
        if (this.filters.publisher !== 'all') {
            filtered = filtered.filter(author => {
                if (!author.books) return false;
                return author.books.some(book => book.publisher === this.filters.publisher);
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue, bValue;

            switch (this.sortBy) {
                case 'author':
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
                    break;
                case 'books':
                    aValue = a.books ? a.books.length : 0;
                    bValue = b.books ? b.books.length : 0;
                    break;
                default:
                    aValue = a.name.toLowerCase();
                    bValue = b.name.toLowerCase();
            }

            if (this.sortOrder === 'asc') {
                return aValue < bValue ? -1 : aValue > bValue ? 1 : 0;
            } else {
                return aValue > bValue ? -1 : aValue < bValue ? 1 : 0;
            }
        });

        this.filteredAuthors = filtered;
        this.render();
    }

    /**
     * Enhanced view mode setter with proper state management
     */
    setViewMode(mode) {
        console.log('Setting view mode to:', mode);
        this.viewMode = mode;
        
        // Hide all view containers
        const tableContainer = document.getElementById('authors-table-container');
        const gridContainer = document.getElementById('authors-container');
        
        if (mode === 'table') {
            if (tableContainer) tableContainer.style.display = 'block';
            if (gridContainer) gridContainer.style.display = 'none';
            
            // Initialize or show table view
            if (window.tableView) {
                window.tableView.show();
                window.tableView.loadData(this.filteredAuthors);
            }
        } else {
            if (tableContainer) tableContainer.style.display = 'none';
            if (gridContainer) gridContainer.style.display = 'block';
            
            // Update grid container class
            gridContainer.className = mode === 'grid' ? 'authors-grid' : 'authors-list';
            this.render();
        }
        
        // Update button states
        this.updateViewButtons(mode);
    }
    
    /**
     * Update view button active states
     */
    updateViewButtons(activeMode) {
        document.querySelectorAll('[name="view-mode"]').forEach(radio => {
            radio.checked = radio.id === `${activeMode}-view`;
        });
        
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.toggle('active', btn.dataset.view === activeMode);
        });
    }

    render() {
        // Use optimized rendering for better performance
        this.renderOptimized();
    }

    renderAuthorCard(author) {
        const bookCount = author.books ? author.books.length : 0;
        const recentBooks = author.books ? author.books.slice(0, 3) : [];
        
        return `
            <div class="author-card" data-author="${this.escapeHtml(author.name)}">
                <div class="author-header">
                    <div class="author-info">
                        <h3 class="author-name">${this.escapeHtml(author.name)}</h3>
                        <div class="author-meta">
                            <span class="book-count">
                                <i class="fas fa-book me-1"></i>
                                ${bookCount} book${bookCount !== 1 ? 's' : ''}
                            </span>
                        </div>
                    </div>
                    <div class="author-actions">
                        <button class="btn btn-sm btn-outline-primary" onclick="editAuthor('${this.escapeHtml(author.name)}')">
                            <i class="fas fa-edit"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" onclick="deleteAuthor('${this.escapeHtml(author.name)}')">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                ${recentBooks.length > 0 ? `
                    <div class="recent-books">
                        <div class="books-header">
                            <span class="books-label">Recent Books:</span>
                        </div>
                        <div class="books-list">
                            ${recentBooks.map(book => `
                                <div class="book-item">
                                    <div class="book-title">${this.escapeHtml(book.title)}</div>
                                    ${book.series ? `<div class="book-series">${this.escapeHtml(book.series)}</div>` : ''}
                                </div>
                            `).join('')}
                        </div>
                        ${bookCount > 3 ? `
                            <div class="more-books">
                                <small class="text-muted">+${bookCount - 3} more books</small>
                            </div>
                        ` : ''}
                    </div>
                ` : ''}
            </div>
        `;
    }

    renderAuthorListItem(author) {
        const bookCount = author.books ? author.books.length : 0;
        
        return `
            <div class="author-list-item" data-author="${this.escapeHtml(author.name)}">
                <div class="author-info">
                    <h4 class="author-name">${this.escapeHtml(author.name)}</h4>
                    <div class="author-meta">
                        <span class="book-count">
                            <i class="fas fa-book me-1"></i>
                            ${bookCount} book${bookCount !== 1 ? 's' : ''}
                        </span>
                    </div>
                </div>
                <div class="author-actions">
                    <button class="btn btn-sm btn-outline-primary" onclick="editAuthor('${this.escapeHtml(author.name)}')">
                        <i class="fas fa-edit me-1"></i>Edit
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAuthor('${this.escapeHtml(author.name)}')">
                        <i class="fas fa-trash me-1"></i>Delete
                    </button>
                </div>
            </div>
        `;
    }

    renderEmptyState() {
        return `
            <div class="text-center py-5">
                <i class="fas fa-users text-muted" style="font-size: 4rem;"></i>
                <h3 class="mt-3 text-muted">No authors configured</h3>
                <p class="text-muted">Add authors to start tracking their upcoming audiobooks.</p>
                <button class="btn btn-primary" onclick="showAddAuthorModal()">
                    <i class="fas fa-plus me-2"></i>Add Your First Author
                </button>
            </div>
        `;
    }

    escapeHtml(text) {
        if (!text) return '';
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    async refresh() {
        try {
            this.showLoading(true, 'Refreshing authors data...');
            
            const response = await fetch('/api/config');
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            this.authors = await response.json();
            this.filteredAuthors = [...this.authors];
            this.render();
            this.updateFilters();
            this.updateStats();
            this.showToast('Authors data refreshed successfully', 'success');
        } catch (error) {
            this.handleError(error, 'refresh');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Show/hide loading state with better UX
     */
    showLoading(show, message = 'Loading...') {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) {
                overlay.innerHTML = `
                    <div class="d-flex flex-column align-items-center">
                        <div class="spinner-border text-primary mb-3" role="status">
                            <span class="visually-hidden">Loading...</span>
                        </div>
                        <div class="text-muted">${message}</div>
                    </div>
                `;
                overlay.style.display = 'flex';
            } else {
                overlay.style.display = 'none';
            }
        }
    }

    /**
     * Enhanced error handling
     */
    handleError(error, context = 'Unknown') {
        console.error(`Error in ${context}:`, error);
        
        let userMessage = 'An unexpected error occurred.';
        
        if (error.name === 'TypeError') {
            userMessage = 'There was a problem processing the data.';
        } else if (error.name === 'NetworkError' || error.message.includes('fetch')) {
            userMessage = 'Network connection issue. Please check your connection.';
        } else if (error.message) {
            userMessage = error.message;
        }
        
        this.showToast(userMessage, 'error');
        this.showLoading(false);
    }

    updateStats() {
        const stats = this.calculateStats();
        this.renderStats(stats);
    }

    calculateStats() {
        const totalAuthors = this.authors.length;
        let totalBooks = 0;
        let totalSeries = new Set();
        let totalPublishers = new Set();

        this.authors.forEach(author => {
            if (author.books) {
                totalBooks += author.books.length;
                author.books.forEach(book => {
                    if (book.series) totalSeries.add(book.series);
                    if (book.publisher) totalPublishers.add(book.publisher);
                });
            }
        });

        return {
            authors: totalAuthors,
            books: totalBooks,
            series: totalSeries.size,
            publishers: totalPublishers.size
        };
    }

    renderStats(stats) {
        const statsCards = document.getElementById('stats-cards');
        if (!statsCards) return;

        statsCards.innerHTML = `
            <div class="col-sm-6 col-lg-3">
                <div class="card card-sm">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <span class="bg-primary text-white avatar">
                                    <i class="fas fa-users"></i>
                                </span>
                            </div>
                            <div class="col">
                                <div class="font-weight-medium">
                                    ${stats.authors}
                                </div>
                                <div class="text-muted">
                                    Authors
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-lg-3">
                <div class="card card-sm">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <span class="bg-success text-white avatar">
                                    <i class="fas fa-book"></i>
                                </span>
                            </div>
                            <div class="col">
                                <div class="font-weight-medium">
                                    ${stats.books}
                                </div>
                                <div class="text-muted">
                                    Books
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-lg-3">
                <div class="card card-sm">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <span class="bg-warning text-white avatar">
                                    <i class="fas fa-layer-group"></i>
                                </span>
                            </div>
                            <div class="col">
                                <div class="font-weight-medium">
                                    ${stats.series}
                                </div>
                                <div class="text-muted">
                                    Series
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
            <div class="col-sm-6 col-lg-3">
                <div class="card card-sm">
                    <div class="card-body">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <span class="bg-info text-white avatar">
                                    <i class="fas fa-building"></i>
                                </span>
                            </div>
                            <div class="col">
                                <div class="font-weight-medium">
                                    ${stats.publishers}
                                </div>
                                <div class="text-muted">
                                    Publishers
                                </div>
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    /**
     * Debounced search function for better performance
     */
    debouncedSearch = this.debounce((searchTerm) => {
        this.filters.search = searchTerm.toLowerCase();
        this.applyFilters();
    }, 300);

    /**
     * Utility function to debounce rapid function calls
     */
    debounce(func, wait) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                clearTimeout(timeout);
                func(...args);
            };
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
        }
    }

    /**
     * Performance optimization for large datasets
     */
    shouldUseVirtualScrolling() {
        return this.filteredAuthors.length > 100;
    }

    /**
     * Optimized rendering for large datasets
     */
    renderOptimized() {
        const container = document.getElementById('authors-container');
        if (!container) return;

        // For very large datasets, recommend table view
        if (this.filteredAuthors.length > 500 && this.viewMode !== 'table') {
            this.showToast('Large dataset detected. Consider switching to Table view for better performance.', 'info');
        }

        // Update container class based on view mode
        container.className = this.viewMode === 'grid' ? 'authors-grid' : 'authors-list';

        if (this.filteredAuthors.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        // Use document fragment for better performance
        const fragment = document.createDocumentFragment();
        
        this.filteredAuthors.forEach(author => {
            const authorElement = document.createElement('div');
            authorElement.innerHTML = this.viewMode === 'grid' 
                ? this.renderAuthorCard(author) 
                : this.renderAuthorListItem(author);
            
            // Add the first child (the actual author card/item) to fragment
            if (authorElement.firstElementChild) {
                fragment.appendChild(authorElement.firstElementChild);
            }
        });

        // Clear and append all at once for better performance
        container.innerHTML = '';
        container.appendChild(fragment);
    }

}

// Export to global scope
window.AuthorsApp = AuthorsApp;

// Global functions for HTML onclick handlers
function setViewMode(mode) {
    if (window.authorsApp) {
        window.authorsApp.setViewMode(mode);
    }
}

function editAuthor(authorName) {
    // This would typically open a modal to edit the author
    console.log('Edit author:', authorName);
    if (window.showEditAuthorModal) {
        window.showEditAuthorModal(authorName);
    }
}

function deleteAuthor(authorName) {
    // This would typically show a confirmation dialog
    console.log('Delete author:', authorName);
    if (window.showDeleteAuthorModal) {
        window.showDeleteAuthorModal(authorName);
    }
}

function refreshData() {
    if (window.authorsApp) {
        window.authorsApp.refresh();
    }
}

// Export to global scope
window.AuthorsApp = AuthorsApp;

// Global stub functions for modal functionality (to be implemented)
// Note: showAddAuthorModal is now defined in app.js

window.showEditAuthorModal = function(authorName) {
    console.log('Edit Author modal for:', authorName);
    // TODO: Implement edit author modal
};

window.showDeleteAuthorModal = function(authorName) {
    if (window.modals && window.modals.showDeleteAuthorModal) {
        window.modals.showDeleteAuthorModal(authorName);
    } else {
        console.log('Delete Author confirmation for:', authorName);
        // Fallback to simple confirmation
        if (confirm(`Are you sure you want to delete "${authorName}" and all their books?`)) {
            if (window.deleteAuthor) {
                window.deleteAuthor(authorName);
            }
        }
    }
};

window.showImportModal = function() {
    console.log('showImportModal called from config.js');
    if (window.modals && typeof window.modals.showImportModal === 'function') {
        window.modals.showImportModal();
    } else {
        console.error('Modals module not available or showImportModal method not found');
        alert('Import feature is not available. Please refresh the page.');
    }
};

window.showQuickAddModal = function() {
    console.log('showQuickAddModal called from config.js');
    if (window.modals && typeof window.modals.showQuickAddModal === 'function') {
        window.modals.showQuickAddModal();
    } else {
        console.error('Modals module not available or showQuickAddModal method not found');
        alert('Quick Add feature is not available. Please refresh the page.');
    }
};

window.exportCollection = function() {
    console.log('Export collection called from config.js');
    
    // The global wrapper should be available from app.js
    // If not, try fallback methods
    if (window.app && typeof window.app.exportCollection === 'function') {
        console.log('Using app.exportCollection');
        return window.app.exportCollection();
    } else if (typeof window.simpleExport === 'function') {
        console.log('Using simpleExport fallback');
        return window.simpleExport();
    } else {
        console.error('No export method available');
        if (window.toast) {
            window.toast.error('Export functionality is not available');
        } else {
            alert('Export functionality is not available');
        }
    }
};
