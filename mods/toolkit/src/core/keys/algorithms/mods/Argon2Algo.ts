import { keyLogger } from "../../keys-logger";
import {
    AlgorithmBackend,
    KeyDerivationAlgorithm,
    KeyDerivationMetrics,
} from "../../keys-types";
import { PerformanceUtils } from "../../keys-utils";
import { ScryptAlgo } from "./ScryptAlgo";


/**
 * Argon2 implementation with multiple backends
 */
export class Argon2Algo {
    /**
     * Derive key using Argon2 with optimal backend selection
     */
    public static derive(
        password: Uint8Array,
        salt: Uint8Array,
        iterations: number,
        keyLength: number,
        variant: "argon2i" | "argon2d" | "argon2id" = "argon2id"
    ): {
        key: Uint8Array;
        backend: AlgorithmBackend;
        metrics: KeyDerivationMetrics;
    } {
        const startTime = performance.now();
        let backend: AlgorithmBackend;
        let key: Uint8Array;
        let error: string | undefined;

        try {
            // Primary: Node.js argon2 library (if available)
            if (this.canUseArgon2Library()) {
                const result = this.deriveWithNodeLibrary(
                    password,
                    salt,
                    iterations,
                    keyLength,
                    variant
                );
                backend = AlgorithmBackend.EXTERNAL_LIBRARY;
                key = result;
                keyLogger.debug("Argon2", "Using Node.js argon2 library");
            }
            // Secondary: Browser argon2-browser (if available and has sync API)
            else if (this.canUseBrowserArgon2()) {
                const result = this.deriveWithBrowserLibrary(
                    password,
                    salt,
                    iterations,
                    keyLength,
                    variant
                );
                backend = AlgorithmBackend.EXTERNAL_LIBRARY;
                key = result;
                keyLogger.debug("Argon2", "Using browser argon2 library");
            }
            // Fallback: Scrypt with equivalent parameters
            else {
                keyLogger.warn(
                    "Argon2",
                    "Argon2 not available, using Scrypt fallback"
                );
                const scryptCost = Math.min(
                    18,
                    Math.max(14, Math.floor(iterations / 2))
                );
                const scryptResult = ScryptAlgo.derive(
                    password,
                    salt,
                    scryptCost,
                    keyLength
                );
                backend = AlgorithmBackend.PURE_JS;
                key = scryptResult.key;
            }
        } catch (err) {
            error = err instanceof Error ? err.message : "Unknown error";
            throw err;
        } finally {
            const executionTime = performance.now() - startTime;
            const algorithm =
                variant === "argon2i"
                    ? KeyDerivationAlgorithm.ARGON2I
                    : variant === "argon2d"
                    ? KeyDerivationAlgorithm.ARGON2D
                    : KeyDerivationAlgorithm.ARGON2ID;

            const metrics: KeyDerivationMetrics = {
                algorithm,
                backend: backend!,
                executionTime,
                memoryUsage: PerformanceUtils.estimateMemoryUsage(key!),
                iterations,
                keyLength,
                success: !error,
                errorMessage: error,
                timestamp: Date.now(),
            };

            keyLogger.logMetrics(metrics);
            return { key: key!, backend: backend!, metrics };
        }
    }

    private static canUseArgon2Library(): boolean {
        try {
            if (typeof require === "function") {
                const argon2 = require("argon2");
                // Check if sync version is available (some versions have it)
                return (
                    typeof argon2.hashSync === "function" ||
                    typeof argon2.hash === "function"
                );
            }
            return false;
        } catch {
            return false;
        }
    }

    private static canUseBrowserArgon2(): boolean {
        try {
            if (
                typeof window !== "undefined" &&
                typeof require === "function"
            ) {
                const argon2Browser = require("argon2-browser");
                return typeof argon2Browser.hashSync === "function";
            }
            return false;
        } catch {
            return false;
        }
    }

    private static deriveWithNodeLibrary(
        password: Uint8Array,
        salt: Uint8Array,
        iterations: number,
        keyLength: number,
        variant: string
    ): Uint8Array {
        const argon2 = require("argon2");

        // Try sync version first if available
        if (typeof argon2.hashSync === "function") {
            const result = argon2.hashSync(Buffer.from(password), {
                type: argon2[variant] || argon2.argon2id,
                timeCost: iterations,
                memoryCost: 4096,
                parallelism: 1,
                salt: Buffer.from(salt),
                hashLength: keyLength,
                raw: true,
            });
            return new Uint8Array(result);
        }

        // If no sync version, throw error to trigger fallback
        throw new Error("Argon2 sync API not available");
    }

    private static deriveWithBrowserLibrary(
        password: Uint8Array,
        salt: Uint8Array,
        iterations: number,
        keyLength: number,
        _variant: string
    ): Uint8Array {
        const argon2Browser = require("argon2-browser");

        // Only use if synchronous API is available
        if (typeof argon2Browser.hashSync === "function") {
            const result = argon2Browser.hashSync({
                pass: password,
                salt: salt,
                time: iterations,
                mem: 4096,
                parallelism: 1,
                hashLen: keyLength,
                type: argon2Browser.ArgonType.Argon2id,
            });
            return new Uint8Array(result.hash);
        }

        throw new Error("Browser Argon2 sync API not available");
    }
}
