/**
 * AudioStacker Main Application
 * Coordinates all modules and handles the main application logic
 */

class AudioStackerApp {
    constructor() {
        this.isInitialized = false;
        this.viewMode = 'grid';
        this.unsavedChanges = false;
        
        this.init();
    }

    async init() {
        try {
            showLoading(true);
            
            // Initialize with data from server
            if (window.initialData) {
                state.setAudiobooks(window.initialData);
            }
            if (window.initialStats) {
                state.setStats(window.initialStats);
            }
            
            // Set up view mode
            this.viewMode = state.get('ui.viewMode') || 'grid';
            this.updateViewModeButtons();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Initial render
            this.renderAuthors();
            this.updateStats();
            
            // Subscribe to state changes
            this.setupStateSubscriptions();
            
            // Mark as initialized
            this.isInitialized = true;
            
            showToast('AudioStacker loaded successfully', 'success', 3000);
            
        } catch (error) {
            console.error('Failed to initialize AudioStacker:', error);
            showToast('Failed to load AudioStacker. Please refresh the page.', 'error');
        } finally {
            showLoading(false);
        }
    }

    setupEventListeners() {
        // Prevent page unload with unsaved changes
        window.addEventListener('beforeunload', (e) => {
            if (this.unsavedChanges) {
                e.preventDefault();
                e.returnValue = 'You have unsaved changes. Are you sure you want to leave?';
                return e.returnValue;
            }
        });

        // Auto-save when user stops typing
        document.addEventListener('input', debounce((e) => {
            if (e.target.matches('input[data-auto-save], textarea[data-auto-save]')) {
                this.handleAutoSave(e.target);
            }
        }, 1000));

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    setupStateSubscriptions() {
        // Re-render when audiobooks data changes
        state.subscribe('audiobooks', () => {
            this.renderAuthors();
            this.updateStats();
        });

        // Update stats when stats change
        state.subscribe('stats', () => {
            this.updateStats();
        });

        // Update view mode when UI state changes
        state.subscribe('ui.viewMode', (data) => {
            this.viewMode = data.newValue;
            this.updateViewModeButtons();
            this.renderAuthors();
        });

        // Mark unsaved changes
        state.subscribe('audiobooks', () => {
            this.unsavedChanges = true;
        });
    }

    handleKeyboardShortcuts(e) {
        // Ctrl+S - Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveChanges();
        }
        
        // Ctrl+N - Add new author
        if (e.ctrlKey && e.key === 'n') {
            e.preventDefault();
            this.showAddAuthorModal();
        }
        
        // Ctrl+F - Focus search
        if (e.ctrlKey && e.key === 'f') {
            e.preventDefault();
            const searchInput = document.getElementById('search-input');
            if (searchInput) {
                searchInput.focus();
                searchInput.select();
            }
        }
        
        // Ctrl+E - Export
        if (e.ctrlKey && e.key === 'e') {
            e.preventDefault();
            this.exportCollection();
        }
        
        // Ctrl+I - Import
        if (e.ctrlKey && e.key === 'i') {
            e.preventDefault();
            this.showImportModal();
        }
    }

    async renderAuthors() {
        const container = document.getElementById('authors-container');
        if (!container) return;

        const filteredData = state.getFilteredData();
        const authors = Object.keys(filteredData);

        if (authors.length === 0) {
            container.innerHTML = this.createEmptyState();
            return;
        }

        // Update container class based on view mode
        container.className = this.viewMode === 'grid' ? 'authors-grid' : 'authors-list';

        // Render authors
        const authorsHtml = authors.map(authorName => {
            const books = filteredData[authorName];
            return this.createAuthorCard(authorName, books);
        }).join('');

        container.innerHTML = authorsHtml;

        // Initialize any new components
        this.initializeAuthorCards();
    }

