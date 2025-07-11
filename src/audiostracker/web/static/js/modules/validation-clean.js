/**
 * ValidationModule - Modular validation utilities with modern browser APIs
 * Handles real-time validation, field error management, and accessibility
 */

class ValidationModule extends window.BaseModule {
    constructor(core) {
        super(core);
        this.validators = new Map();
        this.debounceTimers = new Map();
        this.performanceObserver = null;
        this.intersectionObserver = null;
        this.abortController = new AbortController();
    }

    init() {
        this.validationRules = {
            title: {
                required: true,
                minLength: 1,
                maxLength: 500,
                pattern: /^[a-zA-Z0-9\s\-_.,!?'"()]+$/,
                message: 'Title is required and must be valid text'
            },
            series: {
                required: false,
                minLength: 0,
                maxLength: 200,
                pattern: /^[a-zA-Z0-9\s\-_.,!?'"()]*$/
            },
            publisher: {
                required: false,
                minLength: 0,
                maxLength: 100,
                pattern: /^[a-zA-Z0-9\s\-_.,&'"()]*$/
            },
            narrator: {
                required: false,
                minLength: 0,
                maxLength: 200,
                validateArray: true,
                pattern: /^[a-zA-Z\s\-_.,'"()]*$/
            },
            email: {
                required: false,
                pattern: /^[^\s@]+@[^\s@]+\.[^\s@]+$/,
                message: 'Please enter a valid email address'
            },
            url: {
                required: false,
                pattern: /^https?:\/\/.+/,
                message: 'Please enter a valid URL starting with http:// or https://'
            }
        };

        this.setupEventListeners();
        this.setupPerformanceMonitoring();
        this.setupIntersectionObserver();
        this.log('ValidationModule initialized with enhanced features');
    }

    setupEventListeners() {
        const signal = this.abortController.signal;
        
        // Listen for validation requests
        this.core.on('validate:field', (data) => {
            const result = this.validateField(data.fieldName, data.value, data.context);
            this.core.emit('validation:result', {
                fieldName: data.fieldName,
                result: result
            });
        });

        this.core.on('validate:form', (data) => {
            const result = this.validateForm(data.formData, data.context);
            this.core.emit('validation:form-result', {
                formData: data.formData,
                result: result
            });
        });

        // Listen for form submission attempts
        document.addEventListener('submit', (e) => {
            this.handleFormSubmission(e);
        }, { signal });

        // Global input validation with debouncing
        document.addEventListener('input', (e) => {
            if (e.target.matches('[data-validate]')) {
                this.handleRealtimeValidation(e.target);
            }
        }, { signal });

        // Blur validation for immediate feedback
        document.addEventListener('blur', (e) => {
            if (e.target.matches('[data-validate]')) {
                this.validateFieldElement(e.target);
            }
        }, { signal, capture: true });
    }

    setupPerformanceMonitoring() {
        if ('PerformanceObserver' in window) {
            this.performanceObserver = new PerformanceObserver((list) => {
                for (const entry of list.getEntries()) {
                    if (entry.name.includes('validation') && entry.duration > 50) {
                        this.log(`Slow validation detected: ${entry.name} took ${entry.duration}ms`);
                    }
                }
            });
            
            this.performanceObserver.observe({ entryTypes: ['measure', 'mark'] });
        }
    }

    setupIntersectionObserver() {
        if ('IntersectionObserver' in window) {
            this.intersectionObserver = new IntersectionObserver((entries) => {
                entries.forEach((entry) => {
                    if (entry.isIntersecting && entry.target.matches('[data-validate-on-visible]')) {
                        this.validateFieldElement(entry.target);
                    }
                });
            }, { threshold: 0.5 });
        }
    }

    /**
     * Validate a single field value with enhanced rules
     */
    validateField(fieldName, value, context = {}) {
        performance.mark(`validation-${fieldName}-start`);
        
        const rule = this.validationRules[fieldName];
        if (!rule) {
            performance.mark(`validation-${fieldName}-end`);
            performance.measure(`validation-${fieldName}`, `validation-${fieldName}-start`, `validation-${fieldName}-end`);
            return { isValid: true, errors: [], warnings: [] };
        }

        const errors = [];
        const warnings = [];
        
        // Required validation
        if (rule.required && (!value || (typeof value === 'string' && value.trim() === ''))) {
            errors.push(rule.message || `${this.humanizeFieldName(fieldName)} is required`);
        }
        
        // Skip other validations if empty and not required
        if (!value || (typeof value === 'string' && value.trim() === '')) {
            performance.mark(`validation-${fieldName}-end`);
            performance.measure(`validation-${fieldName}`, `validation-${fieldName}-start`, `validation-${fieldName}-end`);
            return { isValid: errors.length === 0, errors, warnings };
        }

        // Length validations
        if (rule.minLength && value.length < rule.minLength) {
            errors.push(`${this.humanizeFieldName(fieldName)} must be at least ${rule.minLength} characters`);
        }
        
        if (rule.maxLength && value.length > rule.maxLength) {
            errors.push(`${this.humanizeFieldName(fieldName)} must be no more than ${rule.maxLength} characters`);
        }

        // Pattern validation
        if (rule.pattern && !rule.pattern.test(value)) {
            errors.push(rule.message || `${this.humanizeFieldName(fieldName)} contains invalid characters`);
        }

        // Custom validation function
        if (rule.customValidator && typeof rule.customValidator === 'function') {
            const customResult = rule.customValidator(value, context);
            if (customResult.errors) errors.push(...customResult.errors);
            if (customResult.warnings) warnings.push(...customResult.warnings);
        }
        
        // Array validation for fields like narrator
        if (rule.validateArray && Array.isArray(value)) {
            if (rule.required && value.length === 0) {
                errors.push(`${this.humanizeFieldName(fieldName)} is required`);
            }
            
            // Validate each item in array
            value.forEach((item, index) => {
                if (typeof item === 'string') {
                    if (item.trim() === '') {
                        errors.push(`${this.humanizeFieldName(fieldName)} item ${index + 1} cannot be empty`);
                    } else if (rule.pattern && !rule.pattern.test(item)) {
                        errors.push(`${this.humanizeFieldName(fieldName)} item ${index + 1} contains invalid characters`);
                    }
                }
            });
        }

        // Add performance warning if validation is slow
        if (rule.maxLength && rule.maxLength > 1000 && value.length > 500) {
            warnings.push('Large input detected - consider optimizing');
        }

        performance.mark(`validation-${fieldName}-end`);
        performance.measure(`validation-${fieldName}`, `validation-${fieldName}-start`, `validation-${fieldName}-end`);

        return {
            isValid: errors.length === 0,
            errors: errors,
            warnings: warnings
        };
    }

    /**
     * Validate an entire form
     */
    validateForm(formData, context = {}) {
        const results = {};
        let isFormValid = true;

        for (const [fieldName, value] of Object.entries(formData)) {
            const result = this.validateField(fieldName, value, context);
            results[fieldName] = result;
            if (!result.isValid) {
                isFormValid = false;
            }
        }

        return {
            isValid: isFormValid,
            fields: results,
            errors: this.getFlatErrors(results)
        };
    }

    /**
     * Get flat array of all errors
     */
    getFlatErrors(validationResults) {
        const errors = [];
        for (const [fieldName, result] of Object.entries(validationResults)) {
            if (!result.isValid) {
                errors.push(...result.errors);
            }
        }
        return errors;
    }

    /**
     * Show field validation error with enhanced accessibility
     */
    showFieldError(fieldName, errors) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (!field) return;

        // Remove existing validation states
        this.clearFieldValidationState(fieldName);

        // Add error state
        field.classList.add('is-invalid');
        field.setAttribute('aria-invalid', 'true');

        // Create or update error message
        let errorDiv = document.getElementById(`${fieldName}-error`);
        if (!errorDiv) {
            errorDiv = document.createElement('div');
            errorDiv.className = 'invalid-feedback';
            errorDiv.id = `${fieldName}-error`;
            errorDiv.setAttribute('role', 'alert');
            errorDiv.setAttribute('aria-live', 'assertive');
            field.parentNode.insertBefore(errorDiv, field.nextSibling);
        }
        
        errorDiv.innerHTML = `<i class="fas fa-exclamation-circle me-1" aria-hidden="true"></i>${errors.join(', ')}`;
        
        // Update aria-describedby
        const describedBy = field.getAttribute('aria-describedby') || '';
        if (!describedBy.includes(errorDiv.id)) {
            field.setAttribute('aria-describedby', `${describedBy} ${errorDiv.id}`.trim());
        }
    }

    /**
     * Clear field validation error
     */
    clearFieldError(fieldName) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (field) {
            field.classList.remove('is-invalid');
            field.removeAttribute('aria-invalid');
        }

        const errorDiv = document.getElementById(`${fieldName}-error`);
        if (errorDiv) {
            // Clean up aria-describedby
            if (field) {
                const describedBy = field.getAttribute('aria-describedby') || '';
                const newDescribedBy = describedBy.replace(errorDiv.id, '').trim();
                if (newDescribedBy) {
                    field.setAttribute('aria-describedby', newDescribedBy);
                } else {
                    field.removeAttribute('aria-describedby');
                }
            }
            errorDiv.remove();
        }
    }

    /**
     * Clear all validation states for a field
     */
    clearFieldValidationState(fieldName) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (field) {
            field.classList.remove('is-invalid', 'is-valid');
            field.removeAttribute('aria-invalid');
        }

        // Remove all validation feedback elements
        const validationElements = document.querySelectorAll(`#${fieldName}-error, #${fieldName}-warning, .validation-success-icon`);
        validationElements.forEach(el => el.remove());
    }

    /**
     * Clear all validation errors
     */
    clearAllErrors() {
        // Clear field-level errors
        document.querySelectorAll('.is-invalid').forEach(field => {
            field.classList.remove('is-invalid');
            field.removeAttribute('aria-invalid');
        });
        
        document.querySelectorAll('.invalid-feedback, .validation-warning, .validation-success-icon').forEach(errorDiv => {
            errorDiv.remove();
        });

        // Clear form-level error summary
        document.querySelectorAll('.form-error-summary').forEach(summary => {
            summary.remove();
        });

        // Clear aria-describedby attributes
        document.querySelectorAll('[aria-describedby]').forEach(element => {
            const describedBy = element.getAttribute('aria-describedby');
            if (describedBy && describedBy.includes('-error')) {
                element.removeAttribute('aria-describedby');
            }
        });
    }

    /**
     * Setup real-time validation for a form
     */
    setupRealtimeValidation(formSelector) {
        const form = document.querySelector(formSelector);
        if (!form) return;

        // Add validation on blur for each input
        form.querySelectorAll('input, textarea, select').forEach(field => {
            field.addEventListener('blur', () => {
                const value = field.value;
                const fieldName = field.name || field.id;
                
                const result = this.validateField(fieldName, value);
                
                if (result.isValid) {
                    this.clearFieldError(fieldName);
                } else {
                    this.showFieldError(fieldName, result.errors);
                }
            });

            // Clear errors on input
            field.addEventListener('input', () => {
                const fieldName = field.name || field.id;
                this.clearFieldError(fieldName);
            });
        });
    }

    /**
     * Add custom validation rule
     */
    addValidationRule(fieldName, rule) {
        this.validationRules[fieldName] = { ...this.validationRules[fieldName], ...rule };
    }

    /**
     * Handle realtime validation with debouncing
     */
    handleRealtimeValidation(element) {
        const fieldName = element.name || element.id;
        const debounceKey = `${fieldName}-${element.type}`;
        
        // Clear existing timer
        if (this.debounceTimers.has(debounceKey)) {
            clearTimeout(this.debounceTimers.get(debounceKey));
        }
        
        // Set new timer
        const timer = setTimeout(() => {
            this.validateFieldElement(element);
            this.debounceTimers.delete(debounceKey);
        }, element.type === 'email' || element.type === 'url' ? 800 : 300);
        
        this.debounceTimers.set(debounceKey, timer);
    }

    /**
     * Validate a DOM element
     */
    validateFieldElement(element) {
        const fieldName = element.name || element.id;
        const value = element.type === 'checkbox' ? element.checked : element.value;
        
        const result = this.validateField(fieldName, value);
        
        if (result.isValid) {
            this.clearFieldError(fieldName);
            this.showFieldSuccess(fieldName);
        } else {
            this.showFieldError(fieldName, result.errors);
        }
        
        // Show warnings separately
        if (result.warnings && result.warnings.length > 0) {
            this.showFieldWarning(fieldName, result.warnings);
        }
        
        // Announce validation result to screen readers
        this.announceValidationResult(element, result);
    }

    /**
     * Handle form submission with comprehensive validation
     */
    handleFormSubmission(event) {
        const form = event.target;
        if (!form.hasAttribute('data-validate-form')) return;
        
        const formData = new FormData(form);
        const dataObject = Object.fromEntries(formData.entries());
        
        const result = this.validateForm(dataObject);
        
        if (!result.isValid) {
            event.preventDefault();
            
            // Focus first invalid field
            const firstError = Object.keys(result.fields).find(key => !result.fields[key].isValid);
            if (firstError) {
                const element = form.querySelector(`[name="${firstError}"], #${firstError}`);
                if (element) {
                    element.focus();
                    element.scrollIntoView({ behavior: 'smooth', block: 'center' });
                }
            }
            
            // Show summary of errors
            this.showFormErrors(form, result.errors);
        }
    }

    /**
     * Show field success state
     */
    showFieldSuccess(fieldName) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (!field) return;

        field.classList.remove('is-invalid');
        field.classList.add('is-valid');
        
        // Add success icon
        const successIcon = field.parentNode.querySelector('.validation-success-icon');
        if (!successIcon) {
            const icon = document.createElement('span');
            icon.className = 'validation-success-icon text-success ms-2';
            icon.innerHTML = '<i class="fas fa-check-circle" aria-hidden="true"></i>';
            icon.setAttribute('title', 'Valid input');
            field.parentNode.appendChild(icon);
        }
    }

