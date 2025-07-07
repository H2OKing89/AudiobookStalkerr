/**
 * UpcomingModule - Modular upcoming audiobooks functionality
 * Handles display and filtering of upcoming audiobook releases
 */

class UpcomingModule extends window.BaseModule {
    constructor(core) {
        super(core);
        this.dependencies = ['search', 'filters', 'api'];
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
        
        // iCal download button handler
        document.addEventListener('click', (e) => {
            if (e.target.closest('.btn-ical')) {
                e.preventDefault();
                const button = e.target.closest('.btn-ical');
                const asin = button.dataset.asin;
                if (asin) {
                    this.downloadIcal(asin);
                }
            }
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
                this.audiobooks = this.normalizeAudiobooks(window.upcomingAudiobooks);
            } else {
                // Fetch from API with abort controller
                const api = this.getModule('api');
                const response = await api.get('/api/upcoming', {
                    signal: this.abortController.signal
                });
                this.audiobooks = this.normalizeAudiobooks(response.data || []);
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
     * Normalize audiobook data from backend to frontend expected format
     */
    normalizeAudiobooks(audiobooks) {
        return audiobooks.map(book => ({
            // Preserve original fields
            ...book,
            // Add normalized field names for frontend compatibility
            id: book.asin || book.id,
            author_name: book.author_name || book.author,
            cover_url: book.cover_url || book.image_url,
            audible_url: book.audible_url || book.link,
            series_sequence: book.series_sequence || book.series_number,
            // Add price if available (currently not in backend but could be added)
            price: book.price || null
        }));
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
                        book.author_name || book.author,
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
                    // Parse date as local time to avoid timezone shifts
                    const [year, month, day] = book.release_date.split('-').map(Number);
                    book._releaseDate = new Date(year, month - 1, day);
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
                // Parse dates as local time to avoid timezone shifts
                const [aYear, aMonth, aDay] = aValue.split('-').map(Number);
                const [bYear, bMonth, bDay] = bValue.split('-').map(Number);
                aValue = new Date(aYear, aMonth - 1, aDay);
                bValue = new Date(bYear, bMonth - 1, bDay);
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
            <div class="row g-4" role="grid" aria-label="Upcoming audiobooks grid">
                ${this.filteredAudiobooks.map((book, index) => {
                    // Parse release date as local time to avoid timezone shifts
                    const [year, month, day] = book.release_date.split('-').map(Number);
                    const releaseDate = new Date(year, month - 1, day); // month is 0-indexed
                    const today = new Date();
                    const daysToRelease = Math.ceil((releaseDate - today) / (1000 * 60 * 60 * 24));
                    const isNewRelease = daysToRelease <= 7;
                    const isComingSoon = daysToRelease <= 30;
                    
                    // Format release date
                    const formattedDate = releaseDate.toLocaleDateString('en-US', {
                        weekday: 'long',
                        year: 'numeric',
                        month: 'long',
                        day: 'numeric'
                    });
                    
                    // Handle image with fallback
                    const imageUrl = book.cover_url || book.image_url || '/static/images/og-image.png';
                    const hasValidImage = true; // Always try to show an image (with fallback)
                    
                    // Handle description with truncation
                    const description = book.merchandising_summary || book.description || '';
                    const cleanDescription = this.stripHtml(description);
                    const truncatedDescription = cleanDescription.length > 150 ? 
                        cleanDescription.substring(0, 150) + '...' : cleanDescription;
                    
                    // Publisher name handling
                    const publisherName = book.publisher_name || book.publisher || 'Unknown Publisher';
                    
                    return `
                    <div class="col-lg-4 col-md-6 col-sm-12" role="gridcell">
                        <article class="card h-100 audiobook-card ${isNewRelease ? 'border-danger' : isComingSoon ? 'border-warning' : ''}" 
                                 tabindex="0" role="article" 
                                 aria-labelledby="book-title-${index}" 
                                 data-book-id="${book.id || book.asin || index}">
                            
                            <!-- Card Header with Author and Actions -->
                            <div class="card-header d-flex justify-content-between align-items-center">
                                <h6 class="mb-0 text-primary">${this.escapeHtml(book.author_name || book.author)}</h6>
                                <div class="btn-group d-flex gap-2 align-items-center">
                                    ${isNewRelease ? 
                                        '<span class="badge bg-danger">This Week</span>' : 
                                        isComingSoon ? 
                                        '<span class="badge bg-warning">This Month</span>' : ''
                                    }
                                    <button class="btn btn-sm btn-outline-success btn-ical" 
                                            data-asin="${book.asin || book.id}"
                                            title="Download calendar event (.ics file)"
                                            aria-label="Download calendar event for ${this.escapeHtml(book.title)}">
                                        <i class="fas fa-calendar-plus"></i>
                                    </button>
                                </div>
                            </div>
                            
                            <!-- Card Body -->
                            <div class="card-body">
                                <div class="row">
                                    <div class="col-4">
                                        <div class="book-cover mb-3">
                                            <img src="${this.escapeHtml(imageUrl)}" 
                                                 alt="Cover of ${this.escapeHtml(book.title)}" 
                                                 class="book-cover-img"
                                                 onerror="if(this.src !== '/static/images/og-image.png') { this.src='/static/images/og-image.png'; } else { this.style.display='none'; this.parentNode.innerHTML='<div class=\\'book-cover-fallback\\'><i class=\\'fas fa-headphones\\'></i><div class=\\'fallback-text\\'>No Cover</div></div>'; }"
                                                 loading="lazy">
                                        </div>
                                    </div>
                                    <div class="col-8">
                                        <h5 class="card-title" id="book-title-${index}">${this.escapeHtml(book.title)}</h5>
                                        ${book.series ? `
                                            <p class="text-muted mb-2">
                                                <i class="fas fa-list me-1"></i>
                                                ${this.escapeHtml(book.series)} 
                                                ${(book.series_sequence || book.series_number) ? `#${book.series_sequence || book.series_number}` : ''}
                                            </p>
                                        ` : ''}
                                        ${book.narrator ? `
                                            <p class="text-muted mb-2">
                                                <i class="fas fa-microphone me-1"></i>
                                                ${this.escapeHtml(book.narrator)}
                                            </p>
                                        ` : ''}
                                        <p class="text-muted mb-3">
                                            <i class="fas fa-building me-1"></i>
                                            ${this.escapeHtml(publisherName)}
                                        </p>
                                    </div>
                                </div>
                                
                                ${truncatedDescription ? `
                                    <div class="book-description mb-3">
                                        <p class="text-muted small">${this.escapeHtml(truncatedDescription)}</p>
                                    </div>
                                ` : ''}
                                
                                <div class="release-info">
                                    <div class="d-flex align-items-center mb-2">
                                        <i class="fas fa-calendar-day text-primary me-2"></i>
                                        <span class="fw-bold">${formattedDate}</span>
                                    </div>
                                    <div class="d-flex align-items-center">
                                        <i class="fas fa-clock text-muted me-2"></i>
                                        <span class="text-muted">${daysToRelease} days from now</span>
                                    </div>
                                </div>
                            </div>
                            
                            <!-- Card Footer -->
                            <div class="card-footer bg-transparent">
                                <div class="d-flex justify-content-between align-items-center">
                                    <div class="metadata-info">
                                        ${book.asin ? `
                                            <span class="badge">
                                                <i class="fas fa-tag me-1"></i>ASIN: ${book.asin}
                                            </span>
                                        ` : ''}
                                    </div>
                                    ${(book.audible_url || book.link) ? `
                                        <a href="${this.escapeHtml(book.audible_url || book.link)}" 
                                           target="_blank" 
                                           rel="noopener"
                                           class="btn btn-sm btn-outline-primary"
                                           aria-label="View ${this.escapeHtml(book.title)} on Audible">
                                            <i class="fas fa-external-link-alt me-1"></i>View on Audible
                                        </a>
                                    ` : ''}
                                </div>
                                ${book.last_checked ? `
                                    <small class="text-muted d-block mt-1">
                                        <i class="fas fa-sync me-1"></i>
                                        Updated: ${new Date(book.last_checked).toLocaleDateString()}
                                    </small>
                                ` : ''}
                            </div>
                        </article>
                    </div>
                `;
                }).join('')}
            </div>
        `;
    }

    /**
     * Render list view
     */
    renderListView() {
        return `
            <div class="list-group" role="list" aria-label="Upcoming audiobooks list">
                ${this.filteredAudiobooks.map((book, index) => {
                    // Handle image with fallback - same logic as grid view
                    const imageUrl = book.cover_url || book.image_url || '/static/images/og-image.png';
                    
                    return `
                    <article class="list-group-item" role="listitem" 
                             tabindex="0" 
                             aria-labelledby="book-title-list-${index}"
                             data-book-id="${book.id || index}">
                        <div class="row align-items-center">
                            <div class="col-auto">
                                <img src="${this.escapeHtml(imageUrl)}" 
                                     alt="Cover of ${this.escapeHtml(book.title)}" 
                                     style="width: 60px; height: 60px; object-fit: cover;" 
                                     class="rounded"
                                     onerror="this.src='/static/images/og-image.png';"
                                     loading="lazy">
                            </div>
                            <div class="col">
                                <h6 class="mb-1" id="book-title-list-${index}">${this.escapeHtml(book.title)}</h6>
                                <p class="mb-1 text-muted" aria-label="Author">${this.escapeHtml(book.author_name || book.author)}</p>
                                ${book.series ? `<small class="text-secondary" aria-label="Series">${this.escapeHtml(book.series)} ${(book.series_sequence || book.series_number) ? `#${book.series_sequence || book.series_number}` : ''}</small>` : ''}
                            </div>
                            <div class="col-auto">
                                <span class="badge bg-primary" aria-label="Release date">${this.formatDate(book.release_date)}</span>
                                <div class="text-muted small" aria-label="Time to release">${this.getTimeToRelease(book.release_date)}</div>
                            </div>
                        </div>
                    </article>
                `;
                }).join('')}
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

    truncateText(text, maxLength) {
        if (!text || text.length <= maxLength) return text;
        return text.substring(0, maxLength).trim() + '...';
    }

    formatDate(dateString) {
        // Parse date as local time to avoid timezone shifts
        // Split YYYY-MM-DD and create date in local timezone
        const [year, month, day] = dateString.split('-').map(Number);
        const date = new Date(year, month - 1, day); // month is 0-indexed
        return date.toLocaleDateString();
    }

    getTimeToRelease(dateString) {
        // Parse date as local time to avoid timezone shifts
        const [year, month, day] = dateString.split('-').map(Number);
        const releaseDate = new Date(year, month - 1, day);
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
     * Strip HTML tags from text
     */
    stripHtml(html) {
        if (!html) return '';
        // Create a temporary div to parse HTML and extract text content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || '';
    }

    /**
     * Download iCal file for audiobook
     */
    downloadIcal(asin) {
        if (!asin) {
            console.warn('No ASIN provided for iCal download');
            return;
        }
        
        // Create download URL for iCal export
        const downloadUrl = `/api/ical/download/${asin}`;
        
        // Create temporary link element
        const link = document.createElement('a');
        link.href = downloadUrl;
        link.download = `audiobook-${asin}.ics`;
        link.style.display = 'none';
        
        // Add to DOM, click, and remove
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        // Show success notification
        this.core.showToast && this.core.showToast('Calendar event downloaded', 'success');
        
        this.log(`Downloaded iCal for ASIN: ${asin}`);
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
if (typeof window !== 'undefined') {
    window.UpcomingModule = UpcomingModule;
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpcomingModule;
}

// Make downloadIcal globally accessible for backward compatibility
window.downloadIcal = function(asin) {
    const upcomingModule = window.AppCore?.getModule?.('upcoming');
    if (upcomingModule && upcomingModule.downloadIcal) {
        upcomingModule.downloadIcal(asin);
    } else {
        console.warn('UpcomingModule not available for iCal download');
    }
};

// Register the module
if (typeof window !== 'undefined') {
    window.UpcomingModule = UpcomingModule;
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = UpcomingModule;
}
