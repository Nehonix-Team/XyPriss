// Enhanced security imports with proper type safety
export interface SodiumInterface {
    ready: Promise<void> | boolean;
    randombytes_buf: (size: number) => Uint8Array;
    crypto_aead_chacha20poly1305_ietf_encrypt: (
        message: Uint8Array,
        additionalData: Uint8Array | null,
        secretNonce: Uint8Array | null,
        publicNonce: Uint8Array,
        key: Uint8Array
    ) => Uint8Array;
    crypto_aead_chacha20poly1305_ietf_decrypt: (
        secretNonce: Uint8Array | null,
        ciphertext: Uint8Array,
        additionalData: Uint8Array | null,
        publicNonce: Uint8Array,
        key: Uint8Array
    ) => Uint8Array;
}

interface NobleHashesInterface {
    sha256: (data: Uint8Array) => Uint8Array;
    sha512: (data: Uint8Array) => Uint8Array;
}

interface NobleCiphersInterface {
    chacha20poly1305: any;
    aes: any;
}

// Safe library instances
let sodium: SodiumInterface | null = null;
let nobleHashes: NobleHashesInterface | null = null;
let nobleCiphers: NobleCiphersInterface | null = null;

// Library status tracking
const libraryStatus = {
    sodium: false,
    nobleHashes: false,
    nobleCiphers: false,
};

// Safe library initialization with proper error handling
export async function initializeSecurityLibraries(): Promise<void> {
    // Initialize libsodium with proper async handling
    try {
        const sodiumLib = await import("libsodium-wrappers");
        if (sodiumLib.default) {
            // Wait for sodium to be ready if it has a ready promise
            if (
                sodiumLib.default.ready &&
                typeof sodiumLib.default.ready.then === "function"
            ) {
                await sodiumLib.default.ready;
            }

            // Verify required methods exist
            if (typeof sodiumLib.default.randombytes_buf === "function") {
                sodium = sodiumLib.default as SodiumInterface;
                libraryStatus.sodium = true;
                // console.log(
                //     "✔ libsodium-wrappers loaded successfully for SecureBuffer"
                // );
            }
        }
    } catch (e) {
        // console.warn(
        //     "⚠️ libsodium-wrappers not available for SecureBuffer:",
        //     (e as Error).message
        // );
    }

    // Initialize @noble/hashes using require for compatibility
    try {
        const nobleHashesLib = require("@noble/hashes/sha256");
        const nobleHashesLib512 = require("@noble/hashes/sha512");
        if (
            nobleHashesLib &&
            nobleHashesLib.sha256 &&
            nobleHashesLib512 &&
            nobleHashesLib512.sha512
        ) {
            nobleHashes = {
                sha256: nobleHashesLib.sha256,
                sha512: nobleHashesLib512.sha512,
            } as NobleHashesInterface;
            libraryStatus.nobleHashes = true;
            // console.log(
            //     "✔ @noble/hashes loaded successfully for SecureBuffer"
            // );
        }
    } catch (e) {
        // console.warn(
        //     "⚠️ @noble/hashes not available for SecureBuffer:",
        //     (e as Error).message
        // );
    }

    // Initialize @noble/ciphers using require for compatibility
    try {
        // Try importing specific submodules instead of root module
        const chachaLib = require("@noble/ciphers/chacha");
        const aesLib = require("@noble/ciphers/aes");
        if (chachaLib && aesLib) {
            nobleCiphers = {
                chacha20poly1305: chachaLib.chacha20poly1305,
                aes: aesLib,
            } as NobleCiphersInterface;
            libraryStatus.nobleCiphers = true;
            // console.log(
            //     "✔ @noble/ciphers loaded successfully for SecureBuffer"
            // );
        }
    } catch (e) {
        // Silently fail - this is optional
        // console.warn(
        //     "⚠️ @noble/ciphers not available for SecureBuffer:",
        //     (e as Error).message
        // );
    }
}

// Initialize libraries asynchronously and non-blocking
let initializationPromise: Promise<void> | null = null;

export function ensureLibrariesInitialized(): Promise<void> {
    if (!initializationPromise) {
        initializationPromise = initializeSecurityLibraries().catch(
            (_error) => {
                // Silently handle initialization errors - libraries are optional
                // console.error(
                //     "Failed to initialize security libraries for SecureBuffer:",
                //     error
                // );
            }
        );
    }
    return initializationPromise;
}

export { sodium, nobleHashes, nobleCiphers, libraryStatus };
