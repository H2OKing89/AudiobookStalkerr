/**
 * AudioStacker Main Application
 * Coordinates all modules and handles the main application logic
 */

class AudioStackerApp {
    constructor() {
        this.isInitialized = false;
        this.viewMode = 'grid';
        this.unsavedChanges = false;
        this.autoSaveEnabled = localStorage.getItem('autoSaveEnabled') !== 'false';
        this.autoSaveTimeout = null;
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
                state.setAudiobooks(window.initialData);
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
            this.setupKeyboardShortcuts();
            
            // Initialize settings
            this.initializeSettings();
            
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
            return this.createBookListItem(authorName, book, index, bookId);
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

    createBookListItem(authorName, book, index, bookId) {
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
        if (!this.unsavedChanges) {
            showToast('No changes to save', 'info', 2000);
            return;
        }

        try {
            showToast('Saving changes...', 'info');
            
            const result = await api.saveAudiobooks(state.get('audiobooks'));
            if (result.success) {
                this.unsavedChanges = false;
                
                // Update save buttons to saved state WITHOUT re-rendering
                const globalSaveBtn = document.querySelector('.control-panel .save-changes-btn');
                if (globalSaveBtn) {
                    globalSaveBtn.innerHTML = '<i class="fas fa-check me-1"></i>Saved';
                    globalSaveBtn.classList.remove('btn-warning');
                    globalSaveBtn.classList.add('btn-success');
                    globalSaveBtn.disabled = true;
                }
                
                const authorSaveBtns = document.querySelectorAll('.save-changes-btn');
                authorSaveBtns.forEach(btn => {
                    if (btn !== globalSaveBtn) {
                        btn.innerHTML = '<i class="fas fa-check me-1"></i>Saved';
                        btn.classList.remove('btn-warning');
                        btn.classList.add('btn-success');
                        btn.disabled = true;
                    }
                });
                
                // Clear unsaved changes indicator
                this.updateUnsavedIndicator();
                
                // Clear field change tracking and show visual feedback
                this.fieldChangeTracking.forEach((fields, bookId) => {
                    this.clearFieldChanges(bookId);
                });
                this.fieldChangeTracking.clear();
                
                // Update stats if provided
                if (result.stats) {
                    state.setStats(result.stats);
                }
                
                showToast('Changes saved successfully', 'success');
            }
        } catch (error) {
            console.error('Failed to save changes:', error);
            showToast('Failed to save changes', 'error');
        }
    }

    markUnsavedChanges() {
        // Mark that there are unsaved changes without auto-saving
        this.unsavedChanges = true;
        
        // Update save button states WITHOUT re-rendering the entire page
        this.updateSaveButtonStates();
        
        // Update unsaved changes indicator
        this.updateUnsavedIndicator();
        
        // Schedule auto-save if enabled
        this.scheduleAutoSave();
    }

    updateSaveButtonStates() {
        // Update global save button
        const globalSaveBtn = document.querySelector('.control-panel .save-changes-btn');
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
        } else {
            // Fallback stats display
            const stats = state.get('stats') || {};
            const content = `
                <div class="stats-summary">
                    <div class="row g-3">
                        <div class="col-6">
                            <div class="stat-item">
                                <h3>${stats.total_authors || 0}</h3>
                                <p>Authors</p>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="stat-item">
                                <h3>${stats.total_books || 0}</h3>
                                <p>Books</p>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="stat-item">
                                <h3>${stats.total_publishers || 0}</h3>
                                <p>Publishers</p>
                            </div>
                        </div>
                        <div class="col-6">
                            <div class="stat-item">
                                <h3>${stats.total_narrators || 0}</h3>
                                <p>Narrators</p>
                            </div>
                        </div>
                    </div>
                </div>
            `;
            // ...you may want to display 'content' in a modal or alert here...
        }
    }
}
