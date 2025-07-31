/**
 * @author iDevo
 * Enhanced RSA Key Size Calculator
 * Calculates appropriate RSA key size based on data size with improved security and performance
 */

import * as crypto from "crypto";

// Enhanced constants for better maintainability and security
const HASH_SIZES = {
    sha1: 20, // Deprecated - included for legacy support only
    sha224: 28,
    sha256: 32, // Recommended default
    sha384: 48, // High security
    sha512: 64, // Maximum security
    sha3_256: 32,
    sha3_384: 48,
    sha3_512: 64,
} as const;

// Security level mappings for key strength assessment
const SECURITY_LEVELS = {
    minimal: {
        bits: 80,
        description: "Legacy compatibility only",
        minKeySize: 1024,
    },
    standard: {
        bits: 112,
        description: "Current standard security",
        minKeySize: 2048,
    },
    high: {
        bits: 128,
        description: "High security applications",
        minKeySize: 3072,
    },
    maximum: { bits: 256, description: "Maximum security", minKeySize: 15360 },
} as const;

const STANDARD_RSA_KEY_SIZES = [2048, 3072, 4096, 7680, 8192, 15360] as const;
const MIN_SECURE_KEY_SIZE = 2048; // NIST recommendation
const DEFAULT_HASH_ALGORITHM = "sha256";

// Performance thresholds
const PERFORMANCE_THRESHOLDS = {
    fast: 2048, // Fast operations
    balanced: 3072, // Balance of security and performance
    secure: 4096, // High security with acceptable performance
    maximum: 8192, // Maximum security, slower operations
} as const;

type HashAlgorithm = keyof typeof HASH_SIZES;
type StandardKeySize = (typeof STANDARD_RSA_KEY_SIZES)[number];
type SecurityLevel = keyof typeof SECURITY_LEVELS;
type PerformanceLevel = keyof typeof PERFORMANCE_THRESHOLDS;

interface RSAKeyPair {
    publicKey: string;
    privateKey: string;
    keySize: number;
    maxDataSize: number;
    hashAlgorithm: HashAlgorithm;
}

interface RSATestResult {
    success: boolean;
    error?: string;
    encryptedSize?: number;
    decryptedMatches?: boolean;
    performanceMs?: number;
}

interface RSARecommendation {
    keySize: number;
    maxDataSize: number;
    securityLevel: "minimal" | "standard" | "high" | "maximum";
    recommendation: string;
}

interface KeyValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
    securityScore: number; // 0-100
    recommendations: string[];
}

/**
 * Calculate OAEP padding overhead for given hash algorithm
 */
function calculateOAEPOverhead(hashAlgorithm: HashAlgorithm): number {
    const hashSize = HASH_SIZES[hashAlgorithm];
    return 2 * hashSize + 2;
}

/**
 * Validate input parameters
 */
function validateInputs(
    dataSize: number,
    rsaKeySize?: number,
    hashAlgorithm?: string
): void {
    if (!Number.isInteger(dataSize) || dataSize < 0) {
        throw new Error("Data size must be a non-negative integer");
    }

    if (dataSize > 1024 * 1024) {
        // 1MB limit for RSA
        console.warn(
            `Large data size (${dataSize} bytes) - consider hybrid encryption instead`
        );
    }

    if (rsaKeySize !== undefined) {
        if (!Number.isInteger(rsaKeySize) || rsaKeySize < MIN_SECURE_KEY_SIZE) {
            throw new Error(
                `RSA key size must be at least ${MIN_SECURE_KEY_SIZE} bits for security`
            );
        }

        if (rsaKeySize % 8 !== 0) {
            throw new Error("RSA key size must be divisible by 8");
        }
    }

    if (hashAlgorithm && !(hashAlgorithm in HASH_SIZES)) {
        throw new Error(
            `Unsupported hash algorithm: ${hashAlgorithm}. Supported: ${Object.keys(
                HASH_SIZES
            ).join(", ")}`
        );
    }
}

