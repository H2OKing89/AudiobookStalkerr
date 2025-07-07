/**
 * ExportModule - Modular export functionality
 * Handles data export operations with loading states and notifications
 */

class ExportModule extends window.AudiobookStalkerrCore.BaseModule {
    constructor() {
        super('export', ['toast', 'api']);
    }

    init() {
        // Modern browser APIs
        this.abortController = new AbortController();
        this.supportedMimeTypes = new Map([
            ['json', 'application/json'],
            ['csv', 'text/csv'],
            ['ical', 'text/calendar'],
            ['backup', 'application/zip']
        ]);
        
        // Download tracking
        this.activeDownloads = new Set();
        this.downloadHistory = [];
        
        // Performance tracking
        this.performanceMetrics = {
            exportTimes: new Map(),
            totalExports: 0,
            averageExportTime: 0
        };

        this.setupEventListeners();
        this.setupProgressTracking();
        this.log('ExportModule initialized');
    }

    setupEventListeners() {
        // Listen for export requests
        this.core.on('export:request', (data) => {
            this.performExport(data.type, data.options);
        });

        // Setup export button handlers with accessibility
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-export]') || e.target.closest('[data-export]')) {
                const button = e.target.matches('[data-export]') ? e.target : e.target.closest('[data-export]');
                const exportType = button.dataset.export;
                const options = this.parseExportOptions(button);
                
