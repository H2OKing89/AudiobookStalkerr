/**
 * Modals Module (Clean Version)
 * Handles all modal dialogs with modern browser APIs
 */

class ModalsModule extends window.BaseModule {
    constructor(core) {
        super(core);
        this.activeModals = new Map();
        this.focusStack = [];
        this.resizeObserver = null;
        this.mutationObserver = null;
        this.abortController = new AbortController();
    }

    async init() {
        await super.init();
        
        // Create modal container if it doesn't exist
        let container = document.getElementById('modals-container');
        if (!container) {
            container = document.createElement('div');
            container.id = 'modals-container';
            container.setAttribute('role', 'region');
            container.setAttribute('aria-label', 'Modal dialogs');
            document.body.appendChild(container);
        }
        this.container = container;
        
        this.setupGlobalEventListeners();
        this.setupResizeObserver();
        this.setupMutationObserver();
        
        this.debug('Modals module initialized');
    }

    setupGlobalEventListeners() {
        const signal = this.abortController.signal;
        
        // Global escape key handler
        document.addEventListener('keydown', (e) => {
            if (e.key === 'Escape' && this.activeModals.size > 0) {
                this.closeTopModal();
            }
        }, { signal });

        // Focus trap management
        document.addEventListener('focusin', (e) => {
            this.handleFocusTrap(e);
        }, { signal });

        // Handle visibility changes (page hidden/visible)
        document.addEventListener('visibilitychange', () => {
            if (document.hidden && this.activeModals.size > 0) {
                // Pause any animations or timers when page is hidden
                this.pauseModalAnimations();
            } else if (!document.hidden) {
                this.resumeModalAnimations();
            }
        }, { signal });
    }

    setupResizeObserver() {
        if ('ResizeObserver' in window) {
            this.resizeObserver = new ResizeObserver((entries) => {
                // Adjust modal positioning on viewport changes
                entries.forEach((entry) => {
                    if (entry.target === this.container) {
                        this.adjustModalPositions();
                    }
                });
            });
            this.resizeObserver.observe(this.container);
        }
    }

    setupMutationObserver() {
        if ('MutationObserver' in window) {
            this.mutationObserver = new MutationObserver((mutations) => {
                mutations.forEach((mutation) => {
                    if (mutation.type === 'childList') {
                        // Handle dynamic modal content changes
                        this.handleDynamicContentChanges(mutation);
                    }
                });
            });
            
            this.mutationObserver.observe(this.container, {
                childList: true,
                subtree: true
            });
        }
    }

    createModal(id, title, content, options = {}) {
        const modal = document.createElement('div');
        modal.className = 'modal fade';
        modal.id = id;
        modal.setAttribute('tabindex', '-1');
        modal.setAttribute('role', 'dialog');
        modal.setAttribute('aria-labelledby', `${id}-title`);
        modal.setAttribute('aria-describedby', `${id}-body`);
        modal.setAttribute('aria-hidden', 'true');
        modal.setAttribute('aria-modal', 'true');

        const size = options.size ? `modal-${options.size}` : '';
        const centered = options.centered ? 'modal-dialog-centered' : '';
        const scrollable = options.scrollable ? 'modal-dialog-scrollable' : '';

        modal.innerHTML = `
            <div class="modal-dialog ${size} ${centered} ${scrollable}">
                <div class="modal-content">
                    <div class="modal-header">
                        <h5 class="modal-title" id="${id}-title">${this.escapeHtml(title)}</h5>
                        <button type="button" class="btn-close" data-bs-dismiss="modal" 
                                aria-label="Close" title="Close modal (Esc)"></button>
                    </div>
                    <div class="modal-body" id="${id}-body">
                        ${content}
                    </div>
                    ${options.footer ? `<div class="modal-footer">${options.footer}</div>` : ''}
                </div>
            </div>
        `;

        this.container.appendChild(modal);
        
        // Store focus context for restoration
        const focusContext = {
            previouslyFocused: document.activeElement,
            firstFocusable: null,
            lastFocusable: null
        };
        modal._focusContext = focusContext;
        
        return modal;
    }

