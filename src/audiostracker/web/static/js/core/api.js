/**
 * AudioStacker API Module
 * Handles all API communication with the FastAPI backend
 */

class AudioStackerAPI {
    constructor() {
        this.baseURL = '';
        this.defaultHeaders = {
            'Content-Type': 'application/json'
        };
        
        // Initialize a simple fallback for debouncedSave
        // Will be replaced with proper debounced version when available
        this.debouncedSave = async (data) => {
            try {
                await this.saveAudiobooks(data);
                showToast('Changes saved successfully', 'success');
            } catch (error) {
                showToast('Failed to save changes', 'error');
            }
        };
        
        // Try to initialize debounced version after a short delay
        setTimeout(() => this.initializeDebouncedSave(), 100);
    }
    
    /**
     * Initialize the debounced save function
     */
    initializeDebouncedSave() {
        if (typeof debounce === 'function') {
            this.debouncedSave = debounce(async (data) => {
                try {
                    await this.saveAudiobooks(data);
                    showToast('Changes saved successfully', 'success');
                } catch (error) {
                    showToast('Failed to save changes', 'error');
                }
            }, 1000);
            console.log('API: Debounced save function initialized');
        } else {
            console.log('API: debounce function not available, using fallback');
        }
    }

    /**
     * Generic API request handler
     */
    async request(endpoint, options = {}) {
        const url = `${this.baseURL}${endpoint}`;
        const config = {
            headers: this.defaultHeaders,
            ...options
        };

        try {
            showLoading(true);
            const response = await fetch(url, config);
            
            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                throw new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
            }

            const data = await response.json();
            return data;
        } catch (error) {
            console.error('API Request Error:', error);
            showToast(`Error: ${error.message}`, 'error');
            throw error;
        } finally {
            showLoading(false);
        }
    }

    /**
     * Get all audiobooks data
     */
    async getAudiobooks() {
        return await this.request('/api/audiobooks');
    }

    /**
     * Save audiobooks data
     */
    async saveAudiobooks(data) {
        return await this.request('/api/audiobooks', {
            method: 'POST',
            body: JSON.stringify(data)
        });
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

// Create global API instance
console.log('Initializing API...');
window.api = new AudioStackerAPI();
console.log('API initialized:', !!window.api);

// Register this module as loaded
if (window.moduleStatus && typeof window.moduleStatus.modules === 'object') {
    window.moduleStatus.modules['api'] = {
        loaded: true,
        timestamp: new Date().getTime()
    };
    console.log('API module registered');
} else {
    console.log('moduleStatus not available, API module loaded but not registered');
}

// Add a global backup export function that doesn't rely on the app object
window.directExport = async function() {
    console.log('Direct export called');
    try {
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
