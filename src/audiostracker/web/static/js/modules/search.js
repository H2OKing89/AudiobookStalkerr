/**
 * Search Module
 * Handles search functionality across the application
 */

class SearchModule {
    constructor() {
        this.searchInput = null;
        this.searchTimeout = null;
        this.minSearchLength = 2;
        
        this.init();
    }

    init() {
        this.searchInput = document.getElementById('search-input');
        if (this.searchInput) {
            this.setupEventListeners();
        }
        
        // Subscribe to state changes
        state.subscribe('filters.search', (data) => {
            this.updateSearchInput(data.newValue);
        });
    }

    setupEventListeners() {
        // Real-time search with debouncing
        this.searchInput.addEventListener('input', (e) => {
            clearTimeout(this.searchTimeout);
            this.searchTimeout = setTimeout(() => {
                this.performSearch(e.target.value);
            }, 300);
        });

        // Search on Enter key
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                e.preventDefault();
                clearTimeout(this.searchTimeout);
                this.performSearch(e.target.value);
            }
        });

        // Clear search with Escape key
        this.searchInput.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                e.preventDefault();
                this.clearSearch();
            }
        });

        // Prevent any interference with normal typing
        this.searchInput.addEventListener('keydown', (e) => {
            // Allow all normal typing keys including space
            if (e.key === ' ' || e.key.length === 1 || 
                e.key === 'Backspace' || e.key === 'Delete' ||
                e.key === 'ArrowLeft' || e.key === 'ArrowRight' ||
                e.key === 'Home' || e.key === 'End') {
                // These are normal input keys, don't interfere
                return;
            }
        });
    }

    performSearch(query) {
        // Keep user text exactly as typed
        state.update('filters.search', query);
        
        // Trigger re-render if we have a search module hook
        if (window.app?.renderAuthors) {
            window.app.renderAuthors();
        }
        
        // Update URL for bookmarking (trim for URL)
        const q = query.trim();
        if (q) {
            url.setParam('search', q);
        } else {
            url.removeParam('search');
        }
        
        // Analytics or logging (use trimmed version)
        this.logSearch(q);
    }

    clearSearch() {
        if (this.searchInput) {
            this.searchInput.value = '';
            this.performSearch('');
        }
    }

    updateSearchInput(value) {
        // Only update if the input is not currently focused (avoid interfering with typing)
        if (this.searchInput && 
            this.searchInput.value !== value && 
            document.activeElement !== this.searchInput) {
            this.searchInput.value = value;
        }
    }

    // Advanced search functionality
    parseAdvancedQuery(query) {
        const filters = {
            title: [],
            author: [],
            series: [],
            publisher: [],
            narrator: [],
            general: []
        };

        // Parse field-specific searches (e.g., "title:sword", "author:brandon")
        const fieldPattern = /(\w+):([^"\s]+|"[^"]*")/g;
        let match;
        let processedQuery = query;

        while ((match = fieldPattern.exec(query)) !== null) {
            const field = match[1].toLowerCase();
            const value = match[2].replace(/"/g, '').trim();
            
            if (filters.hasOwnProperty(field)) {
                filters[field].push(value);
                processedQuery = processedQuery.replace(match[0], '').trim();
            }
        }

        // Remaining text goes to general search
        if (processedQuery) {
            filters.general.push(processedQuery);
        }

        return filters;
    }

    // Fuzzy search implementation
    fuzzyMatch(text, query, threshold = 0.6) {
        if (!text || !query) return false;
        
        text = text.toLowerCase();
        query = query.toLowerCase();
        
        // Exact match
        if (text.includes(query)) return true;
        
        // Levenshtein distance for fuzzy matching
        const distance = this.levenshteinDistance(text, query);
        const maxLength = Math.max(text.length, query.length);
        const similarity = 1 - (distance / maxLength);
        
        return similarity >= threshold;
    }

    levenshteinDistance(str1, str2) {
        const matrix = [];
        
        for (let i = 0; i <= str2.length; i++) {
            matrix[i] = [i];
        }
        
        for (let j = 0; j <= str1.length; j++) {
            matrix[0][j] = j;
        }
        
        for (let i = 1; i <= str2.length; i++) {
            for (let j = 1; j <= str1.length; j++) {
                if (str2.charAt(i - 1) === str1.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1,
                        matrix[i][j - 1] + 1,
                        matrix[i - 1][j] + 1
                    );
                }
            }
        }
        
        return matrix[str2.length][str1.length];
    }

    // Search suggestions
    generateSuggestions(query) {
        const authors = Object.keys(state.get('audiobooks.audiobooks.author') || {});
        const stats = state.get('stats') || {};
        const suggestions = new Set();
        
        // Author suggestions
        authors.forEach(author => {
            if (author.toLowerCase().includes(query.toLowerCase())) {
                suggestions.add(`author:${author}`);
            }
        });
        
        // Publisher suggestions
        if (stats.publishers) {
            stats.publishers.forEach(publisher => {
                if (publisher.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.add(`publisher:${publisher}`);
                }
            });
        }
        
        // Narrator suggestions
        if (stats.narrators) {
            stats.narrators.forEach(narrator => {
                if (narrator.toLowerCase().includes(query.toLowerCase())) {
                    suggestions.add(`narrator:${narrator}`);
                }
            });
        }
        
        return Array.from(suggestions).slice(0, 10);
    }

    // Search highlighting
    highlightMatches(text, query) {
        if (!query || !text) return escapeHtml(text);
        
        const escapedText = escapeHtml(text);
        const escapedQuery = escapeHtml(query);
        const regex = new RegExp(`(${escapedQuery})`, 'gi');
        
        return escapedText.replace(regex, '<mark>$1</mark>');
    }

    // Search history
    addToHistory(query) {
        if (!query.trim()) return;
        
        const history = storage.get('search-history', []);
        const trimmedQuery = query.trim();
        
        // Remove existing entry if present
        const existingIndex = history.indexOf(trimmedQuery);
        if (existingIndex > -1) {
            history.splice(existingIndex, 1);
        }
        
        // Add to beginning
        history.unshift(trimmedQuery);
        
        // Keep only last 20 searches
        if (history.length > 20) {
            history.splice(20);
        }
        
        storage.set('search-history', history);
    }

    getSearchHistory() {
        return storage.get('search-history', []);
    }

    clearSearchHistory() {
        storage.remove('search-history');
    }

    // Search analytics
    logSearch(query) {
        if (!query) return;
        
        const searchLog = storage.get('search-analytics', {
            queries: {},
            totalSearches: 0,
            lastSearch: null
        });
        
        searchLog.queries[query] = (searchLog.queries[query] || 0) + 1;
        searchLog.totalSearches++;
        searchLog.lastSearch = new Date().toISOString();
        
        storage.set('search-analytics', searchLog);
    }

    getSearchAnalytics() {
        return storage.get('search-analytics', {
            queries: {},
            totalSearches: 0,
            lastSearch: null
        });
    }

    // Load search from URL parameters
    loadSearchFromURL() {
        const searchParam = url.getParam('search');
        if (searchParam) {
            state.update('filters.search', searchParam);
            if (this.searchInput) {
                this.searchInput.value = searchParam;
            }
        }
    }
}

// Global search functionality
function searchCollection() {
    const searchInput = document.getElementById('search-input');
    if (searchInput && window.search) {
        window.search.performSearch(searchInput.value);
    }
}

// Initialize search module
window.search = new SearchModule();

// Load search from URL on page load
document.addEventListener('DOMContentLoaded', () => {
    window.search.loadSearchFromURL();
});
