/**
 * Toast Notification Module
 * Handles all toast notifications and user feedback
 */

class ToastModule extends window.BaseModule {
    constructor(core) {
        super(core);
        this.toastContainer = null;
        this.activeToasts = new Map();
        this.defaultDuration = 5000;
    }

    async init() {
        await super.init();
        
        this.toastContainer = document.querySelector('.toast-container');
        if (!this.toastContainer) {
            this.createToastContainer();
        }
        
        this.debug('Toast module initialized');
    }

    createToastContainer() {
        this.toastContainer = document.createElement('div');
        this.toastContainer.className = 'toast-container position-fixed bottom-0 end-0 p-3';
        this.toastContainer.style.zIndex = '9999';
        document.body.appendChild(this.toastContainer);
    }

    show(message, type = 'info', duration = this.defaultDuration) {
        const toastId = this.generateId('toast');
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
        
        this.debug(`Toast shown: ${type} - ${message}`);
        return toastId;
   }

    // Queue system for managing multiple toasts
    showWithQueue(message, type = 'info', duration = this.defaultDuration) {
        // Limit the number of visible toasts
        const maxToasts = 5;
        if (this.activeToasts.size >= maxToasts) {
            // Remove the oldest toast
            const oldestToastId = this.activeToasts.keys().next().value;
            this.remove(oldestToastId);
        }
        
        return this.show(message, type, duration);
    }

    // Enhanced notification with better user experience
    notify(message, type = 'info', options = {}) {
        const defaultOptions = {
            duration: this.defaultDuration,
            persistent: false,
            actions: [],
            sound: false
        };
        
        const config = { ...defaultOptions, ...options };
        
        // Use Web Notifications API if available and permitted
        if (config.persistent && 'Notification' in window && Notification.permission === 'granted') {
            return this.showWebNotification(message, type, config);
        }
        
        // Use sound if requested and available
        if (config.sound && 'AudioContext' in window) {
            this.playNotificationSound(type);
        }
        
        if (config.actions.length > 0) {
            return this.withActions(message, config.actions, type);
        }
        
        return this.show(message, type, config.duration);
    }

    // Web Notifications API integration
    async showWebNotification(message, type, options) {
        if (!('Notification' in window)) {
            return this.show(message, type, options.duration);
        }
        
        if (Notification.permission === 'default') {
            const permission = await Notification.requestPermission();
            if (permission !== 'granted') {
                return this.show(message, type, options.duration);
            }
        }
        
        if (Notification.permission === 'granted') {
            const config = this.getTypeConfig(type);
            new Notification(`AudiobookStalkerr - ${config.title}`, {
                body: message,
                icon: '/static/favicon.ico',
                tag: 'AudiobookStalkerr-notification'
            });
        }
        
        return this.show(message, type, options.duration);
    }

