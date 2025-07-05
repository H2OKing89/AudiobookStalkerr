/**
 * Upcoming Audiobooks App
 * Handles display and filtering of upcoming audiobook releases from database
 */

class UpcomingApp {
    constructor() {
        this.audiobooks = [];
        this.filteredAudiobooks = [];
        this.filters = {
            search: '',
            author: 'all',
            dateRange: 'all'
        };
        this.sortBy = 'release_date';
        this.sortOrder = 'asc';
    }

    async init() {
        console.log('Initializing Upcoming Audiobooks App...');
        
        // Load initial data
        this.audiobooks = window.upcomingAudiobooks || [];
        this.filteredAudiobooks = [...this.audiobooks];
        
        // Setup event listeners
        this.setupEventListeners();
        
        // Initial render
        this.render();
        this.updateFilters();
        
        console.log(`Loaded ${this.audiobooks.length} upcoming audiobooks`);
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

        // Author filter
        const authorFilter = document.getElementById('author-filter');
        if (authorFilter) {
            authorFilter.addEventListener('change', (e) => {
                this.filters.author = e.target.value;
                this.applyFilters();
            });
        }

        // Date filter
        const dateFilter = document.getElementById('date-filter');
        if (dateFilter) {
            dateFilter.addEventListener('change', (e) => {
                this.filters.dateRange = e.target.value;
                this.applyFilters();
            });
        }

        // Sort select
        const sortSelect = document.getElementById('sort-select');
        if (sortSelect) {
            sortSelect.addEventListener('change', (e) => {
                this.sortBy = e.target.value;
                this.applyFilters();
            });
        }
    }

    updateFilters() {
        // Update author filter options
        const authorFilter = document.getElementById('author-filter');
        if (authorFilter) {
            const authors = [...new Set(this.audiobooks.map(book => book.author))].sort();
            
            // Clear existing options except "All Authors"
            authorFilter.innerHTML = '<option value="all">All Authors</option>';
            
            authors.forEach(author => {
                const option = document.createElement('option');
                option.value = author;
                option.textContent = author;
                authorFilter.appendChild(option);
            });
        }
    }

    applyFilters() {
        let filtered = [...this.audiobooks];

        // Apply search filter
        if (this.filters.search) {
            filtered = filtered.filter(book => 
                book.title.toLowerCase().includes(this.filters.search) ||
                book.author.toLowerCase().includes(this.filters.search) ||
                book.series.toLowerCase().includes(this.filters.search) ||
                book.narrator.toLowerCase().includes(this.filters.search)
            );
        }

        // Apply author filter
        if (this.filters.author !== 'all') {
            filtered = filtered.filter(book => book.author === this.filters.author);
        }

        // Apply date range filter
        if (this.filters.dateRange !== 'all') {
            const now = new Date();
            const currentMonth = now.getMonth();
            const currentYear = now.getFullYear();

            filtered = filtered.filter(book => {
                const releaseDate = new Date(book.release_date);
                const releaseMonth = releaseDate.getMonth();
                const releaseYear = releaseDate.getFullYear();

                switch (this.filters.dateRange) {
                    case 'this-month':
                        return releaseMonth === currentMonth && releaseYear === currentYear;
                    case 'next-month':
                        const nextMonth = currentMonth === 11 ? 0 : currentMonth + 1;
                        const nextYear = currentMonth === 11 ? currentYear + 1 : currentYear;
                        return releaseMonth === nextMonth && releaseYear === nextYear;
                    case 'next-3-months':
                        const threeMonthsFromNow = new Date(now);
                        threeMonthsFromNow.setMonth(threeMonthsFromNow.getMonth() + 3);
                        return releaseDate <= threeMonthsFromNow;
                    default:
                        return true;
                }
            });
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aValue, bValue;

            switch (this.sortBy) {
                case 'release_date':
                    aValue = new Date(a.release_date);
                    bValue = new Date(b.release_date);
                    break;
                case 'author':
                    aValue = a.author.toLowerCase();
                    bValue = b.author.toLowerCase();
                    break;
                case 'title':
                    aValue = a.title.toLowerCase();
                    bValue = b.title.toLowerCase();
                    break;
                case 'series':
                    aValue = a.series.toLowerCase();
                    bValue = b.series.toLowerCase();
                    break;
                default:
                    aValue = a.release_date;
                    bValue = b.release_date;
            }

            if (aValue < bValue) return this.sortOrder === 'asc' ? -1 : 1;
            if (aValue > bValue) return this.sortOrder === 'asc' ? 1 : -1;
            return 0;
        });

