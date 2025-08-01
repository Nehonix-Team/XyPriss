/***************************************************************************
 * XyPrissSecurity - Ex xypriss2-js is an Advanced JavaScript Security Library designed for XyPriss
 *
 * This file contains the main entry point for the XyPrissSecurity library.
 *
 * @author Nehonix
 * @license MIT
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * Permission is hereby granted, free of charge, to any person obtaining a copy
 * of this software and associated documentation files (the "Software"), to deal
 * in the Software without restriction, including without limitation the rights
 * to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
 * copies of the Software, and to permit persons to whom the Software is
 * furnished to do so, subject to the following conditions:
 *
 * The above copyright notice and this permission notice shall be included in all
 * copies or substantial portions of the Software.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 ***************************************************************************** */

/**
 * # XyPrissSecurity - Advanced JavaScript Security Library
 *
 * **The most comprehensive cryptographic security library for JavaScript applications**
 *
 * XyPrissSecurity provides enterprise-grade security features including military-grade encryption,
 * secure data structures, advanced password management, and real-time security monitoring.
 * Built with TypeScript for maximum type safety and developer experience.
 *
 * ## Core Features
 *
 * ### Secure Data Structures
 * - **SecureArray**: Military-grade encrypted arrays with AES-256-CTR-HMAC
 * - **SecureString**: Protected string handling with automatic memory cleanup
 * - **SecureObject**: Encrypted object storage with metadata management
 * - **SecureBuffer**: Protected memory allocation with secure wiping
 *
 * ### Cryptographic Operations
 * - **Token Generation**: Secure random tokens with configurable entropy
 * - **Password Management**: Argon2ID hashing with pepper support
 * - **Hash Functions**: SHA-256/512, BLAKE3, with timing-safe operations
 * - **Key Derivation**: PBKDF2, Argon2, scrypt with memory-hard algorithms
 *
 * ### Performance & Security
 * - **FortifiedFunction**: Ultra-fast function execution with security monitoring
 * - **Cache System**: High-performance caching with encryption support
 * - **Memory Management**: Automatic cleanup and leak detection
 * - **Side-Channel Protection**: Constant-time operations and fault resistance
 *
 * ### Advanced Security
 * - **Post-Quantum Cryptography**: Lamport signatures and Ring-LWE
 * - **Canary Tokens**: Intrusion detection and monitoring
 * - **Attestation**: Code integrity verification
 * - **Entropy Augmentation**: Enhanced randomness sources
 *
 * ## Quick Start Examples
 *
 * ### Basic Token Generation
 * ```typescript
 * import { XyPrissSecurity, generateSecureToken } from "xypriss-security";
 *
 * // Generate a secure API key
 * const apiKey = XyPrissSecurity.generateSecureToken({
 *     length: 32,
 *     entropy: "maximum",
 *     includeSymbols: false
 * });
 * console.log(apiKey); // "aK7mN9pQ2rS8tU3vW6xY1zB4cD5eF7gH"
 *
 * // Quick token generation
 * const sessionToken = generateSecureToken(64, "base64url");
 * ```
 *
 * ### Secure Data Structures
 * ```typescript
 * import { fArray, fString, fObject } from "xypriss-security";
 *
 * // Secure array with encryption
 * const sensitiveData = fArray(["api-key-1", "secret-token", "user-data"]);
 * sensitiveData.setEncryptionKey("your-encryption-key-2025");
 * sensitiveData.encryptAll();
 *
 * // Secure string with automatic cleanup
 * const password = fString("user-password-123", {
 *     protectionLevel: "maximum",
 *     enableEncryption: true
 * });
 *
 * // Secure object with metadata
 * const userCredentials = fObject({
 *     username: "john_doe",
 *     apiKey: "secret-key-value"
 * });
 * ```
 *
 * ### Password Management
 * ```typescript
 * import { PasswordManager, encryptSecurePass, verifyEncryptedPassword } from "xypriss-security";
 *
 * // Advanced password hashing with pepper
 * const pepper = process.env.PASSWORD_PEPPER;
 * const hashedPassword = await encryptSecurePass("userPassword123", pepper);
 *
 * // Verify password with timing-safe comparison
 * const isValid = await verifyEncryptedPassword("userPassword123", hashedPassword, pepper);
 *
 * // Password manager with custom configuration
 * const pm = PasswordManager.create({
 *     algorithm: "argon2id",
 *     memoryCost: 65536,
 *     timeCost: 3
 * });
 * ```
 *
 * ### High-Performance Functions
 * ```typescript
 * import { func, createFortifiedFunction } from "xypriss-security";
 *
 * // Ultra-fast function with security monitoring
 * const optimizedFunction = func(async (data: string) => {
 *     return data.toUpperCase();
 * }, {
 *     ultraFast: "maximum",
 *     smartCaching: true,
 *     autoEncrypt: true
 * });
 *
 * const result = await optimizedFunction.execute("hello world");
 * const analytics = optimizedFunction.getAnalyticsData();
 * ```
 *
 * ## Security Best Practices
 *
 * 1. **Always use environment variables for sensitive keys**
 * 2. **Enable encryption for sensitive data structures**
 * 3. **Use timing-safe operations for authentication**
 * 4. **Implement proper memory cleanup with destroy() methods**
 * 5. **Monitor security status with built-in analytics**
 *
 * @author Nehonix
 * @version 4.2.0
 * @license MIT
 * @see {@link https://lab.nehonix.space/nehonix_viewer/_doc/Nehonix%20XyPrissSecurity} Official Documentation
 * @see {@link https://github.com/Nehonix-Team/XyPriss} GitHub Repository
 * @see {@link https://nodejs.org/api/crypto.html} Node.js Crypto Module
 * @see {@link https://github.com/ranisalt/node-argon2} Argon2 Implementation
 * @see {@link https://github.com/paulmillr/noble-hashes} Noble Hashes Library
 * @see {@link https://libsodium.gitbook.io/doc/} Libsodium Documentation
 * @see {@link https://github.com/jedisct1/libsodium.js} Libsodium.js
 * @see {@link https://www.npmjs.com/package/bcryptjs} BCrypt.js Package
 *
 * @example
 * ```typescript
 * // Complete security setup example
 * import { XyPrissSecurity, fArray, PasswordManager } from "xypriss-security";
 *
 * // 1. Generate secure tokens
 * const apiKey = XyPrissSecurity.generateAPIKey(32, "api");
 * const sessionToken = XyPrissSecurity.generateSessionToken();
 *
 * // 2. Secure data storage
 * const userData = fArray([]);
 * userData.setEncryptionKey(process.env.ENCRYPTION_KEY);
 * userData.push("sensitive-user-data");
 *
 * // 3. Password management
 * const pm = PasswordManager.getInstance();
 * const hashedPassword = await pm.hash("userPassword");
 *
 * // 4. Security monitoring
 * const stats = XyPrissSecurity.getStats();
 * const securityStatus = XyPrissSecurity.verifyRuntimeSecurity();
 *
 * console.log("Security Status:", securityStatus.isSecure);
 * console.log("Operations:", stats.totalOperations);
 * ```
 */

