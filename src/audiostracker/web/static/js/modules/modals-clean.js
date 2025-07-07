/**
 * Modals Module (Clean Version)
 * Handles all modal dialogs with modern browser APIs
 */

class ModalsModule extends BaseModule {
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
            <form id="add-author-form">
                <div class="mb-3">
                    <label for="author-name" class="form-label">Author Name</label>
                    <input type="text" class="form-control" id="author-name" placeholder="Enter author name" required>
                </div>
                <div class="alert alert-info">
                    <i class="fas fa-info-circle me-2"></i>
                    After adding the author, you can manage their books from the author detail page.
                </div>
            </form>
        `;

        const footer = `
            <button type="button" class="btn btn-secondary" data-bs-dismiss="modal">Cancel</button>
            <button type="button" class="btn btn-primary" onclick="this.submitAddAuthor('${modalId}')">Add Author</button>
        `;

        const modal = this.createModal(modalId, 'Add New Author', content, { footer });
        this.showModal(modal);

        // Focus on the input
        setTimeout(() => {
            const input = document.getElementById('author-name');
            if (input) input.focus();
        }, 300);

        this.debug('Add author modal shown');
    }

    async submitAddAuthor(modalId) {
        const input = document.getElementById('author-name');
        if (!input || !input.value.trim()) {
            this.notify('Please enter an author name', 'warning');
            return;
        }

        const authorName = input.value.trim();

        try {
            const apiModule = this.getModule('api');
            if (apiModule) {
                await apiModule.addAuthor(authorName);
                this.notify(`Author "${authorName}" added successfully`, 'success');
                
                // Close modal
                const modal = this.activeModals.get(modalId);
                if (modal) {
                    modal.hide();
                }

                // Refresh data
                this.emit('author:added', { authorName });
            }
        } catch (error) {
            this.notify(`Failed to add author: ${error.message}`, 'error');
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