    // Simple notification sound feedback
    playNotificationSound(type) {
        try {
            const audioContext = new (window.AudioContext || window.webkitAudioContext)();
            const oscillator = audioContext.createOscillator();
            const gainNode = audioContext.createGain();
            
            oscillator.connect(gainNode);
            gainNode.connect(audioContext.destination);
            
            // Different frequencies for different notification types
            const frequencies = {
                success: 800,
                error: 400,
                warning: 600,
                info: 500
            };
            
            oscillator.frequency.setValueAtTime(frequencies[type] || 500, audioContext.currentTime);
            oscillator.type = 'sine';
            
            gainNode.gain.setValueAtTime(0.1, audioContext.currentTime);
            gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.1);
            
            oscillator.start(audioContext.currentTime);
            oscillator.stop(audioContext.currentTime + 0.1);
        } catch (error) {
            this.debug('Could not play notification sound:', error);
        }
    }

    createToast(id, message, type) {
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        toast.setAttribute('aria-live', 'assertive');
        toast.setAttribute('aria-atomic', 'true');
        
        // Enhanced accessibility
        toast.setAttribute('aria-describedby', `${id}-message`);
        
        const config = this.getTypeConfig(type);
        
        toast.innerHTML = `
            <div class="toast-header ${config.headerClass}">
                <i class="${config.icon} me-2" aria-hidden="true"></i>
                <strong class="me-auto">${config.title}</strong>
                <small class="text-muted">${this.formatTime(new Date())}</small>
                <button type="button" class="btn-close" data-bs-dismiss="toast" aria-label="Close notification"></button>
            </div>
            <div class="toast-body" id="${id}-message">
                ${this.escapeHtml(message)}
            </div>
        `;
        
        // Add keyboard navigation support
        toast.addEventListener('keydown', (e) => {
            if (e.key === 'Escape') {
                const bsToast = bootstrap.Toast.getInstance(toast);
                if (bsToast) bsToast.hide();
            }
        });
        
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
    success(message, duration = this.defaultDuration) {
        return this.show(message, 'success', duration);
    }

    error(message, duration = 8000) {
        return this.show(message, 'error', duration);
    }

    warning(message, duration = 6000) {
        return this.show(message, 'warning', duration);
    }

    info(message, duration = this.defaultDuration) {
        return this.show(message, 'info', duration);
    }

    // Progress toast for long operations
    progress(message, progressCallback) {
        const toastId = this.generateId('progress-toast');
        const toast = this.createProgressToast(toastId, message);
        
        this.toastContainer.appendChild(toast);
        this.activeToasts.set(toastId, toast);
        
        const bsToast = new bootstrap.Toast(toast, {
            autohide: false
        });
        
        bsToast.show();
        
        return {
            id: toastId,
            update: (progress, text) => this.updateProgress(toastId, progress, text),
            complete: (message) => this.completeProgress(toastId, message),
            error: (error) => this.errorProgress(toastId, error)
        };
    }

    createProgressToast(id, message) {
        const toast = document.createElement('div');
        toast.id = id;
        toast.className = 'toast';
        toast.setAttribute('role', 'alert');
        
        toast.innerHTML = `
            <div class="toast-header bg-primary text-white">
                <i class="fas fa-spinner fa-spin me-2"></i>
                <strong class="me-auto">Processing</strong>
                <button type="button" class="btn-close btn-close-white" data-bs-dismiss="toast"></button>
            </div>
            <div class="toast-body">
                <div class="progress-message">${this.escapeHtml(message)}</div>
                <div class="progress mt-2">
                    <div class="progress-bar" role="progressbar" style="width: 0%"></div>
                </div>
            </div>
        `;
        
        return toast;
    }

    updateProgress(toastId, progress, text) {
        const toast = this.activeToasts.get(toastId);
        if (toast) {
            const progressBar = toast.querySelector('.progress-bar');
            const messageEl = toast.querySelector('.progress-message');
            
            if (progressBar) {
                progressBar.style.width = `${progress}%`;
                progressBar.setAttribute('aria-valuenow', progress);
            }
            
            if (messageEl && text) {
                messageEl.textContent = text;
            }
        }
    }

    completeProgress(toastId, message = 'Completed successfully') {
        const toast = this.activeToasts.get(toastId);
        if (toast) {
            const header = toast.querySelector('.toast-header');
            const icon = toast.querySelector('.toast-header i');
            const title = toast.querySelector('.toast-header strong');
            const progressBar = toast.querySelector('.progress-bar');
            const messageEl = toast.querySelector('.progress-message');
            
            header.className = 'toast-header bg-success text-white';
            icon.className = 'fas fa-check-circle me-2';
            title.textContent = 'Success';
            progressBar.style.width = '100%';
            progressBar.className = 'progress-bar bg-success';
            messageEl.textContent = message;
            
            // Auto-hide after 3 seconds
            setTimeout(() => this.remove(toastId), 3000);
        }
    }

    errorProgress(toastId, error) {
        const toast = this.activeToasts.get(toastId);
        if (toast) {
            const header = toast.querySelector('.toast-header');
            const icon = toast.querySelector('.toast-header i');
            const title = toast.querySelector('.toast-header strong');
            const progressBar = toast.querySelector('.progress-bar');
            const messageEl = toast.querySelector('.progress-message');
            
            header.className = 'toast-header bg-danger text-white';
            icon.className = 'fas fa-exclamation-circle me-2';
            title.textContent = 'Error';
            progressBar.style.width = '100%';
            progressBar.className = 'progress-bar bg-danger';
            messageEl.textContent = error;
        }
    }

    // Utility methods
    generateId(prefix = 'id') {
        return `${prefix}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    escapeHtml(text) {
        if (typeof text !== 'string') return text;
        
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    formatTime(date) {
        return date.toLocaleTimeString('en-US', { 
            hour12: false, 
            hour: '2-digit', 
            minute: '2-digit', 
            second: '2-digit' 
        });
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.ToastModule = ToastModule;
}

// Export for module systems
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ToastModule;
}