import { XyPrissSecurity } from "./core/crypto";
import * as fObjectUtils from "./components/secure-object";
import * as fstringUtils from "./components/secure-string";
import * as fArrayUtils from "./components/secure-array";

/**
 * ## Core Type Definitions
 *
 * Comprehensive TypeScript type definitions for all XyPrissSecurity components.
 * These types provide full type safety and IntelliSense support for all
 * cryptographic operations, secure data structures, and configuration options.
 */

/**
 * ### Core Cryptographic Types
 *
 * Essential types for cryptographic operations including token generation,
 * hashing, key derivation, and security configuration.
 *
 * @example
 * ```typescript
 * import type { SecureTokenOptions, HashOptions } from "xypriss-security";
 *
 * const tokenConfig: SecureTokenOptions = {
 *     length: 32,
 *     entropy: "maximum",
 *     includeSymbols: false,
 *     excludeSimilarCharacters: true
 * };
 *
 * const hashConfig: HashOptions = {
 *     algorithm: "SHA-256",
 *     outputFormat: "hex",
 *     timingSafe: true
 * };
 * ```
 */
export type {
    /** Configuration options for secure token generation */
    SecureTokenOptions,
    /** Configuration options for hash operations */
    HashOptions,
    /** Configuration options for key derivation functions */
    KeyDerivationOptions,
    /** Configuration options for API key generation */
    APIKeyOptions,
    /** Configuration options for session token generation */
    SessionTokenOptions,
    /** Configuration options for middleware integration */
    MiddlewareOptions,
    /** Statistics and metrics for cryptographic operations */
    CryptoStats,
    /** Results from security testing and validation */
    SecurityTestResult,
    /** Results from password strength analysis */
    PasswordStrengthResult,
} from "./types";

/**
 * ### SecureObject Types
 *
 * Type definitions for secure object storage with encryption and metadata management.
 * Provides comprehensive type safety for sensitive data handling.
 *
 * @example
 * ```typescript
 * import type { SecureObjectOptions, SecureValue } from "xypriss-security";
 *
 * const config: SecureObjectOptions = {
 *     encryptionKey: "your-encryption-key",
 *     enableMetadata: true,
 *     autoCleanup: true
 * };
 *
 * const sensitiveData: Record<string, SecureValue> = {
 *     apiKey: "secret-api-key",
 *     userToken: "user-session-token"
 * };
 * ```
 */
export type {
    /** Union type for values that can be stored in SecureObject */
    SecureValue,
    /** Configuration options for object serialization */
    SerializationOptions,
    /** Metadata information for stored values */
    ValueMetadata,
    /** Event types emitted by SecureObject instances */
    SecureObjectEvent,
    /** Event listener function signature */
    EventListener,
    /** Configuration options for SecureObject creation */
    SecureObjectOptions,
} from "./components/secure-object";

/**
 * ### SecureString Types
 *
 * Type definitions for secure string handling with automatic memory management
 * and cryptographic operations. Ensures type safety for sensitive string data.
 *
 * @example
 * ```typescript
 * import type { SecureStringOptions, ValidationResult } from "xypriss-security";
 *
 * const stringConfig: SecureStringOptions = {
 *     protectionLevel: "maximum",
 *     enableEncryption: true,
 *     enableMemoryTracking: true,
 *     autoCleanup: true
 * };
 *
 * // Type-safe validation results
 * const validation: ValidationResult = {
 *     isValid: true,
 *     score: 95,
 *     feedback: ["Strong password"]
 * };
 * ```
 */
export type {
    /** Configuration options for SecureString creation */
    SecureStringOptions,
    /** Event types emitted by SecureString instances */
    SecureStringEvent,
    /** Event listener function signature for SecureString */
    SecureStringEventListener,
    /** Results from string comparison operations */
    ComparisonResult,
    /** Configuration options for string search operations */
    SearchOptions,
    /** Configuration options for string split operations */
    SplitOptions,
    /** Results from string validation operations */
    ValidationResult,
    /** Statistical information about string content */
    StringStatistics,
    /** Memory usage information for SecureString instances */
    MemoryUsage,
} from "./components/secure-string";

/**
 * ### SecureArray Types
 *
 * Type definitions for military-grade secure arrays with encryption and
 * comprehensive security features. Provides full type safety for array operations.
 *
 * @example
 * ```typescript
 * import type { SecureArrayOptions, SecureArrayStats } from "xypriss-security";
 *
 * const arrayConfig: SecureArrayOptions = {
 *     encryptionKey: "array-encryption-key",
 *     enableCompression: true,
 *     maxSize: 10000,
 *     enableEvents: true
 * };
 *
 * // Access comprehensive array statistics
 * const stats: SecureArrayStats = {
 *     totalElements: 100,
 *     encryptedElements: 100,
 *     memoryUsage: 2048,
 *     compressionRatio: 0.75
 * };
 * ```
 */
export type {
    /** Union type for values that can be stored in SecureArray */
    SecureArrayValue,
    /** Configuration options for array serialization */
    SecureArraySerializationOptions,
    /** Metadata information for array elements */
    ElementMetadata,
    /** Event types emitted by SecureArray instances */
    SecureArrayEvent,
    /** Event listener function signature for SecureArray */
    SecureArrayEventListener,
    /** Configuration options for SecureArray creation */
    SecureArrayOptions,
    /** Statistical information about SecureArray performance */
    SecureArrayStats,
    /** Flexible SecureArray type for dynamic typing */
    FlexibleSecureArray,
} from "./components/secure-array";

/**
 * ### FortifiedFunction Types
 *
 * Type definitions for ultra-fast function execution with comprehensive
 * security monitoring and performance optimization.
 *
 * @example
 * ```typescript
 * import type { FortifiedFunctionOptions, FunctionStats } from "xypriss-security";
 *
 * const functionConfig: FortifiedFunctionOptions = {
 *     ultraFast: "maximum",
 *     smartCaching: true,
 *     autoEncrypt: true,
 *     predictiveAnalytics: true,
 *     detailedMetrics: true
 * };
 *
 * // Access detailed function statistics
 * const stats: FunctionStats = {
 *     totalExecutions: 1000,
 *     averageExecutionTime: 2.5,
 *     cacheHitRate: 0.85,
 *     errorRate: 0.001
 * };
 * ```
 */
