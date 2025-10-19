/**
 * Input Validator Module
 * 
 * Comprehensive input validation using popular libraries
 * Leverages validator.js for common validations
 */

interface ValidationRule {
    type: 'email' | 'url' | 'ip' | 'uuid' | 'alphanumeric' | 'numeric' | 'alpha' | 'json' | 'jwt' | 'custom';
    required?: boolean;
    minLength?: number;
    maxLength?: number;
    pattern?: RegExp;
    customValidator?: (value: any) => boolean;
    sanitize?: boolean;
}

interface ValidationResult {
    isValid: boolean;
    errors: string[];
    sanitizedValue?: any;
}

class InputValidator {
    /**
     * Validate input against rules
     */
    validate(input: any, rules: ValidationRule): ValidationResult {
        const result: ValidationResult = {
            isValid: true,
            errors: [],
            sanitizedValue: input,
        };

        // Check required
        if (rules.required && (input === null || input === undefined || input === '')) {
            result.isValid = false;
            result.errors.push('Field is required');
            return result;
        }

        // Skip validation if input is empty and not required
        if (!input && !rules.required) {
            return result;
        }

        const value = String(input);

        // Length validation
        if (rules.minLength && value.length < rules.minLength) {
            result.isValid = false;
            result.errors.push(`Minimum length is ${rules.minLength}`);
        }

        if (rules.maxLength && value.length > rules.maxLength) {
            result.isValid = false;
            result.errors.push(`Maximum length is ${rules.maxLength}`);
        }

        // Type validation
        switch (rules.type) {
            case 'email':
                if (!this.isEmail(value)) {
                    result.isValid = false;
                    result.errors.push('Invalid email format');
                }
                break;

            case 'url':
                if (!this.isURL(value)) {
                    result.isValid = false;
                    result.errors.push('Invalid URL format');
                }
                break;

            case 'ip':
                if (!this.isIP(value)) {
                    result.isValid = false;
                    result.errors.push('Invalid IP address');
                }
                break;

            case 'uuid':
                if (!this.isUUID(value)) {
                    result.isValid = false;
                    result.errors.push('Invalid UUID format');
                }
                break;

            case 'alphanumeric':
                if (!/^[a-zA-Z0-9]+$/.test(value)) {
                    result.isValid = false;
                    result.errors.push('Must be alphanumeric');
                }
                break;

            case 'numeric':
                if (!/^[0-9]+$/.test(value)) {
                    result.isValid = false;
                    result.errors.push('Must be numeric');
                }
                break;

            case 'alpha':
                if (!/^[a-zA-Z]+$/.test(value)) {
                    result.isValid = false;
                    result.errors.push('Must contain only letters');
                }
                break;

            case 'json':
                try {
                    JSON.parse(value);
                } catch {
                    result.isValid = false;
                    result.errors.push('Invalid JSON format');
                }
                break;

            case 'jwt':
                if (!this.isJWT(value)) {
                    result.isValid = false;
                    result.errors.push('Invalid JWT format');
                }
                break;

            case 'custom':
                if (rules.customValidator && !rules.customValidator(value)) {
                    result.isValid = false;
                    result.errors.push('Custom validation failed');
                }
                break;
        }

        // Pattern validation
        if (rules.pattern && !rules.pattern.test(value)) {
            result.isValid = false;
            result.errors.push('Does not match required pattern');
        }

        // Sanitization
        if (rules.sanitize && result.isValid) {
            result.sanitizedValue = this.sanitize(value, rules.type);
        }

        return result;
    }

    /**
     * Validate multiple fields
     */
    validateFields(data: Record<string, any>, rules: Record<string, ValidationRule>): {
        isValid: boolean;
        errors: Record<string, string[]>;
        sanitizedData: Record<string, any>;
    } {
        const errors: Record<string, string[]> = {};
        const sanitizedData: Record<string, any> = {};
        let isValid = true;

        for (const [field, rule] of Object.entries(rules)) {
            const result = this.validate(data[field], rule);
            
            if (!result.isValid) {
                errors[field] = result.errors;
                isValid = false;
            }
            
            sanitizedData[field] = result.sanitizedValue;
        }

        return { isValid, errors, sanitizedData };
    }

    // Validation helpers (basic implementations - use validator.js in production)
    private isEmail(value: string): boolean {
        return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value);
    }

    private isURL(value: string): boolean {
        try {
            new URL(value);
            return true;
        } catch {
            return false;
        }
    }

    private isIP(value: string): boolean {
        // IPv4
        const ipv4 = /^(\d{1,3}\.){3}\d{1,3}$/;
        if (ipv4.test(value)) {
            return value.split('.').every(part => parseInt(part) <= 255);
        }
        // IPv6 (basic check)
        return /^([0-9a-fA-F]{1,4}:){7}[0-9a-fA-F]{1,4}$/.test(value);
    }

    private isUUID(value: string): boolean {
        return /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(value);
    }

    private isJWT(value: string): boolean {
        return /^[A-Za-z0-9-_]+\.[A-Za-z0-9-_]+\.[A-Za-z0-9-_]*$/.test(value);
    }

    private sanitize(value: string, type: string): string {
        // Basic sanitization - trim whitespace
        let sanitized = value.trim();

        // Type-specific sanitization
        switch (type) {
            case 'email':
                sanitized = sanitized.toLowerCase();
                break;
            case 'alphanumeric':
                sanitized = sanitized.replace(/[^a-zA-Z0-9]/g, '');
                break;
            case 'numeric':
                sanitized = sanitized.replace(/[^0-9]/g, '');
                break;
            case 'alpha':
                sanitized = sanitized.replace(/[^a-zA-Z]/g, '');
                break;
        }

        return sanitized;
    }
}

export default InputValidator;