    createEmptyState() {
        return `
            <div class="empty-state text-center py-5">
                <div class="mb-4">
                    <i class="fas fa-book-open fa-5x text-muted"></i>
                </div>
                <h3 class="text-muted mb-3">No audiobooks found</h3>
                <p class="text-muted mb-4">
                    ${state.get('filters.search') || state.get('filters.status') !== 'all' ? 
                        'Try adjusting your search or filters.' : 
                        'Get started by adding your first author and book collection.'
                    }
                </p>
                <div class="d-flex gap-2 justify-content-center">
                    ${state.get('filters.search') || state.get('filters.status') !== 'all' ? 
                        '<button class="btn btn-outline-primary" onclick="clearAllFilters()"><i class="fas fa-filter me-1"></i>Clear Filters</button>' : 
                        '<button class="btn btn-primary" onclick="showAddAuthorModal()"><i class="fas fa-plus me-1"></i>Add Author</button>'
                    }
                </div>
            </div>
        `;
    }

    createAuthorCard(authorName, books) {
        const authorId = sanitizeId(authorName);
        const bookCount = books.length;
        const completeCount = books.filter(isBookComplete).length;
        const completionPercentage = bookCount > 0 ? Math.round((completeCount / bookCount) * 100) : 0;
        const initials = getInitials(authorName);
        
        const narratorSet = new Set();
        const publisherSet = new Set();
        
        books.forEach(book => {
            if (book.publisher) publisherSet.add(book.publisher);
            if (book.narrator) {
                book.narrator.forEach(n => {
                    if (n.trim()) narratorSet.add(n.trim());
                });
            }
        });

        return `
            <div class="author-card" data-author="${escapeHtml(authorName)}">
                <div class="author-header">
                    <div class="author-info">
                        <div class="author-avatar">
                            ${escapeHtml(initials)}
                        </div>
                        <div class="author-details">
                            <h3 class="author-name">
                                <input type="text" class="form-control author-name-input" 
                                       value="${escapeHtml(authorName)}" 
                                       onchange="updateAuthorName('${escapeHtml(authorName)}', this.value)"
                                       data-auto-save="true">
                            </h3>
                            <div class="author-meta">
                                <div class="meta-item">
                                    <i class="fas fa-calendar"></i>
                                    <span>Active Collection</span>
                                </div>
                                <div class="meta-item">
                                    <i class="fas fa-chart-line"></i>
                                    <span>${completionPercentage}% Complete</span>
                                </div>
                            </div>
                        </div>
                        <button class="collapse-toggle" 
                                onclick="toggleAuthorCollapse('${authorId}')" 
                                title="Toggle Books View">
                            <i class="fas fa-chevron-down" id="collapse-icon-${authorId}"></i>
                        </button>
                    </div>
                    
                    <div class="author-stats">
                        <div class="stat-badge">
                            <span class="stat-number">${bookCount}</span>
                            <span class="stat-label">${bookCount === 1 ? 'Book' : 'Books'}</span>
                        </div>
                        <div class="stat-badge">
                            <span class="stat-number">${completeCount}</span>
                            <span class="stat-label">Complete</span>
                        </div>
                        <div class="stat-badge">
                            <span class="stat-number">${narratorSet.size}</span>
                            <span class="stat-label">Narrators</span>
                        </div>
                        <div class="stat-badge">
                            <span class="stat-number">${publisherSet.size}</span>
                            <span class="stat-label">Publishers</span>
                        </div>
                    </div>
                    
                    <div class="author-progress">
                        <div class="progress-label">
                            <span>Collection Progress</span>
                            <span>${completionPercentage}%</span>
                        </div>
                        <div class="progress-bar-container">
                            <div class="progress-bar" style="width: ${completionPercentage}%"></div>
                        </div>
                    </div>
                    
                    <div class="author-actions mt-3">
                        <button class="btn-author-action me-2" 
                                onclick="addBook('${escapeHtml(authorName)}')" 
                                title="Add New Book">
                            <i class="fas fa-plus me-1"></i>Add Book
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteAuthor('${escapeHtml(authorName)}')" 
                                title="Delete Author">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                <div class="author-books" id="books-${authorId}">
                    ${this.createBooksContainer(authorName, books)}
                </div>
            </div>
        `;
    }

    createBooksContainer(authorName, books) {
        const containerClass = this.viewMode === 'grid' ? 'books-grid' : 'books-list';
        
        const booksHtml = books.map((book, index) => 
            this.createBookCard(authorName, book, index)
        ).join('');

        return `
            <div class="${containerClass}">
                ${booksHtml}
            </div>
        `;
    }

