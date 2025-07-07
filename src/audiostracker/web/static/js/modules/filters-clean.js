/**
 * Filters Module (Clean Version)
 * Handles filtering and sorting functionality
 */

class FiltersModule extends BaseModule {
    constructor(core) {
        super(core);
        this.filterSelect = null;
        this.availableFilters = {
            all: 'All Books',
            publisher: 'By Publisher',
            narrator: 'By Narrator'
        };
    }

    async init() {
        await super.init();
        this.filterSelect = document.getElementById('publisher-filter');
        if (this.filterSelect) {
            this.setupEventListeners();
        }
        this.debug('Filters module initialized');
    }

    setupEventListeners() {
        if (!this.filterSelect) return;

        this.filterSelect.addEventListener('change', (e) => {
            this.applyFilter(e.target.value);
        });
    }

    applyFilter(filterValue = 'all') {
        this.setState('filters.publisher', filterValue);
        this.emit('filter:changed', { type: 'publisher', value: filterValue });
        this.debug(`Filter applied: publisher = ${filterValue}`);
    }

    updateFilterOptions(authors) {
        if (!this.filterSelect || !authors) return;

        // Get unique publishers
        const publishers = new Set();
        authors.forEach(author => {
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
        this.filterSelect.innerHTML = '<option value="all">All Publishers</option>';

        sortedPublishers.forEach(publisher => {
            const option = document.createElement('option');
            option.value = publisher;
            option.textContent = publisher;
            this.filterSelect.appendChild(option);
        });

        this.debug(`Updated filter options: ${sortedPublishers.length} publishers`);
    }

    clearAllFilters() {
        this.setState('filters.publisher', 'all');
        if (this.filterSelect) {
            this.filterSelect.value = 'all';
        }
        this.emit('filter:cleared');
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.FiltersModule = FiltersModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = FiltersModule;
}
