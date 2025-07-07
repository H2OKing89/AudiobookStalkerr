/**
 * Table View Module (Clean Version)
 * Handles DataTables integration for large datasets
 */

class TableViewModule extends BaseModule {
    constructor(core) {
        super(core);
        this.dataTable = null;
        this.currentData = [];
    }

    async init() {
        await super.init();
        
        // Ensure jQuery and DataTables are available
        if (typeof $ === 'undefined' || typeof $.fn.DataTable === 'undefined') {
            console.warn('jQuery or DataTables not available');
            return;
        }

        this.debug('Table view module initialized');
    }

    loadData(authors) {
        this.currentData = this.processDataForTable(authors);
        
        if (this.dataTable) {
            this.dataTable.clear().rows.add(this.currentData).draw();
        } else {
            this.initializeDataTable();
        }

        this.debug(`Table loaded with ${this.currentData.length} rows`);
    }

    initializeDataTable() {
        const tableElement = $('#authors-table');
        if (tableElement.length === 0) {
            console.warn('Table element not found');
            return;
        }

        this.dataTable = tableElement.DataTable({
            data: this.currentData,
            columns: [
                { 
                    title: '<input type="checkbox" id="select-all">',
                    data: 'select',
                    orderable: false,
                    searchable: false,
                    width: '30px'
                },
                { title: 'Author', data: 'author' },
                { title: 'Books', data: 'books' },
                { title: 'Complete', data: 'completion' },
                { title: 'Publishers', data: 'publishers' },
                { title: 'Last Updated', data: 'lastUpdated' },
                { 
                    title: 'Actions', 
                    data: 'actions',
                    orderable: false,
                    searchable: false,
                    width: '120px'
                }
            ],
            pageLength: 25,
            responsive: true,
            order: [[1, 'asc']],
            language: {
                emptyTable: 'No authors found'
            }
        });

        // Handle select all checkbox
        $('#select-all').on('change', (e) => {
            const checkboxes = this.dataTable.$('input[type="checkbox"]');
            checkboxes.prop('checked', e.target.checked);
        });

        this.debug('DataTable initialized');
    }

    processDataForTable(authors) {
        return authors.map(author => {
            const books = author.books || [];
            const completeBooks = books.filter(this.isBookComplete).length;
            const publishers = [...new Set(books.map(b => b.publisher).filter(Boolean))];
            
            return {
                select: `<input type="checkbox" value="${this.escapeHtml(author.name)}">`,
                author: this.createAuthorCell(author.name, books.length),
                books: books.length,
                completion: this.createCompletionCell(completeBooks, books.length),
                publishers: publishers.slice(0, 3).join(', ') + (publishers.length > 3 ? '...' : ''),
                lastUpdated: this.getLastUpdated(books),
                actions: this.createActionsCell(author.name)
            };
        });
    }

    createAuthorCell(authorName, bookCount) {
        return `
            <div>
                <strong>
                    <a href="/authors/author/${encodeURIComponent(authorName)}" class="text-decoration-none">
                        ${this.escapeHtml(authorName)}
                    </a>
                </strong>
                <small class="text-muted d-block">${bookCount} book${bookCount !== 1 ? 's' : ''}</small>
            </div>
        `;
    }

    createCompletionCell(complete, total) {
        const percentage = total > 0 ? Math.round((complete / total) * 100) : 0;
        return `
            <div>
                <div class="d-flex justify-content-between">
                    <span>${complete}/${total}</span>
                    <span>${percentage}%</span>
                </div>
                <div class="progress mt-1" style="height: 4px;">
                    <div class="progress-bar bg-success" style="width: ${percentage}%"></div>
                </div>
            </div>
        `;
    }

    createActionsCell(authorName) {
        return `
            <div class="btn-group">
                <a href="/authors/author/${encodeURIComponent(authorName)}" class="btn btn-sm btn-outline-primary" title="View Details">
                    <i class="fas fa-eye"></i>
                </a>
                <button class="btn btn-sm btn-outline-danger" onclick="deleteAuthor('${this.escapeHtml(authorName)}')" title="Delete">
                    <i class="fas fa-trash"></i>
                </button>
            </div>
        `;
    }

    show() {
        const container = document.getElementById('authors-table-container');
        if (container) {
            container.style.display = 'block';
        }
    }

    hide() {
        const container = document.getElementById('authors-table-container');
        if (container) {
            container.style.display = 'none';
        }
    }

    getSelectedAuthors() {
        if (!this.dataTable) return [];
        
        const selected = [];
        this.dataTable.$('input[type="checkbox"]:checked').each((i, el) => {
            if (el.value) {
                selected.push(el.value);
            }
        });
        return selected;
    }

    isBookComplete(book) {
        return book && book.title && book.title.trim() !== '';
    }

    getLastUpdated(books) {
        // Placeholder - could be enhanced with actual timestamps
        return 'Recently';
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.TableViewModule = TableViewModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = TableViewModule;
}
