/**
 * Table View Module for Authors Management
 * Handles DataTables integration for large datasets
 */

class TableViewModule {
    constructor() {
        this.dataTable = null;
        this.currentData = [];
    }

    /**
     * Initialize the DataTable
     */
    init() {
        // Ensure jQuery and DataTables are available
        if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
            console.error('jQuery or DataTables not available');
            return;
        }

        if (this.dataTable) {
            this.dataTable.destroy();
        }

        this.dataTable = $('#authors-table').DataTable({
            responsive: true,
            pageLength: 25,
            lengthMenu: [[10, 25, 50, 100, -1], [10, 25, 50, 100, "All"]],
            order: [[1, 'asc']], // Sort by author name
            columnDefs: [
                {
                    targets: 0, // Checkbox column
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    width: '40px'
                },
                {
                    targets: 6, // Actions column
                    orderable: false,
                    searchable: false,
                    className: 'text-center',
                    width: '120px'
                }
            ],
            language: {
                search: "Search authors:",
                lengthMenu: "Show _MENU_ authors per page",
                info: "Showing _START_ to _END_ of _TOTAL_ authors",
                infoEmpty: "No authors found",
                infoFiltered: "(filtered from _MAX_ total authors)",
                emptyTable: "No authors configured yet",
                zeroRecords: "No matching authors found"
            },
            dom: '<"row"<"col-sm-12 col-md-6"l><"col-sm-12 col-md-6"f>>' +
                 '<"row"<"col-sm-12"tr>>' +
                 '<"row"<"col-sm-12 col-md-5"i><"col-sm-12 col-md-7"p>>',
        });

        // Handle select all checkbox
        $('#select-all').on('change', (e) => {
            const isChecked = $(e.target).is(':checked');
            $('.author-checkbox').prop('checked', isChecked);
        });

