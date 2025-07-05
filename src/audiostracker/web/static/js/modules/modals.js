/**
 * Modals Module
 * Handles all modal dialogs in the application
 */
//
class ModalsModule {
    constructor() {
        this.activeModals = new Map();
        this.init();
    }

    init() {
        // Create modal container if it doesn't exist
        let container = document.getElementById('modals-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'modals-container';
            document.body.appendChild(container);
        }
        this.container = container;
    }

    createModal(id, title, content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = id;
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('aria-labelledby', `${id}-title`);
        modal.setAttribute('aria-hidden', 'true');

        const size = options.size ? `modal-${options.size}` : '';
        const centered = options.centered ? 'modal-dialog-centered' : '';

        modal.innerHTML = `
            <div class="modal-dialog ${size} ${centered}">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${id}-title">${title}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" aria-label="Close"></button>
                    </div>
                    <div class="modal-body">
                        ${content}
                    </div>
                    ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
                </div>
            </div>
        `;

        this.container.appendChild(modal);
        return modal;
    }

    showModal(modalElement, options = {}) {
        const bsModal = new bootstrap.Modal(modalElement, {
            backdrop: options.backdrop !== false,
            keyboard: options.keyboard !== false,
            focus: options.focus !== false
        });

        bsModal.show();

        // Clean up when modal is hidden
        modalElement.addEventListener('hidden.bs.modal', () => {
            modalElement.remove();
            this.activeModals.delete(modalElement.id);
        });

        this.activeModals.set(modalElement.id, bsModal);
        return bsModal;
    }

    showAddAuthorModal() {
        const modalId = generateId('modal');
        const content = `
            <form id="add-author-form">
                <div class="mb-3">
                    <label for="author-name" class="form-label">
                        <i class="fas fa-user-edit me-2"></i>Author Name
                    </label>
                    <input type="text" class="form-control" id="author-name" 
                           placeholder="Enter author name..." required>
                    <div class="form-text">
                        Enter the full name of the author (e.g., "Brandon Sanderson")
                    </div>
                </div>
                <div class="mb-3">
                    <label for="book-name" class="form-label">
                        <i class="fas fa-book me-2"></i>Book Name
                    </label>
                    <input type="text" class="form-control" id="book-name" 
                           placeholder="Enter a book title..." required>
                    <div class="form-text">
                        Enter at least one book title for this author
                    </div>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitAddAuthor()">
                <i class="fas fa-plus me-1"></i>Add Author
            </button>
        `;

        const modal = this.createModal(modalId, 'Add New Author', content, { footer });
        const bsModal = this.showModal(modal);

        // Focus on input
        setTimeout(() => {
            const input = modal.querySelector('#author-name');
            if (input) input.focus();
        }, 200);

        // Handle form submission
        window.submitAddAuthor = async () => {
            const form = document.getElementById('add-author-form');
            const formData = new FormData(form);
            const authorName = formData.get('author-name') || document.getElementById('author-name').value;
            const bookName = formData.get('book-name') || document.getElementById('book-name').value;

            if (!authorName.trim()) {
                showToast('Please enter an author name', 'warning');
                return;
            }

            if (!bookName.trim()) {
                showToast('Please enter a book name', 'warning');
                return;
            }

            try {
                const audiobooks = state.get('audiobooks');
                if (audiobooks.audiobooks.author[authorName]) {
                    showToast('Author already exists', 'warning');
                    return;
                }

                // Add author
                audiobooks.audiobooks.author[authorName] = [];

                // Always add the book with the provided name
                audiobooks.audiobooks.author[authorName].push({
                    title: bookName,
                    series: '',
                    publisher: '',
                    narrator: ['']
                });

                state.setAudiobooks(audiobooks);
                bsModal.hide();
                showToast(`Author "${authorName}" added successfully`, 'success');

                // Auto-save
                await window.app.saveChanges();

            } catch (error) {
                console.error('Failed to add author:', error);
                showToast('Failed to add author', 'error');
            }
        };

        // Handle enter key
        modal.addEventListener('keydown', (e) => {
            if (e.key === 'Enter') {
                if (e.target.id === 'author-name' || e.target.id === 'book-name') {
                    e.preventDefault();
                    window.submitAddAuthor();
                }
            }
        });

        return bsModal;
    }

