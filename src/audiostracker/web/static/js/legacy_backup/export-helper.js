/**
 * Export Helper - Standalone export functionality
 * This module provides a completely independent export function that doesn't rely
 * on any other modules or global objects.
 */

// Self-executing function to avoid polluting global namespace
(function() {
    // Show/hide loading overlay
    function showLoadingOverlay(show) {
        const overlay = document.getElementById('loading-overlay');
        if (overlay) {
            overlay.style.display = show ? 'flex' : 'none';
        }
    }
    
    // Show toast notification
    function showToastNotification(message, type = 'info') {
        const toast = document.getElementById('notification-toast');
        const toastBody = document.getElementById('toast-message');
        
        if (toast && toastBody) {
            // Set message
            toastBody.textContent = message;
            
            // Set toast type
            toast.className = 'toast';
            toast.classList.add(`bg-${type === 'error' ? 'danger' : type}`);
            if (type === 'error' || type === 'danger') {
                toast.classList.add('text-white');
            }
            
            // Show the toast
            const bsToast = new bootstrap.Toast(toast);
            bsToast.show();
        } else {
            // Fallback to alert if toast elements don't exist
            alert(message);
        }
    }
    
    // Basic export function
    async function performExport() {
        console.log('Simple export helper called');
        showLoadingOverlay(true);
        
        try {
            const response = await fetch('/api/export', { method: 'POST' });
            if (!response.ok) {
                throw new Error(`HTTP error ${response.status}: ${response.statusText}`);
            }
            
            // Get the blob data
            const blob = await response.blob();
            
            // Create object URL
            const url = window.URL.createObjectURL(blob);
            
            // Create download link
            const link = document.createElement('a');
            link.href = url;
            link.download = 'audiobooks_export.json';
            document.body.appendChild(link);
            link.click();
            document.body.removeChild(link);
            
            // Clean up
            window.URL.revokeObjectURL(url);
            showToastNotification('Export successful', 'success');
            console.log('Simple export completed successfully');
        } catch (error) {
            console.error('Simple export failed:', error);
            showToastNotification(`Export failed: ${error.message}`, 'error');
        } finally {
            showLoadingOverlay(false);
        }
    }
    
    // Expose function to global scope
    window.simpleExport = performExport;
    
    // Log that this module is loaded
    console.log('Export helper module loaded, window.simpleExport is available');
})();
