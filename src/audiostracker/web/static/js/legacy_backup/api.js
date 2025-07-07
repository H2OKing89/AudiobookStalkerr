/**
 * AudiobookStalkerr API Module
 * Handles all API communication with the FastAPI backend
 */

class APIModule extends BaseModule {
    constructor(core) {
        super(core);
        this.baseURL = '';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
    }

    async init() {
        await super.init();
        
        // Initialize the debounced save function
        this.debouncedSave = this.debounce(async (data) => {
            try {
                await this.saveAudiobooks(data);
                this.notify('Changes saved successfully', 'success');
            } catch (error) {
                this.notify('Failed to save changes', 'error');
            }
        }, 1000);
        
        this.debug('API module initialized');
    }

    /**
     * Debounce utility method
     */
    debounce(func, wait, immediate) {
        let timeout;
        return function executedFunction(...args) {
            const later = () => {
                timeout = null;
                if (!immediate) func(...args);
            };
            const callNow = immediate && !timeout;
            clearTimeout(timeout);
            timeout = setTimeout(later, wait);
            if (callNow) func(...args);
        };
    }

    /**
     * Generic API request handler
     */
    async request(method, endpoint, data = null) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            method: method.toUpperCase(),
            headers: this.defaultHeaders
        };

        if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
            config.body = JSON.stringify(data);
        }

        try {
            this.showLoading(true);
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            const responseData = await response.json();
            return responseData;
        } catch (error) {
            console.error('API Request Error:', error);
            this.notify(`Error: ${error.message}`, 'error');
            throw error;
        } finally {
            this.showLoading(false);
        }
    }

    /**
     * Show loading state
     */
    showLoading(show) {
        // Use utils function if available, otherwise try direct DOM manipulation
        if (typeof showLoading === 'function') {
            showLoading(show);
        } else {
            const overlay = document.getElementById('loading-overlay');
            if (overlay) {
                overlay.style.display = show ? 'flex' : 'none';
            }
        }
    }

    /**
     * Get all audiobooks data
     */
    async getAudiobooks() {
        return await this.request('GET', '/api/audiobooks');
    }

    /**
     * Save audiobooks data
     */
    async saveAudiobooks(data) {
        return await this.request('POST', '/api/audiobooks', data);
    }

    /**
     * Add a new author
     */
    async addAuthor(authorName) {
        const formData = new FormData();
        formData.append('author_name', authorName);
        
        return await this.request('/api/authors', {
            method: 'POST',
            headers: {}, // Remove Content-Type to let browser set it for FormData
            body: formData
        });
    }

    /**
     * Delete an author
     */
    async deleteAuthor(authorName) {
        return await this.request(`/api/authors/${encodeURIComponent(authorName)}`, {
            method: 'DELETE'
        });
    }

    /**
     * Add a book to an author
     */
    async addBook(authorName, book) {
        return await this.request(`/api/authors/${encodeURIComponent(authorName)}/books`, {
            method: 'POST',
            body: JSON.stringify(book)
        });
    }

    /**
     * Update a specific book
     */
    async updateBook(authorName, bookIndex, book) {
        return await this.request(`/api/authors/${encodeURIComponent(authorName)}/books/${bookIndex}`, {
            method: 'PUT',
            body: JSON.stringify(book)
        });
    }

    /**
     * Delete a specific book
     */
    async deleteBook(authorName, bookIndex) {
        return await this.request(`/api/authors/${encodeURIComponent(authorName)}/books/${bookIndex}`, {
            method: 'DELETE'
        });
    }

    /**
     * Get collection statistics
     */
    async getStats() {
        return await this.request('/api/stats');
    }

    /**
     * Export collection (download as file)
     */
    async exportCollection() {
        try {
            showLoading(true);
            const response = await fetch('/api/export', { method: 'POST' });
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }
            
            // Get filename from Content-Disposition header
            const disposition = response.headers.get('Content-Disposition');
            let filename = 'audiobooks_export.json';
            if (disposition && disposition.includes('filename=')) {
                filename = disposition.split('filename=')[1].replace(/"/g, '');
            }
            
            const blob = await response.blob();
            
            // Download the file
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = filename;
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            showToast('Collection exported successfully', 'success');
            return { success: true };
        } catch (error) {
            showToast(`Failed to export collection: ${error.message}`, 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    /**
     * Import collection
     */
    async importCollection(data) {
        return await this.request('/api/import', {
            method: 'POST',
            body: JSON.stringify(data)
        });
    }

    /**
     * Batch update operations
     */
    async batchUpdate(operations) {
        // Process multiple operations in sequence to maintain data integrity
        const results = [];
        
        for (const operation of operations) {
            try {
                let result;
                switch (operation.type) {
                    case 'add_book':
                        result = await this.addBook(operation.authorName, operation.book);
                        break;
                    case 'update_book':
                        result = await this.updateBook(operation.authorName, operation.bookIndex, operation.book);
                        break;
                    case 'delete_book':
                        result = await this.deleteBook(operation.authorName, operation.bookIndex);
                        break;
                    case 'add_author':
                        result = await this.addAuthor(operation.authorName);
                        break;
                    case 'delete_author':
                        result = await this.deleteAuthor(operation.authorName);
                        break;
                    default:
                        throw new Error(`Unknown operation type: ${operation.type}`);
                }
                results.push({ operation, result, success: true });
            } catch (error) {
                results.push({ operation, error: error.message, success: false });
            }
        }

        return results;
    }
}

// Register the module with the global registry when available
if (typeof window !== 'undefined') {
    window.APIModule = APIModule;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = APIModule;
}
        if (!window.api) {
            console.error('API not available for direct export');
            alert('API not available. Please refresh the page.');
            return;
        }
        
        showLoading(true);
        await window.api.exportCollection();
        console.log('Direct export completed successfully');
    } catch (error) {
        console.error('Direct export error:', error);
        // Error already handled in exportCollection
    } finally {
        showLoading(false);
    }
};
