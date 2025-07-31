import { ALGORITHM_REGISTRY } from "../algorithms/registry";
import type {
    AlgorithmInfo,
    CryptoAlgorithm,
    HashAlgorithm,
} from "../types/string";

/**
 * Utility class for algorithm validation and information
 */
export class CryptoAlgorithmUtils {
    /**
     * Validates if an algorithm is supported
     */
    static isSupported(algorithm: string): algorithm is CryptoAlgorithm {
        return algorithm in ALGORITHM_REGISTRY;
    }

    /**
     * Gets algorithm information
     */
    static getInfo(algorithm: CryptoAlgorithm): AlgorithmInfo {
        return ALGORITHM_REGISTRY[algorithm];
    }

    /**
     * Checks if an algorithm is deprecated
     */
    static isDeprecated(algorithm: CryptoAlgorithm): boolean {
        return ALGORITHM_REGISTRY[algorithm].deprecated;
    }

    /**
     * Gets all algorithms by security level
     */
    static getAlgorithmsBySecurityLevel(
        level: AlgorithmInfo["securityLevel"]
    ): CryptoAlgorithm[] {
        return Object.entries(ALGORITHM_REGISTRY)
            .filter(([, info]) => info.securityLevel === level)
            .map(([algorithm]) => algorithm as CryptoAlgorithm);
    }

    /**
     * Gets recommended algorithms (non-deprecated, strong or very-strong)
     */
    static getRecommendedAlgorithms(): CryptoAlgorithm[] {
        return Object.entries(ALGORITHM_REGISTRY)
            .filter(
                ([, info]) =>
                    !info.deprecated &&
                    (info.securityLevel === "strong" ||
                        info.securityLevel === "very-strong")
            )
            .map(([algorithm]) => algorithm as CryptoAlgorithm);
    }

    /**
     * Validates algorithm and warns about deprecated ones
     */
    static validateAlgorithm(algorithm: string): HashAlgorithm {
        if (!this.isSupported(algorithm)) {
            throw new Error(
                `Unsupported algorithm: ${algorithm}. Supported: ${Object.keys(
                    ALGORITHM_REGISTRY
                ).join(", ")}`
            );
        }

        const info = this.getInfo(algorithm as CryptoAlgorithm);
        if (info.deprecated) {
            console.warn(
                `Warning: ${algorithm} is deprecated. ${info.description}`
            );
        }

        // For now, only return hash algorithms for the hash method
        const hashAlgorithms: HashAlgorithm[] = [
            "SHA-1",
            "SHA-256",
            "SHA-384",
            "SHA-512",
        ];
        if (!hashAlgorithms.includes(algorithm as HashAlgorithm)) {
            throw new Error(`Algorithm ${algorithm} is not a hash algorithm`);
        }

        return algorithm as HashAlgorithm;
    }
}
