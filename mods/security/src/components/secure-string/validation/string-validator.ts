/**
 * String Validator Module
 * Handles validation and analysis of string content
 */ 

import { ValidationResult, StringStatistics } from "../types";

/**
 * Handles string validation and analysis
 */
export class StringValidator {
    /**
     * Validates if a string meets password requirements
     */
    static validatePassword(
        password: string,
        requirements: {
            minLength?: number;
            maxLength?: number;
            requireUppercase?: boolean;
            requireLowercase?: boolean;
            requireNumbers?: boolean;
            requireSpecialChars?: boolean;
            forbiddenPatterns?: RegExp[];
            customRules?: Array<(password: string) => string | null>;
        } = {}
    ): ValidationResult {
        const {
            minLength = 8,
            maxLength = 128,
            requireUppercase = true,
            requireLowercase = true,
            requireNumbers = true,
            requireSpecialChars = true,
            forbiddenPatterns = [],
            customRules = [],
        } = requirements;

        const errors: string[] = [];
        const warnings: string[] = [];

        // Length validation
        if (password.length < minLength) {
            errors.push(`Password must be at least ${minLength} characters long`);
        }
        if (password.length > maxLength) {
            errors.push(`Password must not exceed ${maxLength} characters`);
        }

        // Character type validation
        if (requireUppercase && !/[A-Z]/.test(password)) {
            errors.push("Password must contain at least one uppercase letter");
        }
        if (requireLowercase && !/[a-z]/.test(password)) {
            errors.push("Password must contain at least one lowercase letter");
        }
        if (requireNumbers && !/\d/.test(password)) {
            errors.push("Password must contain at least one number");
        }
        if (requireSpecialChars && !/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) {
            errors.push("Password must contain at least one special character");
        }

        // Forbidden patterns
        for (const pattern of forbiddenPatterns) {
            if (pattern.test(password)) {
                errors.push(`Password contains forbidden pattern: ${pattern.source}`);
            }
        }

        // Common weak patterns
        if (/(.)\1{2,}/.test(password)) {
            warnings.push("Password contains repeated characters");
        }
        if (/123|abc|qwe|asd|zxc/i.test(password)) {
            warnings.push("Password contains common sequences");
        }

        // Custom rules
        for (const rule of customRules) {
            const ruleResult = rule(password);
            if (ruleResult) {
                errors.push(ruleResult);
            }
        }

        // Calculate strength score
        const score = this.calculatePasswordStrength(password);

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
            score,
        };
    }

    /**
     * Validates email format
     */
    static validateEmail(email: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Basic email regex (RFC 5322 compliant)
        const emailRegex = /^[a-zA-Z0-9.!#$%&'*+/=?^_`{|}~-]+@[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?(?:\.[a-zA-Z0-9](?:[a-zA-Z0-9-]{0,61}[a-zA-Z0-9])?)*$/;

        if (!emailRegex.test(email)) {
            errors.push("Invalid email format");
        }

        // Additional checks
        if (email.length > 254) {
            errors.push("Email address is too long");
        }

        const [localPart, domain] = email.split('@');
        if (localPart && localPart.length > 64) {
            errors.push("Local part of email is too long");
        }

        if (domain && domain.includes('..')) {
            errors.push("Domain contains consecutive dots");
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validates URL format
     */
    static validateURL(url: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            const urlObj = new URL(url);

            // Check for common issues
            if (!['http:', 'https:', 'ftp:', 'ftps:'].includes(urlObj.protocol)) {
                warnings.push(`Unusual protocol: ${urlObj.protocol}`);
            }

            if (urlObj.hostname.includes('..')) {
                errors.push("Hostname contains consecutive dots");
            }

        } catch (error) {
            errors.push("Invalid URL format");
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validates phone number format
     */
    static validatePhoneNumber(
        phone: string,
        format: 'international' | 'us' | 'flexible' = 'flexible'
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Remove common formatting characters
        const cleanPhone = phone.replace(/[\s\-\(\)\+\.]/g, '');

        switch (format) {
            case 'international':
                if (!/^\+?[1-9]\d{1,14}$/.test(cleanPhone)) {
                    errors.push("Invalid international phone number format");
                }
                break;
            case 'us':
                if (!/^(\+?1)?[2-9]\d{2}[2-9]\d{2}\d{4}$/.test(cleanPhone)) {
                    errors.push("Invalid US phone number format");
                }
                break;
            case 'flexible':
                if (!/^\+?[\d\s\-\(\)\.]{7,15}$/.test(phone)) {
                    errors.push("Phone number should be 7-15 digits");
                }
                break;
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validates credit card number using Luhn algorithm
     */
    static validateCreditCard(cardNumber: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Remove spaces and dashes
        const cleanNumber = cardNumber.replace(/[\s\-]/g, '');

        // Check if all characters are digits
        if (!/^\d+$/.test(cleanNumber)) {
            errors.push("Credit card number must contain only digits");
        } else {
            // Luhn algorithm
            let sum = 0;
            let isEven = false;

            for (let i = cleanNumber.length - 1; i >= 0; i--) {
                let digit = parseInt(cleanNumber.charAt(i), 10);

                if (isEven) {
                    digit *= 2;
                    if (digit > 9) {
                        digit -= 9;
                    }
                }

                sum += digit;
                isEven = !isEven;
            }

            if (sum % 10 !== 0) {
                errors.push("Invalid credit card number (failed Luhn check)");
            }

            // Check length for common card types
            const length = cleanNumber.length;
            if (![13, 14, 15, 16, 17, 18, 19].includes(length)) {
                warnings.push("Unusual credit card number length");
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Calculates password strength score (0-100)
     */
    static calculatePasswordStrength(password: string): number {
        let score = 0;

        // Length bonus
        score += Math.min(password.length * 2, 25);

        // Character variety bonus
        if (/[a-z]/.test(password)) score += 5;
        if (/[A-Z]/.test(password)) score += 5;
        if (/\d/.test(password)) score += 5;
        if (/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(password)) score += 10;

        // Complexity bonus
        const uniqueChars = new Set(password).size;
        score += Math.min(uniqueChars * 2, 20);

        // Entropy bonus
        const entropy = this.calculateEntropy(password);
        score += Math.min(entropy / 2, 20);

        // Penalties
        if (/(.)\1{2,}/.test(password)) score -= 10; // Repeated characters
        if (/123|abc|qwe|asd|zxc/i.test(password)) score -= 15; // Common sequences
        if (/password|123456|qwerty/i.test(password)) score -= 25; // Common passwords

        return Math.max(0, Math.min(100, score));
    }

    /**
     * Calculates Shannon entropy of a string
     */
    static calculateEntropy(str: string): number {
        const frequencies: Record<string, number> = {};

        // Count character frequencies
        for (const char of str) {
            frequencies[char] = (frequencies[char] || 0) + 1;
        }

        // Calculate entropy
        let entropy = 0;
        const length = str.length;

        for (const count of Object.values(frequencies)) {
            const probability = count / length;
            entropy -= probability * Math.log2(probability);
        }

        return entropy * length;
    }

    /**
     * Gets detailed string statistics
     */
    static getStringStatistics(str: string): StringStatistics {
        const characterCount: Record<string, number> = {};

        // Count characters
        for (const char of str) {
            characterCount[char] = (characterCount[char] || 0) + 1;
        }

        return {
            length: str.length,
            byteLength: new TextEncoder().encode(str).length,
            characterCount,
            hasUpperCase: /[A-Z]/.test(str),
            hasLowerCase: /[a-z]/.test(str),
            hasNumbers: /\d/.test(str),
            hasSpecialChars: /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(str),
            entropy: this.calculateEntropy(str),
        };
    }

    /**
     * Checks if string contains only printable ASCII characters
     */
    static isPrintableASCII(str: string): boolean {
        return /^[\x20-\x7E]*$/.test(str);
    }

    /**
     * Checks if string is valid UTF-8
     */
    static isValidUTF8(str: string): boolean {
        try {
            // Try to encode and decode
            const encoded = new TextEncoder().encode(str);
            const decoded = new TextDecoder('utf-8', { fatal: true }).decode(encoded);
            return decoded === str;
        } catch {
            return false;
        }
    }

    /**
     * Validates JSON string
     */
    static validateJSON(str: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            JSON.parse(str);
        } catch (error) {
            errors.push(`Invalid JSON: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validates XML string (basic check)
     */
    static validateXML(str: string): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        try {
            if (typeof DOMParser !== 'undefined') {
                const parser = new DOMParser();
                const doc = parser.parseFromString(str, 'text/xml');
                const parseError = doc.querySelector('parsererror');

                if (parseError) {
                    errors.push('Invalid XML format');
                }
            } else {
                // Basic XML validation for Node.js environment
                if (!str.trim().startsWith('<') || !str.trim().endsWith('>')) {
                    errors.push('XML must start with < and end with >');
                }
            }
        } catch (error) {
            errors.push(`XML validation error: ${error instanceof Error ? error.message : String(error)}`);
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }
}
