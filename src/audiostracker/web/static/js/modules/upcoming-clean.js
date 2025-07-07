/**
 * UpcomingModule - Modular upcoming audiobooks functionality
 * Handles display and filtering of upcoming audiobook releases
 */

class UpcomingModule extends window.AudiobookStalkerrCore.BaseModule {
    constructor() {
        super('upcoming', ['search', 'filters', 'api']);
    }

    init() {
        this.audiobooks = [];
        this.filteredAudiobooks = [];
        this.filters = {
            search: '',
            author: 'all',
            dateRange: 'all'
        };
        this.sortBy = 'release_date';
        this.sortOrder = 'asc';
        this.viewMode = 'grid'; // grid or list
        
        // Modern browser APIs
        this.abortController = new AbortController();
        this.intersectionObserver = null;
        this.resizeObserver = null;
        this.searchDebounceTimer = null;
        this.isVisible = true;
        
        // Performance tracking
        this.performanceMetrics = {
            renderTime: 0,
            filterTime: 0,
            lastUpdate: Date.now()
        };

        this.loadData();
        this.setupEventListeners();
        this.setupObservers();
        this.log('UpcomingModule initialized');
    }

    setupEventListeners() {
        // Search functionality with debouncing
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            // Add ARIA attributes
            searchInput.setAttribute('aria-label', 'Search upcoming audiobooks');
            searchInput.setAttribute('aria-describedby', 'search-help');
            
            searchInput.addEventListener('input', (e) => {
                clearTimeout(this.searchDebounceTimer);
                this.searchDebounceTimer = setTimeout(() => {
                    this.filters.search = e.target.value.toLowerCase();
                    this.applyFilters();
                    
                    // Announce search results to screen readers
                    this.announceSearchResults();
                }, 300);
            });
            
            // Keyboard shortcuts
            searchInput.addEventListener('keydown', (e) => {
                if (e.key === 'Escape') {
                    e.target.value = '';
                    this.filters.search = '';
                    this.applyFilters();
                }
            });
        }

        // Author filter with accessibility
        const authorFilter = document.getElementById('author-filter');
        if (authorFilter) {
            authorFilter.setAttribute('aria-label', 'Filter by author');
            authorFilter.addEventListener('change', (e) => {
                this.filters.author = e.target.value;
                this.applyFilters();
                this.announceFilterUpdate('author', e.target.value);
            });
        }

        // Date range filter with accessibility
        const dateRangeFilter = document.getElementById('date-range-filter');
        if (dateRangeFilter) {
            dateRangeFilter.setAttribute('aria-label', 'Filter by date range');
            dateRangeFilter.addEventListener('change', (e) => {
                this.filters.dateRange = e.target.value;
                this.applyFilters();
                this.announceFilterUpdate('date range', e.target.value);
            });
        }

