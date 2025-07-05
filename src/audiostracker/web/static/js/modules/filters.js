/**
 * Filters Module
 * Handles filtering and sorting functionality
 */

class FiltersModule {
    constructor() {
        this.filterSelect = null;
        this.availableFilters = {
            all: 'All Books',
            complete: 'Complete Info',
            incomplete: 'Missing Info',
            publisher: 'By Publisher',
            narrator: 'By Narrator'
        };
        
        this.init();
    }

    init() {
        this.filterSelect = document.getElementById('filter-select');
        if (this.filterSelect) {
            this.setupEventListeners();
        }
        
        // Subscribe to state changes
        state.subscribe('filters.status', (data) => {
            this.updateFilterSelect(data.newValue);
        });
        
        state.subscribe('audiobooks', () => {
            this.updateFilterOptions();
        });
    }

    setupEventListeners() {
        this.filterSelect.addEventListener('change', (e) => {
            this.applyFilter(e.target.value);
        });
    }

    applyFilter(filterType = 'all') {
        // Update state
        state.update('filters.status', filterType);
        
        // Special handling for publisher and narrator filters
        if (filterType === 'publisher') {
            this.showPublisherFilter();
        } else if (filterType === 'narrator') {
            this.showNarratorFilter();
        } else {
            // Clear specific filters
            state.update('filters.publisher', '');
            state.update('filters.narrator', '');
        }
        
        // Trigger re-render
        if (window.app && window.app.renderAuthors) {
            window.app.renderAuthors();
        }
        
        // Update URL
        this.updateURL();
        
        // Show filter summary
        this.showFilterSummary();
    }

    showPublisherFilter() {
        const stats = state.get('stats');
        if (!stats || !stats.publishers) return;
        
        const modal = this.createFilterModal('Publisher Filter', stats.publishers, 'publisher');
        modal.show();
    }

    showNarratorFilter() {
        const stats = state.get('stats');
        if (!stats || !stats.narrators) return;
        
        const modal = this.createFilterModal('Narrator Filter', stats.narrators, 'narrator');
        modal.show();
    }