        // Handle individual checkboxes
        $(document).on('change', '.author-checkbox', () => {
            const totalCheckboxes = $('.author-checkbox').length;
            const checkedCheckboxes = $('.author-checkbox:checked').length;
            
            $('#select-all').prop('indeterminate', checkedCheckboxes > 0 && checkedCheckboxes < totalCheckboxes);
            $('#select-all').prop('checked', checkedCheckboxes === totalCheckboxes);
        });
    }

    /**
     * Load data into the table
     */
    loadData(audiobooks) {
        console.log('TableView: Loading data:', audiobooks);
        
        this.currentData = audiobooks;
        const tableData = this.processDataForTable(audiobooks);
        
        console.log('TableView: Processed table data:', tableData);
        
        if (this.dataTable) {
            this.dataTable.clear();
            this.dataTable.rows.add(tableData);
            this.dataTable.draw();
        }
    }

    /**
     * Process audiobooks data for DataTable format
     */
    processDataForTable(audiobooks) {
        const tableData = [];

        // Handle different data structures
        const authorsData = this.normalizeAudiobooksData(audiobooks);

        Object.entries(authorsData).forEach(([authorName, books]) => {
            // Ensure books is an array
            const booksArray = Array.isArray(books) ? books : [books];
            
            const totalBooks = booksArray.length;
            const completeBooks = booksArray.filter(book => this.isBookComplete(book)).length;
            const completionPercentage = totalBooks > 0 ? Math.round((completeBooks / totalBooks) * 100) : 0;
            
            const publishers = [...new Set(booksArray.map(book => book.publisher).filter(p => p))];
            const lastUpdated = this.getLastUpdated(booksArray);

            tableData.push([
                `<input type="checkbox" class="author-checkbox" data-author="${this.escapeHtml(authorName)}">`,
                this.createAuthorCell(authorName, booksArray),
                this.createBooksCell(totalBooks, completeBooks),
                this.createCompletionCell(completionPercentage),
                this.createPublishersCell(publishers),
                this.createDateCell(lastUpdated),
                this.createActionsCell(authorName)
            ]);
        });

        return tableData;
    }

    /**
     * Normalize different audiobooks data structures
     */
    normalizeAudiobooksData(audiobooks) {
        console.log('TableView: Normalizing data:', audiobooks);
        
        // Handle new format: array of author objects with {name: string, books: array}
        if (Array.isArray(audiobooks)) {
            const normalized = {};
            audiobooks.forEach(author => {
                if (author && author.name && author.books) {
                    normalized[author.name] = author.books;
                } else if (author && typeof author === 'object') {
                    // Fallback: try to extract author and books info
                    const authorName = author.author || author.name || 'Unknown Author';
                    const books = author.books || [author];
                    if (!normalized[authorName]) {
                        normalized[authorName] = [];
                    }
                    normalized[authorName] = normalized[authorName].concat(books);
                }
            });
            console.log('TableView: Normalized to:', normalized);
            return normalized;
        }
        
        // Handle nested structure like {audiobooks: {author: {...}}}
        if (audiobooks && audiobooks.audiobooks && audiobooks.audiobooks.author) {
            return audiobooks.audiobooks.author;
        }
        
        // Handle direct author structure like {authorName: [books]}
        if (typeof audiobooks === 'object' && !Array.isArray(audiobooks)) {
            const firstKey = Object.keys(audiobooks)[0];
            if (firstKey && Array.isArray(audiobooks[firstKey])) {
                return audiobooks;
            }
        }

        console.warn('TableView: Unknown data format, returning empty object');
        return {};
    }

    /**
     * Create author name cell with book count
     */
    createAuthorCell(authorName, books) {
        const seriesCount = [...new Set(books.map(book => book.series).filter(s => s))].length;
        
        return `
            <div class="d-flex align-items-center">
                <div>
                    <div class="fw-bold">
                        <a href="#" onclick="showAuthorDetail('${this.escapeHtml(authorName)}')" class="text-decoration-none">
                            ${this.escapeHtml(authorName)}
                        </a>
                    </div>
                    <small class="text-muted">
                        ${seriesCount} series • ${books.length} books
                    </small>
                </div>
            </div>
        `;
    }

    /**
     * Create books count cell
     */
    createBooksCell(total, complete) {
        return `
            <div class="text-center">
                <div class="fw-bold">${total}</div>
                <small class="text-muted">${complete} complete</small>
            </div>
        `;
    }

    /**
     * Create completion progress cell
     */
    createCompletionCell(percentage) {
        let badgeClass = 'bg-danger';
        if (percentage >= 80) badgeClass = 'bg-success';
        else if (percentage >= 50) badgeClass = 'bg-warning';

        return `
            <div class="text-center">
                <span class="badge ${badgeClass}">${percentage}%</span>
                <div class="progress mt-1" style="height: 4px;">
                    <div class="progress-bar" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }

    /**
     * Create publishers cell
     */
    createPublishersCell(publishers) {
        if (publishers.length === 0) {
            return '<span class="text-muted">None</span>';
        }

        const displayPublishers = publishers.slice(0, 2);
        const remainingCount = publishers.length - 2;

        let html = displayPublishers.map(p => `<span class="badge bg-secondary me-1">${this.escapeHtml(p)}</span>`).join('');
        
        if (remainingCount > 0) {
            html += `<span class="badge bg-light text-dark">+${remainingCount}</span>`;
        }

        return html;
    }

    /**
     * Create date cell
     */
    createDateCell(date) {
        if (!date) return '<span class="text-muted">Never</span>';
        
        const dateObj = new Date(date);
        const now = new Date();
        const diffTime = Math.abs(now - dateObj);
        const diffDays = Math.floor(diffTime / (1000 * 60 * 60 * 24));

        let timeAgo = '';
        if (diffDays === 0) timeAgo = 'Today';
        else if (diffDays === 1) timeAgo = 'Yesterday';
        else if (diffDays < 7) timeAgo = `${diffDays} days ago`;
        else if (diffDays < 30) timeAgo = `${Math.floor(diffDays / 7)} weeks ago`;
        else timeAgo = `${Math.floor(diffDays / 30)} months ago`;

        return `
            <div class="text-center">
                <div class="small">${dateObj.toLocaleDateString()}</div>
                <small class="text-muted">${timeAgo}</small>
            </div>
        `;
    }

    /**
     * Create actions cell
     */
    createActionsCell(authorName) {
        return `
            <div class="btn-group" role="group">
                <button class="btn btn-sm btn-outline-primary" onclick="showAuthorDetail('${this.escapeHtml(authorName)}')" title="View Details">
                    <i class="fas fa-eye"></i>
                </button>
                <button class="btn btn-sm btn-outline-secondary" onclick="editAuthor('${this.escapeHtml(authorName)}')" title="Edit">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAuthor('${this.escapeHtml(authorName)}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    /**
     * Show table view
     */
    show() {
        // Hide grid container
        const gridContainer = document.getElementById('authors-container');
        if (gridContainer) gridContainer.style.display = 'none';
        
        // Show table container
        const tableContainer = document.getElementById('authors-table-container');
        if (tableContainer) tableContainer.style.display = 'block';
        
        if (!this.dataTable) {
            this.init();
        }
        
        // Trigger responsive recalculation
        setTimeout(() => {
            if (this.dataTable) {
                this.dataTable.columns.adjust().responsive.recalc();
            }
        }, 100);
    }

    /**
     * Hide table view
     */
    hide() {
        // Hide table container
        const tableContainer = document.getElementById('authors-table-container');
        if (tableContainer) tableContainer.style.display = 'none';
        
        // Show grid container
        const gridContainer = document.getElementById('authors-container');
        if (gridContainer) gridContainer.style.display = 'block';
    }

    /**
     * Get selected authors
     */
    getSelectedAuthors() {
        const selected = [];
        $('.author-checkbox:checked').each(function() {
            selected.push($(this).data('author'));
        });
        return selected;
    }

    /**
     * Helper methods
     */
    isBookComplete(book) {
        return !!(
            book.title &&
            book.series &&
            book.publisher &&
            book.narrator &&
            book.narrator.length > 0 &&
            book.narrator.every(n => n && n.trim())
        );
    }

    getLastUpdated(books) {
        const dates = books.map(book => book.last_updated || book.lastUpdated).filter(d => d);
        if (dates.length === 0) return null;
        return dates.sort().pop();
    }

    escapeHtml(text) {
        const map = {
            '&': '&amp;',
            '<': '&lt;',
            '>': '&gt;',
            '"': '&quot;',
            "'": '&#039;'
        };
        return text.replace(/[&<>"']/g, m => map[m]);
    }
}

// Global functions for table actions
window.showAuthorDetail = function(authorName) {
    // Navigate to author detail page
    const encodedName = encodeURIComponent(authorName);
    window.location.href = `/authors/author/${encodedName}`;
};

window.editAuthor = function(authorName) {
    // Navigate to author detail page (same as view for now)
    window.showAuthorDetail(authorName);
};

window.deleteAuthor = function(authorName) {
    if (confirm(`Are you sure you want to delete ${authorName} and all their books?`)) {
        // TODO: Implement author deletion via API
        console.log('Delete author:', authorName);
        
        // For now, just show a message
        if (window.app && window.app.deleteAuthor) {
            window.app.deleteAuthor(authorName);
        }
    }
};

window.exportSelected = function() {
    const selected = window.tableView?.getSelectedAuthors() || [];
    if (selected.length === 0) {
        alert('Please select authors to export');
        return;
    }
    console.log('Export selected:', selected);
};

window.deleteSelected = function() {
    const selected = window.tableView?.getSelectedAuthors() || [];
    if (selected.length === 0) {
        alert('Please select authors to delete');
        return;
    }
    
    if (confirm(`Are you sure you want to delete ${selected.length} selected authors?`)) {
        console.log('Delete selected:', selected);
    }
};

// Export the module
window.TableViewModule = TableViewModule;
