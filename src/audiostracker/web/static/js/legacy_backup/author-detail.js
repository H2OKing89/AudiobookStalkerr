/**
 * Author Detail Page Application
 * Manages individual author's book collection
 */

class AuthorDetailApp {
    constructor() {
        this.authorData = window.authorData || {};
        this.dataTable = null;
        this.currentViewMode = 'table';
        this.hasUnsavedChanges = false;
    }

    /**
     * Initialize the application
     */
    init() {
        console.log('Initializing Author Detail App for:', this.authorData.name);
        
        this.initDataTable();
        this.setupEventListeners();
        this.checkForUnsavedChanges();
        
        console.log('Author Detail App initialized successfully');
    }

    /**
     * Initialize DataTable for books
     */
    initDataTable() {
        if (this.dataTable) {
            this.dataTable.destroy();
        }

        this.dataTable = $('#books-table').DataTable({
            responsive: true,
            pageLength: 25,
            lengthMenu: [[10, 25, 50, -1], [10, 25, 50, "All"]],
            order: [[1, 'asc']], // Sort by title
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
                search: "Search books:",
                lengthMenu: "Show _MENU_ books per page",
                info: "Showing _START_ to _END_ of _TOTAL_ books",
                infoEmpty: "No books found",
                infoFiltered: "(filtered from _MAX_ total books)",
                emptyTable: "No books configured for this author",
                zeroRecords: "No matching books found"
            }
        });

        // Handle select all checkbox
        $('#select-all-books').on('change', (e) => {
            const isChecked = $(e.target).is(':checked');
            $('.book-checkbox').prop('checked', isChecked);
        });

