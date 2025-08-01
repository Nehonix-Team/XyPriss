/**
 * Random sources - Multiple entropy sources and library management
 */

import * as crypto from "crypto";
import {
    SodiumInterface,
    ForgeInterface,
    SecureRandomInterface,
    RandomBytesInterface,
    NobleHashesInterface,
    TweetNaClInterface,
    LibraryStatus,
    EntropySourceConfig,
} from "./random-types";

// ============================================================================
// LIBRARY INSTANCES
// ============================================================================

// Safe library instances with proper typing
let sodium: SodiumInterface | null = null;
let forge: ForgeInterface | null = null;
let secureRandomBytes: SecureRandomInterface | null = null;
let randombytes: RandomBytesInterface | null = null;
let nobleHashes: NobleHashesInterface | null = null;
let tweetnacl: TweetNaClInterface | null = null;

// Additional libraries for enhanced security
let kyber: any = null;
let entropyString: any = null;
let cryptoJs: any = null;
let elliptic: any = null;
let nobleCurves: any = null;

// Library availability flags
const libraryStatus: LibraryStatus = {
    sodium: false,
    forge: false,
    secureRandom: false,
    randombytes: false,
    nobleHashes: false,
    tweetnacl: false,
    kyber: false,
    entropyString: false,
    cryptoJs: false,
    elliptic: false,
    nobleCurves: false,
};

// ============================================================================
// LIBRARY INITIALIZATION
// ============================================================================

export class RandomSources {
    private static initialized = false;
    private static initializationPromise: Promise<void> | null = null;

    /**
     * Initialize all security libraries with comprehensive error handling
     */
    public static async initializeLibraries(): Promise<void> {
        if (RandomSources.initialized) {
            return;
        }

        if (RandomSources.initializationPromise) {
            return RandomSources.initializationPromise;
        }

        RandomSources.initializationPromise =
            RandomSources.performInitialization();
        await RandomSources.initializationPromise;
        RandomSources.initialized = true;
    }

    private static async performInitialization(): Promise<void> {
        // Initialize libsodium with proper async handling
        await RandomSources.initializeSodium();

        // Initialize other libraries
        RandomSources.initializeForge();
        RandomSources.initializeSecureRandom();
        RandomSources.initializeRandomBytes();
        RandomSources.initializeNobleHashes();
        RandomSources.initializeTweetNaCl();
        RandomSources.initializeAdditionalLibraries();
    }

    private static async initializeSodium(): Promise<void> {
        try {
            const sodiumLib = require("libsodium-wrappers");
            if (sodiumLib) {
                // Wait for sodium to be ready if it has a ready promise
                if (
                    sodiumLib.ready &&
                    typeof sodiumLib.ready.then === "function"
                ) {
                    await sodiumLib.ready;
                }

                // Verify required methods exist
                if (typeof sodiumLib.randombytes_buf === "function") {
                    sodium = sodiumLib as SodiumInterface;
                    libraryStatus.sodium = true;
                } else {
                    console.warn(
                        "⚠️ libsodium-wrappers loaded but randombytes_buf method not available"
                    );
                }
            }
        } catch (e) {
            console.warn(
                "⚠️ libsodium-wrappers not available:",
                (e as Error).message
            );
        }
    }

    private static initializeForge(): void {
        try {
            const forgeLib = require("node-forge");
            if (
                forgeLib &&
                forgeLib.random &&
                typeof forgeLib.random.getBytesSync === "function"
            ) {
                forge = forgeLib as ForgeInterface;
                libraryStatus.forge = true;
            }
        } catch (e) {
            console.warn("⚠️ node-forge not available:", (e as Error).message);
        }
    }

    private static initializeSecureRandom(): void {
        try {
            const secureRandomLib = require("secure-random");
            if (secureRandomLib) {
                if (
                    typeof secureRandomLib === "function" ||
                    typeof secureRandomLib.randomBytes === "function"
                ) {
                    secureRandomBytes =
                        secureRandomLib as SecureRandomInterface;
                    libraryStatus.secureRandom = true;
                }
            }
        } catch (e) {
            console.warn(
                "⚠️ secure-random not available:",
                (e as Error).message
            );
        }
    }

