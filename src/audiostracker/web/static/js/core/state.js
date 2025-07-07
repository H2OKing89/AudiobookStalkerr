/**
 * AudiobookStalkerr State Management
 * Manages application state and data flow
 */

class StateModule extends BaseModule {
    constructor(core) {
        super(core);
        this.data = {
            audiobooks: {},  // Will contain authors directly: { "Author Name": [books...] }
            stats: {},
            filters: {
                search: '',
                status: 'all',
                publisher: '',
                narrator: ''
            },
            ui: {
                viewMode: 'grid',
                theme: 'light',
                sortBy: 'author',
                sortOrder: 'asc'
            },
            selections: {
                selectedAuthors: new Set(),
                selectedBooks: new Set()
            }
        };
        
        this.subscribers = new Map();
        this.changeQueue = [];
        this.isProcessingChanges = false;
    }

    async init() {
        await super.init();
        
        // Load saved preferences
        this.loadPreferences();
        
        // Debounced save function
        this.debouncedSave = this.debounce(() => this.savePreferences(), 1000);
        
        this.debug('State module initialized');
    }

    /**
     * Subscribe to state changes
     */
    subscribe(key, callback) {
        if (!this.subscribers.has(key)) {
            this.subscribers.set(key, []);
        }
        this.subscribers.get(key).push(callback);
        
        // Return unsubscribe function
        return () => {
            const callbacks = this.subscribers.get(key);
            if (callbacks) {
                const index = callbacks.indexOf(callback);
                if (index > -1) {
                    callbacks.splice(index, 1);
                }
            }
        };
    }

    /**
     * Notify subscribers of state changes
     */
    notify(key, data) {
        const callbacks = this.subscribers.get(key);
        if (callbacks) {
            callbacks.forEach(callback => {
                try {
                    callback(data, this.data);
                } catch (error) {
                    console.error('Error in state subscriber:', error);
                }
            });
        }
    }

    /**
     * Update state with automatic notification
     */
    update(path, value) {
        const keys = path.split('.');
        let current = this.data;
        
        // Navigate to parent object
        for (let i = 0; i < keys.length - 1; i++) {
            if (!(keys[i] in current)) {
                current[keys[i]] = {};
            }
            current = current[keys[i]];
        }
        
        // Set the value
        const lastKey = keys[keys.length - 1];
        const oldValue = current[lastKey];
        current[lastKey] = value;
        
        // Notify subscribers
        this.notify(path, { oldValue, newValue: value, path });
        this.notify('*', { path, oldValue, newValue: value });
        
        // Auto-save preferences for UI changes
        if (path.startsWith('ui.') || path.startsWith('filters.')) {
            this.debouncedSave();
        }
    }

    /**
     * Get value from state
     */
    get(path) {
        const keys = path.split('.');
        let current = this.data;
        
        for (const key of keys) {
            if (current === null || current === undefined) {
                return undefined;
            }
            current = current[key];
        }
        
        return current;
    }

    /**
     * Set audiobooks data
     */
    setAudiobooks(data) {
        this.data.audiobooks = data;
        this.notify('audiobooks', data);
        this.notify('*', { path: 'audiobooks', newValue: data });
        this.calculateStats();
    }

    /**
     * Set audiobooks data without triggering notifications (for internal field updates)
     */
    setAudiobooksQuiet(data) {
        this.data.audiobooks = data;
        this.calculateStats();
    }

    /**
     * Set statistics
     */
    setStats(stats) {
        this.data.stats = stats;
        this.notify('stats', stats);
        this.notify('*', { path: 'stats', newValue: stats });
    }

    /**
     * Calculate statistics from current data
     */
    calculateStats() {
        const authors = this.data.audiobooks?.audiobooks?.author || {};
        const stats = {
            total_books: 0,
            total_authors: Object.keys(authors).length,
            total_publishers: 0,
            total_narrators: 0,
            publishers: new Set(),
            narrators: new Set()
        };

        for (const authorBooks of Object.values(authors)) {
            stats.total_books += authorBooks.length;
            
            for (const book of authorBooks) {
                if (book.publisher) {
                    stats.publishers.add(book.publisher);
                }
                
                if (book.narrator && Array.isArray(book.narrator)) {
                    book.narrator.forEach(n => {
                        if (n && n.trim()) {
                            stats.narrators.add(n.trim());
                        }
                    });
                }
            }
        }

        stats.total_publishers = stats.publishers.size;
        stats.total_narrators = stats.narrators.size;
        stats.publishers = Array.from(stats.publishers).sort();
        stats.narrators = Array.from(stats.narrators).sort();

        this.setStats(stats);
    }