    showQuickAddModal() {
        const modalId = generateId('modal');
        const stats = state.get('stats') || {};
        const authors = Object.keys(state.get('audiobooks').audiobooks.author || {});

        const content = `
            <form id="quick-add-form">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="quick-author" class="form-label">
                                <i class="fas fa-user-edit me-2"></i>Author
                            </label>
                            <input type="text" class="form-control" id="quick-author" 
                                   list="authors-list-quick" placeholder="Select or enter author..." required>
                            <datalist id="authors-list-quick">
                                ${authors.map(author => `<option value="${escapeHtml(author)}">`).join('')}
                            </datalist>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="quick-title" class="form-label">
                                <i class="fas fa-book me-2"></i>Title
                            </label>
                            <input type="text" class="form-control" id="quick-title" 
                                   placeholder="Enter book title..." required>
                        </div>
                    </div>
                </div>

                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="quick-series" class="form-label">
                                <i class="fas fa-layer-group me-2"></i>Series
                            </label>
                            <input type="text" class="form-control" id="quick-series" 
                                   placeholder="Enter series name...">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="quick-publisher" class="form-label">
                                <i class="fas fa-building me-2"></i>Publisher
                            </label>
                            <input type="text" class="form-control" id="quick-publisher" 
                                   list="publishers-list-quick" placeholder="Select or enter publisher...">
                            <datalist id="publishers-list-quick">
                                ${(stats.publishers || []).map(pub => `<option value="${escapeHtml(pub)}">`).join('')}
                            </datalist>
                        </div>
                    </div>
                </div>

                <div class="mb-3">
                    <label for="quick-narrator" class="form-label">
                        <i class="fas fa-microphone me-2"></i>Narrator(s)
                    </label>
                    <input type="text" class="form-control" id="quick-narrator" 
                           list="narrators-list-quick" placeholder="Enter narrator name(s), separate with commas...">
                    <datalist id="narrators-list-quick">
                        ${(stats.narrators || []).map(nar => `<option value="${escapeHtml(nar)}">`).join('')}
                    </datalist>
                    <div class="form-text">
                        You can enter multiple narrators separated by commas
                    </div>
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="submitQuickAdd()">
                <i class="fas fa-plus me-1"></i>Add Book
            </button>
        `;

        const modal = this.createModal(modalId, 'Quick Add Book', content, { 
            footer,
            size: 'lg'
        });
        const bsModal = this.showModal(modal);

        // Focus on author input
        setTimeout(() => {
            const input = modal.querySelector('#quick-author');
            if (input) input.focus();
        }, 200);

        // Handle form submission
        window.submitQuickAdd = async () => {
            const authorName = document.getElementById('quick-author').value.trim();
            const title = document.getElementById('quick-title').value.trim();
            const series = document.getElementById('quick-series').value.trim();
            const publisher = document.getElementById('quick-publisher').value.trim();
            const narratorInput = document.getElementById('quick-narrator').value.trim();

            if (!authorName || !title) {
                showToast('Author and title are required', 'warning');
                return;
            }

            // Parse narrators
            const narrators = narratorInput 
                ? narratorInput.split(',').map(n => n.trim()).filter(n => n)
                : [''];

            try {
                const audiobooks = state.get('audiobooks');
                
                // Ensure author exists
                if (!audiobooks.audiobooks.author[authorName]) {
                    audiobooks.audiobooks.author[authorName] = [];
                }

                // Add book
                audiobooks.audiobooks.author[authorName].push({
                    title,
                    series,
                    publisher,
                    narrator: narrators.length > 0 ? narrators : ['']
                });

                state.setAudiobooks(audiobooks);
                bsModal.hide();
                showToast(`Book "${title}" added to ${authorName}`, 'success');

                // Auto-save
                await window.app.saveChanges();

            } catch (error) {
                console.error('Failed to add book:', error);
                showToast('Failed to add book', 'error');
            }
        };

        return bsModal;
    }