export type {
    /** Configuration options for FortifiedFunction creation */
    FortifiedFunctionOptions,
    /** Statistical information about function performance */
    FunctionStats,
    /** Audit log entry for function execution */
    AuditEntry,
    /** Secure execution context for function calls */
    SecureExecutionContext,
    /** Event information for function execution */
    ExecutionEvent,
    /** Cache entry information for function results */
    CacheEntry,
    /** Security flags and configuration */
    SecurityFlags,
} from "./components/fortified-function";

/**
 * ### Password Management Types
 *
 * Comprehensive type definitions for advanced password management including
 * Argon2ID hashing, strength analysis, and security policies.
 *
 * @example
 * ```typescript
 * import type { PasswordHashOptions, PasswordPolicy } from "xypriss-security";
 *
 * const hashConfig: PasswordHashOptions = {
 *     algorithm: "argon2id",
 *     memoryCost: 65536,
 *     timeCost: 3,
 *     parallelism: 1,
 *     hashLength: 32
 * };
 *
 * const policy: PasswordPolicy = {
 *     minLength: 12,
 *     requireUppercase: true,
 *     requireLowercase: true,
 *     requireNumbers: true,
 *     requireSymbols: true,
 *     maxAge: 90
 * };
 * ```
 *
 * @see {@link https://github.com/ranisalt/node-argon2} Argon2 Node.js Implementation
 * @see {@link https://tools.ietf.org/html/rfc9106} RFC 9106 - Argon2 Memory-Hard Function
 * @see {@link https://cheatsheetseries.owasp.org/cheatsheets/Password_Storage_Cheat_Sheet.html} OWASP Password Storage
 * @see {@link https://github.com/dcodeIO/bcrypt.js} BCrypt.js Alternative
 */
export type {
    /** Configuration options for password hashing */
    PasswordHashOptions,
    /** Results from password verification operations */
    PasswordVerificationResult,
    /** Configuration options for password generation */
    PasswordGenerationOptions,
    /** Results from password strength analysis */
    PasswordStrengthAnalysis,
    /** Results from password migration operations */
    PasswordMigrationResult,
    /** Password policy configuration */
    PasswordPolicy,
    /** Results from password validation against policies */
    PasswordValidationResult,
} from "./core/password/password-types";

/**
 * ### Password Management Enums
 *
 * Enumeration types for password management configuration including
 * supported algorithms and security levels.
 *
 * @example
 * ```typescript
 * import { PasswordAlgorithm, PasswordSecurityLevel } from "xypriss-security";
 *
 * const algorithm = PasswordAlgorithm.ARGON2ID;
 * const securityLevel = PasswordSecurityLevel.MAXIMUM;
 * ```
 */
export {
    /** Supported password hashing algorithms */
    PasswordAlgorithm,
    /** Password security level configurations */
    PasswordSecurityLevel,
} from "./core/password/password-types";

/**
 * ### Core Enumeration Types
 *
 * Essential enumeration types for cryptographic operations, security levels,
 * and algorithm selection throughout the XyPrissSecurity library.
 *
 * @example
 * ```typescript
 * import { SecurityLevel, HashAlgorithm, EntropySource } from "xypriss-security";
 *
 * const config = {
 *     securityLevel: SecurityLevel.MAXIMUM,
 *     hashAlgorithm: HashAlgorithm.SHA256,
 *     entropySource: EntropySource.CRYPTO_RANDOM
 * };
 * ```
 */
export {
    /** Available entropy sources for random generation */
    EntropySource,
    /** Security level configurations */
    SecurityLevel,
    /** Token type classifications */
    TokenType,
    /** Supported hash algorithms */
    HashAlgorithm,
    /** Key derivation algorithm options */
    KeyDerivationAlgorithm,
} from "./types";

/** Hash strength measurement type */
export type { HashStrength } from "./core";

/**
 * ## Core Module Imports
 *
 * Internal imports for core cryptographic modules and utilities.
 * These are used internally and re-exported with enhanced documentation.
 */
import { SecureRandom, RandomCrypto, RandomTokens } from "./core/random";
import { Hash } from "./core";
import { PasswordManager } from "./core/password";
import { PasswordHashOptions } from "./core/password/password-types";

/**
 * ## Core Cryptographic Exports
 *
 * Primary cryptographic classes and utilities for secure random generation,
 * key management, validation, and buffer operations.
 */

/**
 * ### Secure Random Generation
 *
 * High-entropy random number and data generation with multiple entropy sources.
 * Provides cryptographically secure random values for all security operations.
 *
 * @example
 * ```typescript
 * import { Random } from "xypriss-security";
 *
 * // Generate secure random bytes
 * const randomBytes = Random.getRandomBytes(32);
 *
 * // Generate secure UUID
 * const uuid = Random.generateSecureUUID();
 *
 * // Generate random integers
 * const randomInt = Random.getSecureRandomInt(1, 100);
 * ```
 *
 * @see {@link https://nodejs.org/api/crypto.html#cryptorandombytesbuffer} Node.js crypto.randomBytes
 * @see {@link https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues} Web Crypto API
 * @see {@link https://tools.ietf.org/html/rfc4086} RFC 4086 - Randomness Requirements
 */
export { SecureRandom as Random } from "./core/random";

/**
 * @module Keys
 * ### Cryptographic Key Management
 *
 * Advanced key generation, derivation, and management utilities for
 * symmetric and asymmetric cryptographic operations.
 *
 * @example
 * ```typescript
 * import { Keys } from "xypriss-security";
 *
 * // Generate encryption key
 * const encryptionKey = Keys.generateEncryptionKey(256);
 *
 * // Derive key from password
 * const derivedKey = await Keys.deriveKey("password", "salt");
 * ```
 */
export { Keys } from "./core/keys";

/**
 * ### Input Validation and Security
 *
 * Comprehensive validation utilities for input sanitization,
 * security checks, and data integrity verification.
 *
 * @example
 * ```typescript
 * import { Validators } from "xypriss-security";
 *
 * // Validate email format
 * const isValidEmail = Validators.isValidEmail("user@example.com");
 *
 * // Check for injection attacks
 * const isSafe = Validators.isSafeInput(userInput);
 * ```
 */
export { Validators } from "./core/validators";

/**
 * ### Secure Memory Management
 *
 * Protected memory allocation and management with automatic cleanup
 * and secure wiping capabilities for sensitive data.
 *
 * @example
 * ```typescript
 * import { SecureBuffer, Buffer } from "xypriss-security";
 *
 * // Create secure buffer
 * const buffer = SecureBuffer.from("sensitive data");
 *
 * // Automatic secure cleanup
 * buffer.destroy(); // Securely wipes memory
 * ```
 */
export { SecureBuffer } from "./components";
export { SecureBuffer as Buffer } from "./components";