    createBookCard(authorName, book, index) {
        const bookId = `book-${sanitizeId(authorName)}-${index}`;
        const isComplete = isBookComplete(book);
        
        if (this.viewMode === 'list') {
            return this.createBookListItem(authorName, book, index, bookId, isComplete);
        }
        
        return `
            <div class="book-card ${isComplete ? 'complete' : 'incomplete'}" id="${bookId}">
                <div class="book-header">
                    <div class="book-title">
                        <input type="text" class="form-control" 
                               value="${escapeHtml(book.title || '')}" 
                               placeholder="Enter book title..."
                               onchange="updateBookField('${escapeHtml(authorName)}', ${index}, 'title', this.value)"
                               data-auto-save="true">
                    </div>
                    <div class="book-status-indicator ${isComplete ? 'complete' : 'incomplete'}" 
                         title="${isComplete ? 'Complete Information' : 'Missing Information'}"></div>
                </div>

                <div class="book-series mb-2">
                    <input type="text" class="form-control" 
                           value="${escapeHtml(book.series || '')}" 
                           placeholder="Series name..."
                           onchange="updateBookField('${escapeHtml(authorName)}', ${index}, 'series', this.value)"
                           data-auto-save="true">
                </div>

                <div class="book-details">
                    <div class="book-detail-row">
                        <i class="fas fa-building"></i>
                        <input type="text" class="form-control form-control-sm" 
                               value="${escapeHtml(book.publisher || '')}" 
                               list="publishers-list"
                               placeholder="Publisher..."
                               onchange="updateBookField('${escapeHtml(authorName)}', ${index}, 'publisher', this.value)"
                               data-auto-save="true">
                    </div>
                    
                    <div class="book-detail-row">
                        <i class="fas fa-microphone"></i>
                        <div class="narrator-container flex-grow-1">
                            ${(book.narrator || ['']).map((narrator, nIndex) => `
                                <div class="narrator-input-group mb-1">
                                    <input type="text" class="form-control form-control-sm" 
                                           value="${escapeHtml(narrator)}" 
                                           list="narrators-list"
                                           placeholder="Narrator name..."
                                           onchange="updateNarrator('${escapeHtml(authorName)}', ${index}, ${nIndex}, this.value)"
                                           data-auto-save="true">
                                    ${book.narrator && book.narrator.length > 1 ? `
                                        <button type="button" class="btn btn-sm btn-outline-danger ms-1" 
                                                onclick="removeNarrator('${escapeHtml(authorName)}', ${index}, ${nIndex})"
                                                title="Remove narrator">
                                            <i class="fas fa-times"></i>
                                        </button>
                                    ` : ''}
                                </div>
                            `).join('')}
                            <button type="button" class="btn btn-sm btn-outline-primary mt-1" 
                                    onclick="addNarrator('${escapeHtml(authorName)}', ${index})">
                                <i class="fas fa-plus me-1"></i>Add Narrator
                            </button>
                        </div>
                    </div>
                </div>
                
                <div class="book-actions mt-3">
                    <button class="btn btn-sm btn-outline-danger ms-auto" 
                            onclick="deleteBook('${escapeHtml(authorName)}', ${index})" 
                            title="Delete Book">
                        <i class="fas fa-trash me-1"></i>Delete
                    </button>
                </div>
            </div>
        `;
    }