        this.filteredAudiobooks = filtered;
        this.render();
        this.updateSearchResultsHeader();
    }

    updateSearchResultsHeader() {
        const header = document.getElementById('search-results-header');
        const count = document.getElementById('results-count');
        
        if (this.filters.search || this.filters.author !== 'all' || this.filters.dateRange !== 'all') {
            header.style.display = 'block';
            count.textContent = this.filteredAudiobooks.length;
        } else {
            header.style.display = 'none';
        }
    }

    render() {
        const container = document.getElementById('audiobooks-container');
        const emptyState = document.getElementById('empty-state');
        
        if (this.filteredAudiobooks.length === 0) {
            container.innerHTML = '';
            emptyState.style.display = 'block';
            return;
        }

        emptyState.style.display = 'none';
        
        // Group by month
        const groupedByMonth = this.groupByMonth(this.filteredAudiobooks);
        
        container.innerHTML = '';
        
        Object.keys(groupedByMonth).forEach(month => {
            const monthSection = this.createMonthSection(month, groupedByMonth[month]);
            container.appendChild(monthSection);
        });
    }

    groupByMonth(audiobooks) {
        const grouped = {};
        
        audiobooks.forEach(book => {
            const date = new Date(book.release_date);
            const monthKey = date.toLocaleDateString('en-US', { year: 'numeric', month: 'long' });
            
            if (!grouped[monthKey]) {
                grouped[monthKey] = [];
            }
            grouped[monthKey].push(book);
        });
        
        return grouped;
    }

    createMonthSection(month, books) {
        const section = document.createElement('div');
        section.className = 'month-section mb-5';
        
        section.innerHTML = `
            <div class="month-header mb-4">
                <h2 class="month-title">
                    <i class="fas fa-calendar me-2"></i>${month}
                    <span class="badge bg-primary ms-2">${books.length}</span>
                </h2>
            </div>
            <div class="row g-4" id="books-${month.replace(/\s+/g, '-')}">
            </div>
        `;
        
        const booksContainer = section.querySelector('.row');
        books.forEach(book => {
            const bookCard = this.createBookCard(book);
            booksContainer.appendChild(bookCard);
        });
        
        return section;
    }

    createBookCard(book) {
        const col = document.createElement('div');
        col.className = 'col-lg-4 col-md-6 col-sm-12';
        
        const releaseDate = new Date(book.release_date);
        const formattedDate = releaseDate.toLocaleDateString('en-US', {
            weekday: 'long',
            year: 'numeric',
            month: 'long',
            day: 'numeric'
        });
        
        const daysUntilRelease = Math.ceil((releaseDate - new Date()) / (1000 * 60 * 60 * 24));
        
        let urgencyClass = '';
        let urgencyText = '';
        if (daysUntilRelease <= 7) {
            urgencyClass = 'border-danger';
            urgencyText = '<span class="badge bg-danger">This Week</span>';
        } else if (daysUntilRelease <= 30) {
            urgencyClass = 'border-warning';
            urgencyText = '<span class="badge bg-warning">This Month</span>';
        }
        
        col.innerHTML = `
            <div class="card h-100 audiobook-card ${urgencyClass}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h6 class="mb-0 text-primary">${this.escapeHtml(book.author)}</h6>
                    ${urgencyText}
                </div>
                <div class="card-body">
                    <h5 class="card-title">${this.escapeHtml(book.title)}</h5>
                    ${book.series ? `<p class="text-muted mb-2"><i class="fas fa-list me-1"></i>${this.escapeHtml(book.series)} ${book.series_number ? `#${book.series_number}` : ''}</p>` : ''}
                    <p class="text-muted mb-2"><i class="fas fa-microphone me-1"></i>${this.escapeHtml(book.narrator)}</p>
                    <p class="text-muted mb-3"><i class="fas fa-building me-1"></i>${this.escapeHtml(book.publisher)}</p>
                    
                    <div class="release-info">
                        <div class="d-flex align-items-center mb-2">
                            <i class="fas fa-calendar-day text-primary me-2"></i>
                            <span class="fw-bold">${formattedDate}</span>
                        </div>
                        <div class="d-flex align-items-center">
                            <i class="fas fa-clock text-muted me-2"></i>
                            <span class="text-muted">${daysUntilRelease} days from now</span>
                        </div>
                    </div>
                </div>
                <div class="card-footer bg-transparent">
                    <small class="text-muted">
                        <i class="fas fa-tag me-1"></i>ASIN: ${book.asin}
                        ${book.last_checked ? ` • Updated: ${new Date(book.last_checked).toLocaleDateString()}` : ''}
                    </small>
                </div>
            </div>
        `;
        
        return col;
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
            
            const response = await fetch('/api/upcoming');
            if (response.ok) {
                this.audiobooks = await response.json();
                this.filteredAudiobooks = [...this.audiobooks];
                this.render();
                this.updateFilters();
                this.showToast('Data refreshed successfully', 'success');
            } else {
                throw new Error('Failed to refresh data');
            }
        } catch (error) {
            console.error('Error refreshing data:', error);
            this.showToast('Failed to refresh data', 'error');
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
function refreshData() {
    if (window.app) {
        window.app.refresh();
    }
}

function toggleTheme() {
    // Simple theme toggle implementation
    const body = document.body;
    const themeToggle = document.getElementById('theme-toggle');
    
    if (body.classList.contains('dark-theme')) {
        body.classList.remove('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-moon"></i>';
        localStorage.setItem('theme', 'light');
    } else {
        body.classList.add('dark-theme');
        themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        localStorage.setItem('theme', 'dark');
    }
}

// Load saved theme on page load
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme');
    if (savedTheme === 'dark') {
        document.body.classList.add('dark-theme');
        const themeToggle = document.getElementById('theme-toggle');
        if (themeToggle) {
            themeToggle.innerHTML = '<i class="fas fa-sun"></i>';
        }
    }
});

// Export to global scope
window.UpcomingApp = UpcomingApp;