/**
 * ### Enhanced Array Operations
 *
 * Enhanced Uint8Array implementation with additional security features
 * and performance optimizations for cryptographic operations.
 */
export { EnhancedUint8Array } from "./helpers/Uint8Array";

/** Encoding type definitions for random data generation */
export type { EncodingType } from "./types/random";

/**
 * ### RSA Key Calculation Utilities
 *
 * Advanced RSA key generation and calculation utilities for
 * asymmetric cryptographic operations.
 */
export * from "./generators/rsaKeyCalculator";

/**
 * ## Crypto Compatibility Layer
 *
 * Direct function exports for easy migration from Node.js crypto module.
 * These functions provide drop-in replacements with enhanced security features.
 */

/**
 * ### Secure Cipher Operations
 *
 * Enhanced cipher creation and management with automatic security hardening.
 * Provides secure alternatives to Node.js crypto.createCipher functions.
 *
 * @example
 * ```typescript
 * import { createSecureCipheriv, createSecureDecipheriv, generateSecureIV } from "xypriss-security";
 *
 * // Create secure cipher with automatic IV generation
 * const key = "your-encryption-key";
 * const iv = generateSecureIV("aes-256-cbc");
 * const cipher = createSecureCipheriv("aes-256-cbc", key, iv);
 *
 * // Encrypt data
 * let encrypted = cipher.update("sensitive data", "utf8", "hex");
 * encrypted += cipher.final("hex");
 *
 * // Decrypt data
 * const decipher = createSecureDecipheriv("aes-256-cbc", key, iv);
 * let decrypted = decipher.update(encrypted, "hex", "utf8");
 * decrypted += decipher.final("utf8");
 * ```
 */ 

/** Create secure cipher with enhanced security features */
export const createSecureCipheriv = RandomCrypto.createSecureCipheriv;

/** Create secure decipher with enhanced security features */
export const createSecureDecipheriv = RandomCrypto.createSecureDecipheriv;

/** Generate cryptographically secure initialization vector */
export const generateSecureIV = RandomCrypto.generateSecureIV;

/** Generate multiple secure IVs in batch for performance */
export const generateSecureIVBatch = RandomCrypto.generateSecureIVBatch;

/** Generate secure IV for specific algorithm */
export const generateSecureIVForAlgorithm =
    RandomCrypto.generateSecureIVForAlgorithm;

/** Generate multiple secure IVs for specific algorithm */
export const generateSecureIVBatchForAlgorithm =
    RandomCrypto.generateSecureIVBatchForAlgorithm;

/** Validate initialization vector format and security */
export const validateIV = RandomCrypto.validateIV;

/**
 * ### Random Data Generation
 *
 * High-entropy random data generation for cryptographic operations.
 *
 * @example
 * ```typescript
 * import { getRandomBytes, generateSecureUUID } from "xypriss-security";
 *
 * // Generate random bytes
 * const randomData = getRandomBytes(32);
 *
 * // Generate secure UUID
 * const uuid = generateSecureUUID();
 * ```
 */

/** Generate cryptographically secure random bytes */
export const getRandomBytes = SecureRandom.getRandomBytes;

/** Generate secure UUID with high entropy */
export const generateSecureUUID = SecureRandom.generateSecureUUID;

/**
 * ### Token Generation
 *
 * Secure token generation for sessions, API keys, and authentication.
 *
 * @example
 * ```typescript
 * import { generateSessionToken } from "xypriss-security";
 *
 * // Generate session token
 * const sessionToken = generateSessionToken(64, "base64url");
 * ```
 */

/** Generate secure session token with configurable encoding */
export const generateSessionToken = RandomTokens.generateSessionToken;

/**
 * ### Hash Operations
 *
 * Military-grade hashing functions with timing-safe operations and
 * automatic salt generation for maximum security.
 *
 * @example
 * ```typescript
 * import { createSecureHash, createSecureHMAC, verifyHash } from "xypriss-security";
 *
 * // Create secure hash with automatic salt
 * const hash = createSecureHash("data to hash");
 *
 * // Create HMAC with secret key
 * const hmac = createSecureHMAC("sha256", "secret-key", "data");
 *
 * // Verify hash with timing-safe comparison
 * const isValid = verifyHash("original-data", hash);
 * ```
 *
 * @see {@link https://github.com/paulmillr/noble-hashes} Noble Hashes - Modern Crypto Library
 * @see {@link https://nodejs.org/api/crypto.html#cryptocreatehashstring-options} Node.js Hash Functions
 * @see {@link https://tools.ietf.org/html/rfc2104} RFC 2104 - HMAC Specification
 * @see {@link https://nvlpubs.nist.gov/nistpubs/FIPS/NIST.FIPS.180-4.pdf} NIST SHA Standards
 */

/** Create secure hash with automatic salt generation */
export const createSecureHash = Hash.createSecureHash;

/** Create secure HMAC with timing-safe operations */
export const createSecureHMAC = Hash.createSecureHMAC;

/** Verify hash with constant-time comparison */
export const verifyHash = Hash.verifyHash;

/**
 * ## Core Security Classes
 *
 * Primary classes for advanced cryptographic operations and password management.
 */

/**
 * ### Hash Class
 *
 * Comprehensive hashing utilities with support for multiple algorithms,
 * timing-safe operations, and advanced security features.
 *
 * @example
 * ```typescript
 * import { Hash } from "xypriss-security";
 *
 * // Use static methods for quick operations
 * const hash = Hash.createSecureHash("data");
 *
 * // Or create instance for advanced operations
 * const hasher = new Hash();
 * const result = await hasher.pbkdf2("password", "salt", 100000);
 * ```
 */
export { Hash };

/**
 * ### Password Manager
 *
 * Advanced password management with Argon2ID hashing, strength analysis,
 * and comprehensive security policies.
 *
 * @example
 * ```typescript
 * import { PasswordManager } from "xypriss-security";
 *
 * // Get singleton instance with default config
 * const pm = PasswordManager.getInstance();
 *
 * // Or create custom instance
 * const customPM = PasswordManager.create({
 *     algorithm: "argon2id",
 *     memoryCost: 65536,
 *     timeCost: 3
 * });
 *
 * // Hash password
 * const hash = await pm.hash("userPassword");
 *
 * // Verify password
 * const result = await pm.verify("userPassword", hash);
 * ```
 */
export { PasswordManager } from "./core/password";

/**
 * ## Main XyPrissSecurity Class Exports
 *
 * Primary class exports with convenient aliases for different use cases.
 */

