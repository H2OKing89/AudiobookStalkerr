/**
 * AudioStacker State Management
 * Manages application state and data flow
 */

class AudioStackerState {
    constructor() {
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
        
        this.subscribers = new Map();
        this.changeQueue = [];
        this.isProcessingChanges = false;
        
        // Load saved preferences
        this.loadPreferences();
        
        // Debounced save function
        this.debouncedSave = debounce(() => this.savePreferences(), 1000);
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
        const authors = this.data.audiobooks?.audiobooks?.author || {};
        const filters = this.data.filters;
        const ui = this.data.ui;
        
        let filteredAuthors = {};
        
        // Apply filters
        for (const [authorName, books] of Object.entries(authors)) {
            let authorBooks = books;
            
            // Search filter
            if (filters.search) {
                const searchTerm = filters.search.trim().toLowerCase();
                authorBooks = books.filter(book => 
                    authorName.toLowerCase().includes(searchTerm) ||
                    book.title?.toLowerCase().includes(searchTerm) ||
                    book.series?.toLowerCase().includes(searchTerm) ||
                    book.publisher?.toLowerCase().includes(searchTerm) ||
                    book.narrator?.some(n => n.toLowerCase().includes(searchTerm))
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
     * Load preferences from localStorage
     */
    loadPreferences() {
        const saved = storage.get('audiostacker-preferences', {});
        
        if (saved.ui) {
            Object.assign(this.data.ui, saved.ui);
        }
        
        if (saved.filters) {
            Object.assign(this.data.filters, saved.filters);
        }
    }

    /**
     * Save preferences to localStorage
     */
    savePreferences() {
        storage.set('audiostacker-preferences', {
            ui: this.data.ui,
            filters: this.data.filters
        });
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
}

// Create global state instance
window.state = new AudioStackerState();