        // Handle individual checkboxes
        $(document).on('change', '.book-checkbox', () => {
            const totalCheckboxes = $('.book-checkbox').length;
            const checkedCheckboxes = $('.book-checkbox:checked').length;
            
            $('#select-all-books').prop('indeterminate', checkedCheckboxes > 0 && checkedCheckboxes < totalCheckboxes);
            $('#select-all-books').prop('checked', checkedCheckboxes === totalCheckboxes);
        });
    }

    /**
     * Setup event listeners
     */
    setupEventListeners() {
        // Prevent page unload if there are unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.hasUnsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 's':
                        e.preventDefault();
                        this.saveAuthorData();
                        break;
                    case 'b':
                        e.preventDefault();
                        this.showAddBookModal();
                        break;
                }
            }
        });
    }

    /**
     * Set books view mode (table or cards)
     */
    setBooksViewMode(mode) {
        this.currentViewMode = mode;
        
        const tableContainer = document.getElementById('books-table-container');
        const cardContainer = document.getElementById('books-card-container');
        
        if (mode === 'table') {
            tableContainer.style.display = 'block';
            cardContainer.style.display = 'none';
            
            // Trigger DataTable responsive recalculation
            setTimeout(() => {
                if (this.dataTable) {
                    this.dataTable.columns.adjust().responsive.recalc();
                }
            }, 100);
        } else {
            tableContainer.style.display = 'none';
            cardContainer.style.display = 'block';
        }
    }

    /**
     * Mark changes as unsaved
     */
    markUnsaved() {
        this.hasUnsavedChanges = true;
        this.updateUI();
    }

    /**
     * Mark changes as saved
     */
    markSaved() {
        this.hasUnsavedChanges = false;
        this.updateUI();
    }

    /**
     * Update UI based on saved state
     */
    updateUI() {
        // Add visual indicator for unsaved changes
        const saveButton = document.querySelector('[onclick="saveAuthorData()"]');
        if (saveButton) {
            if (this.hasUnsavedChanges) {
                saveButton.classList.add('btn-warning');
                saveButton.classList.remove('btn-outline-secondary');
            } else {
                saveButton.classList.remove('btn-warning');
                saveButton.classList.add('btn-outline-secondary');
            }
        }
    }

    /**
     * Check for unsaved changes periodically
     */
    checkForUnsavedChanges() {
        // This would compare current data with original data
        // For now, we'll implement this when we add editing functionality
    }

    /**
     * Save author data
     */
    async saveAuthorData() {
        try {
            this.showLoading(true);
            
            // Prepare data for saving
            const saveData = {
                [this.authorData.name]: this.authorData.books
            };

            const response = await fetch('/api/audiobooks', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify(saveData)
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            const result = await response.json();
            
            if (result.success) {
                this.markSaved();
                this.showToast('Author data saved successfully!', 'success');
            } else {
                throw new Error(result.error || 'Save failed');
            }

        } catch (error) {
            console.error('Save failed:', error);
            this.showToast(`Save failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Refresh author data
     */
    async refreshAuthorData() {
        try {
            this.showLoading(true);
            
            const response = await fetch(`/api/audiobooks`);
            const data = await response.json();
            
            if (data.data && data.data[this.authorData.name]) {
                this.authorData.books = data.data[this.authorData.name];
                
                // Reload page to refresh template data
                window.location.reload();
            } else {
                this.showToast('Author data refreshed', 'info');
            }

        } catch (error) {
            console.error('Refresh failed:', error);
            this.showToast(`Refresh failed: ${error.message}`, 'error');
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Export author data
     */
    exportAuthorData() {
        const exportData = {
            author: this.authorData.name,
            books: this.authorData.books,
            stats: this.authorData.stats,
            exportDate: new Date().toISOString()
        };

        const dataStr = JSON.stringify(exportData, null, 2);
        const dataBlob = new Blob([dataStr], { type: 'application/json' });
        
        const link = document.createElement('a');
        link.href = URL.createObjectURL(dataBlob);
        link.download = `${this.authorData.name.replace(/[^a-z0-9]/gi, '_').toLowerCase()}_audiobooks.json`;
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
        
        this.showToast('Author data exported successfully!', 'success');
    }

    /**
     * Show loading overlay
     */
    showLoading(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }

    /**
     * Show toast notification
     */
    showToast(message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        const messageEl = document.getElementById('toast-message');
        
        if (toast && messageEl) {
            messageEl.textContent = message;
            
            // Set toast style based on type
            toast.className = `toast ${type === 'error' ? 'bg-danger text-white' : type === 'success' ? 'bg-success text-white' : ''}`;
            
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        }
    }

    /**
     * Get selected books
     */
    getSelectedBooks() {
        const selected = [];
        $('.book-checkbox:checked').each(function() {
            const index = parseInt($(this).data('index'));
            selected.push(index);
        });
        return selected;
    }
}

// Global functions for book management
window.editBook = function(index) {
    console.log('Edit book at index:', index);
    // TODO: Implement book editing modal
    if (window.app) {
        window.app.markUnsaved();
    }
};

window.duplicateBook = function(index) {
    console.log('Duplicate book at index:', index);
    // TODO: Implement book duplication
    if (window.app) {
        window.app.markUnsaved();
    }
};

window.deleteBook = function(index) {
    if (confirm('Are you sure you want to delete this book?')) {
        console.log('Delete book at index:', index);
        // TODO: Implement book deletion
        if (window.app) {
            window.app.markUnsaved();
        }
    }
};

window.showAddBookModal = function() {
    console.log('Show add book modal');
    // TODO: Implement add book modal
};

window.setBooksViewMode = function(mode) {
    if (window.app) {
        window.app.setBooksViewMode(mode);
    }
};

window.saveAuthorData = function() {
    if (window.app) {
        window.app.saveAuthorData();
    }
};

window.refreshAuthorData = function() {
    if (window.app) {
        window.app.refreshAuthorData();
    }
};

window.exportAuthorData = function() {
    if (window.app) {
        window.app.exportAuthorData();
    }
};

window.duplicateAuthor = function() {
    console.log('Duplicate author');
    // TODO: Implement author duplication
};

window.mergeAuthor = function() {
    console.log('Merge author');
    // TODO: Implement author merging
};

window.deleteAuthor = function() {
    const authorName = window.app?.authorData?.name || 'this author';
    if (confirm(`Are you sure you want to delete ${authorName} and all their books? This action cannot be undone.`)) {
        console.log('Delete author:', authorName);
        // TODO: Implement author deletion with redirect to config page
    }
};

// Export the class
window.AuthorDetailApp = AuthorDetailApp;