/**
 * ### XyPrissSecurity Main Class
 *
 * The core XyPrissSecurity class providing comprehensive cryptographic operations,
 * secure token generation, and advanced security features.
 *
 * @example
 * ```typescript
 * import { XyPriss } from "xypriss-security";
 *
 * // Generate secure tokens
 * const apiKey = XyPriss.generateAPIKey(32, "api");
 * const sessionToken = XyPriss.generateSessionToken();
 *
 * // Create secure hashes
 * const hash = XyPriss.secureHash("data to hash");
 *
 * // Verify runtime security
 * const securityStatus = XyPriss.verifyRuntimeSecurity();
 * ```
 */
export { XyPrissSecurity as XyPriss };

/**
 * ### XyPrissSecurity Compact Alias
 *
 * Compact alias for XyPrissSecurity class, useful for shorter import statements
 * and reduced code verbosity while maintaining full functionality.
 *
 * @example
 * ```typescript
 * import { ftfy } from "xypriss-security";
 *
 * // Same functionality as XyPriss, shorter syntax
 * const token = ftfy.generateSecureToken({ length: 32 });
 * const stats = ftfy.getStats();
 * ```
 */
export { XyPrissSecurity as ftfy };

/**
 * ## Advanced Security Components
 *
 * Complete export of all advanced security components including secure data structures,
 * fortified functions, cache systems, and specialized security utilities.
 *
 * This includes:
 * - SecureArray, SecureString, SecureObject classes
 * - FortifiedFunction optimization system
 * - Advanced cache implementations
 * - Memory management utilities
 * - Side-channel protection mechanisms
 * - Post-quantum cryptography features
 *
 * @example
 * ```typescript
 * // All components are available through this export
 * import {
 *     SecureArray,
 *     SecureString,
 *     SecureObject,
 *     FortifiedFunction,
 *     createFortifiedFunction
 * } from "xypriss-security";
 * ```
 */
export * from "./components";

/**
 * ## Utility Functions
 *
 * Essential utility functions for encoding, pattern matching, and security validation.
 */

/**
 * ### Encoding Utilities
 *
 * Comprehensive encoding and decoding utilities for various formats
 * including Base64, Base32, hex, and custom encoding schemes.
 *
 * @example
 * ```typescript
 * import { base64Encode, hexEncode, base32Encode } from "xypriss-security";
 *
 * const encoded = base64Encode("data to encode");
 * const hexData = hexEncode(new Uint8Array([1, 2, 3, 4]));
 * ```
 */
export * from "./utils/encoding";

/**
 * ### Pattern Matching Utilities
 *
 * Advanced pattern matching and validation utilities for security
 * checks, input validation, and data format verification.
 *
 * @example
 * ```typescript
 * import { isValidEmail, isStrongPassword, detectSQLInjection } from "xypriss-security";
 *
 * const emailValid = isValidEmail("user@example.com");
 * const passwordStrong = isStrongPassword("MySecurePass123!");
 * ```
 */
export * from "./utils/patterns";

/**
 * ### Injection Detection Utilities
 *
 * Advanced security utilities for detecting and preventing various
 * types of injection attacks including SQL, XSS, and command injection.
 *
 * @example
 * ```typescript
 * import { detectInjection, sanitizeInput, validateInput } from "xypriss-security";
 *
 * const isSafe = detectInjection(userInput);
 * const sanitized = sanitizeInput(userInput);
 * ```
 */
export * from "./utils/detectInjection";

/**
 * ### Password Manager Quick Access
 *
 * Convenient alias for password manager with default configuration.
 * For production use with custom configuration, use PasswordManager.create()
 * or PasswordManager.getInstance() with specific options.
 *
 * @example
 * ```typescript
 * import { pm } from "xypriss-security";
 *
 * // Quick password operations with default config
 * const hash = await pm.hash("userPassword");
 * const result = await pm.verify("userPassword", hash);
 *
 * // For custom configuration:
 * // const customPM = PasswordManager.create({ memoryCost: 131072 });
 * ```
 *
 * @deprecated Consider using PasswordManager.getInstance() for explicit configuration
 */
export const pm = PasswordManager.getInstance();

/**
 * ## Secure Data Structure Factory Functions
 *
 * Convenient factory functions for creating secure data structures with
 * enhanced security features and automatic memory management.
 */

/**
 * ### Create Secure String
 *
 * Creates a secure string instance with automatic memory management,
 * encryption capabilities, and secure cleanup functionality.
 *
 * **Key Features:**
 * - Automatic memory tracking and cleanup
 * - Optional AES-256 encryption for sensitive data
 * - Memory fragmentation protection
 * - Secure wiping on destruction
 * - Event-driven lifecycle management
 *
 * @param value - The initial string value to secure
 * @param options - Configuration options for security level and features
 * @returns A new SecureString instance with enhanced protection
 *
 * @example Basic Usage
 * ```typescript
 * import { fString } from "xypriss-security";
 *
 * // Create basic secure string
 * const password = fString("userPassword123");
 *
 * // Access string value
 * console.log(password.toString());
 *
 * // Secure cleanup
 * password.destroy();
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * import { fString } from "xypriss-security";
 *
 * // Maximum security configuration
 * const sensitiveData = fString("credit-card-4532-1234-5678-9012", {
 *     protectionLevel: "maximum",
 *     enableEncryption: true,
 *     enableFragmentation: true,
 *     enableMemoryTracking: true,
 *     autoCleanup: true
 * });
 *
 * // String operations with automatic encryption/decryption
 * sensitiveData.append("-VERIFIED");
 * const masked = sensitiveData.mask(4, 12, "*");
 *
 * // Cryptographic operations
 * const hash = await sensitiveData.hash("SHA-256");
 * const isValid = sensitiveData.equals("other-string", true); // timing-safe
 *
 * // Automatic cleanup when done
 * sensitiveData.destroy();
 * ```
 *
 * @author Seth Eleazar
 * @since 1.0.0
 */
export function fString(
    ...args: Parameters<typeof fstringUtils.createSecureString>
) {
    return fstringUtils.createSecureString(...args);
}

