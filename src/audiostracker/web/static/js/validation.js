/**
 * AudioStacker Validation Utilities
 * Handles real-time validation and field error management
 */

class ValidationManager {
    constructor() {
        this.validationRules = {
            title: {
                required: true,
                minLength: 1,
                message: 'Title is required'
            },
            series: {
                required: false,
                minLength: 0
            },
            publisher: {
                required: false,
                minLength: 0
            },
            narrator: {
                required: false,
                minLength: 0,
                validateArray: true
            }
        };
    }

    /**
     * Validate a single field value
     */
    validateField(fieldName, value, context = {}) {
        const rule = this.validationRules[fieldName];
        if (!rule) {
            return { isValid: true, errors: [] };
        }

        const errors = [];
        
        // Required validation
        if (rule.required && (!value || value.trim() === '')) {
            errors.push(rule.message || `${fieldName} is required`);
        }
        
        // Min length validation
        if (rule.minLength && value && value.length < rule.minLength) {
            errors.push(`${fieldName} must be at least ${rule.minLength} characters`);
        }
        
        // Array validation for narrator field
        if (rule.validateArray && Array.isArray(value)) {
            const nonEmptyNarrators = value.filter(n => n && n.trim());
            if (rule.required && nonEmptyNarrators.length === 0) {
                errors.push('At least one narrator is required');
            }
        }

        return {
            isValid: errors.length === 0,
            errors: errors
        };
    }

    /**
     * Validate an entire book object
     */
    validateBook(book) {
        const allErrors = [];
        const fieldResults = {};

        // Validate each field
        Object.keys(this.validationRules).forEach(fieldName => {
            const value = book[fieldName];
            const result = this.validateField(fieldName, value);
            fieldResults[fieldName] = result;
            
            if (!result.isValid) {
                allErrors.push(...result.errors);
            }
        });

        return {
            isValid: allErrors.length === 0,
            errors: allErrors,
            fieldResults: fieldResults
        };
    }

    /**
     * Show field error visually
     */
    showFieldError(inputElement, message) {
        if (!inputElement) return;

        // Remove existing error state
        this.clearFieldError(inputElement);
        
        // Add error class
        inputElement.classList.add('field-error');
        
        // Find or create error message element
        let errorElement = inputElement.parentElement.querySelector('.field-error-message');
        if (!errorElement) {
            errorElement = document.createElement('div');
            errorElement.className = 'field-error-message';
            inputElement.parentElement.appendChild(errorElement);
        }
        
        // Set error message
        errorElement.innerHTML = `<i class="fas fa-exclamation-circle"></i>${message}`;
        errorElement.style.display = 'block';
        
        // Add ARIA attributes for accessibility
        inputElement.setAttribute('aria-invalid', 'true');
        inputElement.setAttribute('aria-describedby', errorElement.id || 'field-error');
    }

    /**
     * Clear field error state
     */
    clearFieldError(inputElement) {
        if (!inputElement) return;

        inputElement.classList.remove('field-error');
        
        const errorElement = inputElement.parentElement.querySelector('.field-error-message');
        if (errorElement) {
            errorElement.style.display = 'none';
        }
        
        // Remove ARIA attributes
        inputElement.removeAttribute('aria-invalid');
        inputElement.removeAttribute('aria-describedby');
    }

    /**
     * Real-time field validation on input
     */
    validateFieldRealtime(inputElement, fieldName) {
        if (!inputElement) return;

        const value = inputElement.value;
        const result = this.validateField(fieldName, value);
        
        if (!result.isValid && result.errors.length > 0) {
            this.showFieldError(inputElement, result.errors[0]);
        } else {
            this.clearFieldError(inputElement);
        }
        
        return result;
    }

    /**
     * Validate all visible book forms
     */
    validateAllVisibleBooks() {
        const results = [];
        const bookCards = document.querySelectorAll('.book-card');
        
        bookCards.forEach(card => {
            const bookId = card.id;
            const titleInput = card.querySelector('input[data-field="title"]');
            const seriesInput = card.querySelector('input[data-field="series"]');
            const publisherInput = card.querySelector('input[data-field="publisher"]');
            const narratorInputs = card.querySelectorAll('input[data-field="narrator"]');
            
            const book = {
                title: titleInput?.value || '',
                series: seriesInput?.value || '',
                publisher: publisherInput?.value || '',
                narrator: Array.from(narratorInputs).map(input => input.value || '')
            };
            
            const validation = this.validateBook(book);
            results.push({
                bookId: bookId,
                validation: validation,
                book: book
            });
            
            // Show validation errors
            if (titleInput) {
                const titleResult = validation.fieldResults.title;
                if (!titleResult.isValid) {
                    this.showFieldError(titleInput, titleResult.errors[0]);
                } else {
                    this.clearFieldError(titleInput);
                }
            }
        });
        
        return results;
    }

    /**
     * Get completion percentage for a book
     */
    getCompletionPercentage(book) {
        const requiredFields = ['title'];
        const optionalFields = ['series', 'publisher'];
        
        let completed = 0;
        let total = requiredFields.length;
        
        // Count required fields
        requiredFields.forEach(field => {
            if (book[field] && book[field].trim()) {
                completed++;
            }
        });
        
        // Count optional fields (weighted less)
        optionalFields.forEach(field => {
            if (book[field] && book[field].trim()) {
                completed += 0.5;
                total += 0.5;
            } else {
                total += 0.5;
            }
        });
        
        // Handle narrator field
        if (book.narrator && book.narrator.length > 0 && book.narrator[0].trim()) {
            completed += 0.5;
            total += 0.5;
        } else {
            total += 0.5;
        }
        
        return Math.round((completed / total) * 100);
    }
}

// Global validation manager instance
window.validationManager = new ValidationManager();

// Global validation functions for use in HTML
function validateFieldRealtime(inputElement, required = false) {
    if (!window.app || !window.app.realtimeValidation) {
        return;
    }
    
    const fieldName = inputElement.getAttribute('data-field');
    if (fieldName) {
        return window.validationManager.validateFieldRealtime(inputElement, fieldName);
    }
    
    // Fallback for simple required validation
    if (required) {
        const value = inputElement.value.trim();
        if (!value) {
            window.validationManager.showFieldError(inputElement, 'This field is required');
            return { isValid: false, errors: ['This field is required'] };
        } else {
            window.validationManager.clearFieldError(inputElement);
            return { isValid: true, errors: [] };
        }
    }
    
    return { isValid: true, errors: [] };
}

function validateAllBooks() {
    return window.validationManager.validateAllVisibleBooks();
}

function clearAllValidationErrors() {
    document.querySelectorAll('.field-error').forEach(element => {
        window.validationManager.clearFieldError(element);
    });
}