    showImportModal() {
        const modalId = generateId('modal');
        const content = `
            <div class="import-options">
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <i class="fas fa-file-upload fa-3x text-primary mb-3"></i>
                                <h5 class="card-title">Upload File</h5>
                                <p class="card-text">Import from a JSON file</p>
                                <input type="file" class="form-control" id="import-file" 
                                       accept=".json" style="display: none;">
                                <button type="button" class="btn btn-primary" onclick="document.getElementById('import-file').click()">
                                    Choose File
                                </button>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card h-100">
                            <div class="card-body text-center">
                                <i class="fas fa-paste fa-3x text-secondary mb-3"></i>
                                <h5 class="card-title">Paste Data</h5>
                                <p class="card-text">Paste JSON data directly</p>
                                <button type="button" class="btn btn-secondary" onclick="showPasteArea()">
                                    Paste JSON
                                </button>
                            </div>
                        </div>
                    </div>
                </div>

                <div id="paste-area" style="display: none;">
                    <div class="mb-3">
                        <label for="import-json" class="form-label">JSON Data</label>
                        <textarea class="form-control" id="import-json" rows="10" 
                                  placeholder="Paste your JSON data here..."></textarea>
                    </div>
                </div>

                <div id="file-info" class="alert alert-info" style="display: none;">
                    <i class="fas fa-info-circle me-2"></i>
                    <span id="file-details"></span>
                </div>

                <div id="import-preview" style="display: none;">
                    <h6>Import Preview</h6>
                    <div class="table-responsive">
                        <table class="table table-sm">
                            <thead>
                                <tr>
                                    <th>Author</th>
                                    <th>Books</th>
                                    <th>Action</th>
                                </tr>
                            </thead>
                            <tbody id="preview-body">
                            </tbody>
                        </table>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-warning" id="import-merge-btn" onclick="performImport('merge')" style="display: none;">
                <i class="fas fa-layer-group me-1"></i>Merge Data
            </button>
            <button type="button" class="btn btn-danger" id="import-replace-btn" onclick="performImport('replace')" style="display: none;">
                <i class="fas fa-sync-alt me-1"></i>Replace All
            </button>
        `;

        const modal = this.createModal(modalId, 'Import Collection', content, { 
            footer,
            size: 'lg'
        });
        const bsModal = this.showModal(modal);

        let importData = null;

        // File input handler
        modal.querySelector('#import-file').addEventListener('change', async (e) => {
            const file = e.target.files[0];
            if (!file) return;

            try {
                const text = await readFileAsText(file);
                const data = JSON.parse(text);
                
                if (validateImportData(data)) {
                    importData = data;
                    showFileInfo(file, data);
                    showImportPreview(data);
                } else {
                    showToast('Invalid JSON structure', 'error');
                }
            } catch (error) {
                console.error('Failed to read file:', error);
                showToast('Failed to read file. Please check the format.', 'error');
            }
        });

        // Paste area functions
        window.showPasteArea = () => {
            modal.querySelector('#paste-area').style.display = 'block';
            modal.querySelector('#import-json').focus();
        };

        window.performImport = async (mode) => {
            if (!importData) {
                showToast('No data to import', 'warning');
                return;
            }

            try {
                const currentData = state.get('audiobooks');
                let finalData;

                if (mode === 'replace') {
                    finalData = importData;
                } else {
                    // Merge mode
                    finalData = deepClone(currentData);
                    const importAuthors = importData.audiobooks?.author || {};
                    
                    Object.entries(importAuthors).forEach(([authorName, books]) => {
                        if (finalData.audiobooks.author[authorName]) {
                            // Merge books
                            finalData.audiobooks.author[authorName].push(...books);
                        } else {
                            // Add new author
                            finalData.audiobooks.author[authorName] = books;
                        }
                    });
                }

                state.setAudiobooks(finalData);
                await window.app.saveChanges();
                
                bsModal.hide();
                showToast('Collection imported successfully', 'success');

            } catch (error) {
                console.error('Import failed:', error);
                showToast('Failed to import collection', 'error');
            }
        };

        // Validate JSON on paste
        modal.querySelector('#import-json').addEventListener('input', debounce((e) => {
            try {
                const data = JSON.parse(e.target.value);
                if (validateImportData(data)) {
                    importData = data;
                    showImportPreview(data);
                }
            } catch {
                // Invalid JSON, hide preview
                modal.querySelector('#import-preview').style.display = 'none';
                modal.querySelector('#import-merge-btn').style.display = 'none';
                modal.querySelector('#import-replace-btn').style.display = 'none';
            }
        }, 500));

        function validateImportData(data) {
            return data && 
                   data.audiobooks && 
                   data.audiobooks.author && 
                   typeof data.audiobooks.author === 'object';
        }

        function showFileInfo(file, data) {
            const info = modal.querySelector('#file-info');
            const details = modal.querySelector('#file-details');
            
            const authorCount = Object.keys(data.audiobooks.author).length;
            const bookCount = Object.values(data.audiobooks.author)
                .reduce((sum, books) => sum + books.length, 0);
            
            details.textContent = `File: ${file.name} (${(file.size / 1024).toFixed(1)}KB) - ${authorCount} authors, ${bookCount} books`;
            info.style.display = 'block';
        }

        function showImportPreview(data) {
            const preview = modal.querySelector('#import-preview');
            const tbody = modal.querySelector('#preview-body');
            const currentAuthors = Object.keys(state.get('audiobooks').audiobooks.author);
            
            const rows = Object.entries(data.audiobooks.author).map(([author, books]) => {
                const isExisting = currentAuthors.includes(author);
                const status = isExisting ? 
                    `<span class="badge bg-warning">Will merge</span>` : 
                    `<span class="badge bg-success">New</span>`;
                
                return `
                    <tr>
                        <td>${escapeHtml(author)}</td>
                        <td>${books.length} books</td>
                        <td>${status}</td>
                    </tr>
                `;
            }).join('');
            
            tbody.innerHTML = rows;
            preview.style.display = 'block';
            
            // Show import buttons
            modal.querySelector('#import-merge-btn').style.display = 'inline-block';
            modal.querySelector('#import-replace-btn').style.display = 'inline-block';
        }

        return bsModal;
    }

