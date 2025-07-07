/**
 * AudiobookStalkerr Main Application Module
 * Manages the authors page and integrates all other modules
 */

class AudiobookStalkerrApp extends window.BaseModule {
    constructor(core) {
        super(core);
        this.authors = [];
        this.filteredAuthors = [];
        this.viewMode = 'grid';
        this.hasUnsavedChanges = false;
        this.autoSaveEnabled = true;
        this.autoSaveTimer = null;
    }

    async init() {
        // Prevent double initialization
        if (this.isInitialized) {
            this.debug('App already initialized, skipping');
            return;
        }
        
        await super.init();
        
        try {
            // Start performance measurement
            this.startPerformanceMeasure?.('app-init');
            
            // Load initial data
            await this.loadInitialData();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up keyboard shortcuts
            this.setupKeyboardShortcuts();
            
            // Set up intersection observer for performance
            this.setupIntersectionObserver();
            
            // Subscribe to state changes
            this.setupStateSubscriptions();
            
            // Initial render
            this.render();
            
            // End performance measurement
            this.endPerformanceMeasure?.('app-init');
            
            this.debug('AudiobookStalkerr application initialized');
            this.notify('Application loaded successfully', 'success', 3000);
            
        } catch (error) {
            console.error('Failed to initialize AudiobookStalkerr application:', error);
            this.notify('Failed to load application. Please refresh the page.', 'error');
            throw error;
        }
    }

    async loadInitialData() {
        // Load data from server-provided globals or API
        if (window.initialData) {
            // The data is already transformed by the backend
            this.authors = Array.isArray(window.initialData) ? window.initialData : [];
        } else {
            // Try to load from API
            const api = this.getModule('api');
            if (api) {
                try {
                    const data = await api.getAudiobooks();
                    this.authors = Array.isArray(data) ? data : [];
                } catch (error) {
                    this.debug('Failed to load data from API:', error);
                    this.authors = [];
                }
            }
        }

        // Load stats
        if (window.initialStats) {
            this.setState('stats', window.initialStats);
        }

        this.filteredAuthors = [...this.authors];
        this.debug(`Loaded ${this.authors.length} authors`);
    }

    convertObjectToArray(data) {
        if (Array.isArray(data)) return data;
        
        // Handle nested structure { audiobooks: { author: {...} } }
        if (data.audiobooks && data.audiobooks.author) {
            return this.convertAuthorObjectToArray(data.audiobooks.author);
        }
        
        // Handle direct author object structure
        if (typeof data === 'object') {
            return this.convertAuthorObjectToArray(data);
        }
        
        return [];
    }

    convertAuthorObjectToArray(authorObj) {
        const authors = [];
        for (const [authorName, books] of Object.entries(authorObj)) {
            authors.push({
                name: authorName,
                books: Array.isArray(books) ? books : []
            });
        }
        return authors;
    }