    showModal(modalElement, options = {}) {
        // Store current focus
        this.focusStack.push(document.activeElement);
        
        const bsModal = new bootstrap.Modal(modalElement, {
            backdrop: options.backdrop !== false ? 'static' : false,
            keyboard: options.keyboard !== false,
            focus: options.focus !== false
        });

        // Set up focus trap
        this.setupFocusTrap(modalElement);

        // Show with animation
        bsModal.show();

        // Enhanced event handling
        modalElement.addEventListener('shown.bs.modal', () => {
            this.handleModalShown(modalElement, options);
        }, { once: true });

        modalElement.addEventListener('hidden.bs.modal', () => {
            this.handleModalHidden(modalElement);
        }, { once: true });

        // Handle potential errors
        modalElement.addEventListener('hide.bs.modal', (e) => {
            if (options.preventClose && typeof options.preventClose === 'function') {
                if (options.preventClose()) {
                    e.preventDefault();
                    return false;
                }
            }
        });

        this.activeModals.set(modalElement.id, {
            modal: bsModal,
            element: modalElement,
            options: options
        });

        // Announce to screen readers
        this.announceModal(modalElement);
        
        return bsModal;
    }

    setupFocusTrap(modalElement) {
        const focusableElements = modalElement.querySelectorAll(
            'button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])'
        );
        
        if (focusableElements.length > 0) {
            modalElement._focusContext.firstFocusable = focusableElements[0];
            modalElement._focusContext.lastFocusable = focusableElements[focusableElements.length - 1];
        }
    }

    handleFocusTrap(e) {
        const activeModal = this.getTopModal();
        if (!activeModal) return;

        const focusContext = activeModal._focusContext;
        if (!focusContext.firstFocusable || !focusContext.lastFocusable) return;

        if (e.target === focusContext.lastFocusable && !e.shiftKey && e.key === 'Tab') {
            e.preventDefault();
            focusContext.firstFocusable.focus();
        } else if (e.target === focusContext.firstFocusable && e.shiftKey && e.key === 'Tab') {
            e.preventDefault();
            focusContext.lastFocusable.focus();
        }
    }

    handleModalShown(modalElement, options) {
        // Focus management
        if (options.autoFocus !== false) {
            const autofocusElement = modalElement.querySelector('[autofocus]');
            if (autofocusElement) {
                autofocusElement.focus();
            } else {
                const firstInput = modalElement.querySelector('input, textarea, select');
                if (firstInput) {
                    firstInput.focus();
                }
            }
        }

        // Haptic feedback on supported devices
        if ('vibrate' in navigator && options.haptic !== false) {
            navigator.vibrate(50);
        }

        this.emit('modal:shown', { id: modalElement.id, element: modalElement });
    }

    handleModalHidden(modalElement) {
        // Restore focus
        const previousFocus = this.focusStack.pop();
        if (previousFocus && document.body.contains(previousFocus)) {
            previousFocus.focus();
        }

        // Clean up
        modalElement.remove();
        this.activeModals.delete(modalElement.id);
        
        this.emit('modal:hidden', { id: modalElement.id });
    }

    showAddAuthorModal() {
        const modalId = `add-author-modal-${Date.now()}`;
        const content = `
            <form id="add-author-form-${modalId}">
                <div class="mb-3">
                    <label for="author-name-${modalId}" class="form-label">Author Name</label>
                    <input type="text" class="form-control" id="author-name-${modalId}" placeholder="Enter author name" required>
                </div>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    After adding the author, you can manage their books from the author detail page.
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" id="submit-author-btn-${modalId}" data-action="submit-add-author" data-modal-id="${modalId}">Add Author</button>
        `;

        // Create the modal
        const modal = this.createModal(modalId, 'Add New Author', content, { footer });
        
        // Set up event handlers before showing the modal to prevent race conditions
        const self = this; // Store reference to 'this' for event handlers
        
        // Set up the submit button click handler immediately
        document.getElementById(`submit-author-btn-${modalId}`).addEventListener('click', function() {
            self.submitAddAuthor(modalId);
        });
        
        // Show the modal
        this.showModal(modal);

        // Set up form handling and focus the input field after the modal is shown
        modal.addEventListener('shown.bs.modal', () => {
            // Focus on the input
            const inputField = document.getElementById(`author-name-${modalId}`);
            if (inputField) {
                inputField.focus();
                
                // Handle Enter key in the form
                inputField.addEventListener('keydown', (e) => {
                    if (e.key === 'Enter') {
                        e.preventDefault();
                        this.submitAddAuthor(modalId);
                    }
                });
                
                // Set up form submission
                const form = document.getElementById(`add-author-form-${modalId}`);
                if (form) {
                    form.addEventListener('submit', (e) => {
                        e.preventDefault();
                        this.submitAddAuthor(modalId);
                    });
                }
            }
        });

        this.debug('Add author modal shown');
    }