    /**
     * Show field warning state
     */
    showFieldWarning(fieldName, warnings) {
        const field = document.querySelector(`[name="${fieldName}"], #${fieldName}`);
        if (!field) return;

        // Create or update warning message
        let warningDiv = document.getElementById(`${fieldName}-warning`);
        if (!warningDiv) {
            warningDiv = document.createElement('div');
            warningDiv.className = 'validation-warning text-warning small mt-1';
            warningDiv.id = `${fieldName}-warning`;
            warningDiv.setAttribute('role', 'status');
            warningDiv.setAttribute('aria-live', 'polite');
            field.parentNode.insertBefore(warningDiv, field.nextSibling);
        }
        
        warningDiv.innerHTML = `<i class="fas fa-exclamation-triangle me-1" aria-hidden="true"></i>${warnings.join(', ')}`;
    }

    /**
     * Announce validation results to screen readers
     */
    announceValidationResult(element, result) {
        const announcement = element.getAttribute('aria-describedby');
        let announceElement = announcement ? document.getElementById(announcement) : null;
        
        if (!announceElement) {
            announceElement = document.createElement('div');
            announceElement.id = `${element.id || element.name}-validation-announce`;
            announceElement.className = 'sr-only';
            announceElement.setAttribute('aria-live', 'polite');
            announceElement.setAttribute('aria-atomic', 'true');
            element.parentNode.appendChild(announceElement);
            element.setAttribute('aria-describedby', announceElement.id);
        }
        
        if (result.isValid) {
            announceElement.textContent = `${this.humanizeFieldName(element.name || element.id)} is valid`;
        } else {
            announceElement.textContent = `${this.humanizeFieldName(element.name || element.id)} has errors: ${result.errors.join(', ')}`;
        }
    }

