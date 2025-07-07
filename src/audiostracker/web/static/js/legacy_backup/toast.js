/**
 * Toast Notification Module
 * Handles all toast notifications and user feedback
 */

class ToastModule {
    constructor() {
        this.toastContainer = null;
        this.activeToasts = new Map();
        this.defaultDuration = 5000;
        
        this.init();
    }

    init() {
        this.toastContainer = document.querySelector('.toast-container');
        if (!this.toastContainer) {
            this.createToastContainer();
        }
    }

    createToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        this.toastContainer.style.zIndex = '9999';
        document.body.appendChild(this.toastContainer);
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        const toastId = generateId('toast');
        const toast = this.createToast(toastId, message, type);
        
        this.toastContainer.appendChild(toast);
        this.activeToasts.set(toastId, toast);
        
        // Initialize Bootstrap toast
        const bsToast = new bootstrap.Toast(toast, {
            delay: duration,
            autohide: duration > 0
        });
        
        // Show the toast
        bsToast.show();
        
        // Clean up when toast is hidden
        toast.addEventListener('hidden.bs.toast', () => {
            this.remove(toastId);
        });
        
        return toastId;
    }

    createToast(id, message, type) {
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        const config = this.getTypeConfig(type);
        
        toast.innerHTML = `
            <div class="toast-header ${config.headerClass}">
                <i class="${config.icon} me-2"></i>
                <strong class="me-auto">${config.title}</strong>
                <small class="text-muted">${formatDate(new Date(), 'HH:mm:ss')}</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close"></button>
            </div>
            <div class="toast-body">
                ${escapeHtml(message)}
            </div>
        `;
        
        return toast;
    }

    getTypeConfig(type) {
        const configs = {
            success: {
                icon: 'fas fa-check-circle text-success',
                title: 'Success',
                headerClass: 'bg-success text-white'
            },
            error: {
                icon: 'fas fa-exclamation-circle text-danger',
                title: 'Error',
                headerClass: 'bg-danger text-white'
            },
            warning: {
                icon: 'fas fa-exclamation-triangle text-warning',
                title: 'Warning',
                headerClass: 'bg-warning text-dark'
            },
            info: {
                icon: 'fas fa-info-circle text-info',
                title: 'Information',
                headerClass: 'bg-info text-white'
            }
        };
        
        return configs[type] || configs.info;
    }

    remove(toastId) {
        const toast = this.activeToasts.get(toastId);
        if (toast) {
            toast.remove();
            this.activeToasts.delete(toastId);
        }
    }

    removeAll() {
        this.activeToasts.forEach((toast, id) => {
            this.remove(id);
        });
    }

    // Specialized toast methods
    success(message, duration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 8000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration) {
        return this.show(message, 'info', duration);
    }

    // Progress toast for long operations
    progress(message, progressCallback) {
        const toastId = generateId('toast');
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="toast-header">
                <i class="fas fa-spinner fa-spin me-2"></i>
                <strong class="me-auto">Processing</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                <div class="mb-2">${escapeHtml(message)}</div>
                <div class="progress">
                    <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                </div>
            </div>
        `;
        
        this.toastContainer.appendChild(toast);
        this.activeToasts.set(toastId, toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: false
        });
        bsToast.show();
        
        const progressBar = toast.querySelector('.progress-bar');
        
        return {
            id: toastId,
            updateProgress: (percent) => {
                progressBar.style.width = `${Math.min(100, Math.max(0, percent))}%`;
                progressBar.setAttribute('aria-valuenow', percent);
            },
            complete: (successMessage) => {
                toast.querySelector('.toast-header i').className = 'fas fa-check-circle text-success me-2';
                toast.querySelector('.toast-header strong').textContent = 'Complete';
                toast.querySelector('.toast-body .mb-2').textContent = successMessage || 'Operation completed successfully';
                progressBar.style.width = '100%';
                progressBar.classList.add('bg-success');
                
                setTimeout(() => {
                    bsToast.hide();
                }, 2000);
            },
            error: (errorMessage) => {
                toast.querySelector('.toast-header i').className = 'fas fa-exclamation-circle text-danger me-2';
                toast.querySelector('.toast-header strong').textContent = 'Error';
                toast.querySelector('.toast-body .mb-2').textContent = errorMessage || 'Operation failed';
                progressBar.classList.add('bg-danger');
                
                setTimeout(() => {
                    bsToast.hide();
                }, 5000);
            },
            close: () => {
                bsToast.hide();
            }
        };
    }

    // Confirmation toast with actions
    confirm(message, options = {}) {
        return new Promise((resolve) => {
            const toastId = generateId('toast');
            const toast = document.createElement('div');
            toast.id = toastId;
            toast.className = 'toast';
            toast.setAttribute('role', 'alert');
            
            toast.innerHTML = `
                <div class="toast-header">
                    <i class="fas fa-question-circle text-warning me-2"></i>
                    <strong class="me-auto">${options.title || 'Confirm'}</strong>
                    <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
                </div>
                <div class="toast-body">
                    <div class="mb-3">${escapeHtml(message)}</div>
                    <div class="d-flex gap-2">
                        <button type="button" class="btn btn-primary btn-sm" data-action="confirm">
                            ${options.confirmText || 'Confirm'}
                        </button>
                        <button type="button" class="btn btn-secondary btn-sm" data-action="cancel">
                            ${options.cancelText || 'Cancel'}
                        </button>
                    </div>
                </div>
            `;
            
            this.toastContainer.appendChild(toast);
            this.activeToasts.set(toastId, toast);
            
            const bsToast = new bootstrap.Toast(toast, {
                autohide: false
            });
            bsToast.show();
            
            // Handle button clicks
            toast.addEventListener('click', (e) => {
                const action = e.target.getAttribute('data-action');
                if (action) {
                    bsToast.hide();
                    resolve(action === 'confirm');
                }
            });
            
            // Handle close button
            toast.addEventListener('hidden.bs.toast', () => {
                resolve(false);
                this.remove(toastId);
            });
        });
    }

    // Persistent notification that doesn't auto-hide
    persistent(message, type = 'info') {
        return this.show(message, type, 0);
    }

    // Toast with custom action buttons
    withActions(message, actions, type = 'info') {
        const toastId = generateId('toast');
        const toast = document.createElement('div');
        toast.id = toastId;
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        
        const config = this.getTypeConfig(type);
        const actionsHtml = actions.map(action => 
            `<button type="button" class="btn btn-sm ${action.class || 'btn-outline-primary'} me-2" 
                     data-action="${action.id}">
                ${action.text}
             </button>`
        ).join('');
        
        toast.innerHTML = `
            <div class="toast-header ${config.headerClass}">
                <i class="${config.icon} me-2"></i>
                <strong class="me-auto">${config.title}</strong>
                <button type="button" class="btn-close" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                <div class="mb-3">${escapeHtml(message)}</div>
                <div class="d-flex">${actionsHtml}</div>
            </div>
        `;
        
        this.toastContainer.appendChild(toast);
        this.activeToasts.set(toastId, toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: false
        });
        bsToast.show();
        
        return new Promise((resolve) => {
            toast.addEventListener('click', (e) => {
                const actionId = e.target.getAttribute('data-action');
                if (actionId) {
                    const action = actions.find(a => a.id === actionId);
                    if (action && action.callback) {
                        action.callback();
                    }
                    bsToast.hide();
                    resolve(actionId);
                }
            });
            
            toast.addEventListener('hidden.bs.toast', () => {
                resolve(null);
                this.remove(toastId);
            });
        });
    }

    // Batch operation progress
    batchProgress(operations, onProgress, onComplete) {
        let completed = 0;
        const total = operations.length;
        
        const progressToast = this.progress(`Processing ${total} operations...`);
        
        const processNext = async () => {
            if (completed >= total) {
                progressToast.complete(`All ${total} operations completed successfully`);
                if (onComplete) onComplete();
                return;
            }
            
            try {
                await operations[completed]();
                completed++;
                progressToast.updateProgress((completed / total) * 100);
                
                if (onProgress) {
                    onProgress(completed, total);
                }
                
                // Small delay to prevent overwhelming the UI
                setTimeout(processNext, 50);
            } catch (error) {
                progressToast.error(`Operation ${completed + 1} failed: ${error.message}`);
                if (onComplete) onComplete(error);
            }
        };
        
        processNext();
    }
}

// Global toast functions
function showToast(message, type = 'info', duration) {
    return window.toast.show(message, type, duration);
}

function showSuccess(message, duration) {
    return window.toast.success(message, duration);
}

function showError(message, duration) {
    return window.toast.error(message, duration);
}

function showWarning(message, duration) {
    return window.toast.warning(message, duration);
}

function showInfo(message, duration) {
    return window.toast.info(message, duration);
}

// Initialize toast module
window.toast = new ToastModule();
