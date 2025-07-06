/**
 * Configuration Page App
 * Handles display and management of audiobook watchlist configuration
 */

class ConfigApp {
    constructor() {
        this.authors = [];
        this.filteredAuthors = [];
        this.filters = {
            search: '',
            publisher: 'all'
        };
        this.viewMode = 'grid'; // 'grid' or 'list'
        this.sortBy = 'author';
        this.sortOrder = 'asc';
    }

    async init() {
        console.log('Initializing Configuration App...');
        
        // Load initial data
        this.authors = window.initialData || [];
        this.filteredAuthors = [...this.authors];
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initial render
        this.render();
        this.updateFilters();
        
        console.log(`Loaded ${this.authors.length} authors in configuration`);
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', (e) => {
                this.filters.search = e.target.value.toLowerCase();
                this.applyFilters();
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

    setViewMode(mode) {
        this.viewMode = mode;
        
        // Update view buttons
        document.querySelectorAll('.view-btn').forEach(btn => {
            btn.classList.remove('active');
        });
        document.querySelector(`[data-view="${mode}"]`).classList.add('active');
        
        // Re-render with new view mode
        this.render();
    }

    render() {
        const container = document.getElementById('authors-container');
        if (!container) return;

        // Update container class based on view mode
        container.className = this.viewMode === 'grid' ? 'authors-grid' : 'authors-list';

        if (this.filteredAuthors.length === 0) {
            container.innerHTML = this.renderEmptyState();
            return;
        }

        const html = this.filteredAuthors.map(author => 
            this.viewMode === 'grid' ? this.renderAuthorCard(author) : this.renderAuthorListItem(author)
        ).join('');

        container.innerHTML = html;
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
            this.showLoading(true);
            
            const response = await fetch('/api/config');
            if (response.ok) {
                this.authors = await response.json();
                this.filteredAuthors = [...this.authors];
                this.render();
                this.updateFilters();
                this.showToast('Configuration refreshed successfully', 'success');
            } else {
                throw new Error('Failed to refresh configuration');
            }
        } catch (error) {
            console.error('Error refreshing configuration:', error);
            this.showToast('Failed to refresh configuration', 'error');
        } finally {
            this.showLoading(false);
        }
    }

    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    showToast(message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        const toastBody = document.getElementById('toast-message');
        
        if (toast && toastBody) {
            toastBody.textContent = message;
            
            // Set toast type
            toast.className = 'toast';
            toast.classList.add(`bg-${type === 'error' ? 'danger' : type}`);
            if (type === 'error' || type === 'danger') {
                toast.classList.add('text-white');
            }
            
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }
}

// Global functions for HTML onclick handlers
function setViewMode(mode) {
    if (window.configApp) {
        window.configApp.setViewMode(mode);
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
    if (window.configApp) {
        window.configApp.refresh();
    }
}

// Export to global scope
window.ConfigApp = ConfigApp;

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
