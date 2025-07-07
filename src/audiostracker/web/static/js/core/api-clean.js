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
        this.abortControllers = new Map();
        this.retryQueue = [];
        this.maxRetries = 3;
        this.retryDelay = 1000;
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
        
        // Set up online/offline detection
        this.setupNetworkDetection();
        
        this.debug('API module initialized');
    }

    /**
     * Set up network detection and retry mechanism
     */
    setupNetworkDetection() {
        window.addEventListener('online', () => {
            this.debug('Network connection restored');
            this.processRetryQueue();
        });

        window.addEventListener('offline', () => {
            this.debug('Network connection lost');
            this.notify('Connection lost. Requests will be retried when connection is restored.', 'warning');
        });
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
     * Generic API request handler with AbortController and retry logic
     */
    async request(method, endpoint, data = null, options = {}) {
        const requestId = this.generateId('request');
        const url = `${this.baseURL}${endpoint}`;
        
        // Create AbortController for this request
        const abortController = new AbortController();
        this.abortControllers.set(requestId, abortController);
        
        const config = {
            method: method.toUpperCase(),
            headers: { ...this.defaultHeaders, ...options.headers },
            signal: abortController.signal
        };

        if (data && (method.toUpperCase() === 'POST' || method.toUpperCase() === 'PUT')) {
            if (data instanceof FormData) {
                // Remove Content-Type header for FormData to let browser set it
                config.headers = { ...this.defaultHeaders, ...options.headers };
                delete config.headers['Content-Type'];
                config.body = data;
            } else {
                config.body = JSON.stringify(data);
            }
        }

        const attemptRequest = async (attemptNumber = 1) => {
            try {
                this.showLoading(true);
                const response = await fetch(url, config);
                
                if (!response.ok) {
                    const errorData = await response.json().catch(() => ({}));
                    const error = new Error(errorData.detail || `HTTP ${response.status}: ${response.statusText}`);
                    error.status = response.status;
                    error.response = response;
                    throw error;
                }

                const responseData = await response.json();
                return responseData;
            } catch (error) {
                // Handle specific error types
                if (error.name === 'AbortError') {
                    this.debug('Request aborted:', endpoint);
                    throw error;
                }
                
                if (!navigator.onLine) {
                    this.debug('Request failed due to network');
                    this.addToRetryQueue({ method, endpoint, data, options, requestId });
                    throw new Error('No network connection. Request will be retried when connection is restored.');
                }
                
                // Retry logic for certain error types
                if (this.shouldRetry(error, attemptNumber)) {
                    this.debug(`Retrying request (attempt ${attemptNumber + 1}):`, endpoint);
                    await this.delay(this.retryDelay * attemptNumber);
                    return attemptRequest(attemptNumber + 1);
                }
                
                console.error('API Request Error:', error);
                this.notify(`Error: ${error.message}`, 'error');
                throw error;
            } finally {
                this.showLoading(false);
                this.abortControllers.delete(requestId);
            }
        };

        return attemptRequest();
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
        return await this.request('POST', '/api/authors', formData);
    }

    /**
     * Delete an author
     */
    async deleteAuthor(authorName) {
        return await this.request('DELETE', `/api/authors/${encodeURIComponent(authorName)}`);
    }

    /**
     * Add a book to an author
     */
    async addBook(authorName, book) {
        return await this.request('POST', `/api/authors/${encodeURIComponent(authorName)}/books`, book);
    }

    /**
     * Update a specific book
     */
    async updateBook(authorName, bookIndex, book) {
        return await this.request('PUT', `/api/authors/${encodeURIComponent(authorName)}/books/${bookIndex}`, book);
    }

    /**
     * Delete a specific book
     */
    async deleteBook(authorName, bookIndex) {
        return await this.request('DELETE', `/api/authors/${encodeURIComponent(authorName)}/books/${bookIndex}`);
    }

    /**
     * Get collection statistics
     */
    async getStats() {
        return await this.request('GET', '/api/stats');
    }

    /**
     * Export collection (download as file)
     */
    async exportCollection() {
        try {
            const response = await fetch('/api/export', { method: 'POST' });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'audiobooks_export.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            
            this.notify('Export successful', 'success');
        } catch (error) {
            this.notify(`Export failed: ${error.message}`, 'error');
            throw error;
        }
    }

    /**
     * Import collection
     */
    async importCollection(data) {
        return await this.request('POST', '/api/import', data);
    }

    /**
     * Batch update operations
     */
    async batchUpdate(operations) {
        const results = [];
        
        for (const operation of operations) {
            try {
                let result;
                switch (operation.type) {
                    case 'update_book':
                        result = await this.updateBook(operation.authorName, operation.bookIndex, operation.book);
                        break;
                    case 'add_book':
                        result = await this.addBook(operation.authorName, operation.book);
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

    /**
     * Determine if a request should be retried
     */
    shouldRetry(error, attemptNumber) {
        if (attemptNumber >= this.maxRetries) return false;
        
        // Retry on network errors or 5xx server errors
        return (
            error.status >= 500 ||
            error.name === 'TypeError' ||
            error.message.includes('fetch')
        );
    }

    /**
     * Add failed request to retry queue
     */
    addToRetryQueue(requestData) {
        this.retryQueue.push(requestData);
    }

    /**
     * Process retry queue when network is restored
     */
    async processRetryQueue() {
        if (this.retryQueue.length === 0) return;
        
        this.notify(`Retrying ${this.retryQueue.length} failed requests...`, 'info');
        
        const requests = [...this.retryQueue];
        this.retryQueue = [];
        
        for (const requestData of requests) {
            try {
                await this.request(requestData.method, requestData.endpoint, requestData.data, requestData.options);
            } catch (error) {
                this.debug('Retry failed for:', requestData.endpoint);
                // Don't re-queue to avoid infinite loops
            }
        }
    }

    /**
     * Cancel a specific request
     */
    cancelRequest(requestId) {
        const controller = this.abortControllers.get(requestId);
        if (controller) {
            controller.abort();
            this.abortControllers.delete(requestId);
        }
    }

    /**
     * Cancel all pending requests
     */
    cancelAllRequests() {
        this.abortControllers.forEach((controller, id) => {
            controller.abort();
        });
        this.abortControllers.clear();
    }

    /**
     * Utility delay function for retries
     */
    delay(ms) {
        return new Promise(resolve => setTimeout(resolve, ms));
    }

    /**
     * Generate unique IDs using built-in crypto API
     */
    generateId(prefix = 'id') {
        if ('crypto' in window && 'randomUUID' in crypto) {
            return `${prefix}-${crypto.randomUUID()}`;
        }
        
        // Fallback using crypto.getRandomValues
        if ('crypto' in window && 'getRandomValues' in crypto) {
            const array = new Uint32Array(1);
            crypto.getRandomValues(array);
            return `${prefix}-${array[0].toString(16)}`;
        }
        
        // Ultimate fallback
        return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
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
