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
            urgencyText = `<span class="badge bg-danger">Releases in ${daysUntilRelease} day${daysUntilRelease === 1 ? '' : 's'}</span>`;
        } else if (daysUntilRelease <= 30) {
            urgencyClass = 'border-warning';
            urgencyText = `<span class="badge bg-warning">Releases in ${daysUntilRelease} days</span>`;
        } else {
            urgencyText = `<span class="badge bg-primary">Releases in ${daysUntilRelease} days</span>`;
        }
        
        // Handle image with fallback
        const imageUrl = book.image_url || '/static/images/book-placeholder.png';
        const imageTag = book.image_url ? 
            `<img src="${this.escapeHtml(book.image_url)}" alt="Book cover" class="book-cover-img" onerror="this.src='/static/images/book-placeholder.png'">` : 
            `<div class="book-cover-placeholder"><i class="fas fa-book"></i></div>`;
        
        // Handle description with truncation
        const description = book.merchandising_summary || '';
        const cleanDescription = this.stripHtml(description);
        const truncatedDescription = cleanDescription.length > 150 ? 
            cleanDescription.substring(0, 150) + '...' : cleanDescription;
        
        // Use publisher_name if available, fallback to publisher
        const publisherName = book.publisher_name || book.publisher || 'Unknown Publisher';
        
        col.innerHTML = `
            <div class="audiobook-card card h-100 ${urgencyClass}">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <h5 class="card-title mb-0">${this.escapeHtml(book.title)}</h5>
                    <div class="d-flex gap-2">
                        <button class="btn btn-sm btn-outline-primary" onclick="downloadIcal('${book.asin}')" title="Download calendar event (.ics file)">
                            <i class="fas fa-calendar-plus"></i>
                        </button>
                    </div>
                </div>
                <div class="card-body">
                    <div class="row">
                        <div class="col-4">
                            <div class="book-cover">
                                ${imageTag}
                            </div>
                        </div>
                        <div class="col-8">
                            <div class="book-details">
                                <p class="text-muted mb-1">
                                    <i class="fas fa-user me-1"></i>
                                    <strong>Author:</strong> ${this.escapeHtml(book.author)}
                                </p>
                                ${book.series ? `<p class="text-muted mb-1">
                                    <i class="fas fa-list me-1"></i>
                                    <strong>Series:</strong> ${this.escapeHtml(book.series)}${book.series_number ? ` #${book.series_number}` : ''}
                                </p>` : ''}
                                <p class="text-muted mb-1">
                                    <i class="fas fa-microphone me-1"></i>
                                    <strong>Narrator:</strong> ${this.escapeHtml(book.narrator || 'Unknown')}
                                </p>
                                <p class="text-muted mb-2">
                                    <i class="fas fa-building me-1"></i>
                                    <strong>Publisher:</strong> ${this.escapeHtml(publisherName)}
                                </p>
                                
                                <div class="release-info mb-3">
                                    <p class="fw-bold mb-1">
                                        <i class="fas fa-calendar-alt me-1"></i>
                                        Release Date: ${formattedDate}
                                    </p>
                                    ${urgencyText}
                                </div>
                                
                                ${truncatedDescription ? `<div class="book-description">
                                    <p class="small">${this.escapeHtml(truncatedDescription)}</p>
                                </div>` : ''}
                            </div>
                        </div>
                    </div>
                </div>
                <div class="card-footer">
                    <small class="text-muted">
                        <i class="fas fa-barcode me-1"></i>
                        ASIN: ${this.escapeHtml(book.asin)} | 
                        <i class="fas fa-clock me-1"></i>
                        Updated: ${book.updated_at ? new Date(book.updated_at).toLocaleDateString() : 'Unknown'}
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

    stripHtml(html) {
        if (!html) return '';
        // Create a temporary div to parse HTML and extract text content
        const tempDiv = document.createElement('div');
        tempDiv.innerHTML = html;
        return tempDiv.textContent || tempDiv.innerText || '';
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

function downloadIcal(asin) {
    if (!asin) {
        console.error('No ASIN provided for iCal download');
        return;
    }
    
    // Show loading state
    const button = event.target.closest('button');
    const originalHtml = button.innerHTML;
    button.innerHTML = '<i class="fas fa-spinner fa-spin"></i>';
    button.disabled = true;
    
    fetch(`/api/export/ical/${asin}`)
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.blob();
        })
        .then(blob => {
            // Create download link
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            
            // Extract filename from response headers if possible
            link.download = `audiobook_${asin}.ics`;
            link.style.display = 'none';
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            window.URL.revokeObjectURL(url);
            
            // Show success message
            if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast('Calendar event downloaded successfully!', 'success');
            }
        })
        .catch(error => {
            console.error('Error downloading iCal:', error);
            
            // Show error message
            let errorMessage = 'Failed to download calendar event';
            if (error.message.includes('503')) {
                errorMessage = 'Calendar export not available - missing dependencies';
            } else if (error.message.includes('404')) {
                errorMessage = 'Audiobook not found';
            }
            
            if (window.app && typeof window.app.showToast === 'function') {
                window.app.showToast(errorMessage, 'error');
            } else {
                alert(errorMessage);
            }
        })
        .finally(() => {
            // Restore button state
            button.innerHTML = originalHtml;
            button.disabled = false;
        });
}

// Export to global scope
window.UpcomingApp = UpcomingApp;
