/**
 * Search Module (Clean Version)
 * Handles search functionality
 */

class SearchModule extends window.BaseModule {
    constructor(core) {
        super(core);
        this.searchInput = null;
        this.searchTimeout = null;
        this.minSearchLength = 2;
    }

    async init() {
        await super.init();
        this.searchInput = document.getElementById('search-input');
        if (this.searchInput) {
            this.setupEventListeners();
        }
        this.debug('Search module initialized');
    }

    setupEventListeners() {
        if (!this.searchInput) return;

        // Real-time search with debouncing
        this.searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 300);
        });

        // Search on Enter key
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                this.performSearch(e.target.value);
            }
        });

        // Clear search with Escape key
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.clearSearch();
            }
        });
    }

    performSearch(query) {
        this.setState('filters.search', query);
        this.emit('search:performed', { query });
        this.debug(`Search performed: "${query}"`);
    }

    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
            this.setState('filters.search', '');
            this.emit('search:cleared');
        }
    }

    updateSearchInput(value) {
        if (this.searchInput && document.activeElement !== this.searchInput) {
            this.searchInput.value = value;
        }
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.SearchModule = SearchModule;
}

if (typeof window !== 'undefined') {
    window.SearchModule = SearchModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = SearchModule;
}