    createBookListItem(authorName, book, index, bookId, isComplete) {
        return `
            <div class="book-list-item d-flex align-items-center p-3 border rounded mb-2 ${isComplete ? 'border-success' : 'border-warning'}" 
                 id="${bookId}">
                <div class="book-status-icon me-3">
                    <i class="fas fa-${isComplete ? 'check-circle text-success' : 'exclamation-circle text-warning'} fa-2x"></i>
                </div>
                <div class="flex-grow-1">
                    <div class="row align-items-center">
                        <div class="col-md-3">
                            <label class="form-label small text-muted">Title</label>
                            <input type="text" class="form-control form-control-sm" 
                                   value="${escapeHtml(book.title || '')}" 
                                   placeholder="Title..."
                                   onchange="updateBookField('${escapeHtml(authorName)}', ${index}, 'title', this.value)">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small text-muted">Series</label>
                            <input type="text" class="form-control form-control-sm" 
                                   value="${escapeHtml(book.series || '')}" 
                                   placeholder="Series..."
                                   onchange="updateBookField('${escapeHtml(authorName)}', ${index}, 'series', this.value)">
                        </div>
                        <div class="col-md-2">
                            <label class="form-label small text-muted">Publisher</label>
                            <input type="text" class="form-control form-control-sm" 
                                   value="${escapeHtml(book.publisher || '')}" 
                                   placeholder="Publisher..."
                                   onchange="updateBookField('${escapeHtml(authorName)}', ${index}, 'publisher', this.value)">
                        </div>
                        <div class="col-md-3">
                            <label class="form-label small text-muted">Narrators</label>
                            <div class="narrator-compact small">
                                ${(book.narrator || []).filter(n => n.trim()).map(n => escapeHtml(n)).join(', ') || 'None'}
                            </div>
                        </div>
                        <div class="col-md-1">
                            <button class="btn btn-sm btn-outline-danger" 
                                    onclick="deleteBook('${escapeHtml(authorName)}', ${index})" 
                                    title="Delete Book">
                                <i class="fas fa-trash"></i>
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        `;
    }

    initializeAuthorCards() {
        // Initialize any interactive components that need setup
        this.createDataLists();
    }

    createDataLists() {
        const stats = state.get('stats') || {};
        
        // Publishers datalist
        let publishersList = document.getElementById('publishers-list');
        if (!publishersList) {
            publishersList = document.createElement('datalist');
            publishersList.id = 'publishers-list';
            document.body.appendChild(publishersList);
        }
        
        publishersList.innerHTML = (stats.publishers || [])
            .map(publisher => `<option value="${escapeHtml(publisher)}">`)
            .join('');
        
        // Narrators datalist
        let narratorsList = document.getElementById('narrators-list');
        if (!narratorsList) {
            narratorsList = document.createElement('datalist');
            narratorsList.id = 'narrators-list';
            document.body.appendChild(narratorsList);
        }
        
        narratorsList.innerHTML = (stats.narrators || [])
            .map(narrator => `<option value="${escapeHtml(narrator)}">`)
            .join('');
    }

    updateStats() {
        const stats = state.get('stats') || {};
        
        // Update stat cards
        const elements = {
            'total-books': stats.total_books || 0,
            'total-authors': stats.total_authors || 0,
            'complete-books': stats.complete_books || 0,
            'incomplete-books': stats.incomplete_books || 0
        };

        Object.entries(elements).forEach(([id, value]) => {
            const element = document.getElementById(id);
            if (element) {
                element.textContent = value;
            }
        });
    }

    updateViewModeButtons() {
        const gridBtn = document.getElementById('grid-view-btn');
        const listBtn = document.getElementById('list-view-btn');
        
        if (gridBtn && listBtn) {
            gridBtn.classList.toggle('active', this.viewMode === 'grid');
            listBtn.classList.toggle('active', this.viewMode === 'list');
        }
    }

    async saveChanges() {
        if (!this.unsavedChanges) {
            showToast('No changes to save', 'info', 2000);
            return;
        }

        try {
            const result = await api.saveAudiobooks(state.get('audiobooks'));
            if (result.success) {
                this.unsavedChanges = false;
                showToast('Changes saved successfully', 'success');
                
                // Update stats if provided
                if (result.stats) {
                    state.setStats(result.stats);
                }
            }
        } catch (error) {
            console.error('Failed to save changes:', error);
            showToast('Failed to save changes', 'error');
        }
    }

    handleAutoSave(element) {
        // Auto-save specific field changes
        this.unsavedChanges = true;
        
        // Debounced save to prevent too many API calls
        if (this.autoSaveTimeout) {
            clearTimeout(this.autoSaveTimeout);
        }
        
        this.autoSaveTimeout = setTimeout(() => {
            this.saveChanges();
        }, 5000); // Auto-save after 5 seconds of inactivity
    }

    // View mode functions
    setViewMode(mode) {
        this.viewMode = mode;
        state.update('ui.viewMode', mode);
    }

