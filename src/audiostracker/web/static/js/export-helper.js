/**
 * Export Helper - Backward compatibility wrapper
 * This file provides a simple export function for legacy code
 */

window.simpleExport = function() {
    console.log('Export helper: attempting export');
    
    // Try to use the new export module if available
    if (window.appCore && window.appCore.getModule) {
        const exportModule = window.appCore.getModule('export');
        if (exportModule && exportModule.performExport) {
            return exportModule.performExport('json');
        }
    }
    
    // Fallback to direct API call
    fetch('/api/export', { method: 'POST' })
        .then(response => {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            return response.blob();
        })
        .then(blob => {
            const url = window.URL.createObjectURL(blob);
            const link = document.createElement('a');
            link.href = url;
            link.download = 'audiobooks_export.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            window.URL.revokeObjectURL(url);
            console.log('Export completed successfully');
        })
        .catch(error => {
            console.error('Export failed:', error);
            alert('Export failed. Please try again.');
        });
};

// Ensure performExport is also available for backward compatibility
window.performExport = window.simpleExport;

// Log that the module is loaded
console.log('Export helper module loaded');