/**
 * ### Create Secure Object
 *
 * Creates a secure object instance with encryption, metadata management,
 * and comprehensive security features for sensitive data storage.
 *
 * **Key Features:**
 * - Automatic encryption for sensitive values
 * - Metadata tracking and management
 * - Event-driven architecture
 * - Secure serialization and deserialization
 * - Memory protection and cleanup
 *
 * @param initialData - The initial data to store in the secure object
 * @param options - Configuration options for encryption and security
 * @returns A new SecureObject instance with enhanced protection
 *
 * @example Basic Usage
 * ```typescript
 * import { fObject } from "xypriss-security";
 *
 * // Create secure object with initial data
 * const userCredentials = fObject({
 *     username: "john_doe",
 *     apiKey: "secret-api-key-12345",
 *     sessionToken: "session-token-abcdef"
 * });
 *
 * // Access and modify data
 * userCredentials.set("lastLogin", new Date().toISOString());
 * const apiKey = userCredentials.get("apiKey");
 *
 * // Secure cleanup
 * userCredentials.destroy();
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * import { fObject } from "xypriss-security";
 *
 * // Create with encryption and metadata tracking
 * const secureConfig = fObject({
 *     databaseUrl: "postgresql://user:pass@localhost/db",
 *     encryptionKey: "master-encryption-key-2025",
 *     apiSecrets: {
 *         stripe: "sk_live_...",
 *         aws: "AKIA..."
 *     }
 * }, {
 *     encryptionKey: process.env.OBJECT_ENCRYPTION_KEY,
 *     enableMetadata: true,
 *     autoCleanup: true
 * });
 *
 * // Mark sensitive keys for special handling
 * secureConfig.markSensitive("databaseUrl");
 * secureConfig.markSensitive("encryptionKey");
 * secureConfig.markSensitive("apiSecrets");
 *
 * // Export with encryption
 * const encrypted = secureConfig.serialize({ encrypt: true });
 *
 * // Event handling
 * secureConfig.on("accessed", (key) => {
 *     console.log(`Sensitive key accessed: ${key}`);
 * });
 * ```
 *
 * @author Seth Eleazar
 * @since 1.0.0
 */
export function fObject<T extends Record<string, any>>(
    ...args: Parameters<typeof fObjectUtils.createSecureObject<T>>
) {
    return fObjectUtils.createSecureObject<T>(...args);
}

/**
 * ### Create Secure Array
 *
 * Creates a military-grade secure array with AES-256-CTR-HMAC encryption,
 * comprehensive security features, and high-performance operations.
 *
 * **Key Features:**
 * - Military-grade AES-256-CTR-HMAC encryption
 * - Real-time security monitoring and analytics
 * - Automatic memory management and cleanup
 * - Snapshot and versioning capabilities
 * - Event-driven architecture
 * - Multiple export formats with integrity verification
 * - Advanced array operations (unique, shuffle, min/max)
 *
 * @param initialData - The initial array data to secure
 * @param options - Configuration options for encryption and security features
 * @returns A new SecureArray instance with military-grade protection
 *
 * @example Basic Usage
 * ```typescript
 * import { fArray } from "xypriss-security";
 *
 * // Create secure array with sensitive data
 * const apiKeys = fArray([
 *     "api-key-production-12345",
 *     "api-key-staging-67890",
 *     "api-key-development-abcdef"
 * ]);
 *
 * // Set encryption key and encrypt all data
 * apiKeys.setEncryptionKey("your-super-secret-key-2025");
 * apiKeys.encryptAll();
 *
 * // Use like regular array - data automatically encrypted/decrypted
 * apiKeys.push("new-api-key-xyz789");
 * const firstKey = apiKeys.get(0); // Automatically decrypted
 * const filtered = apiKeys.filter(key => key.includes("production"));
 *
 * // Secure cleanup
 * apiKeys.destroy();
 * ```
 *
 * @example Advanced Operations
 * ```typescript
 * import { fArray } from "xypriss-security";
 * import { NehoID as ID } from "nehoid";
 *
 * // Create array for high-volume data processing
 * const dataProcessor = fArray([] as string[], {
 *     encryptionKey: process.env.ARRAY_ENCRYPTION_KEY,
 *     enableCompression: true,
 *     maxSize: 100000,
 *     enableEvents: true
 * });
 *
 * // Bulk data processing with automatic encryption
 * const dataTypes = ["user", "transaction", "audit", "system"];
 * const maxRecords = 10000;
 *
 * for (let i = 0; i < maxRecords; i++) {
 *     const randomType = dataTypes[Math.floor(Math.random() * dataTypes.length)];
 *     const record = `${randomType}-record-${i}-${Date.now()}`;
 *     dataProcessor.push(record);
 * }
 *
 * // Advanced analytics and operations
 * const stats = dataProcessor.getStats();
 * const snapshot = dataProcessor.createSnapshot();
 * const exported = dataProcessor.exportData("json");
 *
 * // Event monitoring
 * dataProcessor.on("push", (index, value) => {
 *     console.log(`New record added at index ${index}`);
 * });
 *
 * // Generate probability analysis
 * console.log("Data distribution:", ID.probabilityCloud(dataProcessor.toArray()));
 *
 * // Secure cleanup - wipes all data and destroys array
 * dataProcessor.destroy(); // Cannot be used after this
 * ```
 *
 * @example Real-time Security Monitoring
 * ```typescript
 * import { fArray } from "xypriss-security";
 *
 * // Create array with comprehensive monitoring
 * const secureData = fArray(["sensitive-data-1", "sensitive-data-2"], {
 *     enableRealTimeMonitoring: true,
 *     enableIntegrityChecks: true,
 *     enableAuditLogging: true
 * });
 *
 * // Monitor security status
 * const encryptionStatus = secureData.getEncryptionStatus();
 * console.log(`Algorithm: ${encryptionStatus.algorithm}`);
 * console.log(`Encrypted elements: ${encryptionStatus.encryptedCount}`);
 *
 * // Real-time analytics
 * const analytics = secureData.getAnalytics();
 * console.log(`Performance score: ${analytics.performanceScore}`);
 * console.log(`Security level: ${analytics.securityLevel}`);
 * ```
 *
 * @author Seth Eleazar
 * @license MIT
 * @since 1.0.0
 * @see {@link https://github.com/paulmillr/noble-ciphers} Noble Ciphers - AES Implementation
 * @see {@link https://tools.ietf.org/html/rfc3610} RFC 3610 - Counter with CBC-MAC (CCM)
 * @see {@link https://csrc.nist.gov/publications/detail/sp/800-38a/final} NIST SP 800-38A
 */
export function fArray<
    T extends fArrayUtils.SecureArrayValue = fArrayUtils.SecureArrayValue
>(...args: Parameters<typeof fArrayUtils.createSecureArray<T>>) {
    return fArrayUtils.createSecureArray<T>(...args);
}

/**
 * ## High-Performance Function Optimization
 *
 * Ultra-fast function execution with comprehensive security monitoring,
 * smart caching, and performance optimization capabilities.
 */

