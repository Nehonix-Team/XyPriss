import { BaseEncodingType } from "../types";

// Supported encoding types
export type EncodingType =
    | "hex"
    | "base64"
    | "base64url"
    | "base58"
    | "binary"
    | "utf8"
    //new
    | BaseEncodingType;

// Entropy quality levels
export enum EntropyQuality {
    POOR = "POOR",
    FAIR = "FAIR",
    GOOD = "GOOD",
    EXCELLENT = "EXCELLENT",
    QUANTUM_SAFE = "QUANTUM_SAFE",
}

// Random number generator states
export enum RNGState {
    UNINITIALIZED = "UNINITIALIZED",
    INITIALIZING = "INITIALIZING",
    READY = "READY",
    RESEEDING = "RESEEDING",
    ERROR = "ERROR",
}

// Military-grade security imports with comprehensive error handling and type safety
export interface SodiumInterface {
    ready: Promise<void> | boolean;
    randombytes_buf: (size: number) => Uint8Array;
    crypto_secretbox_NONCEBYTES: number;
    crypto_secretbox_KEYBYTES: number;
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

export interface ForgeInterface {
    random: {
        getBytesSync: (count: number) => string;
    };
}

export interface SecureRandomInterface {
    randomBytes?: (size: number) => Uint8Array;
    (size: number): Uint8Array; // Call signature for direct invocation
}

export interface RandomBytesInterface {
    (size: number): Buffer;
}

export interface TweetNaClInterface {
    randomBytes: (size: number) => Uint8Array;
}

export interface NobleHashesInterface {
    sha256: (data: Uint8Array) => Uint8Array;
    sha512: (data: Uint8Array) => Uint8Array;
    blake3?: (data: Uint8Array) => Uint8Array; // Optional blake3 support
}