    /**
     * Show form-level error summary
     */
    showFormErrors(form, errors) {
        let errorSummary = form.querySelector('.form-error-summary');
        if (!errorSummary) {
            errorSummary = document.createElement('div');
            errorSummary.className = 'form-error-summary alert alert-danger';
            errorSummary.setAttribute('role', 'alert');
            errorSummary.setAttribute('aria-live', 'assertive');
            form.insertBefore(errorSummary, form.firstChild);
        }
        
        errorSummary.innerHTML = `
            <h6 class="alert-heading"><i class="fas fa-exclamation-triangle me-2"></i>Please correct the following errors:</h6>
            <ul class="mb-0">
                ${errors.map(error => `<li>${error}</li>`).join('')}
            </ul>
        `;
        
        errorSummary.scrollIntoView({ behavior: 'smooth', block: 'center' });
    }

    /**
     * Convert field names to human-readable format
     */
    humanizeFieldName(fieldName) {
        return fieldName
            .replace(/([A-Z])/g, ' $1')
            .replace(/^./, str => str.toUpperCase())
            .replace(/_/g, ' ')
            .replace(/-/g, ' ');
    }

    /**
     * Advanced validation features
     */
    
    observeFieldVisibility(fieldSelector) {
        if (!this.intersectionObserver) return;
        
        const fields = document.querySelectorAll(fieldSelector);
        fields.forEach(field => {
            field.setAttribute('data-validate-on-visible', 'true');
            this.intersectionObserver.observe(field);
        });
    }

    addAsyncValidator(fieldName, validatorFn) {
        this.validators.set(fieldName, validatorFn);
    }

    async validateFieldAsync(fieldName, value) {
        const validator = this.validators.get(fieldName);
        if (!validator) return { isValid: true, errors: [] };
        
        try {
            const result = await validator(value);
            return result;
        } catch (error) {
            return { isValid: false, errors: [`Validation error: ${error.message}`] };
        }
    }

    /**
     * Enhanced cleanup
     */
    async destroy() {
        // Clear all timers
        this.debounceTimers.forEach(timer => clearTimeout(timer));
        this.debounceTimers.clear();
        
        // Disconnect observers
        if (this.performanceObserver) {
            this.performanceObserver.disconnect();
        }
        
        if (this.intersectionObserver) {
            this.intersectionObserver.disconnect();
        }
        
        // Abort any pending operations
        this.abortController.abort();
        
        // Clear validators
        this.validators.clear();
        
        await super.destroy();
    }
}

// Register the module
if (typeof window !== 'undefined') {
    window.ValidationModule = ValidationModule;
}

// Export for ES6 modules
if (typeof module !== 'undefined' && module.exports) {
    module.exports = ValidationModule;
}
