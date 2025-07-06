/**
 * AudioStacker Utility Functions
 * Common utility functions used throughout the application
 */

/**
 * Debounce function to limit how often a function can be called
 */
function debounce(func, wait, immediate) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            timeout = null;
            if (!immediate) func(...args);
        };
        const callNow = immediate && !timeout;
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
        if (callNow) func(...args);
    };
}

/**
 * Throttle function to limit execution frequency
 */
function throttle(func, limit) {
    let inThrottle;
    return function() {
        const args = arguments;
        const context = this;
        if (!inThrottle) {
            func.apply(context, args);
            inThrottle = true;
            setTimeout(() => inThrottle = false, limit);
        }
    };
}

/**
 * Escape HTML to prevent XSS
 */
function escapeHtml(text) {
    if (text === null || text === undefined) return '';
    const map = {
        '&': '&amp;',
        '<': '&lt;',
        '>': '&gt;',
        '"': '&quot;',
        "'": '&#039;'
    };
    return String(text).replace(/[&<>"']/g, m => map[m]);
}

/**
 * Sanitize string for use as HTML ID or class name
 * Creates a unique ID by combining sanitized text with a hash
 */
function sanitizeId(str) {
    const sanitized = String(str).replace(/[^a-zA-Z0-9]/g, '');
    // Create a simple hash to ensure uniqueness
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    // Use absolute value and convert to base 36 for shorter ID
    const hashStr = Math.abs(hash).toString(36);
    return sanitized + '_' + hashStr;
}

/**
 * Generate unique ID
 */
function generateId(prefix = 'id') {
    return `${prefix}-${Date.now()}-${Math.random().toString(36).substr(2, 9)}`;
}

/**
 * Generate a unique ID for an author that's consistent across renders
 * but truly unique for different authors
 */
function generateAuthorId(authorName) {
    // Create a hash-based ID that's consistent for the same author name
    // but unique enough to avoid collisions
    let hash = 0;
    const str = 'author_' + authorName; // Add prefix to avoid collisions with other elements
    
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash & hash; // Convert to 32-bit integer
    }
    
    // Use absolute value and convert to base 36, with additional suffix for uniqueness
    const baseId = 'author_' + Math.abs(hash).toString(36);
    
    // Add length as extra uniqueness factor
    const lengthSuffix = authorName.length.toString(36);
    
    return baseId + '_' + lengthSuffix;
}

/**
 * Deep clone an object
 */
function deepClone(obj) {
    if (obj === null || typeof obj !== 'object') return obj;
    if (obj instanceof Date) return new Date(obj.getTime());
    if (obj instanceof Array) return obj.map(item => deepClone(item));
    if (typeof obj === 'object') {
        const clonedObj = {};
        for (const key in obj) {
            if (obj.hasOwnProperty(key)) {
                clonedObj[key] = deepClone(obj[key]);
            }
        }
        return clonedObj;
    }
    return obj;
}

/**
 * Check if object is empty
 */
function isEmpty(obj) {
    if (obj === null || obj === undefined) return true;
    if (typeof obj === 'string' || Array.isArray(obj)) return obj.length === 0;
    if (typeof obj === 'object') return Object.keys(obj).length === 0;
    return false;
}

/**
 * Format date string
 */
function formatDate(date, format = 'YYYY-MM-DD HH:mm:ss') {
    const d = new Date(date);
    if (isNaN(d.getTime())) return '';
    
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const hours = String(d.getHours()).padStart(2, '0');
    const minutes = String(d.getMinutes()).padStart(2, '0');
    const seconds = String(d.getSeconds()).padStart(2, '0');
    
    return format
        .replace('YYYY', year)
        .replace('MM', month)
        .replace('DD', day)
        .replace('HH', hours)
        .replace('mm', minutes)
        .replace('ss', seconds);
}

/**
 * Capitalize first letter of each word
 */
function titleCase(str) {
    return String(str).replace(/\w\S*/g, txt => 
        txt.charAt(0).toUpperCase() + txt.substr(1).toLowerCase()
    );
}

/**
 * Get initials from name
 */
function getInitials(name, maxLength = 2) {
    if (!name) return '';
    return name
        .split(/\s+/)
        .map(word => word.charAt(0).toUpperCase())
        .slice(0, maxLength)
        .join('');
}

/**
 * Check if book is complete (has all required fields)
 */
function isBookComplete(book) {
    return !!(
        book.title &&
        book.series &&
        book.publisher &&
        book.narrator &&
        book.narrator.length > 0 &&
        book.narrator.every(n => n && n.trim())
    );
}

/**
 * Validate email format
 */
function isValidEmail(email) {
    const re = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return re.test(email);
}

/**
 * Download data as file
 */
function downloadFile(data, filename, type = 'application/json') {
    const blob = new Blob([data], { type });
    const url = window.URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = filename;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    window.URL.revokeObjectURL(url);
}

/**
 * Read file as text
 */
function readFileAsText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = event => resolve(event.target.result);
        reader.onerror = error => reject(error);
        reader.readAsText(file);
    });
}