    private static initializeRandomBytes(): void {
        try {
            const randombytesLib = require("randombytes");
            if (randombytesLib && typeof randombytesLib === "function") {
                randombytes = randombytesLib as RandomBytesInterface;
                libraryStatus.randombytes = true;
            }
        } catch (e) {
            console.warn("⚠️ randombytes not available:", (e as Error).message);
        }
    }

    private static initializeNobleHashes(): void {
        try {
            // Import specific submodules instead of root module
            const sha256Lib = require("@noble/hashes/sha256");
            const sha512Lib = require("@noble/hashes/sha512");

            if (
                sha256Lib &&
                sha256Lib.sha256 &&
                sha512Lib &&
                sha512Lib.sha512
            ) {
                nobleHashes = {
                    sha256: sha256Lib.sha256,
                    sha512: sha512Lib.sha512,
                } as NobleHashesInterface;
                libraryStatus.nobleHashes = true;
            }
        } catch (e) {
            console.warn(
                "⚠️ @noble/hashes not available:",
                (e as Error).message
            );
        }
    }

    private static initializeTweetNaCl(): void {
        try {
            const tweetnaclLib = require("tweetnacl");
            if (
                tweetnaclLib &&
                typeof tweetnaclLib.randomBytes === "function"
            ) {
                tweetnacl = tweetnaclLib as TweetNaClInterface;
                libraryStatus.tweetnacl = true;
            }
        } catch (e) {
            console.warn("⚠️ tweetnacl not available:", (e as Error).message);
        }
    }

    private static initializeAdditionalLibraries(): void {
        // Initialize crystals-kyber
        try {
            kyber = require("crystals-kyber");
            libraryStatus.kyber = true;
        } catch (e) {
            console.warn("⚠️ crystals-kyber not available, using fallback");
        }

        // Initialize entropy-string
        try {
            entropyString = require("entropy-string");
            libraryStatus.entropyString = true;
        } catch (e) {
            console.warn("⚠️ entropy-string not available");
        }

        // Initialize crypto-js
        try {
            cryptoJs = require("crypto-js");
            libraryStatus.cryptoJs = true;
        } catch (e) {
            console.warn("⚠️ crypto-js not available");
        }

        // Initialize elliptic
        try {
            elliptic = require("elliptic");
            libraryStatus.elliptic = true;
        } catch (e) {
            console.warn("⚠️ elliptic not available");
        }

        // Initialize @noble/curves - import specific submodules
        try {
            // Import specific curve implementations instead of root module
            const secp256k1Lib = require("@noble/curves/secp256k1");
            const ed25519Lib = require("@noble/curves/ed25519");

            if (secp256k1Lib && ed25519Lib) {
                nobleCurves = {
                    secp256k1: secp256k1Lib,
                    ed25519: ed25519Lib,
                };
                libraryStatus.nobleCurves = true;
            }
        } catch (e) {
            console.warn("⚠️ @noble/curves not available");
        }
    }

    // ============================================================================
    // ENTROPY SOURCE MANAGEMENT
    // ============================================================================

    /**
     * Get system entropy from multiple CSPRNG sources (military-grade)
     */
    public static getSystemEntropy(size: number): Buffer {
        const sources: Buffer[] = [];

        // Primary: Node.js crypto
        try {
            sources.push(crypto.randomBytes(size));
        } catch (error) {
            console.warn("Node.js crypto randomBytes failed");
        }

        // Secondary: libsodium (if available)
        if (sodium && libraryStatus.sodium) {
            try {
                const sodiumBytes = sodium.randombytes_buf(size);
                sources.push(Buffer.from(sodiumBytes));
            } catch (error) {
                console.warn("libsodium randomBytes failed");
            }
        }

        // Tertiary: secure-random package (if available)
        if (secureRandomBytes && libraryStatus.secureRandom) {
            try {
                let secureBytes: Uint8Array;
                if (typeof secureRandomBytes === "function") {
                    secureBytes = secureRandomBytes(size);
                } else if ((secureRandomBytes as any).randomBytes) {
                    secureBytes = (secureRandomBytes as any).randomBytes(size);
                } else {
                    throw new Error("Invalid secure-random interface");
                }
                sources.push(Buffer.from(secureBytes));
            } catch (error) {
                console.warn("secure-random failed:", (error as Error).message);
            }
        }

        // Quaternary: randombytes package (if available)
        if (randombytes && libraryStatus.randombytes) {
            try {
                const randomBytesBuffer = randombytes(size);
                sources.push(randomBytesBuffer);
            } catch (error) {
                console.warn("randombytes failed");
            }
        }

        // Quinary: tweetnacl (if available)
        if (tweetnacl && libraryStatus.tweetnacl) {
            try {
                const naclBytes = tweetnacl.randomBytes(size);
                sources.push(Buffer.from(naclBytes));
            } catch (error) {
                console.warn("tweetnacl randomBytes failed");
            }
        }

        if (sources.length === 0) {
            // Ultimate fallback
            return RandomSources.getFallbackEntropy(size);
        }

        // Combine all entropy sources using cryptographic mixing
        return RandomSources.combineEntropySources(sources, size);
    }