/**
 * Get security level based on key size
 */
function getSecurityLevel(keySize: number): RSARecommendation["securityLevel"] {
    if (keySize >= 8192) return "maximum";
    if (keySize >= 4096) return "high";
    if (keySize >= 3072) return "standard";
    return "minimal";
}

/**
 * Calculate the minimum RSA key size needed for the given data size
 * @param dataSize - Size of data to encrypt in bytes
 * @param hashAlgorithm - Hash algorithm for OAEP padding (default: sha256)
 * @param allowCustomSize - Allow non-standard key sizes (default: false)
 * @returns Recommended RSA key size in bits
 */
export function calculateRSAKeySize(
    dataSize: number,
    hashAlgorithm: HashAlgorithm = DEFAULT_HASH_ALGORITHM,
    allowCustomSize: boolean = false
): number {
    validateInputs(dataSize, undefined, hashAlgorithm);

    const oaepOverhead = calculateOAEPOverhead(hashAlgorithm);
    const requiredKeyBytes = dataSize + oaepOverhead;
    const requiredKeyBits = requiredKeyBytes * 8;

    // Find the smallest standard key size that can accommodate the data
    for (const keySize of STANDARD_RSA_KEY_SIZES) {
        const maxDataSize = Math.floor(keySize / 8) - oaepOverhead;
        if (dataSize <= maxDataSize) {
            console.info(
                `Data size: ${dataSize} bytes, selected RSA key size: ${keySize} bits (max data: ${maxDataSize} bytes)`
            );
            return keySize;
        }
    }

    // Handle cases where data is too large for standard sizes
    if (!allowCustomSize) {
        const maxStandardSize = Math.max(...STANDARD_RSA_KEY_SIZES);
        const maxDataForLargest =
            Math.floor(maxStandardSize / 8) - oaepOverhead;
        throw new Error(
            `Data size ${dataSize} bytes exceeds maximum for standard RSA keys (max: ${maxDataForLargest} bytes). ` +
                `Consider using hybrid encryption (RSA + AES) or set allowCustomSize=true.`
        );
    }

    // Calculate custom size rounded up to nearest 1024 bits
    const customKeySize = Math.ceil(requiredKeyBits / 1024) * 1024;
    console.warn(
        `Data size ${dataSize} bytes requires custom RSA key size: ${customKeySize} bits`
    );
    return customKeySize;
}

/**
 * Generate RSA key pair with appropriate size for the given data
 * @param dataSize - Size of data to encrypt in bytes
 * @param hashAlgorithm - Hash algorithm for OAEP padding
 * @param allowCustomSize - Allow non-standard key sizes
 * @returns RSA key pair with metadata
 */
export function generateRSAKeyPairForData(
    dataSize: number,
    hashAlgorithm: HashAlgorithm = DEFAULT_HASH_ALGORITHM,
    allowCustomSize: boolean = false
): RSAKeyPair {
    validateInputs(dataSize, undefined, hashAlgorithm);

    const keySize = calculateRSAKeySize(
        dataSize,
        hashAlgorithm,
        allowCustomSize
    );
    const maxDataSize = getMaxDataSizeForRSAKey(keySize, hashAlgorithm);

    console.info(
        `Generating RSA key pair with ${keySize} bits for data size ${dataSize} bytes`
    );

    try {
        const keyPair = crypto.generateKeyPairSync("rsa", {
            modulusLength: keySize,
            publicKeyEncoding: {
                type: "spki",
                format: "pem",
            },
            privateKeyEncoding: {
                type: "pkcs8",
                format: "pem",
                cipher: undefined, // No password protection by default
                passphrase: undefined,
            },
        });

        return {
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey,
            keySize,
            maxDataSize,
            hashAlgorithm,
        };
    } catch (error: any) {
        console.error(`Failed to generate RSA key pair: ${error.message}`);
        throw new Error(`RSA key generation failed: ${error.message}`);
    }
}

