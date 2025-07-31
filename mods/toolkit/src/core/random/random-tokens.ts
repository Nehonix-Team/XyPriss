/**
 * Random tokens - Token and password generation utilities
 */

import { CHAR_SETS, ERROR_MESSAGES } from "../../utils/constants";
import { EncodingHashType, SecurityLevel } from "../../types";
import {
    TokenGenerationOptions,
    RandomGenerationOptions,
} from "./random-types";
import { RandomGenerators } from "./random-generators";

export class RandomTokens {
    /**
     * Generate a secure token with specified options
     * @param length - Length of the token
     * @param options - Token generation options
     * @returns Secure random token
     */
    public static generateSecureToken(
        length: number,
        options: TokenGenerationOptions = {}
    ): string {
        if (length <= 0) {
            throw new Error(ERROR_MESSAGES.INVALID_LENGTH);
        }

        const {
            includeUppercase = true,
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = false,
            excludeSimilarCharacters = false,
            entropyLevel = SecurityLevel.HIGH,
            customCharset,
        } = options;

        // Build character set
        let charset = "";

        if (customCharset) {
            charset = customCharset;
        } else {
            if (includeUppercase) charset += CHAR_SETS.UPPERCASE;
            if (includeLowercase) charset += CHAR_SETS.LOWERCASE;
            if (includeNumbers) charset += CHAR_SETS.NUMBERS;
            if (includeSymbols) charset += CHAR_SETS.SYMBOLS;
        }

        if (charset.length === 0) {
            throw new Error("No character set specified for token generation");
        }

        // Remove similar characters if requested
        if (excludeSimilarCharacters && !customCharset) {
            const similarChars = "0O1lI|";
            charset = charset
                .split("")
                .filter((char) => !similarChars.includes(char))
                .join("");
        }

        // Generate token
        const randomOptions: RandomGenerationOptions = {
            quantumSafe: entropyLevel === SecurityLevel.MAXIMUM,
            useEntropyPool: true,
        };

        let token = "";
        for (let i = 0; i < length; i++) {
            const randomIndex = RandomGenerators.getSecureRandomInt(
                0,
                charset.length - 1,
                randomOptions
            );
            token += charset[randomIndex];
        }

        return token;
    }

    /**
     * Generate secure password with complexity requirements
     * @param length - Password length
     * @param options - Generation options
     * @returns Secure password
     */
    public static generateSecurePassword(
        length: number = 16,
        options: TokenGenerationOptions = {}
    ): string {
        if (length < 8) {
            throw new Error("Password length must be at least 8 characters");
        }

        const {
            includeUppercase = true,
            includeLowercase = true,
            includeNumbers = true,
            includeSymbols = true,
            excludeSimilarCharacters = true,
            entropyLevel = SecurityLevel.HIGH,
        } = options;

        // Ensure at least one character from each required set
        let password = "";
        let remainingLength = length;

        const randomOptions: RandomGenerationOptions = {
            quantumSafe: entropyLevel === SecurityLevel.MAXIMUM,
            useEntropyPool: true,
        };

        // Add required characters
        if (includeUppercase) {
            const char = RandomTokens.getRandomCharFromSet(
                CHAR_SETS.UPPERCASE,
                excludeSimilarCharacters,
                randomOptions
            );
            password += char;
            remainingLength--;
        }

        if (includeLowercase) {
            const char = RandomTokens.getRandomCharFromSet(
                CHAR_SETS.LOWERCASE,
                excludeSimilarCharacters,
                randomOptions
            );
            password += char;
            remainingLength--;
        }

        if (includeNumbers) {
            const char = RandomTokens.getRandomCharFromSet(
                CHAR_SETS.NUMBERS,
                excludeSimilarCharacters,
                randomOptions
            );
            password += char;
            remainingLength--;
        }

        if (includeSymbols) {
            const char = RandomTokens.getRandomCharFromSet(
                CHAR_SETS.SYMBOLS,
                excludeSimilarCharacters,
                randomOptions
            );
            password += char;
            remainingLength--;
        }

        // Fill remaining length with random characters from all sets
        const fullCharset = RandomTokens.buildCharset({
            includeUppercase,
            includeLowercase,
            includeNumbers,
            includeSymbols,
            excludeSimilarCharacters,
        });

        for (let i = 0; i < remainingLength; i++) {
            const randomIndex = RandomGenerators.getSecureRandomInt(
                0,
                fullCharset.length - 1,
                randomOptions
            );
            password += fullCharset[randomIndex];
        }

        // Shuffle the password to avoid predictable patterns
        const passwordArray = password.split("");
        const shuffled = RandomGenerators.secureArrayShuffle(
            passwordArray,
            randomOptions
        );

        return shuffled.join("");
    }

    /**
     * Generate session token
     * @param length - Token length in bytes
     * @param encoding - Output encoding
     * @param options - Generation options
     * @returns Secure session token
     */
    public static generateSessionToken(
        length: number = 32,
        encoding: "hex" | "base64" | "base64url" = "base64url",
        options: RandomGenerationOptions = {}
    ): string {
        const tokenBytes = RandomGenerators.getRandomBytes(length, options);
        const buffer = Buffer.from(tokenBytes);

        switch (encoding) {
            case "hex":
                return buffer.toString("hex");
            case "base64":
                return buffer.toString("base64");
            case "base64url":
                return buffer.toString("base64url");
            default:
                throw new Error(`Unsupported encoding: ${encoding}`);
        }
    }