/**
 * Local storage helpers with error handling
 */
const storage = {
    get(key, defaultValue = null) {
        try {
            const item = localStorage.getItem(key);
            return item ? JSON.parse(item) : defaultValue;
        } catch (error) {
            console.warn('Failed to get from localStorage:', error);
            return defaultValue;
        }
    },
    
    set(key, value) {
        try {
            localStorage.setItem(key, JSON.stringify(value));
            return true;
        } catch (error) {
            console.warn('Failed to save to localStorage:', error);
            return false;
        }
    },
    
    remove(key) {
        try {
            localStorage.removeItem(key);
            return true;
        } catch (error) {
            console.warn('Failed to remove from localStorage:', error);
            return false;
        }
    }
};

/**
 * URL helpers
 */
const url = {
    getParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        return urlParams.get(name);
    },
    
    setParam(name, value) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.set(name, value);
        const newUrl = `${window.location.pathname}?${urlParams.toString()}`;
        window.history.replaceState({}, '', newUrl);
    },
    
    removeParam(name) {
        const urlParams = new URLSearchParams(window.location.search);
        urlParams.delete(name);
        const newUrl = urlParams.toString() ? 
            `${window.location.pathname}?${urlParams.toString()}` : 
            window.location.pathname;
        window.history.replaceState({}, '', newUrl);
    }
};

/**
 * Animation helpers
 */
const animate = {
    fadeIn(element, duration = 300) {
        element.style.opacity = '0';
        element.style.display = 'block';
        
        let start = null;
        function step(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            element.style.opacity = Math.min(progress / duration, 1);
            
            if (progress < duration) {
                requestAnimationFrame(step);
            }
        }
        requestAnimationFrame(step);
    },
    
    fadeOut(element, duration = 300) {
        let start = null;
        function step(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            element.style.opacity = Math.max(1 - progress / duration, 0);
            
            if (progress < duration) {
                requestAnimationFrame(step);
            } else {
                element.style.display = 'none';
            }
        }
        requestAnimationFrame(step);
    },
    
    slideDown(element, duration = 300) {
        element.style.height = '0px';
        element.style.overflow = 'hidden';
        element.style.display = 'block';
        
        const targetHeight = element.scrollHeight;
        let start = null;
        
        function step(timestamp) {
            if (!start) start = timestamp;
            const progress = timestamp - start;
            const height = Math.min((progress / duration) * targetHeight, targetHeight);
            element.style.height = height + 'px';
            
            if (progress < duration) {
                requestAnimationFrame(step);
            } else {
                element.style.height = 'auto';
                element.style.overflow = 'visible';
            }
        }
        requestAnimationFrame(step);
    }
};

/**
 * Form validation helpers
 */
const validation = {
    required(value) {
        return value !== null && value !== undefined && value.toString().trim() !== '';
    },
    
    minLength(value, min) {
        return value && value.toString().length >= min;
    },
    
    maxLength(value, max) {
        return !value || value.toString().length <= max;
    },
    
    pattern(value, regex) {
        return !value || regex.test(value.toString());
    }
};

/**
 * Loading state management
 */
function showLoading(show = true) {
    const overlay = document.getElementById('loading-overlay');
    if (overlay) {
        overlay.classList.toggle('show', show);
    }
}

/**
 * Global error handler
 */
window.addEventListener('error', function(event) {
    console.error('Global error:', event.error);
    showToast('An unexpected error occurred', 'error');
});

window.addEventListener('unhandledrejection', function(event) {
    console.error('Unhandled promise rejection:', event.reason);
    showToast('An unexpected error occurred', 'error');
});

/**
 * Get audiobooks data with backwards compatibility
 * Handles both old format (data.audiobooks.author) and new format (direct authors)
 */
function getAudiobooksData(data) {
    if (!data) return {};
    
    // If data has audiobooks.author structure (old format), extract it
    if (data.audiobooks && data.audiobooks.author) {
        return data.audiobooks.author;
    }
    
    // Otherwise assume it's the new direct format
    return data;
}

// Export utilities to global scope
window.utils = {
    debounce,
    throttle,
    escapeHtml,
    sanitizeId,
    generateId,
    generateAuthorId,
    deepClone,
    isEmpty,
    formatDate,
    titleCase,
    getInitials,
    isBookComplete,
    isValidEmail,
    downloadFile,
    readFileAsText,
    storage,
    url,
    animate,
    validation,
    showLoading,
    getAudiobooksData
};

// Export commonly used functions to global scope for backward compatibility
window.escapeHtml = escapeHtml;
window.isBookComplete = isBookComplete;
window.generateId = generateId;
window.deepClone = deepClone;
window.getAudiobooksData = getAudiobooksData;