/**
 * Generate password-protected RSA key pair
 * @param dataSize - Size of data to encrypt in bytes
 * @param passphrase - Password to protect the private key
 * @param hashAlgorithm - Hash algorithm for OAEP padding
 * @returns Protected RSA key pair
 */
export function generateProtectedRSAKeyPairForData(
    dataSize: number,
    passphrase: string,
    hashAlgorithm: HashAlgorithm = DEFAULT_HASH_ALGORITHM
): RSAKeyPair {
    validateInputs(dataSize, undefined, hashAlgorithm);

    if (!passphrase || passphrase.length < 8) {
        throw new Error("Passphrase must be at least 8 characters long");
    }

    const keySize = calculateRSAKeySize(dataSize, hashAlgorithm);
    const maxDataSize = getMaxDataSizeForRSAKey(keySize, hashAlgorithm);

    try {
        const keyPair = crypto.generateKeyPairSync("rsa", {
            modulusLength: keySize,
            publicKeyEncoding: {
                type: "spki",
                format: "pem",
            },
            privateKeyEncoding: {
                type: "pkcs8",
                format: "pem",
                cipher: "aes-256-cbc",
                passphrase: passphrase,
            },
        });

        return {
            publicKey: keyPair.publicKey,
            privateKey: keyPair.privateKey,
            keySize,
            maxDataSize,
            hashAlgorithm,
        };
    } catch (error: any) {
        console.error(
            `Failed to generate protected RSA key pair: ${error.message}`
        );
        throw new Error(
            `Protected RSA key generation failed: ${error.message}`
        );
    }
}

/**
 * Get maximum data size that can be encrypted with a given RSA key size
 * @param rsaKeySize - RSA key size in bits
 * @param hashAlgorithm - Hash algorithm used for OAEP
 * @returns Maximum data size in bytes
 */
export function getMaxDataSizeForRSAKey(
    rsaKeySize: number,
    hashAlgorithm: HashAlgorithm = DEFAULT_HASH_ALGORITHM
): number {
    validateInputs(0, rsaKeySize, hashAlgorithm);

    const oaepOverhead = calculateOAEPOverhead(hashAlgorithm);
    const keyBytes = Math.floor(rsaKeySize / 8);
    const maxDataSize = keyBytes - oaepOverhead;

    if (maxDataSize <= 0) {
        throw new Error(
            `RSA key size ${rsaKeySize} is too small for ${hashAlgorithm} OAEP padding`
        );
    }

    return maxDataSize;
}

/**
 * Validate if data can be encrypted with the given RSA key
 * @param dataSize - Size of data in bytes
 * @param rsaKeySize - RSA key size in bits
 * @param hashAlgorithm - Hash algorithm used for OAEP
 * @returns Validation result with details
 */
export function validateDataSizeForRSAKey(
    dataSize: number,
    rsaKeySize: number,
    hashAlgorithm: HashAlgorithm = DEFAULT_HASH_ALGORITHM
): { valid: boolean; maxDataSize: number; recommendation?: string } {
    validateInputs(dataSize, rsaKeySize, hashAlgorithm);

    const maxDataSize = getMaxDataSizeForRSAKey(rsaKeySize, hashAlgorithm);
    const valid = dataSize <= maxDataSize;

    let recommendation: string | undefined;
    if (!valid) {
        const requiredKeySize = calculateRSAKeySize(
            dataSize,
            hashAlgorithm,
            true
        );
        recommendation = `Data size ${dataSize} bytes requires at least ${requiredKeySize} bits RSA key`;
    } else if (dataSize > 245) {
        // Typical AES key size
        recommendation =
            "Consider using hybrid encryption (RSA + AES) for better performance with large data";
    }

    return { valid, maxDataSize, recommendation };
}

/**
 * Get RSA key size recommendations for different security levels
 * @param dataSize - Size of data to encrypt in bytes
 * @param hashAlgorithm - Hash algorithm for OAEP padding
 * @returns Array of recommendations
 */
