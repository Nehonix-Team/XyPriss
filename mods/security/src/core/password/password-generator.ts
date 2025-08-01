/**
 * 🔐 Password Generator Module
 *
 * Secure password generation with customizable requirements
 */

import { SecureRandom } from "../random";
import {
    PasswordGenerationOptions,
    PasswordGenerationResult,
    PasswordManagerConfig,
} from "./password-types";
import { PasswordSecurity } from "./password-security";
import { NehoID } from "nehoid";
import { SWLIST } from "./swlist";

/**
 * Secure password generation
 */
export class PasswordGenerator {
    private config: PasswordManagerConfig;
    private security: PasswordSecurity;

    constructor(config: PasswordManagerConfig) {
        this.config = config;
        this.security = new PasswordSecurity(config);
    }

    /**
     * Update configuration
     */
    public updateConfig(config: PasswordManagerConfig): void {
        this.config = config;
        this.security.updateConfig(config);
    }

    /**
     * Generate a secure password
     */
    public generate(
        options: PasswordGenerationOptions = {}
    ): PasswordGenerationResult {
        const opts = this.mergeOptions(options);

        let attempts = 0;
        const maxAttempts = 100;

        while (attempts < maxAttempts) {
            const password = this.generatePassword(opts);
            const strength = this.security.analyzeStrength(password);

            if (strength.score >= opts.minStrengthScore!) {
                return {
                    password,
                    strength,
                    metadata: {
                        generatedAt: Date.now(),
                        algorithm: "xypriss-secure-random",
                        entropy: strength.entropy,
                    },
                };
            }

            attempts++;
        }

        throw new Error(
            "Unable to generate password meeting strength requirements"
        );
    }

    /**
     * Generate multiple passwords
     */
    public generateBatch(
        count: number,
        options: PasswordGenerationOptions = {}
    ): PasswordGenerationResult[] {
        if (count <= 0 || count > 1000) {
            throw new Error("Count must be between 1 and 1000");
        }

        const results: PasswordGenerationResult[] = [];

        for (let i = 0; i < count; i++) {
            results.push(this.generate(options));
        }

        return results;
    }

    /**
     * Generate passphrase (word-based password)
     */
    public generatePassphrase(
        options: {
            wordCount?: number;
            separator?: string;
            includeNumbers?: boolean;
            includeSymbols?: boolean;
            minStrengthScore?: number;
        } = {}
    ): PasswordGenerationResult {
        const opts = {
            wordCount: 4,
            separator: "-",
            includeNumbers: true,
            includeSymbols: false,
            minStrengthScore: 70,
            ...options,
        };

        // Comprehensive EFF word list for maximum security (2048 words for 11 bits of entropy per word)
        const words = this.getSecureWordList();

        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            const selectedWords: string[] = [];

            // Use cryptographically secure random selection with no duplicates
            const usedIndices = new Set<number>();

            for (let i = 0; i < opts.wordCount; i++) {
                let randomIndex: number;
                let wordAttempts = 0;

                // Ensure no duplicate words in the passphrase
                do {
                    randomIndex = SecureRandom.getSecureRandomInt(
                        0,
                        words.length - 1
                    );
                    wordAttempts++;
                } while (usedIndices.has(randomIndex) && wordAttempts < 50);

                usedIndices.add(randomIndex);
                selectedWords.push(words[randomIndex]);
            }

            // Randomly capitalize some words for additional entropy
            const capitalizedWords = selectedWords.map((word) => {
                if (SecureRandom.getSecureRandomBoolean()) {
                    return word.charAt(0).toUpperCase() + word.slice(1);
                }
                return word;
            });

            let passphrase = capitalizedWords.join(opts.separator);

            // Add numbers if requested (use larger range for better entropy)
            if (opts.includeNumbers) {
                const number = SecureRandom.getSecureRandomInt(100, 9999);
                passphrase += opts.separator + number;
            }

            // Add symbols if requested (use more diverse symbols)
            if (opts.includeSymbols) {
                const symbols = "!@#$%^&*()_+-=[]{}|;:,.<>?";
                const symbolCount = SecureRandom.getSecureRandomInt(1, 3);
                let symbolString = "";

                for (let i = 0; i < symbolCount; i++) {
                    const randomSymbol =
                        symbols[
                            SecureRandom.getSecureRandomInt(
                                0,
                                symbols.length - 1
                            )
                        ];
                    symbolString += randomSymbol;
                }

                passphrase += symbolString;
            }

            const strength = this.security.analyzeStrength(passphrase);

            // Calculate theoretical entropy for passphrase
            const wordEntropy = opts.wordCount * Math.log2(words.length);
            const numberEntropy = opts.includeNumbers ? Math.log2(9900) : 0; // 100-9999 range
            const symbolEntropy = opts.includeSymbols
                ? Math.log2(26 * 26 * 26)
                : 0; // Up to 3 symbols
            const totalEntropy = wordEntropy + numberEntropy + symbolEntropy;

            if (strength.score >= opts.minStrengthScore && totalEntropy >= 50) {
                return {
                    password: passphrase,
                    strength: {
                        ...strength,
                        entropy: Math.max(strength.entropy, totalEntropy),
                    },
                    metadata: {
                        generatedAt: Date.now(),
                        algorithm: "xypriss-passphrase-eff",
                        entropy: totalEntropy,
                    },
                };
            }

            attempts++;
        }