    /**
     * Add author
     */
    addAuthor(authorName) {
        if (!this.data.audiobooks.audiobooks.author[authorName]) {
            this.data.audiobooks.audiobooks.author[authorName] = [];
            this.notify('audiobooks', this.data.audiobooks);
            this.calculateStats();
        }
    }

    /**
     * Remove author
     */
    removeAuthor(authorName) {
        if (this.data.audiobooks.audiobooks.author[authorName]) {
            delete this.data.audiobooks.audiobooks.author[authorName];
            this.notify('audiobooks', this.data.audiobooks);
            this.calculateStats();
        }
    }

    /**
     * Add book to author
     */
    addBook(authorName, book) {
        if (!this.data.audiobooks.audiobooks.author[authorName]) {
            this.data.audiobooks.audiobooks.author[authorName] = [];
        }
        
        this.data.audiobooks.audiobooks.author[authorName].push({
            title: book.title || '',
            series: book.series || '',
            publisher: book.publisher || '',
            narrator: book.narrator || ['']
        });
        
        this.notify('audiobooks', this.data.audiobooks);
        this.calculateStats();
    }

    /**
     * Update book
     */
    updateBook(authorName, bookIndex, book) {
        const authorBooks = this.data.audiobooks.audiobooks.author[authorName];
        if (authorBooks && authorBooks[bookIndex]) {
            authorBooks[bookIndex] = {
                title: book.title || '',
                series: book.series || '',
                publisher: book.publisher || '',
                narrator: book.narrator || ['']
            };
            this.notify('audiobooks', this.data.audiobooks);
            this.calculateStats();
        }
    }

    /**
     * Remove book
     */
    removeBook(authorName, bookIndex) {
        const authorBooks = this.data.audiobooks.audiobooks.author[authorName];
        if (authorBooks && authorBooks[bookIndex] !== undefined) {
            authorBooks.splice(bookIndex, 1);
            this.notify('audiobooks', this.data.audiobooks);
            this.calculateStats();
        }
    }

    /**
     * Get filtered and sorted data
     */
    getFilteredData() {
        // The audiobooks data is now directly the authors object
        let authors = this.data.audiobooks || {};
        
        const filters = this.data.filters;
        const ui = this.data.ui;
        
        let filteredAuthors = {};
        
        // Apply filters
        for (const [authorName, books] of Object.entries(authors)) {
            // Ensure books is an array
            let authorBooks = Array.isArray(books) ? books : [];
            
            // Search filter
            if (filters.search) {
                const searchTerm = filters.search.trim().toLowerCase();
                authorBooks = authorBooks.filter(book => 
                    authorName.toLowerCase().includes(searchTerm) ||
                    book.title?.toLowerCase().includes(searchTerm) ||
                    book.series?.toLowerCase().includes(searchTerm) ||
                    book.publisher?.toLowerCase().includes(searchTerm) ||
                    (book.narrator && Array.isArray(book.narrator) && book.narrator.some(n => n.toLowerCase().includes(searchTerm)))
                );
            }
            
            // Status filter
            if (filters.status !== 'all') {
                authorBooks = authorBooks.filter(book => {
                    const isComplete = isBookComplete(book);
                    return filters.status === 'complete' ? isComplete : !isComplete;
                });
            }
            
            // Publisher filter
            if (filters.publisher) {
                authorBooks = authorBooks.filter(book => 
                    book.publisher === filters.publisher
                );
            }
            
            // Narrator filter
            if (filters.narrator) {
                authorBooks = authorBooks.filter(book => 
                    book.narrator?.includes(filters.narrator)
                );
            }
            
            // Only include author if they have books after filtering
            if (authorBooks.length > 0) {
                filteredAuthors[authorName] = authorBooks;
            }
        }
        
        // Sort authors
        const sortedAuthorNames = Object.keys(filteredAuthors).sort((a, b) => {
            let comparison = 0;
            
            switch (ui.sortBy) {
                case 'author':
                    comparison = a.localeCompare(b);
                    break;
                case 'books':
                    comparison = filteredAuthors[a].length - filteredAuthors[b].length;
                    break;
                case 'complete':
                    const aComplete = filteredAuthors[a].filter(isBookComplete).length;
                    const bComplete = filteredAuthors[b].filter(isBookComplete).length;
                    comparison = aComplete - bComplete;
                    break;
                default:
                    comparison = a.localeCompare(b);
            }
            
            return ui.sortOrder === 'desc' ? -comparison : comparison;
        });
        
        // Build sorted result
        const result = {};
        sortedAuthorNames.forEach(authorName => {
            result[authorName] = filteredAuthors[authorName];
        });
        
        return result;
    }