export function getRSARecommendations(
    dataSize: number,
    hashAlgorithm: HashAlgorithm = DEFAULT_HASH_ALGORITHM
): RSARecommendation[] {
    validateInputs(dataSize, undefined, hashAlgorithm);

    const recommendations: RSARecommendation[] = [];

    for (const keySize of STANDARD_RSA_KEY_SIZES) {
        const maxDataSize = getMaxDataSizeForRSAKey(keySize, hashAlgorithm);
        if (dataSize <= maxDataSize) {
            const securityLevel = getSecurityLevel(keySize);
            let recommendation = `${keySize}-bit RSA provides ${securityLevel} security`;

            if (keySize === 2048) {
                recommendation += " (minimum recommended for new applications)";
            } else if (keySize >= 4096) {
                recommendation +=
                    " (recommended for high-security applications)";
            }

            recommendations.push({
                keySize,
                maxDataSize,
                securityLevel,
                recommendation,
            });
        }
    }

    return recommendations;
}

/**
 * Test RSA encryption/decryption with performance monitoring
 * @param dataSize - Size of test data in bytes
 * @param rsaKeySize - RSA key size in bits
 * @param hashAlgorithm - Hash algorithm for OAEP padding
 * @param iterations - Number of test iterations for performance measurement
 * @returns Comprehensive test result
 */
export async function testRSAWithDataSize(
    dataSize: number,
    rsaKeySize: number,
    hashAlgorithm: HashAlgorithm = DEFAULT_HASH_ALGORITHM,
    iterations: number = 1
): Promise<RSATestResult> {
    try {
        validateInputs(dataSize, rsaKeySize, hashAlgorithm);

        if (iterations < 1 || iterations > 1000) {
            throw new Error("Iterations must be between 1 and 1000");
        }

        // Generate test data
        const testData = crypto.randomBytes(dataSize);

        // Generate RSA key pair
        const keyPair = crypto.generateKeyPairSync("rsa", {
            modulusLength: rsaKeySize,
            publicKeyEncoding: { type: "spki", format: "pem" },
            privateKeyEncoding: { type: "pkcs8", format: "pem" },
        });

        const startTime = process.hrtime.bigint();
        let encryptedSize = 0;
        let allDecryptedMatch = true;

        // Run multiple iterations for performance testing
        for (let i = 0; i < iterations; i++) {
            // Test encryption
            const encrypted = crypto.publicEncrypt(
                {
                    key: keyPair.publicKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: hashAlgorithm,
                },
                testData
            );

            encryptedSize = encrypted.length;

            // Test decryption
            const decrypted = crypto.privateDecrypt(
                {
                    key: keyPair.privateKey,
                    padding: crypto.constants.RSA_PKCS1_OAEP_PADDING,
                    oaepHash: hashAlgorithm,
                },
                encrypted
            );

            if (!testData.equals(decrypted)) {
                allDecryptedMatch = false;
                break;
            }
        }

        const endTime = process.hrtime.bigint();
        const performanceMs =
            Number(endTime - startTime) / 1_000_000 / iterations; // Average per iteration

        return {
            success: true,
            encryptedSize,
            decryptedMatches: allDecryptedMatch,
            performanceMs: Math.round(performanceMs * 100) / 100, // Round to 2 decimal places
        };
    } catch (error: any) {
        console.error(`RSA test failed: ${error.message}`);
        return {
            success: false,
            error: error.message,
        };
    }
}

/**
 * Benchmark RSA performance across different key sizes
 * @param dataSize - Size of test data in bytes
 * @param keySizes - Array of key sizes to test
 * @param iterations - Number of iterations per key size
 * @returns Performance comparison results
 */
export async function benchmarkRSAPerformance(
    dataSize: number,
    keySizes: number[] = [...STANDARD_RSA_KEY_SIZES],
    iterations: number = 10
): Promise<
    Array<{
        keySize: number;
        avgTimeMs: number;
        success: boolean;
        error?: string;
    }>