    async submitAddAuthor(modalId) {
        const input = document.getElementById(`author-name-${modalId}`);
        if (!input || !input.value.trim()) {
            this.notify('Please enter an author name', 'warning');
            if (input) input.focus();
            return;
        }

        const authorName = input.value.trim();
        
        // Basic validation
        if (authorName.length < 2) {
            this.notify('Author name must be at least 2 characters long', 'warning');
            input.focus();
            return;
        }

        // Disable the submit button to prevent double submission
        const submitButton = document.getElementById(`submit-author-btn-${modalId}`);
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Adding...';
        }

        try {
            const apiModule = this.getModule('api');
            if (!apiModule) {
                throw new Error('API module not available');
            }

            const response = await apiModule.addAuthor(authorName);
            this.notify(`Author "${authorName}" added successfully`, 'success');
            
            // Close modal
            const modalData = this.activeModals.get(modalId);
            if (modalData && modalData.modal) {
                modalData.modal.hide();
            } else {
                // Fallback in case the modal reference is not found
                const modalElement = document.getElementById(modalId);
                if (modalElement) {
                    const bsModal = bootstrap.Modal.getInstance(modalElement);
                    if (bsModal) bsModal.hide();
                }
            }

            // Emit event for other modules
            this.emit('author:added', { authorName });
            
            // Create a success modal asking about navigation
            this.showNavigationChoiceModal(authorName);
            
        } catch (error) {
            console.error('Error adding author:', error);
            this.notify(`Failed to add author: ${error.message}`, 'error');
            
            // Re-enable the submit button
            const resetButton = document.getElementById(`submit-author-btn-${modalId}`);
            if (resetButton) {
                resetButton.disabled = false;
                resetButton.innerHTML = 'Add Author';
            }
            
            // Focus back to input for retry
            if (input) input.focus();
        }
    }

    /**
     * Show navigation choice modal after adding an author
     */
    showNavigationChoiceModal(authorName) {
        const modalId = 'navigation-choice-modal';
        const content = `
            <div class="text-center mb-4">
                <div class="avatar avatar-xl bg-success text-white mx-auto mb-3">
                    <i class="fas fa-check-circle fa-2x"></i>
                </div>
                <h4 class="text-success mb-2">Author Added Successfully!</h4>
                <p class="text-muted mb-4">
                    <strong>${this.escapeHtml(authorName)}</strong> has been added to your collection.
                </p>
            </div>
            <div class="alert alert-info mb-4">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Next Steps:</strong> This author doesn't have any books yet. 
                You can add books from the author's dedicated page.
            </div>
        `;
        
        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                <i class="fas fa-list me-2"></i>Stay on Authors List
            </button>
            <button type="button" class="btn btn-primary" id="navigate-to-author">
                <i class="fas fa-user-plus me-2"></i>Go to Author Page
            </button>
        `;

        const modal = this.createModal(modalId, 'Author Added', content, {
            footer: footer,
            centered: true,
            backdrop: 'static'
        });

        // Add navigation handler
        const navigateBtn = modal.querySelector('#navigate-to-author');
        if (navigateBtn) {
            navigateBtn.addEventListener('click', () => {
                // Close modal first
                const bsModal = bootstrap.Modal.getInstance(modal);
                if (bsModal) bsModal.hide();
                
                // Show loading state
                this.showLoading(true);
                
                // Navigate to author page
                setTimeout(() => {
                    window.location.href = `/authors/${encodeURIComponent(authorName)}`;
                }, 500);
            });
        }

        // Handle staying on current page
        modal.addEventListener('hidden.bs.modal', (e) => {
            // If they dismissed the modal without choosing to navigate, refresh the page
            if (!e.target.querySelector('#navigate-to-author').clicked) {
                setTimeout(() => {
                    window.location.reload();
                }, 300);
            }
        });

        this.showModal(modal, { backdrop: 'static' });
    }

    /**
     * Show loading overlay
     */
    showLoading(show = true) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
   }

    /**
     * Show add book modal for author page
     */
    showAddBookModal(authorName = null, isNewAuthor = false) {
        const modalId = 'add-book-modal';
        
        const authorDisplayName = authorName || (window.authorData ? window.authorData.name : 'Unknown Author');
        const isFirstBook = isNewAuthor || (window.authorData && window.authorData.is_new_author);
        
        const content = `
            ${isFirstBook ? `
            <div class="alert alert-info mb-3">
                <i class="fas fa-info-circle me-2"></i>
                <strong>Getting Started:</strong> Add your first book for ${this.escapeHtml(authorDisplayName)}. 
                You can fill out just the title now and add more details later.
            </div>` : ''}
            <form id="add-book-form-${modalId}">
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="book-title-${modalId}" class="form-label">Book Title <span class="text-danger">*</span></label>
                            <input type="text" class="form-control" id="book-title-${modalId}" required 
                                   placeholder="Enter the book title">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="book-series-${modalId}" class="form-label">Series</label>
                            <input type="text" class="form-control" id="book-series-${modalId}" 
                                   placeholder="Series name (optional)">
                        </div>
                    </div>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="book-publisher-${modalId}" class="form-label">Publisher</label>
                            <input type="text" class="form-control" id="book-publisher-${modalId}" 
                                   placeholder="Publisher name (optional)">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="book-series-number-${modalId}" class="form-label">Series Number</label>
                            <input type="text" class="form-control" id="book-series-number-${modalId}" 
                                   placeholder="Book number in series">
                        </div>
                    </div>
                </div>
                <div class="mb-3">
                    <label for="book-narrator-${modalId}" class="form-label">Narrator(s)</label>
                    <input type="text" class="form-control" id="book-narrator-${modalId}" 
                           placeholder="For multiple narrators, separate with commas">
                    <div class="form-text">Enter narrator names separated by commas (e.g., "John Doe, Jane Smith")</div>
                </div>
                <div class="mb-3">
                    <label for="book-description-${modalId}" class="form-label">Description</label>
                    <textarea class="form-control" id="book-description-${modalId}" rows="3" 
                              placeholder="Brief description of the book (optional)"></textarea>
                </div>
                <div class="row">
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="book-release-date-${modalId}" class="form-label">Release Date</label>
                            <input type="date" class="form-control" id="book-release-date-${modalId}">
                        </div>
                    </div>
                    <div class="col-md-6">
                        <div class="mb-3">
                            <label for="book-asin-${modalId}" class="form-label">ASIN</label>
                            <input type="text" class="form-control" id="book-asin-${modalId}" 
                                   placeholder="Amazon Standard Identification Number">
                        </div>
                    </div>
                </div>
            </form>
        `;
        
        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">
                <i class="fas fa-times me-2"></i>Cancel
            </button>
            <button type="button" class="btn btn-primary" id="submit-book-btn-${modalId}">
                <i class="fas fa-plus me-2"></i>Add Book
            </button>
        `;

        const modal = this.createModal(modalId, 
            isFirstBook ? `Add First Book for ${authorDisplayName}` : 'Add New Book', 
            content, {
            footer: footer,
            size: 'lg',
            centered: true
        });

        // Add form submission handler
        const submitBtn = modal.querySelector(`#submit-book-btn-${modalId}`);
        if (submitBtn) {
            submitBtn.addEventListener('click', () => {
                this.submitAddBook(modalId, authorDisplayName);
            });
        }

        // Add Enter key support for the form
        const form = modal.querySelector(`#add-book-form-${modalId}`);
        if (form) {
            form.addEventListener('keydown', (e) => {
                if (e.key === 'Enter' && !e.shiftKey && e.target.tagName !== 'TEXTAREA') {
                    e.preventDefault();
                    this.submitAddBook(modalId, authorDisplayName);
                }
            });
        }

        this.showModal(modal);
        
        // Focus on title input
        setTimeout(() => {
            const titleInput = modal.querySelector(`#book-title-${modalId}`);
            if (titleInput) titleInput.focus();
        }, 300);
    }

    /**
     * Submit add book form
     */
    async submitAddBook(modalId, authorName) {
        const titleInput = document.getElementById(`book-title-${modalId}`);
        if (!titleInput || !titleInput.value.trim()) {
            this.notify('Please enter a book title', 'warning');
            if (titleInput) {
                titleInput.classList.add('is-invalid');
                titleInput.focus();
            }
            return;
        }

        // Clear any previous validation errors
        titleInput.classList.remove('is-invalid');

        const bookData = {
            title: titleInput.value.trim(),
            series: document.getElementById(`book-series-${modalId}`)?.value.trim() || '',
            series_number: document.getElementById(`book-series-number-${modalId}`)?.value.trim() || '',
            publisher: document.getElementById(`book-publisher-${modalId}`)?.value.trim() || '',
            narrator: this.parseNarrators(document.getElementById(`book-narrator-${modalId}`)?.value || ''),
            description: document.getElementById(`book-description-${modalId}`)?.value.trim() || '',
            release_date: document.getElementById(`book-release-date-${modalId}`)?.value || '',
            asin: document.getElementById(`book-asin-${modalId}`)?.value.trim() || ''
        };

        // Disable submit button
        const submitButton = document.getElementById(`submit-book-btn-${modalId}`);
        if (submitButton) {
            submitButton.disabled = true;
            submitButton.innerHTML = '<i class="fas fa-spinner fa-spin me-2"></i>Adding...';
        }

        try {
            const apiModule = this.getModule('api');
            if (!apiModule) {
                throw new Error('API module not available');
            }

            const response = await apiModule.addBook(authorName, bookData);
            this.notify(`Book "${bookData.title}" added successfully`, 'success');
            
            // Close modal
            const modalData = this.activeModals.get(modalId);
            if (modalData && modalData.modal) {
                modalData.modal.hide();
            }

            // Emit event for other modules
            this.emit('book:added', { authorName, book: bookData });
            
            // Refresh the page to show the new book
            setTimeout(() => {
                window.location.reload();
            }, 1000);
            
        } catch (error) {
            console.error('Error adding book:', error);
            this.notify(`Failed to add book: ${error.message}`, 'error');
            
            // Re-enable submit button
            if (submitButton) {
                submitButton.disabled = false;
                submitButton.innerHTML = '<i class="fas fa-plus me-2"></i>Add Book';
            }
            
            if (titleInput) titleInput.focus();
        }
    }

    /**
     * Parse narrator string into array
     */
    parseNarrators(narratorString) {
        if (!narratorString || !narratorString.trim()) {
            return [];
        }
        
        return narratorString
            .split(',')
            .map(n => n.trim())
            .filter(n => n.length > 0);
    }

    /**
     * Show loading overlay
     */
    showLoading(show = true) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            if (show) {
                overlay.classList.add('show');
            } else {
                overlay.classList.remove('show');
            }
        }
    }

    // Helper methods for enhanced functionality
    
    getTopModal() {
        const modalElements = Array.from(this.activeModals.values())
            .map(m => m.element)
            .filter(el => el && el.classList.contains('show'));
        return modalElements[modalElements.length - 1];
    }

    closeTopModal() {
        const topModal = this.getTopModal();
        if (topModal) {
            const modalData = this.activeModals.get(topModal.id);
            if (modalData) {
                modalData.modal.hide();
            }
        }
    }

    announceModal(modalElement) {
        if ('speechSynthesis' in window) {
            const title = modalElement.querySelector('.modal-title')?.textContent;
            if (title) {
                // Announce modal opening to screen readers
                const announcement = `Modal opened: ${title}`;
                this.announceToScreenReader(announcement);
            }
        }
    }

    announceToScreenReader(message) {
        const announcement = document.createElement('div');
        announcement.setAttribute('aria-live', 'polite');
        announcement.setAttribute('aria-atomic', 'true');
        announcement.className = 'sr-only';
        announcement.textContent = message;
        
        document.body.appendChild(announcement);
        setTimeout(() => {
            document.body.removeChild(announcement);
        }, 1000);
    }

    adjustModalPositions() {
        // Adjust modal positions on viewport changes
        this.activeModals.forEach((modalData) => {
            const modalElement = modalData.element;
            if (modalElement && modalElement.classList.contains('show')) {
                const dialog = modalElement.querySelector('.modal-dialog');
                if (dialog) {
                    // Reset any custom positioning
                    dialog.style.marginTop = '';
                    dialog.style.marginBottom = '';
                }
            }
        });
    }

    pauseModalAnimations() {
        this.activeModals.forEach((modalData) => {
            const modalElement = modalData.element;
            if (modalElement) {
                modalElement.style.animationPlayState = 'paused';
            }
        });
    }

    resumeModalAnimations() {
        this.activeModals.forEach((modalData) => {
            const modalElement = modalData.element;
            if (modalElement) {
                modalElement.style.animationPlayState = 'running';
            }
        });
    }

    handleDynamicContentChanges(mutation) {
        // Handle dynamic content changes in modals
        if (mutation.addedNodes.length > 0) {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE) {
                    const modal = node.closest('.modal');
                    if (modal && this.activeModals.has(modal.id)) {
                        // Update focus trap for dynamic content
                        this.setupFocusTrap(modal);
                    }
                }
            });
        }
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Enhanced cleanup
    async destroy() {
        this.closeAllModals();
        
        if (this.resizeObserver) {
            this.resizeObserver.disconnect();
        }
        
        if (this.mutationObserver) {
            this.mutationObserver.disconnect();
        }
        
        this.abortController.abort();
        
        await super.destroy();
    }

    closeAllModals() {
        this.activeModals.forEach((modalData, id) => {
            modalData.modal.hide();
        });
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.ModalsModule = ModalsModule;
}

if (typeof module !== 'undefined' && module.exports) {
    module.exports = ModalsModule;
}