    showStatsModal() {
        const modalId = generateId('modal');
        const stats = state.get('stats') || {};
        const audiobooks = state.get('audiobooks').audiobooks.author || {};

        // Calculate additional stats
        const authorStats = Object.entries(audiobooks).map(([author, books]) => {
            const complete = books.filter(isBookComplete).length;
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

            return {
                author,
                bookCount: books.length,
                completeCount: complete,
                completionRate: books.length > 0 ? Math.round((complete / books.length) * 100) : 0,
                narratorCount: narratorSet.size,
                publisherCount: publisherSet.size
            };
        }).sort((a, b) => b.bookCount - a.bookCount);

        const content = `
            <div class="stats-dashboard">
                <!-- Summary Cards -->
                <div class="row mb-4">
                    <div class="col-md-3">
                        <div class="stat-card text-center">
                            <div class="stat-icon"><i class="fas fa-book"></i></div>
                            <div class="stat-info">
                                <h3>${stats.total_books || 0}</h3>
                                <p>Total Books</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card text-center">
                            <div class="stat-icon"><i class="fas fa-user-edit"></i></div>
                            <div class="stat-info">
                                <h3>${stats.total_authors || 0}</h3>
                                <p>Authors</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card success text-center">
                            <div class="stat-icon"><i class="fas fa-check-circle"></i></div>
                            <div class="stat-info">
                                <h3>${stats.complete_books || 0}</h3>
                                <p>Complete</p>
                            </div>
                        </div>
                    </div>
                    <div class="col-md-3">
                        <div class="stat-card warning text-center">
                            <div class="stat-icon"><i class="fas fa-exclamation-circle"></i></div>
                            <div class="stat-info">
                                <h3>${stats.incomplete_books || 0}</h3>
                                <p>Incomplete</p>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Completion Rate -->
                <div class="row mb-4">
                    <div class="col-12">
                        <div class="card">
                            <div class="card-body">
                                <h6 class="card-title">
                                    <i class="fas fa-chart-pie me-2"></i>Collection Completion
                                </h6>
                                <div class="progress mb-2" style="height: 25px;">
                                    <div class="progress-bar bg-success" role="progressbar" 
                                         style="width: ${stats.total_books > 0 ? Math.round((stats.complete_books / stats.total_books) * 100) : 0}%">
                                        ${stats.total_books > 0 ? Math.round((stats.complete_books / stats.total_books) * 100) : 0}% Complete
                                    </div>
                                </div>
                                <small class="text-muted">
                                    ${stats.complete_books || 0} of ${stats.total_books || 0} books have complete information
                                </small>
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Top Authors -->
                <div class="row mb-4">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">
                                    <i class="fas fa-trophy me-2"></i>Most Prolific Authors
                                </h6>
                            </div>
                            <div class="card-body">
                                ${authorStats.slice(0, 5).map((author, index) => `
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <div>
                                            <span class="badge bg-secondary me-2">#${index + 1}</span>
                                            <strong>${escapeHtml(author.author)}</strong>
                                        </div>
                                        <span class="badge bg-primary">${author.bookCount} books</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">
                                    <i class="fas fa-percentage me-2"></i>Best Completion Rates
                                </h6>
                            </div>
                            <div class="card-body">
                                ${authorStats.filter(a => a.bookCount >= 2)
                                    .sort((a, b) => b.completionRate - a.completionRate)
                                    .slice(0, 5)
                                    .map((author, index) => `
                                    <div class="d-flex justify-content-between align-items-center mb-2">
                                        <div>
                                            <span class="badge bg-secondary me-2">#${index + 1}</span>
                                            <strong>${escapeHtml(author.author)}</strong>
                                        </div>
                                        <span class="badge bg-success">${author.completionRate}%</span>
                                    </div>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>

                <!-- Publishers and Narrators -->
                <div class="row">
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">
                                    <i class="fas fa-building me-2"></i>Publishers (${stats.total_publishers || 0})
                                </h6>
                            </div>
                            <div class="card-body" style="max-height: 200px; overflow-y: auto;">
                                ${(stats.publishers || []).map(pub => `
                                    <span class="badge bg-info me-1 mb-1">${escapeHtml(pub)}</span>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="card">
                            <div class="card-header">
                                <h6 class="mb-0">
                                    <i class="fas fa-microphone me-2"></i>Narrators (${stats.total_narrators || 0})
                                </h6>
                            </div>
                            <div class="card-body" style="max-height: 200px; overflow-y: auto;">
                                ${(stats.narrators || []).map(nar => `
                                    <span class="badge bg-secondary me-1 mb-1">${escapeHtml(nar)}</span>
                                `).join('')}
                            </div>
                        </div>
                    </div>
                </div>
            </div>
        `;

        const footer = `
            <button type="button" class="btn btn-outline-primary" onclick="exportStats()">
                <i class="fas fa-download me-1"></i>Export Stats
            </button>
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Close</button>
        `;

        const modal = this.createModal(modalId, 'Collection Statistics', content, { 
            footer,
            size: 'xl'
        });
        const bsModal = this.showModal(modal);

        // Export stats function
        window.exportStats = () => {
            const statsData = {
                summary: stats,
                authorStats: authorStats,
                generatedAt: new Date().toISOString()
            };
            
            const dataStr = JSON.stringify(statsData, null, 2);
            const filename = `audiostacker-stats-${formatDate(new Date(), 'YYYY-MM-DD')}.json`;
            downloadFile(dataStr, filename, 'application/json');
            showToast('Statistics exported successfully', 'success');
        };

        return bsModal;
    }

    closeAllModals() {
        this.activeModals.forEach((modal, id) => {
            modal.hide();
        });
    }
}

// Initialize modals module
window.modals = new ModalsModule();