> {
    const results = [];

    for (const keySize of keySizes) {
        try {
            const validation = validateDataSizeForRSAKey(dataSize, keySize);
            if (!validation.valid) {
                results.push({
                    keySize,
                    avgTimeMs: 0,
                    success: false,
                    error: `Data too large for ${keySize}-bit key`,
                });
                continue;
            }

            const testResult = await testRSAWithDataSize(
                dataSize,
                keySize,
                DEFAULT_HASH_ALGORITHM,
                iterations
            );
            results.push({
                keySize,
                avgTimeMs: testResult.performanceMs || 0,
                success: testResult.success,
                error: testResult.error,
            });
        } catch (error: any) {
            results.push({
                keySize,
                avgTimeMs: 0,
                success: false,
                error: error.message,
            });
        }
    }

    return results;
}

/**
 * Utility to suggest hybrid encryption when RSA alone is inefficient
 * @param dataSize - Size of data to encrypt in bytes
 * @returns Suggestion for encryption approach
 */
export function getEncryptionSuggestion(dataSize: number): {
    approach: "rsa" | "hybrid";
    reason: string;
    details?: {
        aesKeySize: number;
        rsaKeySize: number;
        estimatedPerformanceGain?: string;
    };
} {
    validateInputs(dataSize);

    // Threshold where hybrid encryption becomes more efficient
    const hybridThreshold = 245; // Roughly AES-256 key size

    if (dataSize <= hybridThreshold) {
        return {
            approach: "rsa",
            reason: "Data size is small enough for direct RSA encryption",
        };
    }

    return {
        approach: "hybrid",
        reason: "Large data size - hybrid encryption (RSA + AES) recommended for better performance",
        details: {
            aesKeySize: 256, // AES-256 recommended
            rsaKeySize: 2048, // Minimum secure RSA size for key exchange
            estimatedPerformanceGain: "10-1000x faster encryption/decryption",
        },
    };
}

/**
 * Enhanced key validation with security assessment
 * @param publicKey - RSA public key in PEM format
 * @param privateKey - RSA private key in PEM format (optional)
 * @returns Comprehensive validation result
 */
export function validateRSAKeyPair(
    publicKey: string,
    privateKey?: string
): KeyValidationResult {
    const result: KeyValidationResult = {
        isValid: true,
        errors: [],
        warnings: [],
        securityScore: 100,
        recommendations: [],
    };

    try {
        // Validate public key format
        if (!publicKey.includes("-----BEGIN PUBLIC KEY-----")) {
            result.errors.push(
                "Invalid public key format - must be PEM encoded"
            );
            result.isValid = false;
            result.securityScore -= 50;
        }

        // Extract key size from public key
        const keyObject = crypto.createPublicKey(publicKey);
        // Get key size by checking the modulus length for RSA keys
        const keyDetails = keyObject.asymmetricKeyDetails as any;
        const keySize = keyDetails?.modulusLength || 0;

        // Security assessment based on key size
        if (keySize < 2048) {
            result.errors.push(
                `Key size ${keySize} bits is below minimum secure threshold (2048 bits)`
            );
            result.isValid = false;
            result.securityScore = 0;
        } else if (keySize < 3072) {
            result.warnings.push(
                `Key size ${keySize} bits provides minimal security - consider upgrading to 3072+ bits`
            );
            result.securityScore = Math.max(result.securityScore - 30, 0);
            result.recommendations.push(
                "Upgrade to 3072-bit or 4096-bit keys for better security"
            );
        } else if (keySize >= 4096) {
            result.recommendations.push(
                "Excellent key size for high-security applications"
            );
        }

        // Validate private key if provided
        if (privateKey) {
            if (
                !privateKey.includes("-----BEGIN PRIVATE KEY-----") &&
                !privateKey.includes("-----BEGIN RSA PRIVATE KEY-----") &&
                !privateKey.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----")
            ) {
                result.errors.push(
                    "Invalid private key format - must be PEM encoded"
                );
                result.isValid = false;
                result.securityScore -= 25;
            }

            // Check if private key is encrypted
            if (privateKey.includes("-----BEGIN ENCRYPTED PRIVATE KEY-----")) {
                result.recommendations.push(
                    "Private key is properly encrypted"
                );
            } else {
                result.warnings.push(
                    "Private key is not encrypted - consider adding passphrase protection"
                );
                result.securityScore = Math.max(result.securityScore - 20, 0);
                result.recommendations.push(
                    "Encrypt private key with a strong passphrase"
                );
            }
        }

        // Performance level assessment
        const performanceLevel = getPerformanceLevel(keySize);
        result.recommendations.push(`Performance level: ${performanceLevel}`);
    } catch (error: any) {
        result.errors.push(`Key validation failed: ${error.message}`);
        result.isValid = false;
        result.securityScore = 0;
    }

    return result;
}