    setupEventListeners() {
        // Search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.addEventListener('input', this.debounce((e) => {
                this.handleSearch(e.target.value);
            }, 300));
        }

        // Publisher filter
        const publisherFilter = document.getElementById('publisher-filter');
        if (publisherFilter) {
            publisherFilter.addEventListener('change', (e) => {
                this.handleFilterChange('publisher', e.target.value);
            });
        }

        // View mode buttons
        const viewButtons = document.querySelectorAll('input[name="view-mode"]');
        viewButtons.forEach(button => {
            button.addEventListener('change', (e) => {
                if (e.target.checked) {
                    this.setViewMode(e.target.id.replace('-view', ''));
                }
            });
        });

        // Auto-save changes
        this.on('data:changed', () => {
            this.markUnsaved();
            if (this.autoSaveEnabled) {
                this.scheduleAutoSave();
            }
        });
    }

    /**
     * Set up Intersection Observer for performance optimization
     */
    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting) {
                        // Lazy load content or trigger animations
                        const card = entry.target;
                        card.classList.add('visible');
                        
                        // Load book covers lazily
                        const images = card.querySelectorAll('img[data-src]');
                        images.forEach(img => {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        });
                    }
                });
            }, {
                rootMargin: '10px',
                threshold: 0.1
            });
        }
    }

    /**
     * Enhanced keyboard shortcuts with better event handling
     */
    setupKeyboardShortcuts() {
        // Use modern event handling with proper cleanup
        this.keyboardHandler = (e) => {
            // Only handle shortcuts when not in input fields
            if (e.target.tagName === 'INPUT' || e.target.tagName === 'TEXTAREA' || e.target.contentEditable === 'true') {
                return;
            }

            // Prevent default for handled shortcuts
            let handled = false;

            // Handle keyboard shortcuts
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveChanges();
                        handled = true;
                        break;
                    case 'n':
                        e.preventDefault();
                        this.showAddAuthorModal();
                        handled = true;
                        break;
                    case 'e':
                        e.preventDefault();
                        this.exportCollection();
                        handled = true;
                        break;
                    case 'f':
                        e.preventDefault();
                        this.focusSearch();
                        handled = true;
                        break;
                }
            } else {
                switch (e.key) {
                    case '/':
                        e.preventDefault();
                        this.focusSearch();
                        handled = true;
                        break;
                    case 'v':
                        if (!e.shiftKey) {
                            e.preventDefault();
                            this.toggleViewMode();
                            handled = true;
                        }
                        break;
                    case 'Escape':
                        this.handleEscapeKey();
                        handled = true;
                        break;
                }
            }

            if (handled) {
                // Provide haptic feedback if available
                this.provideFeedback();
            }
        };

        document.addEventListener('keydown', this.keyboardHandler);
    }

    /**
     * Focus search input with better UX
     */
    focusSearch() {
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.focus();
            searchInput.select();
        }
    }

    /**
     * Handle escape key for closing modals, clearing search, etc.
     */
    handleEscapeKey() {
        // Close any open modals
        const openModals = document.querySelectorAll('.modal.show');
        if (openModals.length > 0) {
            const modalsModule = this.getModule('modals');
            openModals.forEach(modal => {
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
            });
            return;
        }
        
        // Clear search if it has content
        const searchInput = document.getElementById('search-input');
        if (searchInput && searchInput.value) {
            searchInput.value = '';
            this.handleSearch('');
            return;
        }
    }

    /**
     * Provide haptic feedback if available
     */
    provideFeedback() {
        if ('vibrate' in navigator) {
            navigator.vibrate(50);
        }
    }

    setupStateSubscriptions() {
        // Listen for filter changes
        this.on('filter:changed', (event) => {
            this.applyFilters();
        });

        // Listen for view mode changes
        this.on('viewmode:changed', (event) => {
            this.render();
        });

        // Listen for data changes
        this.on('authors:updated', (event) => {
            this.authors = event.detail;
            this.applyFilters();
            this.updateStats();
        });
    }

    handleSearch(searchTerm) {
        this.setState('filters.search', searchTerm);
        this.applyFilters();
    }

    handleFilterChange(filterType, value) {
        this.setState(`filters.${filterType}`, value);
        this.applyFilters();
    }

    applyFilters() {
        const filters = this.getState('filters') || {};
        let filtered = [...this.authors];

        // Apply search filter
        if (filters.search) {
            const searchTerm = filters.search.toLowerCase();
            filtered = filtered.filter(author => {
                // Search in author name
                if (author.name.toLowerCase().includes(searchTerm)) {
                    return true;
                }
                
                // Search in book titles and series
                if (author.books) {
                    return author.books.some(book => 
                        book.title?.toLowerCase().includes(searchTerm) ||
                        book.series?.toLowerCase().includes(searchTerm)
                    );
                }
                
                return false;
            });
        }

        // Apply publisher filter
        if (filters.publisher && filters.publisher !== 'all') {
            filtered = filtered.filter(author => {
                if (!author.books) return false;
                return author.books.some(book => book.publisher === filters.publisher);
            });
        }

        // Apply sorting
        const sortBy = this.getState('ui.sortBy') || 'author';
        const sortOrder = this.getState('ui.sortOrder') || 'asc';
        
        filtered.sort((a, b) => {
            let comparison = 0;
            if (sortBy === 'author') {
                comparison = a.name.localeCompare(b.name);
            } else if (sortBy === 'books') {
                comparison = (a.books?.length || 0) - (b.books?.length || 0);
            }
            
            return sortOrder === 'desc' ? -comparison : comparison;
        });

        this.filteredAuthors = filtered;
        this.render();
        this.updateSearchResultsHeader();
    }

    setViewMode(mode) {
        if (['grid', 'table', 'list'].includes(mode)) {
            this.viewMode = mode;
            this.setState('ui.viewMode', mode);
            this.updateViewButtons(mode);
            this.render();
            this.debug(`View mode changed to: ${mode}`);
        }
    }

    updateViewButtons(activeMode) {
        // Update radio button states
        const buttons = document.querySelectorAll('input[name="view-mode"]');
        buttons.forEach(button => {
            button.checked = button.id === `${activeMode}-view`;
        });
    }

    toggleViewMode() {
        const modes = ['grid', 'table', 'list'];
        const currentIndex = modes.indexOf(this.viewMode);
        const nextMode = modes[(currentIndex + 1) % modes.length];
        this.setViewMode(nextMode);
    }

    render() {
        const container = document.getElementById('authors-container');
        const tableContainer = document.getElementById('authors-table-container');
        
        // Only render if we're on a page that has these containers (authors page)
        if (!container && !tableContainer) {
            this.debug('Skipping render - not on authors page');
            return;
        }
        
        if (!container || !tableContainer) {
            this.debug('Partial containers found - limited rendering');
            return;
        }

        // Show/hide appropriate containers
        if (this.viewMode === 'table') {
            container.style.display = 'none';
            tableContainer.style.display = 'block';
            this.renderTable();
        } else {
            container.style.display = 'block';
            tableContainer.style.display = 'none';
            this.renderCards();
        }

        this.updateStats();
    }

    renderCards() {
        const container = document.getElementById('authors-container');
        
        if (this.filteredAuthors.length === 0) {
            container.innerHTML = this.createEmptyState();
            return;
        }

        let html = '';
        if (this.viewMode === 'grid') {
            html = '<div class="row">';
            this.filteredAuthors.forEach(author => {
                html += this.createAuthorCard(author);
            });
            html += '</div>';
        } else if (this.viewMode === 'list') {
            html = '<div class="list-group">';
            this.filteredAuthors.forEach(author => {
                html += this.createAuthorListItem(author);
            });
            html += '</div>';
        }

        container.innerHTML = html;
    }

    renderTable() {
        const tableView = this.getModule('tableView');
        if (tableView) {
            tableView.loadData(this.filteredAuthors);
            tableView.show();
        } else {
            console.warn('Table view module not available');
        }
    }

    createAuthorCard(author) {
        const bookCount = author.books ? author.books.length : 0;
        const completeCount = author.books ? author.books.filter(this.isBookComplete).length : 0;
        const completionPercentage = bookCount > 0 ? Math.round((completeCount / bookCount) * 100) : 0;
        
        return `
            <div class="col-lg-4 col-md-6 col-12 mb-4">
                <div class="card author-card">
                    <div class="card-body">
                        <div class="d-flex justify-content-between align-items-start mb-3">
                            <h5 class="card-title mb-0">
                                <a href="/authors/${encodeURIComponent(author.name)}" class="text-decoration-none">
                                    ${this.escapeHtml(author.name)}
                                </a>
                            </h5>
                            <div class="dropdown">
                                <button class="btn btn-ghost-secondary btn-sm" data-bs-toggle="dropdown">
                                    <i class="fas fa-ellipsis-v"></i>
                                </button>
                                <div class="dropdown-menu">
                                    <a class="dropdown-item" href="/authors/${encodeURIComponent(author.name)}">
                                        <i class="fas fa-eye me-2"></i>View Details
                                    </a>
                                    <a class="dropdown-item" href="#" onclick="editAuthor('${this.escapeHtml(author.name)}')">
                                        <i class="fas fa-edit me-2"></i>Edit
                                    </a>
                                    <div class="dropdown-divider"></div>
                                    <a class="dropdown-item text-danger" href="#" onclick="deleteAuthor('${this.escapeHtml(author.name)}')">
                                        <i class="fas fa-trash me-2"></i>Delete
                                    </a>
                                </div>
                            </div>
                        </div>
                        
                        <div class="row text-center mb-3">
                            <div class="col">
                                <div class="text-muted small">Books</div>
                                <div class="fw-bold">${bookCount}</div>
                            </div>
                            <div class="col">
                                <div class="text-muted small">Complete</div>
                                <div class="fw-bold text-success">${completeCount}</div>
                            </div>
                            <div class="col">
                                <div class="text-muted small">Progress</div>
                                <div class="fw-bold">${completionPercentage}%</div>
                            </div>
                        </div>
                        
                        <div class="progress mb-2" style="height: 4px;">
                            <div class="progress-bar bg-success" style="width: ${completionPercentage}%"></div>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    createAuthorListItem(author) {
        const bookCount = author.books ? author.books.length : 0;
        const completeCount = author.books ? author.books.filter(this.isBookComplete).length : 0;
        
        return `
            <div class="list-group-item d-flex justify-content-between align-items-center">
                <div class="d-flex align-items-center">
                    <div class="me-3">
                        <h6 class="mb-0">
                            <a href="/authors/${encodeURIComponent(author.name)}" class="text-decoration-none">
                                ${this.escapeHtml(author.name)}
                            </a>
                        </h6>
                        <small class="text-muted">${bookCount} books, ${completeCount} complete</small>
                    </div>
                </div>
                <div class="btn-group">
                    <a href="/authors/${encodeURIComponent(author.name)}" class="btn btn-sm btn-outline-primary">
                        <i class="fas fa-eye"></i>
                    </a>
                    <button class="btn btn-sm btn-outline-secondary" onclick="editAuthor('${this.escapeHtml(author.name)}')">
                        <i class="fas fa-edit"></i>
                    </button>
                    <button class="btn btn-sm btn-outline-danger" onclick="deleteAuthor('${this.escapeHtml(author.name)}')">
                        <i class="fas fa-trash"></i>
                    </button>
                </div>
            </div>
        `;
    }

    createEmptyState() {
        return `
            <div class="empty-state text-center py-5">
                <div class="empty-icon mb-3">
                    <i class="fas fa-users fa-3x text-muted"></i>
                </div>
                <h4 class="text-muted">No Authors Found</h4>
                <p class="text-muted mb-4">
                    ${this.getState('filters.search') ? 
                        'No authors match your search criteria. Try adjusting your filters.' : 
                        'Get started by adding your first author to track.'}
                </p>
                <button class="btn btn-primary" onclick="showAddAuthorModal()">
                    <i class="fas fa-plus me-2"></i>Add Your First Author
                </button>
            </div>
        `;
    }

    updateSearchResultsHeader() {
        // Update results counter if element exists
        const resultsHeader = document.getElementById('search-results-header');
        if (resultsHeader) {
            const total = this.authors.length;
            const filtered = this.filteredAuthors.length;
            
            if (total === filtered) {
                resultsHeader.textContent = `Showing all ${total} authors`;
            } else {
                resultsHeader.textContent = `Showing ${filtered} of ${total} authors`;
            }
        }
    }

    updateStats() {
        const stats = this.calculateStats();
        this.setState('stats', stats);
        this.renderStats(stats);
    }

    calculateStats() {
        const totalAuthors = this.authors.length;
        let totalBooks = 0;
        let completeBooks = 0;
        const publishers = new Set();
        const narrators = new Set();

        this.authors.forEach(author => {
            if (author.books) {
                totalBooks += author.books.length;
                author.books.forEach(book => {
                    if (this.isBookComplete(book)) {
                        completeBooks++;
                    }
                    if (book.publisher) {
                        publishers.add(book.publisher);
                    }
                    if (book.narrator) {
                        if (Array.isArray(book.narrator)) {
                            book.narrator.forEach(n => narrators.add(n));
                        } else {
                            narrators.add(book.narrator);
                        }
                    }
                });
            }
        });

        return {
            total_authors: totalAuthors,
            total_books: totalBooks,
            complete_books: completeBooks,
            total_publishers: publishers.size,
            total_narrators: narrators.size,
            completion_percentage: totalBooks > 0 ? Math.round((completeBooks / totalBooks) * 100) : 0
        };
    }

    renderStats(stats) {
        // Update stat cards
        const elements = {
            'total-authors': stats.total_authors,
            'total-books': stats.total_books,
            'total-publishers': stats.total_publishers,
            'total-narrators': stats.total_narrators
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    // Data management methods
    async saveChanges() {
        if (!this.hasUnsavedChanges) {
            this.notify('No changes to save', 'info');
            return;
        }

        try {
            await this.api('POST', '/api/audiobooks', this.authors);
            this.markSaved();
            this.notify('Changes saved successfully', 'success');
        } catch (error) {
            this.notify('Failed to save changes', 'error');
            throw error;
        }
    }

    async refreshData() {
        try {
            const data = await this.api('GET', '/api/audiobooks');
            this.authors = this.convertObjectToArray(data);
            this.setState('audiobooks', this.authors);
            this.applyFilters();
            this.notify('Data refreshed', 'success');
        } catch (error) {
            this.notify('Failed to refresh data', 'error');
        }
    }

    async exportCollection() {
        try {
            const apiModule = this.getModule('api');
            if (apiModule && apiModule.exportCollection) {
                await apiModule.exportCollection();
            } else {
                throw new Error('API module not available');
            }
        } catch (error) {
            this.notify('Export failed', 'error');
        }
    }

    showAddAuthorModal() {
        const modalsModule = this.getModule('modals');
        if (modalsModule && modalsModule.showAddAuthorModal) {
            modalsModule.showAddAuthorModal();
        } else {
            console.warn('Modals module not available');
        }
    }

    // State management
    markUnsaved() {
        this.hasUnsavedChanges = true;
        this.emit('app:unsaved-changes', { hasChanges: true });
    }

    markSaved() {
        this.hasUnsavedChanges = false;
        this.clearAutoSaveTimer();
        this.emit('app:unsaved-changes', { hasChanges: false });
    }

    scheduleAutoSave() {
        this.clearAutoSaveTimer();
        this.autoSaveTimer = setTimeout(() => {
            this.saveChanges().catch(error => {
                console.error('Auto-save failed:', error);
            });
        }, 5000);
    }

    clearAutoSaveTimer() {
        if (this.autoSaveTimer) {
            clearTimeout(this.autoSaveTimer);
            this.autoSaveTimer = null;
        }
    }

    // Utility methods
    isBookComplete(book) {
        return book && book.title && book.title.trim() !== '';
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    // Cleanup with enhanced resource management
    destroy() {
        // Clean up keyboard event listener
        if (this.keyboardHandler) {
            document.removeEventListener('keydown', this.keyboardHandler);
        }
        
        // Clean up intersection observer
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        // Clean up timers
        this.clearAutoSaveTimer();
        
        // Clean up event listeners
        this.removeEventListeners?.();
        
        super.destroy();
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.AudiobookStalkerrApp = AudiobookStalkerrApp;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = AudiobookStalkerrApp;
}

// Remove or comment out all references to editAuthor to prevent ReferenceError
// If you want to keep the UI, define a global stub:
window.editAuthor = function(authorName) {
    alert('Edit author not implemented: ' + authorName);
};