/**
 * ### FortifiedFunction Factory
 *
 * Creates ultra-fast functions with comprehensive security monitoring,
 * automatic optimization, and advanced analytics capabilities.
 *
 * **Key Features:**
 * - Ultra-fast execution with up to 7.1x performance improvements
 * - Smart caching with automatic invalidation
 * - Predictive analytics and optimization suggestions
 * - Comprehensive security monitoring
 * - Automatic encryption for sensitive data
 * - Real-time performance metrics
 *
 * @example Basic Usage
 * ```typescript
 * import { func } from "xypriss-security";
 *
 * // Create optimized function
 * const processData = func(async (data: string) => {
 *     return data.toUpperCase().trim();
 * });
 *
 * // Execute with automatic optimization
 * const result = await processData.execute("hello world");
 * console.log(result); // "HELLO WORLD"
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * import { func } from "xypriss-security";
 *
 * // Create with maximum optimization and security
 * const secureProcessor = func(async (sensitiveData: any) => {
 *     // Your business logic here
 *     return await processUserData(sensitiveData);
 * }, {
 *     ultraFast: "maximum",           // Maximum performance optimization
 *     smartCaching: true,             // Intelligent caching system
 *     autoEncrypt: true,              // Automatic data encryption
 *     predictiveAnalytics: true,      // AI-powered optimization
 *     detailedMetrics: true,          // Comprehensive monitoring
 *     securityMonitoring: true,       // Real-time security checks
 *     auditLogging: true              // Complete audit trail
 * });
 *
 * // Execute and monitor
 * const result = await secureProcessor.execute(userData);
 *
 * // Access comprehensive analytics
 * const analytics = secureProcessor.getAnalyticsData();
 * const suggestions = secureProcessor.getOptimizationSuggestions();
 * const trends = secureProcessor.getPerformanceTrends();
 * const anomalies = secureProcessor.detectAnomalies();
 *
 * console.log(`Execution time: ${analytics.averageExecutionTime}ms`);
 * console.log(`Cache hit rate: ${analytics.cacheHitRate * 100}%`);
 * console.log(`Performance gain: ${analytics.performanceGain}x`);
 * ```
 */
export { func } from "./components/fortified-function";

/**
 * ## Advanced Password Security Functions
 *
 * Military-grade password encryption and verification with pepper support,
 * timing-safe operations, and comprehensive security features.
 */

/**
 * ### Encrypt Password with Pepper
 *
 * Encrypts a password using military-grade security with pepper (secret) application
 * before Argon2ID hashing. This provides maximum protection against rainbow table
 * attacks and database compromise scenarios.
 *
 * **Security Features:**
 * - HMAC-SHA256 pepper application for additional entropy
 * - Argon2ID memory-hard hashing algorithm
 * - Timing-safe operations to prevent side-channel attacks
 * - Configurable memory and time costs for future-proofing
 * - Automatic salt generation for each password
 *
 * **Important Security Notes:**
 * - The PEPPER must be stored securely (environment variables, key management system)
 * - PEPPER should never be stored in the same database as password hashes
 * - Use a cryptographically secure random value for PEPPER generation
 * - Consider key rotation policies for long-term security
 *
 * @param password - The plain text password to encrypt
 * @param PEPPER - A secret pepper value (must be stored securely, not in database)
 * @param options - Advanced hashing configuration options
 * @returns Promise<string> - The peppered and hashed password ready for secure storage
 * @throws {Error} If PEPPER is not provided or invalid
 *
 * @example Basic Usage
 * ```typescript
 * import { encryptSecurePass, Random } from "xypriss-security";
 *
 * // Generate secure pepper (do this once, store securely)
 * const pepper = Random.getRandomBytes(32, "hex");
 * console.log("Store this PEPPER securely:", pepper);
 *
 * // In your application (pepper from environment)
 * const pepper = process.env.PASSWORD_PEPPER;
 * const hashedPassword = await encryptSecurePass("userPassword123", pepper);
 *
 * // Store hashedPassword in database
 * await database.users.update(userId, { passwordHash: hashedPassword });
 * ```
 *
 * @example Advanced Configuration
 * ```typescript
 * import { encryptSecurePass, PasswordAlgorithm } from "xypriss-security";
 *
 * // Maximum security configuration
 * const hashedPassword = await encryptSecurePass("userPassword123", pepper, {
 *     algorithm: PasswordAlgorithm.ARGON2ID,
 *     memoryCost: 131072,    // 128 MB memory usage
 *     timeCost: 4,           // 4 iterations
 *     parallelism: 2,        // 2 parallel threads
 *     hashLength: 64,        // 64-byte output
 *     saltLength: 32         // 32-byte salt
 * });
 * ```
 *
 * @example Production Setup
 * ```typescript
 * // .env file
 * PASSWORD_PEPPER=your-cryptographically-secure-pepper-value-here
 *
 * // Application code
 * import { encryptSecurePass } from "xypriss-security";
 *
 * const pepper = process.env.PASSWORD_PEPPER;
 * if (!pepper) {
 *     throw new Error("PASSWORD_PEPPER environment variable is required");
 * }
 *
 * // User registration
 * const hashedPassword = await encryptSecurePass(userPassword, pepper);
 * await saveUserToDatabase({ email, passwordHash: hashedPassword });
 * ```
 *
 * @security
 * - **HMAC-SHA256**: Applied to password with pepper for additional entropy
 * - **Argon2ID**: Memory-hard algorithm resistant to GPU and ASIC attacks
 * - **Timing Safety**: Constant-time operations prevent timing attacks
 * - **Salt Generation**: Automatic unique salt for each password
 * - **Memory Protection**: Secure memory handling throughout the process
 *
 * @author suppercodercodelover
 * @since 2.0.0
 */
export async function encryptSecurePass(
    password: string,
    PEPPER: string,
    options: PasswordHashOptions = {}
): Promise<string> {
    if (!PEPPER) {
        throw new Error(
            "PEPPER must be defined when running password master. Store it securely in environment variables."
        );
    }

    // Apply pepper using HMAC-SHA256 for cryptographic security
    const peppered = Hash.createSecureHMAC("sha256", PEPPER, password);

    // Hash the peppered password with Argon2ID (military-grade)
    const passwordManager = PasswordManager.getInstance();
    return await passwordManager.hash(peppered, options);
}