/**
 * Get performance level based on key size
 */
function getPerformanceLevel(keySize: number): PerformanceLevel {
    if (keySize <= PERFORMANCE_THRESHOLDS.fast) return "fast";
    if (keySize <= PERFORMANCE_THRESHOLDS.balanced) return "balanced";
    if (keySize <= PERFORMANCE_THRESHOLDS.secure) return "secure";
    return "maximum";
}

/**
 * Enhanced security assessment for RSA configuration
 * @param keySize - RSA key size in bits
 * @param hashAlgorithm - Hash algorithm used
 * @param dataSize - Size of data to encrypt
 * @returns Security assessment with recommendations
 */
export function assessRSASecurity(
    keySize: number,
    hashAlgorithm: HashAlgorithm,
    dataSize: number
): {
    level: SecurityLevel;
    score: number;
    vulnerabilities: string[];
    recommendations: string[];
    compliance: {
        nist: boolean;
        fips: boolean;
        commonCriteria: boolean;
    };
} {
    const vulnerabilities: string[] = [];
    const recommendations: string[] = [];
    let score = 100;

    // Assess key size security
    let level: SecurityLevel = "minimal";
    if (keySize >= SECURITY_LEVELS.maximum.minKeySize) {
        level = "maximum";
    } else if (keySize >= SECURITY_LEVELS.high.minKeySize) {
        level = "high";
    } else if (keySize >= SECURITY_LEVELS.standard.minKeySize) {
        level = "standard";
    }

    // Check for deprecated algorithms
    if (hashAlgorithm === "sha1") {
        vulnerabilities.push(
            "SHA-1 is cryptographically broken and should not be used"
        );
        score -= 50;
        recommendations.push("Upgrade to SHA-256 or higher");
    }

    // Check key size adequacy
    if (keySize < 2048) {
        vulnerabilities.push(
            "Key size below 2048 bits is vulnerable to factorization attacks"
        );
        score = 0;
    } else if (keySize < 3072) {
        vulnerabilities.push(
            "Key size may be vulnerable to future quantum attacks"
        );
        score -= 20;
        recommendations.push(
            "Consider upgrading to 3072+ bits for quantum resistance"
        );
    }

    // Data size assessment
    if (dataSize > 245) {
        recommendations.push(
            "Consider hybrid encryption for better performance and security"
        );
    }

    // Compliance assessment
    const compliance = {
        nist: keySize >= 2048 && hashAlgorithm !== "sha1",
        fips:
            keySize >= 2048 &&
            ["sha256", "sha384", "sha512"].includes(hashAlgorithm),
        commonCriteria:
            keySize >= 3072 &&
            ["sha256", "sha384", "sha512"].includes(hashAlgorithm),
    };

    return {
        level,
        score: Math.max(score, 0),
        vulnerabilities,
        recommendations,
        compliance,
    };
}