    // Export/Import functions
    async exportCollection() {
        console.log('App exportCollection called'); // Debug log
        console.log('API available:', !!window.api); // Debug log
        
        // If API is not defined, try to recover by recreating it
        if (!window.api && typeof AudioStackerAPI === 'function') {
            console.log('Attempting to recover API in app.exportCollection...');
            try {
                window.api = new AudioStackerAPI();
                console.log('API recovery result in app.exportCollection:', !!window.api);
            } catch (e) {
                console.error('Failed to recover API in app.exportCollection:', e);
            }
        }
        
        if (!window.api) {
            console.error('window.api is still not available after recovery attempt');
            showToast('API not available. Trying direct export...', 'warning');
            
            // Fall back to direct export implementation
            try {
                console.log('Using direct export implementation');
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
                
                showToast('Collection exported successfully', 'success');
                console.log('Direct export completed successfully');
            } catch (directError) {
                console.error('Direct export failed:', directError);
                showToast(`Export failed: ${directError.message}`, 'error');
            }
            return;
        }
        
        try {
            console.log('Calling window.api.exportCollection()'); // Debug log
            await window.api.exportCollection();
            console.log('Export completed successfully'); // Debug log
            // The api.exportCollection now handles the download and shows success toast
        } catch (error) {
            console.error('Export failed:', error);
            showToast(`Export failed: ${error.message}`, 'error');
            // Error toast is already shown in api.exportCollection
        }
    }

    showImportModal() {
        // Implementation will be in modals.js
        if (window.modals) {
            window.modals.showImportModal();
        }
    }

    showAddAuthorModal() {
        // Implementation will be in modals.js
        if (window.modals) {
            window.modals.showAddAuthorModal();
        }
    }

    showQuickAddModal() {
        // Implementation will be in modals.js
        if (window.modals) {
            window.modals.showQuickAddModal();
        }
    }

    showStatsModal() {
        // Implementation will be in modals.js
        if (window.modals) {
            window.modals.showStatsModal();
        }
    }
}

// Global functions for HTML onclick handlers
function setViewMode(mode) {
    if (window.app) {
        window.app.setViewMode(mode);
    }
}

function updateAuthorName(oldName, newName) {
    if (oldName === newName || !newName.trim()) return;
    
    const audiobooks = state.get('audiobooks');
    const authors = audiobooks.audiobooks.author;
    
    if (authors[newName]) {
        showToast('Author name already exists', 'error');
        return;
    }
    
    // Move the author data
    authors[newName] = authors[oldName];
    delete authors[oldName];
    
    state.setAudiobooks(audiobooks);
    showToast(`Author renamed to "${newName}"`, 'success');
}

function updateBookField(authorName, bookIndex, field, value) {
    const audiobooks = state.get('audiobooks');
    const book = audiobooks.audiobooks.author[authorName][bookIndex];
    
    if (book) {
        book[field] = value;
        state.setAudiobooks(audiobooks);
    }
}

function updateNarrator(authorName, bookIndex, narratorIndex, value) {
    const audiobooks = state.get('audiobooks');
    const book = audiobooks.audiobooks.author[authorName][bookIndex];
    
    if (book && book.narrator) {
        book.narrator[narratorIndex] = value;
        state.setAudiobooks(audiobooks);
    }
}

function addNarrator(authorName, bookIndex) {
    const audiobooks = state.get('audiobooks');
    const book = audiobooks.audiobooks.author[authorName][bookIndex];
    
    if (book) {
        if (!book.narrator) book.narrator = [];
        book.narrator.push('');
        state.setAudiobooks(audiobooks);
        window.app.renderAuthors();
    }
}

function removeNarrator(authorName, bookIndex, narratorIndex) {
    const audiobooks = state.get('audiobooks');
    const book = audiobooks.audiobooks.author[authorName][bookIndex];
    
    if (book && book.narrator && book.narrator.length > 1) {
        book.narrator.splice(narratorIndex, 1);
        state.setAudiobooks(audiobooks);
        window.app.renderAuthors();
    }
}