    createFilterModal(title, options, filterType) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-filter me-2"></i>${title}
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="mb-3">
                            <input type="text" class="form-control" id="filter-search" 
                                   placeholder="Search ${filterType}s...">
                        </div>
                        <div class="filter-options" style="max-height: 300px; overflow-y: auto;">
                            <div class="form-check mb-2">
                                <input class="form-check-input" type="radio" name="filter-option" 
                                       id="filter-all" value="" checked>
                                <label class="form-check-label" for="filter-all">
                                    <strong>All ${title.replace(' Filter', '')}s</strong>
                                </label>
                            </div>
                            ${options.map((option, index) => `
                                <div class="form-check mb-2">
                                    <input class="form-check-input" type="radio" name="filter-option" 
                                           id="filter-${index}" value="${escapeHtml(option)}">
                                    <label class="form-check-label" for="filter-${index}">
                                        ${escapeHtml(option)}
                                    </label>
                                </div>
                            `).join('')}
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-primary" id="apply-filter">Apply Filter</button>
                    </div>
                </div>
            </div>
        `;

        document.body.appendChild(modal);
        const bsModal = new bootstrap.Modal(modal);

        // Search functionality
        const searchInput = modal.querySelector('#filter-search');
        const filterOptions = modal.querySelector('.filter-options');
        
        searchInput.addEventListener('input', (e) => {
            const searchTerm = e.target.value.toLowerCase();
            const checkboxes = filterOptions.querySelectorAll('.form-check');
            
            checkboxes.forEach((checkbox, index) => {
                if (index === 0) return; // Skip "All" option
                
                const label = checkbox.querySelector('label').textContent.toLowerCase();
                checkbox.style.display = label.includes(searchTerm) ? 'block' : 'none';
            });
        });

        // Apply filter
        modal.querySelector('#apply-filter').addEventListener('click', () => {
            const selectedOption = modal.querySelector('input[name="filter-option"]:checked');
            if (selectedOption) {
                state.update(`filters.${filterType}`, selectedOption.value);
                if (window.app && window.app.renderAuthors) {
                    window.app.renderAuthors();
                }
                this.updateURL();
                this.showFilterSummary();
            }
            bsModal.hide();
        });

        // Clean up on close
        modal.addEventListener('hidden.bs.modal', () => {
            modal.remove();
        });

        return bsModal;
    }

    updateFilterSelect(value) {
        if (this.filterSelect && this.filterSelect.value !== value) {
            this.filterSelect.value = value;
        }
    }

    updateFilterOptions() {
        // This could be expanded to dynamically update filter options
        // based on current data
    }

    showFilterSummary() {
        const filters = state.get('filters');
        const activeFilters = [];
        
        if (filters.search) {
            activeFilters.push(`Search: "${filters.search.trim()}"`);
        }
        
        if (filters.status !== 'all') {
            activeFilters.push(`Status: ${this.availableFilters[filters.status]}`);
        }
        
        if (filters.publisher) {
            activeFilters.push(`Publisher: ${filters.publisher}`);
        }
        
        if (filters.narrator) {
            activeFilters.push(`Narrator: ${filters.narrator}`);
        }
        
        // Show active filters in UI
        this.updateFilterDisplay(activeFilters);
        
        // Calculate and show result count
        const filteredData = state.getFilteredData();
        const totalBooks = Object.values(filteredData).reduce((sum, books) => sum + books.length, 0);
        const totalAuthors = Object.keys(filteredData).length;
        
        if (activeFilters.length > 0) {
            showToast(`Filter applied: ${totalBooks} books from ${totalAuthors} authors`, 'info', 3000);
        }
    }

    updateFilterDisplay(activeFilters) {
        let filterDisplay = document.getElementById('active-filters');
        
        if (activeFilters.length === 0) {
            if (filterDisplay) {
                filterDisplay.remove();
            }
            return;
        }
        
        if (!filterDisplay) {
            filterDisplay = document.createElement('div');
            filterDisplay.id = 'active-filters';
            filterDisplay.className = 'active-filters mb-3';
            
            const controlPanel = document.querySelector('.control-panel');
            if (controlPanel) {
                controlPanel.appendChild(filterDisplay);
            }
        }
        
        filterDisplay.innerHTML = `
            <div class="d-flex align-items-center flex-wrap gap-2">
                <span class="text-muted small">Active filters:</span>
                ${activeFilters.map(filter => `
                    <span class="badge bg-primary">${escapeHtml(filter)}</span>
                `).join('')}
                <button type="button" class="btn btn-sm btn-outline-secondary" onclick="clearAllFilters()">
                    <i class="fas fa-times me-1"></i>Clear All
                </button>
            </div>
        `;
    }

    clearAllFilters() {
        state.update('filters.search', '');
        state.update('filters.status', 'all');
        state.update('filters.publisher', '');
        state.update('filters.narrator', '');
        
        // Clear search input
        const searchInput = document.getElementById('search-input');
        if (searchInput) {
            searchInput.value = '';
        }
        
        // Update filter select
        if (this.filterSelect) {
            this.filterSelect.value = 'all';
        }
        
        // Clear URL parameters
        url.removeParam('search');
        url.removeParam('status');
        url.removeParam('publisher');
        url.removeParam('narrator');
        
        // Re-render
        if (window.app && window.app.renderAuthors) {
            window.app.renderAuthors();
        }
        
        // Remove filter display
        const filterDisplay = document.getElementById('active-filters');
        if (filterDisplay) {
            filterDisplay.remove();
        }
        
        showToast('All filters cleared', 'info', 2000);
    }

    updateURL() {
        const filters = state.get('filters');
        
        // Update URL parameters
        if (filters.search) {
            url.setParam('search', filters.search.trim());
        } else {
            url.removeParam('search');
        }
        
        if (filters.status !== 'all') {
            url.setParam('status', filters.status);
        } else {
            url.removeParam('status');
        }
        
        if (filters.publisher) {
            url.setParam('publisher', filters.publisher);
        } else {
            url.removeParam('publisher');
        }
        
        if (filters.narrator) {
            url.setParam('narrator', filters.narrator);
        } else {
            url.removeParam('narrator');
        }
    }

    loadFiltersFromURL() {
        const searchParam = url.getParam('search');
        const statusParam = url.getParam('status');
        const publisherParam = url.getParam('publisher');
        const narratorParam = url.getParam('narrator');
        
        if (searchParam) {
            state.update('filters.search', searchParam);
        }
        
        if (statusParam && this.availableFilters[statusParam]) {
            state.update('filters.status', statusParam);
        }
        
        if (publisherParam) {
            state.update('filters.publisher', publisherParam);
        }
        
        if (narratorParam) {
            state.update('filters.narrator', narratorParam);
        }
    }

    // Advanced filtering
    createAdvancedFilter() {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.innerHTML = `
            <div class="modal-dialog modal-lg">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title">
                            <i class="fas fa-sliders-h me-2"></i>Advanced Filters
                        </h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal"></button>
                    </div>
                    <div class="modal-body">
                        <div class="row">
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Completion Status</label>
                                    <select class="form-select" id="adv-status">
                                        <option value="all">All Books</option>
                                        <option value="complete">Complete Only</option>
                                        <option value="incomplete">Incomplete Only</option>
                                        <option value="missing-title">Missing Title</option>
                                        <option value="missing-series">Missing Series</option>
                                        <option value="missing-publisher">Missing Publisher</option>
                                        <option value="missing-narrator">Missing Narrator</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Publisher</label>
                                    <select class="form-select" id="adv-publisher">
                                        <option value="">All Publishers</option>
                                    </select>
                                </div>
                            </div>
                            <div class="col-md-6">
                                <div class="mb-3">
                                    <label class="form-label">Narrator</label>
                                    <select class="form-select" id="adv-narrator">
                                        <option value="">All Narrators</option>
                                    </select>
                                </div>
                                