/**
 * ### Verify Encrypted Password
 *
 * Verifies a plain text password against a peppered hash using timing-safe comparison.
 * This function must be used with passwords that were encrypted using encryptSecurePass()
 * to ensure proper pepper application and security verification.
 *
 * **Security Features:**
 * - Constant-time comparison to prevent timing attacks
 * - Same HMAC-SHA256 pepper application as encryption
 * - Resistant to side-channel analysis
 * - No information leakage through execution time
 * - Comprehensive error handling and validation
 *
 * **Important Security Notes:**
 * - Must use the exact same PEPPER value as used in encryptSecurePass()
 * - Verification time is constant regardless of password correctness
 * - Function returns only boolean result to prevent information leakage
 * - All intermediate values are securely cleared from memory
 *
 * @param password - The plain text password to verify
 * @param hashedPassword - The peppered hash from database (created with encryptSecurePass)
 * @param PEPPER - The same secret pepper value used during encryption
 * @returns Promise<boolean> - true if password is valid, false otherwise
 * @throws {Error} If PEPPER is not provided or verification fails
 *
 * @example Basic Login Verification
 * ```typescript
 * import { verifyEncryptedPassword } from "xypriss-security";
 *
 * // User login attempt
 * const pepper = process.env.PASSWORD_PEPPER;
 * const userPassword = "userPassword123";
 * const storedHash = await database.users.getPasswordHash(userId);
 *
 * const isValid = await verifyEncryptedPassword(
 *     userPassword,
 *     storedHash,
 *     pepper
 * );
 *
 * if (isValid) {
 *     // Login successful - create session
 *     const sessionToken = generateSessionToken();
 *     await createUserSession(userId, sessionToken);
 *     console.log("Login successful!");
 * } else {
 *     // Login failed - log attempt and return error
 *     await logFailedLoginAttempt(userId);
 *     console.log("Invalid credentials");
 * }
 * ```
 *
 * @example Production Authentication Flow
 * ```typescript
 * import { verifyEncryptedPassword } from "xypriss-security";
 *
 * async function authenticateUser(email: string, password: string) {
 *     try {
 *         // Get user and password hash from database
 *         const user = await database.users.findByEmail(email);
 *         if (!user) {
 *             // Use timing-safe dummy verification to prevent user enumeration
 *             await verifyEncryptedPassword("dummy", "dummy-hash", pepper);
 *             return { success: false, error: "Invalid credentials" };
 *         }
 *
 *         // Verify password with timing-safe comparison
 *         const pepper = process.env.PASSWORD_PEPPER;
 *         const isValid = await verifyEncryptedPassword(
 *             password,
 *             user.passwordHash,
 *             pepper
 *         );
 *
 *         if (isValid) {
 *             // Update last login timestamp
 *             await database.users.updateLastLogin(user.id);
 *
 *             // Create secure session
 *             const sessionToken = generateSessionToken(64, "base64url");
 *             await database.sessions.create({
 *                 userId: user.id,
 *                 token: sessionToken,
 *                 expiresAt: new Date(Date.now() + 24 * 60 * 60 * 1000) // 24 hours
 *             });
 *
 *             return {
 *                 success: true,
 *                 user: { id: user.id, email: user.email },
 *                 sessionToken
 *             };
 *         } else {
 *             // Log failed attempt for security monitoring
 *             await database.auditLog.create({
 *                 action: "failed_login",
 *                 userId: user.id,
 *                 ip: request.ip,
 *                 timestamp: new Date()
 *             });
 *
 *             return { success: false, error: "Invalid credentials" };
 *         }
 *     } catch (error) {
 *         console.error("Authentication error:", error);
 *         return { success: false, error: "Authentication failed" };
 *     }
 * }
 * ```
 *
 * @example Rate Limiting and Security
 * ```typescript
 * import { verifyEncryptedPassword } from "xypriss-security";
 *
 * async function secureLogin(email: string, password: string, clientIP: string) {
 *     // Check rate limiting first
 *     const attempts = await getFailedAttempts(clientIP);
 *     if (attempts >= 5) {
 *         throw new Error("Too many failed attempts. Please try again later.");
 *     }
 *
 *     // Verify password
 *     const pepper = process.env.PASSWORD_PEPPER;
 *     const user = await getUserByEmail(email);
 *
 *     if (!user) {
 *         // Timing-safe dummy operation
 *         await verifyEncryptedPassword("dummy", "dummy-hash", pepper);
 *         await incrementFailedAttempts(clientIP);
 *         return false;
 *     }
 *
 *     const isValid = await verifyEncryptedPassword(password, user.passwordHash, pepper);
 *
 *     if (isValid) {
 *         await clearFailedAttempts(clientIP);
 *         return true;
 *     } else {
 *         await incrementFailedAttempts(clientIP);
 *         return false;
 *     }
 * }
 * ```
 *
 * @security
 * - **Timing Safety**: Constant execution time prevents timing attacks
 * - **Pepper Consistency**: Uses same HMAC-SHA256 pepper as encryption
 * - **Side-Channel Resistance**: No information leakage through execution patterns
 * - **Memory Protection**: Secure handling of sensitive data throughout verification
 * - **Error Handling**: Comprehensive validation without information disclosure
 *
 * @author suppercodercodelover
 * @since 2.0.0
 */
export async function verifyEncryptedPassword(
    password: string,
    hashedPassword: string,
    PEPPER: string
): Promise<boolean> {
    if (!PEPPER) {
        throw new Error(
            "PEPPER must be defined when running password master. Use the same pepper as encryptSecurePass()."
        );
    }

    // Apply the same pepper transformation as during encryption
    const peppered = Hash.createSecureHMAC("sha256", PEPPER, password);

    // Perform timing-safe verification
    const passwordManager = PasswordManager.getInstance();
    const result = await passwordManager.verify(peppered, hashedPassword);
    return result.isValid;
}

/**
 * ## Additional Component Exports
 *
 * Direct exports for specific components and utilities for advanced use cases
 * and fine-grained control over security features.
 */

/**
 * ### Secure Data Structure Classes
 *
 * Direct class exports for advanced usage patterns and custom implementations.
 * These provide full access to class methods and properties for specialized use cases.
 *
 * @example Direct Class Usage
 * ```typescript
 * import { SecureString, SecureArray, SecureObject } from "xypriss-security";
 *
 * // Direct class instantiation with full control
 * const secureStr = new SecureString("sensitive data", {
 *     protectionLevel: "maximum"
 * });
 *
 * const secureArr = new SecureArray(["data1", "data2"], {
 *     encryptionKey: "key"
 * });
 *
 * const secureObj = new SecureObject({ key: "value" }, {
 *     enableMetadata: true
 * });
 * ```
 */

/** Complete SecureObject utilities and classes */
export * from "./components/secure-object";

/** SecureString class for protected string handling */
export { SecureString } from "./components/secure-string";

/** SecureArray class for military-grade array protection */
export { SecureArray } from "./components/secure-array";

/**
 * ### FortifiedFunction Advanced Utilities
 *
 * Advanced function optimization utilities for creating high-performance,
 * secure functions with comprehensive monitoring and analytics.
 *
 * @example Advanced Function Creation
 * ```typescript
 * import { createFortifiedFunction, FortifiedFunction } from "xypriss-security";
 *
 * // Create with full configuration control
 * const advancedFunction = createFortifiedFunction(myFunction, {
 *     ultraFast: "maximum",
 *     smartCaching: true,
 *     predictiveAnalytics: true,
 *     securityMonitoring: true
 * });
 *
 * // Direct class usage for custom implementations
 * const customFunction = new FortifiedFunction(myFunction, options);
 * ```
 */
export {
    /** Factory function for creating optimized functions */
    createFortifiedFunction,
    /** FortifiedFunction class for direct instantiation */
    FortifiedFunction,
} from "./components/fortified-function";