    /**
     * Load preferences from localStorage with enhanced error handling
     */
    loadPreferences() {
        try {
            // Set up cross-tab synchronization
            this.setupBroadcastChannel();
            
            const saved = storage.get('AudiobookStalkerr-preferences', {});
            
            if (saved.ui) {
                Object.assign(this.data.ui, saved.ui);
            }
            
            if (saved.filters) {
                Object.assign(this.data.filters, saved.filters);
            }
            
            this.debug('Preferences loaded successfully');
        } catch (error) {
            this.warn('Failed to load preferences:', error);
        }
    }

    /**
     * Set up BroadcastChannel for cross-tab state synchronization
     */
    setupBroadcastChannel() {
        if ('BroadcastChannel' in window) {
            this.broadcastChannel = new BroadcastChannel('AudiobookStalkerr-state');
            
            this.broadcastChannel.addEventListener('message', (event) => {
                const { type, key, data } = event.data;
                
                if (type === 'state-update' && key !== 'internal-update') {
                    this.debug('Received cross-tab state update:', key);
                    this.handleCrossTabUpdate(key, data);
                }
            });
        }
    }

    /**
     * Handle cross-tab state updates
     */
    handleCrossTabUpdate(key, data) {
        // Update state without triggering notifications to avoid loops
        this.data[key] = data;
        
        // Notify subscribers
        this.notify(key, data);
        
        this.debug('State synchronized from another tab');
    }

    /**
     * Broadcast state changes to other tabs
     */
    broadcastUpdate(key, data) {
        if (this.broadcastChannel) {
            this.broadcastChannel.postMessage({
                type: 'state-update',
                key,
                data
            });
        }
    }

    /**
     * Save preferences to localStorage with enhanced error handling
     */
    savePreferences() {
        try {
            storage.set('AudiobookStalkerr-preferences', {
                ui: this.data.ui,
                filters: this.data.filters
            });
            
            // Broadcast to other tabs
            this.broadcastUpdate('preferences-updated', {
                ui: this.data.ui,
                filters: this.data.filters
            });
            
            this.debug('Preferences saved successfully');
        } catch (error) {
            this.warn('Failed to save preferences:', error);
        }
    }

    /**
     * Reset all data
     */
    reset() {
        this.data = {
            audiobooks: { audiobooks: { author: {} } },
            stats: {},
            filters: {
                search: '',
                status: 'all',
                publisher: '',
                narrator: ''
            },
            ui: {
                viewMode: 'grid',
                theme: 'light',
                sortBy: 'author',
                sortOrder: 'asc'
            },
            selections: {
                selectedAuthors: new Set(),
                selectedBooks: new Set()
            }
        };
        
        this.notify('*', { path: 'reset', newValue: this.data });
    }

    /**
     * Export current state
     */
    export() {
        return {
            audiobooks: deepClone(this.data.audiobooks),
            timestamp: new Date().toISOString(),
            version: '1.0.0'
        };
    }

    /**
     * Import state
     */
    import(data) {
        if (data.audiobooks) {
            this.setAudiobooks(data.audiobooks);
        }
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
}

// Register the module with the global registry when available
if (typeof window !== 'undefined') {
    window.StateModule = StateModule;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = StateModule;
}