        // Sort controls with keyboard navigation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-sort]')) {
                const sortBy = e.target.dataset.sort;
                this.handleSort(sortBy);
            }
            
            if (e.target.matches('[data-view-mode]')) {
                const viewMode = e.target.dataset.viewMode;
                this.setViewMode(viewMode);
            }
        });
        
        // Keyboard navigation for sort controls
        document.addEventListener('keydown', (e) => {
            if (e.target.matches('[data-sort]') && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const sortBy = e.target.dataset.sort;
                this.handleSort(sortBy);
            }
            
            if (e.target.matches('[data-view-mode]') && (e.key === 'Enter' || e.key === ' ')) {
                e.preventDefault();
                const viewMode = e.target.dataset.viewMode;
                this.setViewMode(viewMode);
            }
        });

        // Page visibility API for performance
        document.addEventListener('visibilitychange', () => {
            this.isVisible = !document.hidden;
            if (this.isVisible && Date.now() - this.performanceMetrics.lastUpdate > 60000) {
                // Refresh data if page has been hidden for more than 1 minute
                this.loadData();
            }
        });

        // Listen for data updates
        this.core.on('upcoming:refresh', () => {
            this.loadData();
        });

        this.core.on('upcoming:filter', (filters) => {
            this.filters = { ...this.filters, ...filters };
            this.applyFilters();
        });
        
        // Global keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'f':
                        if (searchInput) {
                            e.preventDefault();
                            searchInput.focus();
                        }
                        break;
                    case 'r':
                        e.preventDefault();
                        this.loadData();
                        break;
                }
            }
        });
    }

    /**
     * Setup modern browser observers
     */
    setupObservers() {
        // Intersection Observer for lazy loading and performance
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach(entry => {
                    if (entry.isIntersecting) {
                        // Lazy load cover images
                        const img = entry.target.querySelector('img[data-src]');
                        if (img) {
                            img.src = img.dataset.src;
                            img.removeAttribute('data-src');
                        }
                    }
                });
            }, {
                rootMargin: '50px',
                threshold: 0.1
            });
        }
        
        // Resize Observer for responsive layout adjustments
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver((entries) => {
                const container = document.getElementById('audiobooks-container');
                if (container) {
                    // Adjust grid columns based on container width
                    const width = container.offsetWidth;
                    if (width < 576) {
                        container.classList.add('mobile-view');
                    } else {
                        container.classList.remove('mobile-view');
                    }
                }
            });
            
            const container = document.getElementById('audiobooks-container');
            if (container) {
                this.resizeObserver.observe(container);
            }
        }
    }

    /**
     * Load upcoming audiobooks data
     */
    async loadData() {
        try {
            const startTime = performance.now();
            
            // Try to get data from window first (server-rendered)
            if (window.upcomingAudiobooks) {
                this.audiobooks = window.upcomingAudiobooks;
            } else {
                // Fetch from API with abort controller
                const api = this.getModule('api');
                const response = await api.get('/api/upcoming', {
                    signal: this.abortController.signal
                });
                this.audiobooks = response.data || [];
            }

            this.filteredAudiobooks = [...this.audiobooks];
            this.render();
            this.updateFilters();
            
            // Performance tracking
            const loadTime = performance.now() - startTime;
            this.performanceMetrics.lastUpdate = Date.now();
            
            this.log(`Loaded ${this.audiobooks.length} upcoming audiobooks in ${loadTime.toFixed(2)}ms`);
            this.core.emit('upcoming:loaded', {
                audiobooks: this.audiobooks,
                loadTime,
                count: this.audiobooks.length
            });
            
        } catch (error) {
            if (error.name === 'AbortError') {
                this.log('Data loading was cancelled');
                return;
            }
            
            this.error('Failed to load upcoming audiobooks:', error);
            this.showErrorState(error);
            this.core.emit('upcoming:error', error);
        }
    }

    /**
     * Apply current filters to audiobooks
     */
    applyFilters() {
        const startTime = performance.now();
        
        this.filteredAudiobooks = this.audiobooks.filter(book => {
            // Search filter with performance optimization
            if (this.filters.search) {
                const searchTerm = this.filters.search.toLowerCase();
                
                // Use cached search fields if available
                if (!book._searchCache) {
                    book._searchCache = [
                        book.title,
                        book.author_name,
                        book.series,
                        book.narrator
                    ].filter(Boolean).join(' ').toLowerCase();
                }
                
                if (!book._searchCache.includes(searchTerm)) {
                    return false;
                }
            }

            // Author filter
            if (this.filters.author && this.filters.author !== 'all') {
                if (book.author_name !== this.filters.author) {
                    return false;
                }
            }

            // Date range filter with optimized date handling
            if (this.filters.dateRange && this.filters.dateRange !== 'all') {
                if (!book._releaseDate) {
                    book._releaseDate = new Date(book.release_date);
                }
                
                const releaseDate = book._releaseDate;
                const now = new Date();
                
                switch (this.filters.dateRange) {
                    case 'this-week':
                        const weekFromNow = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);
                        if (releaseDate > weekFromNow) return false;
                        break;
                    case 'this-month':
                        const monthFromNow = new Date(now.getFullYear(), now.getMonth() + 1, now.getDate());
                        if (releaseDate > monthFromNow) return false;
                        break;
                    case 'next-3-months':
                        const threeMonthsFromNow = new Date(now.getFullYear(), now.getMonth() + 3, now.getDate());
                        if (releaseDate > threeMonthsFromNow) return false;
                        break;
                }
            }

            return true;
        });

        this.applySorting();
        this.render();
        this.updateFilterCounts();
        
        // Performance tracking
        const filterTime = performance.now() - startTime;
        this.performanceMetrics.filterTime = filterTime;
        
        if (filterTime > 100) {
            this.warn(`Slow filter operation: ${filterTime.toFixed(2)}ms`);
        }
    }

    /**
     * Apply current sorting
     */
    applySorting() {
        this.filteredAudiobooks.sort((a, b) => {
            let aValue = a[this.sortBy];
            let bValue = b[this.sortBy];

            // Handle different data types
            if (this.sortBy === 'release_date') {
                aValue = new Date(aValue);
                bValue = new Date(bValue);
            } else if (typeof aValue === 'string') {
                aValue = aValue.toLowerCase();
                bValue = bValue.toLowerCase();
            }

            let comparison = 0;
            if (aValue < bValue) comparison = -1;
            if (aValue > bValue) comparison = 1;

            return this.sortOrder === 'desc' ? -comparison : comparison;
        });
    }

    /**
     * Handle sort button clicks
     */
    handleSort(sortBy) {
        if (this.sortBy === sortBy) {
            // Toggle sort order
            this.sortOrder = this.sortOrder === 'asc' ? 'desc' : 'asc';
        } else {
            // New sort field
            this.sortBy = sortBy;
            this.sortOrder = 'asc';
        }

        this.applySorting();
        this.render();
        this.updateSortIndicators();
    }

    /**
     * Set view mode (grid or list)
     */
    setViewMode(mode) {
        this.viewMode = mode;
        this.render();
        this.updateViewModeButtons();
    }

    /**
     * Render the audiobooks display
     */
    render() {
        const startTime = performance.now();
        const container = document.getElementById('audiobooks-container');
        if (!container) return;

        // Add loading state
        container.setAttribute('aria-busy', 'true');
        container.setAttribute('aria-live', 'polite');

        if (this.filteredAudiobooks.length === 0) {
            container.innerHTML = this.renderEmptyState();
            container.setAttribute('aria-busy', 'false');
            return;
        }

        let content;
        if (this.viewMode === 'grid') {
            content = this.renderGridView();
        } else {
            content = this.renderListView();
        }
        
        container.innerHTML = content;
        container.setAttribute('aria-busy', 'false');
        
        // Set up lazy loading for images
        this.setupLazyLoading();
        
        // Performance tracking
        const renderTime = performance.now() - startTime;
        this.performanceMetrics.renderTime = renderTime;
        
        if (renderTime > 100) {
            this.warn(`Slow render operation: ${renderTime.toFixed(2)}ms`);
        }

        this.core.emit('upcoming:rendered', {
            count: this.filteredAudiobooks.length,
            viewMode: this.viewMode,
            renderTime
        });
    }

    /**
     * Render grid view
     */
    renderGridView() {
        return `
            <div class="row g-3" role="grid" aria-label="Upcoming audiobooks grid">
                ${this.filteredAudiobooks.map((book, index) => `
                    <div class="col-md-6 col-lg-4 col-xl-3" role="gridcell">
                        <article class="card h-100" tabindex="0" role="article" 
                                 aria-labelledby="book-title-${index}" 
                                 data-book-id="${book.id || index}">
                            ${book.cover_url ? `
                                <img data-src="${book.cover_url}" 
                                     class="card-img-top lazy-img" 
                                     alt="Cover of ${this.escapeHtml(book.title)}" 
                                     style="height: 200px; object-fit: cover;"
                                     loading="lazy">
                            ` : `
                                <div class="card-img-top d-flex align-items-center justify-content-center bg-light" 
                                     style="height: 200px;" aria-label="No cover image">
                                    <i class="fas fa-book fa-3x text-muted" aria-hidden="true"></i>
                                </div>
                            `}
                            <div class="card-body d-flex flex-column">
                                <h5 class="card-title" id="book-title-${index}">${this.escapeHtml(book.title)}</h5>
                                <p class="card-text text-muted" aria-label="Author">${this.escapeHtml(book.author_name)}</p>
                                ${book.series ? `<p class="card-text text-secondary small" aria-label="Series">${this.escapeHtml(book.series)}</p>` : ''}
                                <div class="mt-auto">
                                    <div class="d-flex justify-content-between align-items-center">
                                        <span class="badge bg-primary" aria-label="Release date">${this.formatDate(book.release_date)}</span>
                                        <small class="text-muted" aria-label="Time to release">${this.getTimeToRelease(book.release_date)}</small>
                                    </div>
                                </div>
                            </div>
                        </article>
                    </div>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render list view
     */
    renderListView() {
        return `
            <div class="list-group" role="list" aria-label="Upcoming audiobooks list">
                ${this.filteredAudiobooks.map((book, index) => `
                    <article class="list-group-item" role="listitem" 
                             tabindex="0" 
                             aria-labelledby="book-title-list-${index}"
                             data-book-id="${book.id || index}">
                        <div class="row align-items-center">
                            ${book.cover_url ? `
                                <div class="col-auto">
                                    <img data-src="${book.cover_url}" 
                                         alt="Cover of ${this.escapeHtml(book.title)}" 
                                         style="width: 60px; height: 60px; object-fit: cover;" 
                                         class="rounded lazy-img"
                                         loading="lazy">
                                </div>
                            ` : `
                                <div class="col-auto">
                                    <div class="d-flex align-items-center justify-content-center bg-light rounded" 
                                         style="width: 60px; height: 60px;" aria-label="No cover image">
                                        <i class="fas fa-book text-muted" aria-hidden="true"></i>
                                    </div>
                                </div>
                            `}
                            <div class="col">
                                <h6 class="mb-1" id="book-title-list-${index}">${this.escapeHtml(book.title)}</h6>
                                <p class="mb-1 text-muted" aria-label="Author">${this.escapeHtml(book.author_name)}</p>
                                ${book.series ? `<small class="text-secondary" aria-label="Series">${this.escapeHtml(book.series)}</small>` : ''}
                            </div>
                            <div class="col-auto">
                                <span class="badge bg-primary" aria-label="Release date">${this.formatDate(book.release_date)}</span>
                                <div class="text-muted small" aria-label="Time to release">${this.getTimeToRelease(book.release_date)}</div>
                            </div>
                        </div>
                    </article>
                `).join('')}
            </div>
        `;
    }

    /**
     * Render empty state
     */
    renderEmptyState() {
        return `
            <div class="text-center py-5" role="status" aria-live="polite">
                <i class="fas fa-calendar-alt fa-3x text-muted mb-3" aria-hidden="true"></i>
                <h4>No upcoming audiobooks found</h4>
                <p class="text-muted">Try adjusting your filters or check back later for new releases.</p>
                <button class="btn btn-primary mt-3" onclick="this.loadData()" aria-label="Refresh audiobooks">
                    <i class="fas fa-refresh me-2" aria-hidden="true"></i>Refresh
                </button>
            </div>
        `;
    }

    /**
     * Show error state
     */
    showErrorState(error) {
        const container = document.getElementById('audiobooks-container');
        if (container) {
            container.innerHTML = `
                <div class="text-center py-5" role="alert" aria-live="assertive">
                    <i class="fas fa-exclamation-triangle fa-3x text-warning mb-3" aria-hidden="true"></i>
                    <h4>Error Loading Audiobooks</h4>
                    <p class="text-muted">${this.escapeHtml(error.message || 'An unexpected error occurred.')}</p>
                    <button class="btn btn-primary mt-3" onclick="this.loadData()" aria-label="Try loading again">
                        <i class="fas fa-retry me-2" aria-hidden="true"></i>Try Again
                    </button>
                </div>
            `;
        }
    }

    /**
     * Setup lazy loading for images
     */
    setupLazyLoading() {
        if (this.intersectionObserver) {
            document.querySelectorAll('.lazy-img').forEach(img => {
                this.intersectionObserver.observe(img);
            });
        } else {
            // Fallback for browsers without IntersectionObserver
            document.querySelectorAll('.lazy-img[data-src]').forEach(img => {
                img.src = img.dataset.src;
                img.removeAttribute('data-src');
            });
        }
    }

    /**
     * Announce search results to screen readers
     */
    announceSearchResults() {
        const announcement = `Found ${this.filteredAudiobooks.length} audiobooks matching your search`;
        this.announceToScreenReader(announcement);
    }

    /**
     * Announce filter updates to screen readers
     */
    announceFilterUpdate(filterType, value) {
        const friendlyValue = value === 'all' ? 'all items' : value;
        const announcement = `Filter updated: ${filterType} set to ${friendlyValue}. Showing ${this.filteredAudiobooks.length} audiobooks`;
        this.announceToScreenReader(announcement);
    }

    /**
     * Announce to screen readers using ARIA live region
     */
    announceToScreenReader(message) {
        let liveRegion = document.getElementById('upcoming-announcements');
        if (!liveRegion) {
            liveRegion = document.createElement('div');
            liveRegion.id = 'upcoming-announcements';
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            document.body.appendChild(liveRegion);
        }
        
        liveRegion.textContent = message;
        
        // Clear after announcement
        setTimeout(() => {
            liveRegion.textContent = '';
        }, 1000);
    }

    /**
     * Update filter dropdowns with available options
     */
    updateFilters() {
        this.updateAuthorFilter();
        this.updateDateRangeFilter();
    }

    updateAuthorFilter() {
        const authorFilter = document.getElementById('author-filter');
        if (!authorFilter) return;

        const authors = [...new Set(this.audiobooks.map(book => book.author_name))].sort();
        
        authorFilter.innerHTML = `
            <option value="all">All Authors</option>
            ${authors.map(author => `
                <option value="${this.escapeHtml(author)}">${this.escapeHtml(author)}</option>
            `).join('')}
        `;
    }

    updateDateRangeFilter() {
        const dateRangeFilter = document.getElementById('date-range-filter');
        if (!dateRangeFilter) return;

        dateRangeFilter.innerHTML = `
            <option value="all">All Dates</option>
            <option value="this-week">This Week</option>
            <option value="this-month">This Month</option>
            <option value="next-3-months">Next 3 Months</option>
        `;
    }

    /**
     * Update filter counts
     */
    updateFilterCounts() {
        const countElement = document.getElementById('results-count');
        if (countElement) {
            countElement.textContent = `${this.filteredAudiobooks.length} of ${this.audiobooks.length} audiobooks`;
        }
    }

    /**
     * Update sort indicators
     */
    updateSortIndicators() {
        document.querySelectorAll('[data-sort]').forEach(button => {
            button.classList.remove('active');
            if (button.dataset.sort === this.sortBy) {
                button.classList.add('active');
                button.setAttribute('data-sort-order', this.sortOrder);
            }
        });
    }

    /**
     * Update view mode buttons
     */
    updateViewModeButtons() {
        document.querySelectorAll('[data-view-mode]').forEach(button => {
            button.classList.remove('active');
            if (button.dataset.viewMode === this.viewMode) {
                button.classList.add('active');
            }
        });
    }

    /**
     * Utility methods
     */
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatDate(dateString) {
        return new Date(dateString).toLocaleDateString();
    }

    getTimeToRelease(dateString) {
        const releaseDate = new Date(dateString);
        const now = new Date();
        const diffTime = releaseDate - now;
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));

        if (diffDays < 0) return 'Released';
        if (diffDays === 0) return 'Today';
        if (diffDays === 1) return 'Tomorrow';
        if (diffDays < 7) return `${diffDays} days`;
        if (diffDays < 30) return `${Math.ceil(diffDays / 7)} weeks`;
        return `${Math.ceil(diffDays / 30)} months`;
    }

    /**
     * Public API methods
     */
    getAPI() {
        return {
            loadData: this.loadData.bind(this),
            applyFilters: this.applyFilters.bind(this),
            setViewMode: this.setViewMode.bind(this),
            getAudiobooks: () => this.filteredAudiobooks,
            getFilters: () => ({ ...this.filters }),
            getPerformanceMetrics: () => ({ ...this.performanceMetrics }),
            refresh: this.loadData.bind(this)
        };
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Cancel any pending requests
        if (this.abortController) {
            this.abortController.abort();
        }
        
        // Clear debounce timer
        if (this.searchDebounceTimer) {
            clearTimeout(this.searchDebounceTimer);
        }
        
        // Disconnect observers
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        // Clear performance metrics
        this.performanceMetrics = null;
        
        // Remove announcements element
        const liveRegion = document.getElementById('upcoming-announcements');
        if (liveRegion) {
            liveRegion.remove();
        }
        
        this.log('UpcomingModule destroyed');
        super.destroy();
    }
}

// Register the module
if (window.AudiobookStalkerrCore?.ModuleRegistry) {
    window.AudiobookStalkerrCore.ModuleRegistry.register('upcoming', UpcomingModule);
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpcomingModule;
}
