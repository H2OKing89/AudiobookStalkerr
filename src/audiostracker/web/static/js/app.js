/**
 * AudioStacker Main Application
 * Coordinates all modules and handles the main application logic
 */

class AudioStackerApp {
    constructor() {
        this.isInitialized = false;
        this.viewMode = 'grid';
        this.hasUnsavedChanges = false;
        this.autoSaveEnabled = localStorage.getItem('audioStacker_autoSave') === 'true';
        this.autoSaveTimer = null;
        this.autoSaveDelay = 5000; // 5 seconds
        this.realtimeValidation = localStorage.getItem('realtimeValidation') !== 'false';
        this.showCompletionStatus = localStorage.getItem('showCompletionStatus') !== 'false';
        this.settingsPanelOpen = false;
        this.fieldChangeTracking = new Map(); // Track field changes for visual feedback
        
        this.init();
    }

    async init() {
        try {
            showLoading(true);
            
            // Initialize with data from server
            if (window.initialData) {
                // The server passes { audiobooks: { author: {...} } }
                // We need to extract the authors part for our state
                if (window.initialData.audiobooks && window.initialData.audiobooks.author) {
                    const authorsData = window.initialData.audiobooks.author;
                    state.setAudiobooks(authorsData);
                } else {
                    console.warn('Unexpected data structure:', window.initialData);
                    state.setAudiobooks({});
                }
            } else {
                state.setAudiobooks({});
            }
            
            if (window.initialStats) {
                state.setStats(window.initialStats);
            }
            
            // Load user preferences first
            this.loadUserPreferences();
            
            // Set up view mode
            this.viewMode = state.get('ui.viewMode') || 'grid';
            this.updateViewModeButtons();
            
            // Set up event listeners
            this.setupEventListeners();
            
            // Set up keyboard shortcuts
            this.initializeKeyboardShortcuts();
            
            // Initialize settings
            this.initializeSettings();
            
            // Initialize auto-refresh if enabled
            this.initializeAutoRefresh();
            
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

    loadUserPreferences() {
        // Load all user preferences from localStorage
        this.autoSaveEnabled = localStorage.getItem('audioStacker_autoSave') === 'true';
        this.realtimeValidation = localStorage.getItem('realtimeValidation') !== 'false';
        this.showCompletionStatus = localStorage.getItem('showCompletionStatus') !== 'false';
        
        // Additional UI preferences
        this.compactMode = localStorage.getItem('compactMode') === 'true';
        this.cardsPerRow = parseInt(localStorage.getItem('cardsPerRow')) || 3;
        this.darkMode = localStorage.getItem('darkMode') === 'true';
        
        // Apply UI preferences
        if (this.compactMode) {
            document.body.classList.add('compact-mode');
        }
        
        if (this.darkMode) {
            document.body.classList.add('dark-mode');
        }
        
        // Update CSS custom property for cards per row
        if (this.cardsPerRow) {
            document.documentElement.style.setProperty('--cards-per-row', this.cardsPerRow);
        }
        
        console.log('User preferences loaded:', {
            autoSave: this.autoSaveEnabled,
            realtimeValidation: this.realtimeValidation,
            showCompletionStatus: this.showCompletionStatus,
            compactMode: this.compactMode,
            cardsPerRow: this.cardsPerRow,
            darkMode: this.darkMode
        });
    }

    saveUserPreferences() {
        // Save all user preferences to localStorage
        localStorage.setItem('audioStacker_autoSave', this.autoSaveEnabled.toString());
        localStorage.setItem('realtimeValidation', this.realtimeValidation.toString());
        localStorage.setItem('showCompletionStatus', this.showCompletionStatus.toString());
        localStorage.setItem('compactMode', this.compactMode.toString());
        localStorage.setItem('cardsPerRow', this.cardsPerRow.toString());
        localStorage.setItem('darkMode', this.darkMode.toString());
        
        console.log('User preferences saved');
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

        // Track changes without auto-saving
        document.addEventListener('input', (e) => {
            if (e.target.matches('input[data-field], textarea[data-field], select[data-field]')) {
                this.markUnsavedChanges();
            }
        });

        // Keyboard shortcuts
        document.addEventListener('keydown', (e) => {
            this.handleKeyboardShortcuts(e);
        });
    }

    setupStateSubscriptions() {
        // Don't auto-render on every audiobooks change - we'll control this manually
        // Only update stats on audiobooks changes
        state.subscribe('audiobooks', () => {
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
    }

    handleKeyboardShortcuts(e) {
        // Ctrl+S - Save
        if (e.ctrlKey && e.key === 's') {
            e.preventDefault();
            this.saveChanges();
        }
        
        // Ctrl+A - Add author
        if (e.ctrlKey && e.key === 'a') {
            e.preventDefault();
            this.showAddAuthorModal();
        }
        
        // Ctrl+B - Quick add book
        if (e.ctrlKey && e.key === 'b') {
            e.preventDefault();
            this.showQuickAddModal();
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
        
        // Ctrl+, - Toggle settings
        if (e.ctrlKey && e.key === ',') {
            e.preventDefault();
            this.toggleSettingsPanel();
        }
        
        // V - Toggle view mode
        if (e.key === 'v' || e.key === 'V') {
            e.preventDefault();
            const newMode = this.viewMode === 'grid' ? 'list' : 'grid';
            this.setViewMode(newMode);
            this.updateViewModeButtons();
            this.renderAuthors();
        }
        
        // F5 - Refresh
        if (e.key === 'F5') {
            e.preventDefault();
            this.refreshData();
        }
    }

    async renderAuthors() {
        const container = document.getElementById('authors-container');
        if (!container) {
            console.error('authors-container not found!');
            return;
        }

        const filteredData = state.getFilteredData();
        const authors = Object.keys(filteredData);

        if (authors.length === 0) {
            container.innerHTML = this.createEmptyState();
            return;
        }

        // Update container class based on view mode
        container.className = this.viewMode === 'grid' ? 'authors-grid' : 'authors-list';

        // Render authors
        try {
            const authorsHtml = authors.map(authorName => {
                const books = filteredData[authorName];
                return this.createEnhancedAuthorCard(authorName, books);
            }).join('');

            container.innerHTML = authorsHtml;
        } catch (error) {
            console.error('Error generating author cards:', error);
            // Fallback to simple version
            const authorsHtml = authors.map(authorName => {
                const books = filteredData[authorName];
                return this.createSimpleAuthorCard(authorName, books);
            }).join('');
            container.innerHTML = authorsHtml;
        }

        // Initialize any new components
        this.initializeAuthorCards();
        
        // Restore save button states after rendering (if we have unsaved changes)
        if (this.unsavedChanges) {
            this.updateSaveButtonStates();
        }
    }

    createEmptyState() {
        const hasFilters = state.get('filters.search') || state.get('filters.status') !== 'all';
        
        if (hasFilters) {
            return `
                <div class="empty-state text-center py-5 fade-in">
                    <div class="mb-4">
                        <i class="fas fa-search empty-icon"></i>
                    </div>
                    <h3 class="text-muted mb-3">No results found</h3>
                    <p class="text-muted mb-4">
                        Try adjusting your search terms or filters to find what you're looking for.
                    </p>
                    <div class="d-flex gap-2 justify-content-center flex-wrap">
                        <button class="btn btn-outline-primary" onclick="clearAllFilters()">
                            <i class="fas fa-times me-1"></i>Clear Filters
                        </button>
                        <button class="btn btn-primary" onclick="showQuickAddModal()">
                            <i class="fas fa-plus me-1"></i>Add New Book
                        </button>
                    </div>
                </div>
            `;
        }
        
        return `
            <div class="empty-state text-center py-5 fade-in">
                <div class="mb-4">
                    <div class="position-relative d-inline-block">
                        <i class="fas fa-book-open empty-icon text-primary"></i>
                        <i class="fas fa-plus-circle position-absolute text-success" 
                           style="bottom: -5px; right: -5px; font-size: 2rem;"></i>
                    </div>
                </div>
                <h3 class="mb-3">Start Building Your Audiobook Collection</h3>
                <p class="text-muted mb-4 mx-auto" style="max-width: 500px;">
                    Add your favorite authors and their books to track upcoming audiobook releases. 
                    You'll be notified when new books are available from your watched authors.
                </p>
                <div class="d-flex gap-3 justify-content-center flex-wrap">
                    <button class="btn btn-primary btn-lg" onclick="showAddAuthorModal()">
                        <i class="fas fa-user-plus me-2"></i>Add Your First Author
                    </button>
                    <button class="btn btn-outline-primary btn-lg" onclick="showImportModal()">
                        <i class="fas fa-file-import me-2"></i>Import Existing Collection
                    </button>
                </div>
                <div class="mt-4">
                    <small class="text-muted">
                        <i class="fas fa-info-circle me-1"></i>
                        Pro tip: Use <kbd>Ctrl</kbd>+<kbd>A</kbd> to quickly add a new author
                    </small>
                </div>
                <div class="mt-3">
                    <small class="text-muted">
                        <a href="#" onclick="showKeyboardShortcuts()" class="text-decoration-none">
                            <i class="fas fa-keyboard me-1"></i>View all keyboard shortcuts
                        </a>
                    </small>
                </div>
            </div>
        `;
    }

    createAuthorCard(authorName, books) {
        const authorId = generateAuthorId(authorName);
        const bookCount = books.length;
        const initials = getInitials(authorName);
        
        // Debug logging
        console.log('Creating author card for:', authorName, 'with ID:', authorId);
        
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
            <div class="author-card" data-author="${escapeHtml(authorName)}" data-author-id="${authorId}">
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
                                       data-field="true">
                            </h3>
                            <div class="author-meta">
                                <div class="meta-item">
                                    <i class="fas fa-calendar"></i>
                                    <span>Watch List</span>
                                </div>
                            </div>
                        </div>
                        <button class="collapse-toggle" 
                                onclick="toggleAuthorCollapse('${authorId}')" 
                                title="Toggle Books View"
                                data-author-id="${authorId}">
                            <i class="fas fa-chevron-down" id="collapse-icon-${authorId}"></i>
                        </button>
                    </div>
                    
                    <div class="author-stats">
                        <div class="stat-badge">
                            <span class="stat-number">${bookCount}</span>
                            <span class="stat-label">${bookCount === 1 ? 'Entry' : 'Entries'}</span>
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
                    
                    <div class="author-actions mt-3">
                        <button class="btn-author-action me-2" 
                                onclick="addBook('${escapeHtml(authorName)}')" 
                                title="Add New Book">
                            <i class="fas fa-plus me-1"></i>Add Book
                        </button>
                        <button class="btn btn-sm btn-success save-changes-btn me-2" 
                                onclick="window.app.saveChanges()" 
                                title="Save Changes"
                                disabled>
                            <i class="fas fa-check me-1"></i>Saved
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
        const isComplete = this.isBookComplete(book);
        const completionPercentage = this.getBookCompletionPercentage(book);
        const hasChanges = this.fieldChangeTracking.has(bookId);
        
        if (this.viewMode === 'list') {
            return this.createBookListItem(authorName, book, index, bookId, isComplete);
        }
        
        return `
            <div class="book-card ${hasChanges ? 'has-changes' : ''}" id="${bookId}">
                <div class="book-header">
                    <div class="d-flex justify-content-between align-items-start mb-2">
                        <div class="book-title flex-grow-1">
                            <input type="text" 
                                   class="form-control ${this.getFieldClass(book.title, true)}" 
                                   value="${escapeHtml(book.title || '')}" 
                                   placeholder="Enter book title..."
                                   data-field="title"
                                   onchange="updateBookFieldEnhanced('${escapeHtml(authorName)}', ${index}, 'title', this.value, this)"
                                   oninput="validateFieldRealtime(this, true)">
                            <div class="field-error-message" style="display: none;">
                                <i class="fas fa-exclamation-circle"></i>
                                Title is required
                            </div>
                        </div>
                        ${this.showCompletionStatus ? `
                            <span class="book-status ${isComplete ? 'complete' : 'incomplete'} ms-2">
                                <i class="fas fa-${isComplete ? 'check-circle' : 'exclamation-circle'}"></i>
                                ${isComplete ? 'Complete' : 'Incomplete'}
                            </span>
                        ` : ''}
                    </div>
                    
                    ${this.showCompletionStatus ? `
                        <div class="completion-progress mb-3">
                            <div class="completion-progress-bar" style="width: ${completionPercentage}%"></div>
                        </div>
                    ` : ''}
                </div>

                <div class="book-series mb-2">
                    <input type="text" class="form-control" 
                           value="${escapeHtml(book.series || '')}" 
                           placeholder="Series name..."
                           data-field="series"
                           list="series-list"
                           onchange="updateBookFieldEnhanced('${escapeHtml(authorName)}', ${index}, 'series', this.value, this)">
                </div>

                <div class="book-details">
                    <div class="book-detail-row">
                        <i class="fas fa-building"></i>
                        <input type="text" class="form-control form-control-sm" 
                               value="${escapeHtml(book.publisher || '')}" 
                               list="publishers-list"
                               placeholder="Publisher..."
                               data-field="publisher"
                               onchange="updateBookFieldEnhanced('${escapeHtml(authorName)}', ${index}, 'publisher', this.value, this)">
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
                                           data-field="narrator"
                                           onchange="updateNarratorEnhanced('${escapeHtml(authorName)}', ${index}, ${nIndex}, this.value, this)">
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
                
                <!-- Progress overlay for save operations -->
                <div class="progress-overlay">
                    <div class="progress-spinner"></div>
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

    createSimpleAuthorCard(authorName, books) {
        const bookCount = books.length;
        const initials = getInitials(authorName);
        
        return `
            <div class="card mb-3" style="border: 1px solid #dee2e6;">
                <div class="card-header d-flex justify-content-between align-items-center">
                    <div class="d-flex align-items-center">
                        <div class="bg-primary text-white rounded-circle d-flex align-items-center justify-content-center me-3" 
                             style="width: 40px; height: 40px; font-weight: bold;">
                            ${escapeHtml(initials)}
                        </div>
                        <div>
                            <h5 class="mb-0">${escapeHtml(authorName)}</h5>
                            <small class="text-muted">${bookCount} book${bookCount !== 1 ? 's' : ''}</small>
                        </div>
                    </div>
                    <button class="btn btn-sm btn-outline-primary" onclick="alert('Add book for ${escapeHtml(authorName)}')">
                        <i class="fas fa-plus"></i> Add Book
                    </button>
                </div>
                <div class="card-body">
                    <div class="row">
                        ${books.map((book, index) => `
                            <div class="col-12 mb-2">
                                <div class="border rounded p-2 bg-light">
                                    <strong>${escapeHtml(book.title || 'Untitled')}</strong>
                                    ${book.series ? `<br><small>Series: ${escapeHtml(book.series)}</small>` : ''}
                                    ${book.publisher ? `<br><small>Publisher: ${escapeHtml(book.publisher)}</small>` : ''}
                                    ${book.narrator && book.narrator.length ? `<br><small>Narrator(s): ${book.narrator.map(n => escapeHtml(n)).join(', ')}</small>` : ''}
                                </div>
                            </div>
                        `).join('')}
                    </div>
                </div>
            </div>
        `;
    }

    createEnhancedAuthorCard(authorName, books) {
        const authorId = generateAuthorId(authorName);
        const bookCount = books.length;
        const initials = getInitials(authorName);
        
        // Calculate statistics
        const narratorSet = new Set();
        const publisherSet = new Set();
        
        books.forEach(book => {
            if (book.publisher) publisherSet.add(book.publisher);
            if (book.narrator && Array.isArray(book.narrator)) {
                book.narrator.forEach(n => {
                    if (n.trim()) narratorSet.add(n.trim());
                });
            }
        });

        return `
            <div class="author-card" data-author="${escapeHtml(authorName)}" data-author-id="${authorId}">
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
                                       data-field="true">
                            </h3>
                            <div class="author-meta">
                                <span class="badge bg-primary me-2">${bookCount} book${bookCount !== 1 ? 's' : ''}</span>
                                <span class="badge bg-secondary me-2">${narratorSet.size} narrator${narratorSet.size !== 1 ? 's' : ''}</span>
                                <span class="badge bg-info">${publisherSet.size} publisher${publisherSet.size !== 1 ? 's' : ''}</span>
                            </div>
                        </div>
                    </div>
                    
                    <div class="author-actions">
                        <button class="btn btn-sm btn-outline-primary me-2" 
                                onclick="addBook('${escapeHtml(authorName)}')" 
                                title="Add New Book">
                            <i class="fas fa-plus"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-secondary me-2" 
                                onclick="toggleAuthorCollapse('${authorId}')" 
                                title="Toggle Books View"
                                data-author-id="${authorId}">
                            <i class="fas fa-chevron-down" id="collapse-icon-${authorId}"></i>
                        </button>
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteAuthor('${escapeHtml(authorName)}')" 
                                title="Delete Author">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
                
                <div class="author-books" id="books-${authorId}">
                    ${this.createBooksSection(authorName, books)}
                </div>
            </div>
        `;
    }

    createBooksSection(authorName, books) {
        return books.map((book, index) => `
            <div class="book-item" data-book-index="${index}">
                <div class="book-content">
                    <div class="book-main">
                        <div class="book-title">
                            <input type="text" 
                                   class="form-control ${this.getFieldClass(book.title, true)}" 
                                   value="${escapeHtml(book.title || '')}" 
                                   placeholder="Enter book title..."
                                   data-field="title"
                                   onchange="updateBookFieldEnhanced('${escapeHtml(authorName)}', ${index}, 'title', this.value, this)"
                                   oninput="validateFieldRealtime(this, true)">
                        </div>
                        <div class="book-series">
                            <input type="text" 
                                   class="form-control form-control-sm" 
                                   value="${escapeHtml(book.series || '')}" 
                                   placeholder="Series (optional)..."
                                   data-field="series"
                                   onchange="updateBookFieldEnhanced('${escapeHtml(authorName)}', ${index}, 'series', this.value, this)">
                        </div>
                    </div>
                    
                    <div class="book-details">
                        <div class="book-detail-group">
                            <label class="book-detail-label">
                                <i class="fas fa-building"></i> Publisher
                            </label>
                            <input type="text" 
                                   class="form-control form-control-sm" 
                                   value="${escapeHtml(book.publisher || '')}" 
                                   placeholder="Publisher..."
                                   data-field="publisher"
                                   list="publishers-list"
                                   onchange="updateBookFieldEnhanced('${escapeHtml(authorName)}', ${index}, 'publisher', this.value, this)">
                        </div>
                        
                        <div class="book-detail-group">
                            <label class="book-detail-label">
                                <i class="fas fa-microphone"></i> Narrators
                            </label>
                            <div class="narrator-list">
                                ${(book.narrator || ['']).map((narrator, nIndex) => `
                                    <div class="narrator-input-group mb-1">
                                        <input type="text" 
                                               class="form-control form-control-sm" 
                                               value="${escapeHtml(narrator)}" 
                                               placeholder="Narrator name..."
                                               data-field="narrator"
                                               list="narrators-list"
                                               onchange="updateNarratorEnhanced('${escapeHtml(authorName)}', ${index}, ${nIndex}, this.value, this)">
                                        ${book.narrator && book.narrator.length > 1 ? `
                                            <button type="button" 
                                                    class="btn btn-sm btn-outline-danger ms-1" 
                                                    onclick="removeNarrator('${escapeHtml(authorName)}', ${index}, ${nIndex})"
                                                    title="Remove narrator">
                                                <i class="fas fa-times"></i>
                                            </button>
                                        ` : ''}
                                    </div>
                                `).join('')}
                                <button type="button" 
                                        class="btn btn-sm btn-outline-primary mt-1" 
                                        onclick="addNarrator('${escapeHtml(authorName)}', ${index})">
                                    <i class="fas fa-plus me-1"></i>Add Narrator
                                </button>
                            </div>
                        </div>
                    </div>
                    
                    <div class="book-actions">
                        <button class="btn btn-sm btn-outline-danger" 
                                onclick="deleteBook('${escapeHtml(authorName)}', ${index})" 
                                title="Delete Book">
                            <i class="fas fa-trash"></i>
                        </button>
                    </div>
                </div>
            </div>
        `).join('');
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
            'total-publishers': stats.total_publishers || 0,
            'total-narrators': stats.total_narrators || 0
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
        if (!this.hasUnsavedChanges) {
            showToast('No changes to save', 'info', 2000);
            return;
        }

        try {
            // Show progress indicators
            const bookCards = document.querySelectorAll('.book-card.has-changes');
            bookCards.forEach(card => this.showProgressOverlay(card));
            
            showToast('Saving changes...', 'info');
            
            const result = await api.saveAudiobooks(state.get('audiobooks'));
            
            // Handle different response formats - some APIs return success flag, others just return data
            const isSuccess = result.success === true || result.success === undefined;
            
            if (isSuccess) {
                this.hasUnsavedChanges = false;
                
                // Clear auto-save timer
                if (this.autoSaveTimer) {
                    clearTimeout(this.autoSaveTimer);
                    this.autoSaveTimer = null;
                }
                
                // Update save buttons to saved state
                this.updateSaveButtonStates();
                
                // Hide unsaved changes indicator
                const indicator = document.getElementById('unsaved-indicator');
                if (indicator) {
                    indicator.classList.remove('show');
                }
                
                // Clear all field change tracking and show visual feedback
                this.clearAllFieldChanges();
                
                // Hide progress indicators
                bookCards.forEach(card => this.hideProgressOverlay(card));
                
                // Update stats if provided
                if (result.stats) {
                    state.setStats(result.stats);
                    this.updateStats();
                }
                
                showToast('Changes saved successfully', 'success');
            } else {
                console.log('Save failed - unexpected result:', result);
            }
        } catch (error) {
            console.error('Failed to save changes:', error);
            // Hide progress indicators on error
            const bookCards = document.querySelectorAll('.book-card.has-changes');
            bookCards.forEach(card => this.hideProgressOverlay(card));
            showToast('Failed to save changes', 'error');
        }
    }

    markUnsavedChanges() {
        this.hasUnsavedChanges = true;
        
        // Update save button states
        this.updateSaveButtonStates();
        
        // Show unsaved indicator
        const indicator = document.getElementById('unsaved-indicator');
        if (indicator) {
            indicator.classList.add('show');
        }
        
        // Handle auto-save if enabled
        if (this.autoSaveEnabled) {
            // Clear existing timer
            if (this.autoSaveTimer) {
                clearTimeout(this.autoSaveTimer);
            }
            
            // Set new timer
            this.autoSaveTimer = setTimeout(() => {
                this.saveChanges();
            }, this.autoSaveDelay);
        }
    }

    updateSaveButtonStates() {
        const globalSaveBtn = document.querySelector('.control-panel .save-changes-btn');
        
        if (this.hasUnsavedChanges) {
            // Update global save button to show unsaved state
            if (globalSaveBtn) {
                globalSaveBtn.innerHTML = '<i class="fas fa-save me-1"></i>Save Changes';
                globalSaveBtn.className = 'btn save-changes-btn btn-warning';
                globalSaveBtn.disabled = false;
            }
            
            // Update individual author save buttons
            const authorSaveBtns = document.querySelectorAll('.save-changes-btn');
            authorSaveBtns.forEach(btn => {
                if (btn !== globalSaveBtn) {
                    btn.innerHTML = '<i class="fas fa-save me-1"></i>Save';
                    btn.classList.remove('btn-success');
                    btn.classList.add('btn-warning');
                    btn.disabled = false;
                }
            });
        } else {
            // Update global save button to show saved state
            if (globalSaveBtn) {
                globalSaveBtn.innerHTML = '<i class="fas fa-check me-1"></i>Saved';
                globalSaveBtn.classList.remove('btn-warning');
                globalSaveBtn.classList.add('btn-success');
                globalSaveBtn.disabled = true;
            }
            
            // Update individual author save buttons
            const authorSaveBtns = document.querySelectorAll('.save-changes-btn');
            authorSaveBtns.forEach(btn => {
                if (btn !== globalSaveBtn) {
                    btn.innerHTML = '<i class="fas fa-check me-1"></i>Saved';
                    btn.classList.remove('btn-warning');
                    btn.classList.add('btn-success');
                    btn.disabled = true;
                }
            });
        }
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

    showStatsModal() {
        // Implementation will be in modals.js
        if (window.modals) {
            window.modals.showStatsModal();
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

    showKeyboardShortcuts() {
        const modal = document.getElementById('shortcuts-modal');
        if (modal) {
            const bsModal = new bootstrap.Modal(modal);
            bsModal.show();
        }
    }

    initializeKeyboardShortcuts() {
        document.addEventListener('keydown', (e) => {
            // Ctrl/Cmd + S: Save changes
            if ((e.ctrlKey || e.metaKey) && e.key === 's') {
                e.preventDefault();
                if (this.hasUnsavedChanges) {
                    this.saveChanges();
                }
            }
            
            // Ctrl/Cmd + /: Show shortcuts
            if ((e.ctrlKey || e.metaKey) && e.key === '/') {
                e.preventDefault();
                this.showKeyboardShortcuts();
            }
            
            // Escape: Close modals/panels
            if (e.key === 'Escape') {
                if (this.settingsPanelOpen) {
                    this.closeSettingsPanel();
                }
                // Close any open modals
                const modals = document.querySelectorAll('.modal.show');
                modals.forEach(modal => {
                    const bsModal = bootstrap.Modal.getInstance(modal);
                    if (bsModal) bsModal.hide();
                });
            }
        });
    }

    // Auto-refresh data periodically if enabled
    initializeAutoRefresh() {
        if (localStorage.getItem('autoRefresh') === 'true') {
            setInterval(() => {
                if (!this.hasUnsavedChanges) {
                    this.refreshData();
                }
            }, 300000); // 5 minutes
        }
    }

    async refreshData() {
        try {
            showLoading(true);
            const response = await fetch('/api/audiobooks');
            if (response.ok) {
                const data = await response.json();
                if (data.audiobooks && data.audiobooks.author) {
                    state.setAudiobooks(data.audiobooks.author);
                    this.refreshAuthorsDisplay();
                    showToast('Data refreshed successfully', 'success');
                }
            }
        } catch (error) {
            console.error('Failed to refresh data:', error);
            showToast('Failed to refresh data', 'error');
        } finally {
            showLoading(false);
        }
    }

    refreshAuthorsDisplay() {
        if (this.isInitialized) {
            this.renderAuthors();
        }
    }

    renderAuthors() {
        const filteredData = this.getFilteredData();
        const authorsContainer = document.getElementById('authors-container');
        
        if (!authorsContainer) {
            console.error('Authors container not found');
            return;
        }

        if (Object.keys(filteredData).length === 0) {
            authorsContainer.innerHTML = this.createEmptyState();
            return;
        }

        const authorsHtml = Object.entries(filteredData)
            .map(([authorName, books]) => this.createAuthorCard(authorName, books))
            .join('');

        authorsContainer.innerHTML = authorsHtml;
        
        // Update stats after rendering
        this.updateStats();
        
        // Initialize any new components
        this.initializeAuthorCards();
    }

    getFilteredData() {
        const audiobooks = state.get('audiobooks') || {};
        const searchTerm = state.get('filters.search', '').toLowerCase();
        const statusFilter = state.get('filters.status', 'all');
        
        if (!searchTerm && statusFilter === 'all') {
            return audiobooks;
        }
        
        const filtered = {};
        
        for (const [authorName, books] of Object.entries(audiobooks)) {
            if (!Array.isArray(books)) continue;
            
            let includeAuthor = false;
            let filteredBooks = books;
            
            // Apply search filter
            if (searchTerm) {
                includeAuthor = authorName.toLowerCase().includes(searchTerm);
                filteredBooks = books.filter(book => 
                    includeAuthor || 
                    (book.title && book.title.toLowerCase().includes(searchTerm)) ||
                    (book.series && book.series.toLowerCase().includes(searchTerm))
                );
            }
            
            // Apply status filter
            if (statusFilter !== 'all' && filteredBooks.length > 0) {
                filteredBooks = filteredBooks.filter(book => {
                    const isComplete = this.isBookComplete(book);
                    return statusFilter === 'complete' ? isComplete : !isComplete;
                });
            }
            
            if (filteredBooks.length > 0) {
                filtered[authorName] = filteredBooks;
            }
        }
        
        return filtered;
    }

    initializeSettings() {
        // Initialize settings panel functionality
        
        // Set up toggle switches based on current preferences
        const autoSaveToggle = document.querySelector('input[name="autoSave"]');
        if (autoSaveToggle) {
            autoSaveToggle.checked = this.autoSaveEnabled;
        }
        
        const realtimeValidationToggle = document.querySelector('input[name="realtimeValidation"]');
        if (realtimeValidationToggle) {
            realtimeValidationToggle.checked = this.realtimeValidation;
        }
        
        const showCompletionToggle = document.querySelector('input[name="showCompletionStatus"]');
        if (showCompletionToggle) {
            showCompletionToggle.checked = this.showCompletionStatus;
        }
        
        const compactModeToggle = document.querySelector('input[name="compactMode"]');
        if (compactModeToggle) {
            compactModeToggle.checked = this.compactMode;
        }
        
        // Set up cards per row slider
        const cardsPerRowSlider = document.querySelector('input[name="cardsPerRow"]');
        const cardsPerRowValue = document.querySelector('.range-value');
        if (cardsPerRowSlider) {
            cardsPerRowSlider.value = this.cardsPerRow;
            if (cardsPerRowValue) {
                cardsPerRowValue.textContent = this.cardsPerRow;
            }
        }
        
        console.log('Settings initialized');
    }

    // Book completion utility methods
    isBookComplete(book) {
        const requiredFields = ['title'];
        const optionalFields = ['series', 'publisher', 'narrator'];
        
        // Check required fields
        for (const field of requiredFields) {
            if (!book[field] || !book[field].toString().trim()) {
                return false;
            }
        }
        
        // Check if at least some optional fields are filled
        let filledOptionalFields = 0;
        for (const field of optionalFields) {
            if (book[field] && book[field].toString().trim()) {
                filledOptionalFields++;
            }
        }
        
        // Consider complete if title is present and at least one optional field is filled
        return filledOptionalFields > 0;
    }

    getBookCompletionPercentage(book) {
        const allFields = ['title', 'series', 'publisher', 'narrator'];
        let filledFields = 0;
        
        for (const field of allFields) {
            if (book[field] && book[field].toString().trim()) {
                filledFields++;
            }
        }
        
        return Math.round((filledFields / allFields.length) * 100);
    }

    getFieldClass(fieldValue, isRequired = false) {
        // Return CSS classes for form fields based on validation state
        const classes = [];
        
        if (isRequired && (!fieldValue || !fieldValue.toString().trim())) {
            classes.push('is-invalid');
        } else if (fieldValue && fieldValue.toString().trim()) {
            classes.push('is-valid');
        }
        
        return classes.join(' ');
    }
}

// Make AudioStackerApp available globally
window.AudioStackerApp = AudioStackerApp;

// ===================================
// GLOBAL FUNCTIONS FOR HTML ONCLICK HANDLERS
// ===================================

// Enhanced field update with change tracking
window.updateBookFieldEnhanced = function(authorName, bookIndex, field, value, element) {
    // Get old value for change tracking
    const audiobooks = state.get('audiobooks');
    const oldValue = audiobooks[authorName] && audiobooks[authorName][bookIndex] 
        ? audiobooks[authorName][bookIndex][field] 
        : '';
    
    // Update the field using the standard function
    window.updateBookField(authorName, bookIndex, field, value);
    
    // Track field change for visual feedback
    if (window.app && element) {
        const fieldId = `${sanitizeId(authorName)}-${bookIndex}-${field}`;
        element.setAttribute('data-field-id', fieldId);
        window.app.trackFieldChange(fieldId, oldValue, value);
        
        // Real-time validation if enabled
        if (window.app.realtimeValidation) {
            window.validateFieldRealtime(element, field === 'title');
        }
    }
};

window.updateNarratorEnhanced = function(authorName, bookIndex, narratorIndex, value, element) {
    const audiobooks = state.get('audiobooks');
    if (audiobooks[authorName] && audiobooks[authorName][bookIndex] !== undefined) {
        const oldValue = audiobooks[authorName][bookIndex].narrator && audiobooks[authorName][bookIndex].narrator[narratorIndex] 
            ? audiobooks[authorName][bookIndex].narrator[narratorIndex] 
            : '';
            
        if (!audiobooks[authorName][bookIndex].narrator) {
            audiobooks[authorName][bookIndex].narrator = [];
        }
        audiobooks[authorName][bookIndex].narrator[narratorIndex] = value;
        state.setAudiobooks(audiobooks);
        
        // Track field change for visual feedback
        if (window.app && element) {
            const fieldId = `${sanitizeId(authorName)}-${bookIndex}-narrator-${narratorIndex}`;
            element.setAttribute('data-field-id', fieldId);
            window.app.trackFieldChange(fieldId, oldValue, value);
        }
        
        if (window.app) {
            window.app.markUnsavedChanges();
        }
    }
};

window.updateBookField = function(authorName, bookIndex, field, value) {
    const audiobooks = state.get('audiobooks');
    if (audiobooks[authorName] && audiobooks[authorName][bookIndex] !== undefined) {
        audiobooks[authorName][bookIndex][field] = value;
        state.setAudiobooks(audiobooks);
        
        if (window.app) {
            window.app.markUnsavedChanges();
        }
    }
};

window.addNarrator = function(authorName, bookIndex) {
    const audiobooks = state.get('audiobooks');
    if (audiobooks[authorName] && audiobooks[authorName][bookIndex] !== undefined) {
        if (!audiobooks[authorName][bookIndex].narrator) {
            audiobooks[authorName][bookIndex].narrator = [];
        }
        audiobooks[authorName][bookIndex].narrator.push('');
        state.setAudiobooks(audiobooks);
        
        if (window.app) {
            window.app.markUnsavedChanges();
            window.app.refreshAuthorsDisplay();
        }
    }
};

window.removeNarrator = function(authorName, bookIndex, narratorIndex) {
    const audiobooks = state.get('audiobooks');
    if (audiobooks[authorName] && audiobooks[authorName][bookIndex] !== undefined) {
        if (audiobooks[authorName][bookIndex].narrator && audiobooks[authorName][bookIndex].narrator.length > narratorIndex) {
            audiobooks[authorName][bookIndex].narrator.splice(narratorIndex, 1);
            if (audiobooks[authorName][bookIndex].narrator.length === 0) {
                audiobooks[authorName][bookIndex].narrator = [''];
            }
            state.setAudiobooks(audiobooks);
            
            if (window.app) {
                window.app.markUnsavedChanges();
                window.app.refreshAuthorsDisplay();
            }
        }
    }
};

window.validateFieldRealtime = function(element, isRequired = false) {
    if (!element) return;
    
    const value = element.value.trim();
    const errorMessage = element.parentNode.querySelector('.field-error-message');
    
    if (isRequired && !value) {
        element.classList.add('is-invalid');
        element.classList.remove('is-valid');
        if (errorMessage) errorMessage.style.display = 'block';
    } else if (value) {
        element.classList.add('is-valid');
        element.classList.remove('is-invalid');
        if (errorMessage) errorMessage.style.display = 'none';
    } else {
        element.classList.remove('is-valid', 'is-invalid');
        if (errorMessage) errorMessage.style.display = 'none';
    }
};

window.addBook = function(authorName) {
    const audiobooks = state.get('audiobooks');
    if (!audiobooks[authorName]) {
        audiobooks[authorName] = [];
    }
    
    audiobooks[authorName].push({
        title: '',
        series: '',
        publisher: '',
        narrator: ['']
    });
    
    state.setAudiobooks(audiobooks);
    
    if (window.app) {
        window.app.markUnsavedChanges();
        window.app.refreshAuthorsDisplay();
    }
};

window.deleteBook = function(authorName, bookIndex) {
    if (!confirm('Are you sure you want to delete this book?')) {
        return;
    }
    
    const audiobooks = state.get('audiobooks');
    if (audiobooks[authorName] && audiobooks[authorName][bookIndex] !== undefined) {
        audiobooks[authorName].splice(bookIndex, 1);
        
        // Remove author if no books left
        if (audiobooks[authorName].length === 0) {
            delete audiobooks[authorName];
        }
        
        state.setAudiobooks(audiobooks);
        
        if (window.app) {
            window.app.markUnsavedChanges();
            window.app.refreshAuthorsDisplay();
        }
    }
};

window.addAuthor = function() {
    const modal = document.getElementById('addAuthorModal');
    if (modal) {
        const bsModal = new bootstrap.Modal(modal);
        bsModal.show();
    }
};

window.submitNewAuthor = function() {
    const input = document.getElementById('newAuthorName');
    const authorName = input.value.trim();
    
    if (!authorName) {
        showToast('Please enter an author name', 'error');
        return;
    }
    
    const audiobooks = state.get('audiobooks');
    if (audiobooks[authorName]) {
        showToast('Author already exists', 'error');
        return;
    }
    
    audiobooks[authorName] = [{
        title: '',
        series: '',
        publisher: '',
        narrator: ['']
    }];
    
    state.setAudiobooks(audiobooks);
    
    if (window.app) {
        window.app.markUnsavedChanges();
        window.app.refreshAuthorsDisplay();
    }
    
    input.value = '';
    const modal = bootstrap.Modal.getInstance(document.getElementById('addAuthorModal'));
    if (modal) modal.hide();
    
    showToast(`Author "${authorName}" added successfully`, 'success');
};

window.deleteAuthor = function(authorName) {
    if (!confirm(`Are you sure you want to delete the author "${authorName}" and all their books?`)) {
        return;
    }
    
    const audiobooks = state.get('audiobooks');
    delete audiobooks[authorName];
    state.setAudiobooks(audiobooks);
    
    if (window.app) {
        window.app.markUnsavedChanges();
        window.app.refreshAuthorsDisplay();
    }
    
    showToast(`Author "${authorName}" deleted successfully`, 'success');
};

window.setViewMode = function(mode) {
    if (window.app) {
        window.app.setViewMode(mode);
    }
};

window.toggleAutoSave = function(enabled) {
    if (window.app) {
        window.app.updateSettingValue('audioSave', enabled);
    }
};

window.toggleRealtimeValidation = function(enabled) {
    if (window.app) {
        window.app.updateSettingValue('realtimeValidation', enabled);
    }
};

window.toggleCompletionStatus = function(enabled) {
    if (window.app) {
        window.app.updateSettingValue('showCompletionStatus', enabled);
    }
};

window.toggleSettingsPanel = function() {
    if (window.app) {
        window.app.toggleSettingsPanel();
    }
};

window.closeSettingsPanel = function() {
    if (window.app) {
        window.app.closeSettingsPanel();
    }
};

window.refreshData = function() {
    if (window.app) {
        window.app.refreshData();
    }
};

window.saveChanges = function() {
    if (window.app) {
        window.app.saveChanges();
    }
};

// Global wrapper for showImportModal
window.showImportModal = function() {
    if (window.modals) {
        window.modals.showImportModal();
    }
};

// Global wrapper for showStatsModal
window.showStatsModal = function() {
    if (window.modals) {
        window.modals.showStatsModal();
    }
};

// Global wrapper for showQuickAddModal
window.showQuickAddModal = function() {
    if (window.modals) {
        window.modals.showQuickAddModal();
    }
};

// Global wrapper for showKeyboardShortcuts
window.showKeyboardShortcuts = function() {
    if (window.app) {
        window.app.showKeyboardShortcuts();
    }
};

// Global wrapper for exportCollection
window.exportCollection = function() {
    if (window.app && typeof window.app.exportCollection === 'function') {
        return window.app.exportCollection();
    } else {
        console.error('Export functionality not available - app not initialized');
        if (window.toast) {
            window.toast.error('Export functionality is not available');
        } else {
            alert('Export functionality is not available');
        }
    }
};

// Global UI functions (called from HTML onclick handlers)
function toggleAuthorCollapse(authorId) {
    const booksList = document.querySelector(`#books-${authorId}`);
    const collapseIcon = document.querySelector(`#collapse-icon-${authorId}`);
    
    if (!booksList) return;
    
    const isCollapsed = booksList.style.display === 'none';
    
    if (isCollapsed) {
        booksList.style.display = 'block';
        if (collapseIcon) {
            collapseIcon.className = 'fas fa-chevron-down';
        }
    } else {
        booksList.style.display = 'none';
        if (collapseIcon) {
            collapseIcon.className = 'fas fa-chevron-right';
        }
    }
    
    // Save collapsed state in localStorage
    const collapsedAuthors = JSON.parse(localStorage.getItem('collapsedAuthors') || '{}');
    collapsedAuthors[authorId] = !isCollapsed;
    localStorage.setItem('collapsedAuthors', JSON.stringify(collapsedAuthors));
}