                                <div class="mb-3">
                                    <label class="form-label">Books per Author</label>
                                    <div class="row">
                                        <div class="col">
                                            <input type="number" class="form-control" id="adv-min-books" 
                                                   placeholder="Min" min="0">
                                        </div>
                                        <div class="col">
                                            <input type="number" class="form-control" id="adv-max-books" 
                                                   placeholder="Max" min="0">
                                        </div>
                                    </div>
                                </div>
                            </div>
                        </div>
                        
                        <div class="mb-3">
                            <label class="form-label">Sort By</label>
                            <div class="row">
                                <div class="col">
                                    <select class="form-select" id="adv-sort-by">
                                        <option value="author">Author Name</option>
                                        <option value="books">Number of Books</option>
                                        <option value="complete">Completion Rate</option>
                                    </select>
                                </div>
                                <div class="col-auto">
                                    <select class="form-select" id="adv-sort-order">
                                        <option value="asc">Ascending</option>
                                        <option value="desc">Descending</option>
                                    </select>
                                </div>
                            </div>
                        </div>
                    </div>
                    <div class="modal-footer">
                        <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
                        <button type="button" class="btn btn-outline-warning" id="reset-filters">Reset</button>
                        <button type="button" class="btn btn-primary" id="apply-advanced-filters">Apply</button>
                    </div>
                </div>
            </div>
        `;
        
        // Populate options and handle events
        // ... implementation details
        
        return modal;
    }
}

// Global filter functions
function applyFilter() {
    const filterSelect = document.getElementById('filter-select');
    if (filterSelect && window.filters) {
        window.filters.applyFilter(filterSelect.value);
    }
}

function clearAllFilters() {
    if (window.filters) {
        window.filters.clearAllFilters();
    }
}

// Initialize filters module
window.filters = new FiltersModule();

// Load filters from URL on page load
document.addEventListener('DOMContentLoaded', () => {
    window.filters.loadFiltersFromURL();
});