    /**
     * Cryptographically combine multiple entropy sources
     */
    public static combineEntropySources(
        sources: Buffer[],
        targetSize: number
    ): Buffer {
        if (sources.length === 1) {
            return sources[0].slice(0, targetSize);
        }

        // XOR all sources together
        let combined = Buffer.alloc(targetSize);

        for (const source of sources) {
            for (let i = 0; i < targetSize; i++) {
                combined[i] ^= source[i % source.length];
            }
        }

        // Hash the combined result for uniform distribution
        const hash = crypto.createHash("sha512").update(combined).digest();
        return hash.slice(0, targetSize);
    }

    /**
     * Get fallback entropy when all other sources fail
     */
    public static getFallbackEntropy(size: number): Buffer {
        console.warn("Using fallback entropy - not cryptographically secure!");
        const buffer = Buffer.alloc(size);

        // Use multiple weak sources combined
        for (let i = 0; i < size; i++) {
            buffer[i] =
                Math.floor(Math.random() * 256) ^
                (Date.now() & 0xff) ^
                (Number(process.hrtime.bigint()) & 0xff);
        }

        return buffer;
    }

    /**
     * Get library status
     */
    public static getLibraryStatus(): LibraryStatus {
        return { ...libraryStatus };
    }

    /**
     * Get available entropy sources
     */
    public static getAvailableEntropySources(): EntropySourceConfig[] {
        const sources: EntropySourceConfig[] = [
            {
                name: "node-crypto",
                enabled: true,
                priority: 1,
                fallbackAvailable: true,
            },
            {
                name: "libsodium",
                enabled: libraryStatus.sodium,
                priority: 2,
                fallbackAvailable: false,
            },
            {
                name: "secure-random",
                enabled: libraryStatus.secureRandom,
                priority: 3,
                fallbackAvailable: false,
            },
            {
                name: "randombytes",
                enabled: libraryStatus.randombytes,
                priority: 4,
                fallbackAvailable: false,
            },
            {
                name: "tweetnacl",
                enabled: libraryStatus.tweetnacl,
                priority: 5,
                fallbackAvailable: false,
            },
        ];

        return sources.filter((source) => source.enabled);
    }

    /**
     * Test entropy source availability
     */
    public static testEntropySource(sourceName: string): boolean {
        try {
            switch (sourceName) {
                case "node-crypto":
                    crypto.randomBytes(1);
                    return true;
                case "libsodium":
                    if (sodium && libraryStatus.sodium) {
                        sodium.randombytes_buf(1);
                        return true;
                    }
                    return false;
                case "secure-random":
                    if (secureRandomBytes && libraryStatus.secureRandom) {
                        if (typeof secureRandomBytes === "function") {
                            secureRandomBytes(1);
                        } else if ((secureRandomBytes as any).randomBytes) {
                            (secureRandomBytes as any).randomBytes(1);
                        }
                        return true;
                    }
                    return false;
                default:
                    return false;
            }
        } catch (error) {
            return false;
        }
    }
}

// Initialize libraries immediately
RandomSources.initializeLibraries().catch((error) => {
    console.error("Failed to initialize security libraries:", error);
});