    /**
     * Generate API key
     * @param length - Key length
     * @param prefix - Optional prefix
     * @param options - Generation options
     * @returns Secure API key
     */
    public static generateAPIKey(
        length: number = 32,
        prefix?: string,
        options: TokenGenerationOptions = {}
    ): string {
        const tokenOptions: TokenGenerationOptions = {
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: false,
            excludeSimilarCharacters: true,
            ...options,
        };

        const token = RandomTokens.generateSecureToken(length, tokenOptions);

        return prefix ? `${prefix}_${token}` : token;
    }

    /**
     * Generate secure PIN
     * @param length - PIN length
     * @param options - Generation options
     * @returns Secure numeric PIN
     */
    public static generateSecurePIN(
        length: number = 6,
        options: RandomGenerationOptions = {}
    ): string {
        if (length < 4) {
            throw new Error("PIN length must be at least 4 digits");
        }

        let pin = "";
        for (let i = 0; i < length; i++) {
            const digit = RandomGenerators.getSecureRandomInt(0, 9, options);
            pin += digit.toString();
        }

        return pin;
    }

    /**
     * Generate secure OTP (One-Time Password)
     * @param length - OTP length
     * @param options - Generation options
     * @returns Secure OTP
     */
    public static generateSecureOTP(
        length: number = 6,
        options: TokenGenerationOptions = {}
    ): string {
        const otpOptions: TokenGenerationOptions = {
            includeUppercase: true,
            includeNumbers: true,
            includeLowercase: false,
            includeSymbols: false,
            excludeSimilarCharacters: true,
            ...options,
        };

        return RandomTokens.generateSecureToken(length, otpOptions);
    }

    /**
     * Generate recovery codes
     * @param count - Number of codes to generate
     * @param codeLength - Length of each code
     * @param options - Generation options
     * @returns Array of recovery codes
     */
    public static generateRecoveryCodes(
        count: number = 10,
        codeLength: number = 8,
        options: TokenGenerationOptions = {}
    ): string[] {
        if (count <= 0 || count > 100) {
            throw new Error("Count must be between 1 and 100");
        }

        const codes: string[] = [];
        const codeOptions: TokenGenerationOptions = {
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: false,
            excludeSimilarCharacters: true,
            ...options,
        };

        for (let i = 0; i < count; i++) {
            codes.push(
                RandomTokens.generateSecureToken(codeLength, codeOptions)
            );
        }

        return codes;
    }

    // ============================================================================
    // HELPER METHODS
    // ============================================================================

    /**
     * Get random character from character set
     */
    private static getRandomCharFromSet(
        charset: string,
        excludeSimilar: boolean,
        options: RandomGenerationOptions
    ): string {
        let filteredCharset = charset;

        if (excludeSimilar) {
            const similarChars = "0O1lI|";
            filteredCharset = charset
                .split("")
                .filter((char) => !similarChars.includes(char))
                .join("");
        }

        const randomIndex = RandomGenerators.getSecureRandomInt(
            0,
            filteredCharset.length - 1,
            options
        );
        return filteredCharset[randomIndex];
    }

    /**
     * Build character set based on options
     */
    private static buildCharset(options: {
        includeUppercase: boolean;
        includeLowercase: boolean;
        includeNumbers: boolean;
        includeSymbols: boolean;
        excludeSimilarCharacters: boolean;
    }): string {
        let charset = "";

        if (options.includeUppercase) charset += CHAR_SETS.UPPERCASE;
        if (options.includeLowercase) charset += CHAR_SETS.LOWERCASE;
        if (options.includeNumbers) charset += CHAR_SETS.NUMBERS;
        if (options.includeSymbols) charset += CHAR_SETS.SYMBOLS;

        if (options.excludeSimilarCharacters) {
            const similarChars = "0O1lI|";
            charset = charset
                .split("")
                .filter((char) => !similarChars.includes(char))
                .join("");
        }

        return charset;
    }

    /**
     * Validate token strength
     * @param token - Token to validate
     * @returns Strength assessment
     */
    public static validateTokenStrength(token: string): {
        score: number;
        strength: "weak" | "fair" | "good" | "strong" | "excellent";
        issues: string[];
    } {
        const issues: string[] = [];
        let score = 0;

        // Length check
        if (token.length >= 12) score += 20;
        else if (token.length >= 8) score += 10;
        else issues.push("Token too short");

        // Character variety
        const hasUpper = /[A-Z]/.test(token);
        const hasLower = /[a-z]/.test(token);
        const hasNumbers = /[0-9]/.test(token);
        const hasSymbols = /[^A-Za-z0-9]/.test(token);

        if (hasUpper) score += 15;
        if (hasLower) score += 15;
        if (hasNumbers) score += 15;
        if (hasSymbols) score += 20;

        // Entropy check
        const uniqueChars = new Set(token).size;
        const entropyRatio = uniqueChars / token.length;
        if (entropyRatio > 0.7) score += 15;
        else if (entropyRatio > 0.5) score += 10;
        else issues.push("Low character diversity");

        // Determine strength
        let strength: "weak" | "fair" | "good" | "strong" | "excellent";
        if (score >= 85) strength = "excellent";
        else if (score >= 70) strength = "strong";
        else if (score >= 55) strength = "good";
        else if (score >= 40) strength = "fair";
        else strength = "weak";

        return { score, strength, issues };
    }
}

