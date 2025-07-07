/**
 * Module Check Script
 * This script checks the loading status of all required modules
 */

// Record module loading
window.moduleStatus = window.moduleStatus || {
    modules: {}
};

// Register a module as loaded
function registerModule(name) {
    window.moduleStatus.modules[name] = {
        loaded: true,
        timestamp: new Date().getTime()
    };
    console.log(`Module loaded: ${name}`);
}

// Check if all required modules are loaded
function checkAllModules() {
    const requiredModules = [
        'api',
        'utils',
        'state',
        'search',
        'filters',
        'modals',
        'toast',
        'theme',
        'app'
    ];
    
    const loadedModules = Object.keys(window.moduleStatus.modules);
    const missingModules = requiredModules.filter(m => !loadedModules.includes(m));
    
    console.log('Module loading status:');
    console.table(window.moduleStatus.modules);
    
    if (missingModules.length > 0) {
        console.warn(`Missing modules: ${missingModules.join(', ')}`);
    } else {
        console.log('All required modules loaded successfully');
    }
    
    // Check global objects
    console.log('Global objects status:');
    console.log('window.api:', !!window.api);
    console.log('window.app:', !!window.app);
    console.log('window.state:', !!window.state);
    console.log('window.toast:', !!window.toast);
    console.log('window.modals:', !!window.modals);
}

// Check export functionality
function checkExportFunctionality() {
    console.log('Export functionality check:');
    console.log('exportCollection function exists:', typeof window.exportCollection === 'function');
    console.log('window.api.exportCollection exists:', window.api && typeof window.api.exportCollection === 'function');
    console.log('window.app.exportCollection exists:', window.app && typeof window.app.exportCollection === 'function');
    console.log('directExport function exists:', typeof window.directExport === 'function');
}

// Register this module
registerModule('module-check');

// Run checks when DOM is loaded
document.addEventListener('DOMContentLoaded', () => {
    console.log('DOM loaded, running module checks...');
    setTimeout(() => {
        checkAllModules();
        checkExportFunctionality();
    }, 1000); // Wait 1 second to ensure all modules have been loaded
});

// Add window.checkModules function for manual checking
window.checkModules = function() {
    checkAllModules();
    checkExportFunctionality();
};

// Add a direct export function that uses fetch directly
window.exportDirectly = async function() {
    console.log('Direct export via fetch called');
    try {
        showLoading(true);
        
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
        
        showToast('Collection exported successfully via direct fetch', 'success');
        return true;
    } catch (error) {
        console.error('Direct export via fetch failed:', error);
        showToast(`Export failed: ${error.message}`, 'error');
        return false;
    } finally {
        showLoading(false);
    }
};