                e.preventDefault();
                this.performExport(exportType, options);
            }
        });
        
        // Keyboard shortcuts for exports
        document.addEventListener('keydown', (e) => {
            if (e.ctrlKey || e.metaKey) {
                switch (e.key) {
                    case 'e':
                        e.preventDefault();
                        this.showExportModal();
                        break;
                    case 's':
                        e.preventDefault();
                        this.performExport('json');
                        break;
                }
            }
        });
        
        // Handle download cancellation
        document.addEventListener('click', (e) => {
            if (e.target.matches('[data-cancel-export]')) {
                const exportId = e.target.dataset.cancelExport;
                this.cancelExport(exportId);
            }
        });
    }

    /**
     * Setup progress tracking for downloads
     */
    setupProgressTracking() {
        // Listen for window focus to update download status
        window.addEventListener('focus', () => {
            this.updateDownloadStatus();
        });
        
        // Periodic cleanup of completed downloads
        setInterval(() => {
            this.cleanupDownloadHistory();
        }, 60000); // Clean up every minute
    }

    /**
     * Show export modal for advanced options
     */
    showExportModal() {
        const modals = this.getModule('modals');
        if (modals) {
            modals.show('export-modal');
        } else {
            // Fallback: show simple export options
            this.performExport('json');
        }
    }

    /**
     * Parse export options from button data attributes
     */
    parseExportOptions(button) {
        const options = {};
        
        // Get all data-export-* attributes
        for (const attr of button.attributes) {
            if (attr.name.startsWith('data-export-')) {
                const key = attr.name.replace('data-export-', '').replace(/-./g, x => x[1].toUpperCase());
                options[key] = attr.value;
            }
        }
        
        return options;
    }

    /**
     * Perform export operation
     */
    async performExport(type = 'json', options = {}) {
        const toast = this.getModule('toast');
        const api = this.getModule('api');
        
        const exportId = this.generateExportId();
        const startTime = performance.now();
        
        this.log(`Starting export: ${type}`, options);
        
        try {
            // Add to active downloads
            this.activeDownloads.add(exportId);
            
            // Show loading state with cancellation option
            this.showLoadingOverlay(true, exportId);
            
            // Show progress notification
            toast?.show(`Starting ${type.toUpperCase()} export...`, 'info', {
                duration: 2000,
                actions: [{
                    text: 'Cancel',
                    action: () => this.cancelExport(exportId)
                }]
            });
            
            // Build export URL and parameters
            const exportUrl = this.buildExportUrl(type, options);
            
            // Make export request with timeout and progress tracking
            const response = await api.request(exportUrl, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    ...options,
                    export_id: exportId
                }),
                signal: this.abortController.signal,
                timeout: 300000 // 5 minute timeout
            });

            if (!response.ok) {
                throw new Error(`Export failed: ${response.status} ${response.statusText}`);
            }

            // Handle different response types
            const contentType = response.headers.get('content-type');
            
            if (contentType && contentType.includes('application/json')) {
                // JSON response with download link or data
                const data = await response.json();
                await this.handleJsonExportResponse(data, type, exportId);
            } else {
                // Direct file download
                const blob = await response.blob();
                this.downloadBlob(blob, this.getExportFilename(type, options), exportId);
            }

            // Track performance
            const exportTime = performance.now() - startTime;
            this.trackExportPerformance(type, exportTime);
            
            toast?.show(`${type.toUpperCase()} export completed successfully`, 'success', {
                duration: 5000,
                actions: [{
                    text: 'View Downloads',
                    action: () => this.showDownloadHistory()
                }]
            });
            
            this.core.emit('export:success', { type, options, exportTime, exportId });
            
        } catch (error) {
            if (error.name === 'AbortError') {
                toast?.show(`Export cancelled`, 'info');
                this.core.emit('export:cancelled', { type, options, exportId });
            } else {
                this.error('Export failed:', error);
                toast?.show(`Export failed: ${error.message}`, 'error');
                this.core.emit('export:error', { type, options, error, exportId });
            }
        } finally {
            this.activeDownloads.delete(exportId);
            this.showLoadingOverlay(false, exportId);
        }
    }

    /**
     * Build export URL based on type and options
     */
    buildExportUrl(type, options) {
        const baseUrl = '/api/export';
        
        switch (type) {
            case 'json':
                return `${baseUrl}/json`;
            case 'csv':
                return `${baseUrl}/csv`;
            case 'ical':
                return `${baseUrl}/ical`;
            case 'backup':
                return `${baseUrl}/backup`;
            default:
                return `${baseUrl}/${type}`;
        }
    }

    /**
     * Handle JSON export response
     */
    async handleJsonExportResponse(data, type, exportId) {
        if (data.download_url) {
            // Server provided a download URL
            await this.downloadFromUrl(data.download_url, data.filename, exportId);
        } else if (data.data) {
            // Direct data response
            const mimeType = this.supportedMimeTypes.get(type) || 'application/json';
            const blob = new Blob([JSON.stringify(data.data, null, 2)], {
                type: mimeType
            });
            this.downloadBlob(blob, this.getExportFilename(type), exportId);
        } else {
            throw new Error('Invalid export response format');
        }
    }

    /**
     * Download file from URL
     */
    async downloadFromUrl(url, filename = null, exportId = null) {
        try {
            const link = document.createElement('a');
            link.href = url;
            if (filename) {
                link.download = filename;
            }
            
            // Add accessibility attributes
            link.setAttribute('aria-label', `Download ${filename || 'export file'}`);
            
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Track download
            if (exportId) {
                this.trackDownload(exportId, filename, url);
            }
            
        } catch (error) {
            this.error('Download failed:', error);
            throw error;
        }
    }

    /**
     * Download blob as file
     */
    downloadBlob(blob, filename, exportId = null) {
        try {
            const url = URL.createObjectURL(blob);
            this.downloadFromUrl(url, filename, exportId);
            
            // Clean up object URL after a delay to ensure download starts
            setTimeout(() => {
                URL.revokeObjectURL(url);
            }, 1000);
            
        } catch (error) {
            this.error('Blob download failed:', error);
            throw error;
        }
    }

    /**
     * Generate export filename
     */
    getExportFilename(type, options = {}) {
        const timestamp = new Date().toISOString().slice(0, 19).replace(/[:.]/g, '-');
        const prefix = options.prefix || 'audiobooks';
        
        switch (type) {
            case 'json':
                return `${prefix}_export_${timestamp}.json`;
            case 'csv':
                return `${prefix}_export_${timestamp}.csv`;
            case 'ical':
                return `${prefix}_calendar_${timestamp}.ics`;
            case 'backup':
                return `${prefix}_backup_${timestamp}.zip`;
            default:
                return `${prefix}_export_${timestamp}.${type}`;
        }
    }

    /**
     * Show/hide loading overlay
     */
    showLoadingOverlay(show, exportId = null) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
            overlay.setAttribute('aria-hidden', !show);
            
            if (show && exportId) {
                overlay.setAttribute('data-export-id', exportId);
                
                // Add cancel button if not present
                let cancelBtn = overlay.querySelector('.cancel-export-btn');
                if (!cancelBtn) {
                    cancelBtn = document.createElement('button');
                    cancelBtn.className = 'btn btn-outline-secondary cancel-export-btn';
                    cancelBtn.innerHTML = '<i class="fas fa-times me-2"></i>Cancel Export';
                    cancelBtn.setAttribute('data-cancel-export', exportId);
                    cancelBtn.setAttribute('aria-label', 'Cancel current export');
                    overlay.appendChild(cancelBtn);
                }
            }
        }

        // Also disable export buttons during loading
        document.querySelectorAll('[data-export]').forEach(button => {
            button.disabled = show;
            button.setAttribute('aria-disabled', show);
            
            if (show) {
                button.classList.add('btn-loading');
                button.setAttribute('aria-busy', 'true');
            } else {
                button.classList.remove('btn-loading');
                button.setAttribute('aria-busy', 'false');
            }
        });
    }

    /**
     * Export specific collections
     */
    async exportAuthors(options = {}) {
        return this.performExport('json', {
            ...options,
            collection: 'authors',
            prefix: 'authors'
        });
    }

    async exportUpcoming(options = {}) {
        return this.performExport('json', {
            ...options,
            collection: 'upcoming',
            prefix: 'upcoming'
        });
    }

    async exportCalendar(options = {}) {
        return this.performExport('ical', {
            ...options,
            prefix: 'audiobook_releases'
        });
    }

    /**
     * Public API methods
     */
    getAPI() {
        return {
            export: this.performExport.bind(this),
            exportAuthors: this.exportAuthors.bind(this),
            exportUpcoming: this.exportUpcoming.bind(this),
            exportCalendar: this.exportCalendar.bind(this),
            downloadBlob: this.downloadBlob.bind(this),
            downloadFromUrl: this.downloadFromUrl.bind(this),
            cancelExport: this.cancelExport.bind(this),
            getDownloadHistory: () => [...this.downloadHistory],
            getActiveDownloads: () => new Set(this.activeDownloads),
            getPerformanceMetrics: () => ({ ...this.performanceMetrics })
        };
    }

    /**
     * Generate unique export ID
     */
    generateExportId() {
        return `export_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
    }

    /**
     * Cancel active export
     */
    cancelExport(exportId) {
        if (this.activeDownloads.has(exportId)) {
            this.abortController.abort();
            this.abortController = new AbortController(); // Create new controller for future requests
            this.activeDownloads.delete(exportId);
            this.log(`Export cancelled: ${exportId}`);
        }
    }

    /**
     * Track download for history
     */
    trackDownload(exportId, filename, url) {
        const download = {
            id: exportId,
            filename,
            url,
            timestamp: new Date(),
            size: null // Could be determined from Content-Length header
        };
        
        this.downloadHistory.unshift(download);
        
        // Keep only last 50 downloads
        if (this.downloadHistory.length > 50) {
            this.downloadHistory = this.downloadHistory.slice(0, 50);
        }
    }

    /**
     * Track export performance
     */
    trackExportPerformance(type, exportTime) {
        this.performanceMetrics.exportTimes.set(type, exportTime);
        this.performanceMetrics.totalExports++;
        
        // Calculate running average
        const times = Array.from(this.performanceMetrics.exportTimes.values());
        this.performanceMetrics.averageExportTime = times.reduce((a, b) => a + b, 0) / times.length;
    }

    /**
     * Show download history
     */
    showDownloadHistory() {
        const modals = this.getModule('modals');
        if (modals) {
            modals.show('download-history-modal', {
                downloads: this.downloadHistory
            });
        }
    }

    /**
     * Update download status
     */
    updateDownloadStatus() {
        // Check if any downloads are still active
        // This could be enhanced to actually ping the server for status
        this.log(`Active downloads: ${this.activeDownloads.size}`);
    }

    /**
     * Cleanup old download history
     */
    cleanupDownloadHistory() {
        const cutoff = new Date(Date.now() - 24 * 60 * 60 * 1000); // 24 hours ago
        this.downloadHistory = this.downloadHistory.filter(download => 
            download.timestamp > cutoff
        );
    }

    /**
     * Cleanup resources
     */
    destroy() {
        // Cancel any active exports
        if (this.abortController) {
            this.abortController.abort();
        }
        
        // Clear active downloads
        this.activeDownloads.clear();
        
        // Clear performance metrics
        this.performanceMetrics = null;
        
        this.log('ExportModule destroyed');
        super.destroy();
    }
}

// Register the module
if (window.AudiobookStalkerrCore?.ModuleRegistry) {
    window.AudiobookStalkerrCore.ModuleRegistry.register('export', ExportModule);
}

// Maintain backward compatibility - expose global function
window.performExport = function() {
    const exportModule = window.AudiobookStalkerrCore?.getModule('export');
    if (exportModule) {
        return exportModule.performExport.apply(exportModule, arguments);
    } else {
        console.warn('ExportModule not available, falling back to simple export');
        // Fallback to the simple export helper
        if (window.simpleExport) {
            return window.simpleExport();
        }
    }
};

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ExportModule;
}
