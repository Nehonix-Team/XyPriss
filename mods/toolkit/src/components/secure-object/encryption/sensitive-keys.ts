/**
 * Sensitive Keys Management Module
 * Handles the management of sensitive keys for encryption/masking
 */

/**
 * Default sensitive keys that are commonly used in applications
 */
export const DEFAULT_SENSITIVE_KEYS = [
    // Authentication & Authorization
    "password",
    "passwd",
    "pwd",
    "secret",
    "token",
    "key",
    "apikey",
    "api_key",
    "accesskey",
    "access_key",
    "accesstoken",
    "access_token",
    "refreshtoken",
    "refresh_token",
    "sessionid",
    "session_id",
    "auth",
    "authorization",
    "bearer",
    "credential",
    "credentials",

    // Personal Information
    "pin",
    "ssn",
    "social_security",
    "credit_card",
    "creditcard",
    "cvv",
    "cvc",

    // Cryptographic Keys
    "private_key",
    "privatekey",
    "signature",
    "hash",
    "salt",
    "nonce",
    "otp",
    "passcode",
    "passphrase",
    "masterkey",
    "master_key",
    "encryption_key",
    "decryption_key",

    // Web Security
    "jwt",
    "cookie",
    "session",
    "csrf",
    "xsrf",
] as const;

/**
 * Manages sensitive keys for a SecureObject instance
 */
export class SensitiveKeysManager {
    private sensitiveKeys: Set<string>;
    private customPatterns: RegExp[] = [];

    constructor(initialKeys?: string[]) {
        this.sensitiveKeys = new Set(initialKeys || DEFAULT_SENSITIVE_KEYS);
    }

    /**
     * Adds keys to the sensitive keys list
     */
    add(...keys: string[]): this {
        keys.forEach((key) => this.sensitiveKeys.add(key));
        return this;
    }

    /**
     * Removes keys from the sensitive keys list
     */
    remove(...keys: string[]): this {
        keys.forEach((key) => this.sensitiveKeys.delete(key));
        return this;
    }

    /**
     * Sets the complete list of sensitive keys (replaces existing)
     */
    set(keys: string[]): this {
        this.sensitiveKeys.clear();
        keys.forEach((key) => this.sensitiveKeys.add(key));
        return this;
    }

    /**
     * Gets the current list of sensitive keys
     */
    getAll(): string[] {
        return Array.from(this.sensitiveKeys);
    }

    /**
     * Adds custom regex patterns for sensitive key detection
     */
    addCustomPatterns(...patterns: (RegExp | string)[]): this {
        patterns.forEach((pattern) => {
            if (typeof pattern === "string") {
                // Convert string to case-insensitive regex
                this.customPatterns.push(new RegExp(pattern, "i"));
            } else {
                this.customPatterns.push(pattern);
            }
        });
        return this;
    }

    /**
     * Removes custom patterns
     */
    removeCustomPatterns(...patterns: (RegExp | string)[]): this {
        patterns.forEach((pattern) => {
            const patternStr = pattern.toString();
            this.customPatterns = this.customPatterns.filter(
                (p) => p.toString() !== patternStr
            );
        });
        return this;
    }

    /**
     * Clears all custom patterns
     */
    clearCustomPatterns(): this {
        this.customPatterns = [];
        return this;
    }

    /**
     * Gets all custom patterns
     */
    getCustomPatterns(): RegExp[] {
        return [...this.customPatterns];
    }

    /**
     * Checks if a key is marked as sensitive
     * Simple approach: exact matches + custom patterns + strict mode patterns
     */
    isSensitive(key: string, strictMode: boolean = false): boolean {
        const lowerKey = key.toLowerCase();

        // 1. Check exact match first (case-insensitive) - always applies
        if (this.sensitiveKeys.has(lowerKey)) {
            return true;
        }

        // 2. Check custom patterns (user-defined patterns have priority) - always applies
        for (const pattern of this.customPatterns) {
            if (pattern.test(key)) {
                // Use original case for custom patterns
                return true;
            }
        }

        // 3. In strict mode, apply additional patterns
        if (strictMode) {
            return this.isStrictModePattern(lowerKey);
        }

        // 4. In non-strict mode, only use exact matches and custom patterns
        return false;
    }

    /**
     * Simple strict mode pattern matching
     * Only applies additional patterns when in strict mode
     */
    private isStrictModePattern(lowerKey: string): boolean {
        // In strict mode, apply additional patterns for common sensitive key patterns
        const strictPatterns = [
            // Compound words ending with sensitive terms
            /^[a-z]*password$/, // adminPassword, userPassword, etc.
            /^[a-z]*token$/, // authToken, userToken, etc.
            /^[a-z]*secret$/, // apiSecret, userSecret, etc.
            /^[a-z]*key$/, // ANY word ending with "key" - be REALLY strict!
        ];

        // Check strict patterns
        for (const pattern of strictPatterns) {
            if (pattern.test(lowerKey)) {
                return true;
            }
        }

        return false;
    }

    /**
     * Clears all sensitive keys
     */
    clear(): this {
        this.sensitiveKeys.clear();
        return this;
    }

    /**
     * Resets to default sensitive keys
     */
    resetToDefault(): this {
        this.sensitiveKeys.clear();
        DEFAULT_SENSITIVE_KEYS.forEach((key) => this.sensitiveKeys.add(key));
        return this;
    }

    /**
     * Gets the default sensitive keys
     */
    static getDefaultKeys(): string[] {
        return [...DEFAULT_SENSITIVE_KEYS];
    }
}