function addBook(authorName) {
    const audiobooks = state.get('audiobooks');
    
    if (!audiobooks.audiobooks.author[authorName]) {
        audiobooks.audiobooks.author[authorName] = [];
    }
    
    audiobooks.audiobooks.author[authorName].push({
        title: '',
        series: '',
        publisher: '',
        narrator: ['']
    });
    
    state.setAudiobooks(audiobooks);
    showToast(`New book added to ${authorName}`, 'success');
}

async function deleteBook(authorName, bookIndex) {
    const confirmed = await toast.confirm(
        `Are you sure you want to delete this book?`,
        { title: 'Confirm Deletion' }
    );
    
    if (confirmed) {
        const audiobooks = state.get('audiobooks');
        const books = audiobooks.audiobooks.author[authorName];
        
        if (books && books[bookIndex]) {
            const deletedBook = books[bookIndex];
            books.splice(bookIndex, 1);
            state.setAudiobooks(audiobooks);
            showToast(`Book "${deletedBook.title || 'Untitled'}" deleted`, 'success');
        }
    }
}

async function deleteAuthor(authorName) {
    const books = state.get('audiobooks').audiobooks.author[authorName];
    const bookCount = books ? books.length : 0;
    
    const confirmed = await toast.confirm(
        `Are you sure you want to delete "${authorName}" and all ${bookCount} books?`,
        { title: 'Confirm Deletion', confirmText: 'Delete' }
    );
    
    if (confirmed) {
        const audiobooks = state.get('audiobooks');
        delete audiobooks.audiobooks.author[authorName];
        state.setAudiobooks(audiobooks);
        showToast(`Author "${authorName}" deleted`, 'success');
    }
}

function toggleAuthorCollapse(authorId) {
    const booksContainer = document.getElementById(`books-${authorId}`);
    const icon = document.getElementById(`collapse-icon-${authorId}`);
    const toggle = icon?.closest('.collapse-toggle');
    
    if (booksContainer && icon && toggle) {
        const isExpanded = booksContainer.classList.contains('expanded');
        
        if (isExpanded) {
            // Collapse
            booksContainer.classList.remove('expanded');
            icon.className = 'fas fa-chevron-down';
            toggle.classList.remove('expanded');
        } else {
            // Expand
            booksContainer.classList.add('expanded');
            icon.className = 'fas fa-chevron-up';
            toggle.classList.add('expanded');
        }
    }
}

// Global app functions
function exportCollection() {
    console.log('Export button clicked'); // Debug log
    console.log('Checking API availability at export time:', !!window.api);
    console.log('Checking App availability at export time:', !!window.app);
    
    // If API is not defined, try to recover by recreating it
    if (!window.api && typeof AudioStackerAPI === 'function') {
        console.log('Attempting to recover API...');
        try {
            window.api = new AudioStackerAPI();
            console.log('API recovery result:', !!window.api);
        } catch (e) {
            console.error('Failed to recover API:', e);
        }
    }
    
    // Check if API is available after recovery attempt
    if (!window.api) {
        console.error('window.api is not available');
        showToast('API not ready. Please refresh the page.', 'error');
        return false;
    }
    
    if (window.app) {
        console.log('Calling app.exportCollection()'); // Debug log
        window.app.exportCollection();
    } else {
        console.log('App not available, using API directly'); // Debug log
        // Fallback to direct API call if app object is not ready
        (async function() {
            try {
                console.log('Using direct API call for export');
                showLoading(true);
                const response = await fetch('/api/export', { method: 'POST' });
                if (!response.ok) {
                    throw new Error(`HTTP ${response.status}: ${response.statusText}`);
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
            } catch (error) {
                console.error('Export failed:', error);
                showToast(`Export failed: ${error.message}`, 'error');
            } finally {
                showLoading(false);
            }
        })();
    }
    
    return false; // Prevent default behavior
}

function showImportModal() {
    if (window.app) {
        window.app.showImportModal();
    }
}

function showAddAuthorModal() {
    if (window.app) {
        window.app.showAddAuthorModal();
    }
}

function showQuickAddModal() {
    if (window.app) {
        window.app.showQuickAddModal();
    }
}

function showStatsModal() {
    if (window.app) {
        window.app.showStatsModal();
    }
}

// Initialize app when DOM is ready
document.addEventListener('DOMContentLoaded', () => {
    window.app = new AudioStackerApp();
});