        throw new Error(
            "Unable to generate passphrase meeting strength requirements after maximum attempts"
        );
    }

    /**
     * Generate PIN (numeric password)
     */
    public generatePIN(length: number = 6): string {
        if (length < 4 || length > 20) {
            throw new Error("PIN length must be between 4 and 20");
        }

        let pin = "";
        for (let i = 0; i < length; i++) {
            pin += SecureRandom.getSecureRandomInt(0, 9).toString();
        }

        // Ensure PIN doesn't have obvious patterns
        if (this.hasObviousPattern(pin)) {
            return this.generatePIN(length); // Retry
        }

        return pin;
    }

    /**
     * Generate memorable password (pronounceable)
     */
    public generateMemorable(
        options: {
            length?: number;
            includeNumbers?: boolean;
            includeSymbols?: boolean;
            minStrengthScore?: number;
        } = {}
    ): PasswordGenerationResult {
        const opts = {
            length: 12,
            includeNumbers: true,
            includeSymbols: false,
            minStrengthScore: 60,
            ...options,
        };

        // Consonants and vowels for pronounceable passwords
        const consonants = "bcdfghjklmnpqrstvwxyz";
        const vowels = "aeiou";
        const numbers = "0123456789";
        const symbols = "!@#$%^&*";

        let attempts = 0;
        const maxAttempts = 50;

        while (attempts < maxAttempts) {
            let password = "";
            let useConsonant = true;

            // Generate base pronounceable part
            for (let i = 0; i < opts.length - 2; i++) {
                if (useConsonant) {
                    password +=
                        consonants[
                            SecureRandom.getSecureRandomInt(
                                0,
                                consonants.length - 1
                            )
                        ];
                } else {
                    password +=
                        vowels[
                            SecureRandom.getSecureRandomInt(
                                0,
                                vowels.length - 1
                            )
                        ];
                }
                useConsonant = !useConsonant;
            }

            // Add numbers if requested
            if (opts.includeNumbers) {
                password +=
                    numbers[
                        SecureRandom.getSecureRandomInt(0, numbers.length - 1)
                    ];
            }

            // Add symbols if requested
            if (opts.includeSymbols) {
                password +=
                    symbols[
                        SecureRandom.getSecureRandomInt(0, symbols.length - 1)
                    ];
            }

            // Capitalize some letters randomly
            password = password
                .split("")
                .map((char) => {
                    if (
                        char.match(/[a-z]/) &&
                        SecureRandom.getSecureRandomBoolean()
                    ) {
                        return char.toUpperCase();
                    }
                    return char;
                })
                .join("");

            const strength = this.security.analyzeStrength(password);

            if (strength.score >= opts.minStrengthScore) {
                return {
                    password,
                    strength,
                    metadata: {
                        generatedAt: Date.now(),
                        algorithm: "xypriss-memorable",
                        entropy: strength.entropy,
                    },
                };
            }

            attempts++;
        }

        throw new Error(
            "Unable to generate memorable password meeting strength requirements"
        );
    }

    // ===== PRIVATE HELPER METHODS =====

    private mergeOptions(
        options: PasswordGenerationOptions
    ): Required<PasswordGenerationOptions> {
        return {
            length: 16,
            includeUppercase: true,
            includeLowercase: true,
            includeNumbers: true,
            includeSymbols: true,
            excludeSimilar: true,
            minStrengthScore: 80,
            customCharset: "",
            excludeChars: "",
            requireAll: true,
            ...options,
        };
    }

    private generatePassword(
        options: Required<PasswordGenerationOptions>
    ): string {
        let charset = "";

        // Build character set
        if (options.customCharset) {
            charset = options.customCharset;
        } else {
            if (options.includeUppercase) {
                charset += options.excludeSimilar
                    ? "ABCDEFGHJKLMNPQRSTUVWXYZ"
                    : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            }
            if (options.includeLowercase) {
                charset += options.excludeSimilar
                    ? "abcdefghjkmnpqrstuvwxyz"
                    : "abcdefghijklmnopqrstuvwxyz";
            }
            if (options.includeNumbers) {
                charset += options.excludeSimilar ? "23456789" : "0123456789";
            }
            if (options.includeSymbols) {
                charset += "!@#$%^&*()_+-=[]{}|;:,.<>?";
            }
        }

        // Remove excluded characters
        if (options.excludeChars) {
            for (const char of options.excludeChars) {
                charset = charset.replace(
                    new RegExp(
                        char.replace(/[.*+?^${}()|[\]\\]/g, "\\$&"),
                        "g"
                    ),
                    ""
                );
            }
        }

        if (charset.length === 0) {
            throw new Error(
                "No valid characters available for password generation"
            );
        }

        // Generate password
        let password = "";
        for (let i = 0; i < options.length; i++) {
            const randomIndex = SecureRandom.getSecureRandomInt(
                0,
                charset.length - 1
            );
            password += charset[randomIndex];
        }

        // Ensure all required character types are present if requireAll is true
        if (options.requireAll && !options.customCharset) {
            password = this.ensureAllCharacterTypes(password, options);
        }

        return password;
    }

    private ensureAllCharacterTypes(
        password: string,
        options: Required<PasswordGenerationOptions>
    ): string {
        const chars = password.split("");

        if (options.includeUppercase && !/[A-Z]/.test(password)) {
            const upperChars = options.excludeSimilar
                ? "ABCDEFGHJKLMNPQRSTUVWXYZ"
                : "ABCDEFGHIJKLMNOPQRSTUVWXYZ";
            const randomIndex = SecureRandom.getSecureRandomInt(
                0,
                chars.length - 1
            );
            chars[randomIndex] =
                upperChars[
                    SecureRandom.getSecureRandomInt(0, upperChars.length - 1)
                ];
        }

        if (options.includeLowercase && !/[a-z]/.test(password)) {
            const lowerChars = options.excludeSimilar
                ? "abcdefghjkmnpqrstuvwxyz"
                : "abcdefghijklmnopqrstuvwxyz";
            const randomIndex = SecureRandom.getSecureRandomInt(
                0,
                chars.length - 1
            );
            chars[randomIndex] =
                lowerChars[
                    SecureRandom.getSecureRandomInt(0, lowerChars.length - 1)
                ];
        }

        if (options.includeNumbers && !/[0-9]/.test(password)) {
            const numberChars = options.excludeSimilar
                ? "23456789"
                : "0123456789";
            const randomIndex = SecureRandom.getSecureRandomInt(
                0,
                chars.length - 1
            );
            chars[randomIndex] =
                numberChars[
                    SecureRandom.getSecureRandomInt(0, numberChars.length - 1)
                ];
        }

        if (options.includeSymbols && !/[^A-Za-z0-9]/.test(password)) {
            const symbolChars = "!@#$%^&*()_+-=[]{}|;:,.<>?";
            const randomIndex = SecureRandom.getSecureRandomInt(
                0,
                chars.length - 1
            );
            chars[randomIndex] =
                symbolChars[
                    SecureRandom.getSecureRandomInt(0, symbolChars.length - 1)
                ];
        }

        return chars.join("");
    }

    private hasObviousPattern(pin: string): boolean {
        // Check for sequential numbers
        for (let i = 0; i < pin.length - 2; i++) {
            const a = parseInt(pin[i]);
            const b = parseInt(pin[i + 1]);
            const c = parseInt(pin[i + 2]);

            if (b === a + 1 && c === b + 1) return true;
            if (b === a - 1 && c === b - 1) return true;
        }

        // Check for repeated digits
        if (/(\d)\1{2,}/.test(pin)) return true;

        // Check for common patterns
        const commonPatterns = ["1234", "4321", "1111", "0000", "1212"];
        return commonPatterns.some((pattern) => pin.includes(pattern));
    }

    /**
     * Returns a comprehensive word list for secure passphrase generation
     * Based on EFF's long wordlist for maximum security (2048 words = 11 bits entropy per word)
     */
    private getSecureWordList(): string[] {
        // EFF Long Wordlist - 2048 carefully selected words
        // Each word provides 11 bits of entropy (2^11 = 2048)
        // Words are 3-9 characters, easy to type, and memorable
        return SWLIST;
    }
}

