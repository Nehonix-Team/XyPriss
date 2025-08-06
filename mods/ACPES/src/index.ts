/**
 * # ACPES - Advanced Cross-Platform Secure Storage
 *
 * **True Cross-Platform Secure Storage Service**
 * Works seamlessly on: React Native (iOS/Android), Web, and Node.js
 *
 * ACPES provides military-grade secure storage with automatic platform detection,
 * double encryption, integrity verification, and comprehensive security features.
 *
 * ## Key Features
 *
 * ### Cross-Platform Compatibility
 * - **Web**: localStorage + IndexedDB with automatic fallback
 * - **Mobile**: React Native Keychain with biometric support
 * - **Node.js**: Encrypted file system storage
 * - **Fallback**: Memory storage for unsupported environments
 *
 * ### Security Features
 * - **Double Encryption**: AES-256 with PBKDF2 key derivation
 * - **Integrity Verification**: HMAC-SHA256 checksums
 * - **Device Fingerprinting**: Unique key derivation per device
 * - **Automatic Lockout**: Protection against brute force attacks
 * - **Data Compression**: LZ-string compression for large data
 * - **TTL Support**: Automatic expiration of stored data
 *
 * ## Quick Start
 *
 * ```typescript
 * import { Storage, STORAGE_KEYS } from "xypriss-acpes";
 *
 * // Store sensitive data
 * await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, "your-token");
 *
 * // Retrieve data
 * const token = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);
 *
 * // Store with TTL (expires in 1 hour)
 * await Storage.setItemWithTTL("temp-data", "value", 3600);
 *
 * // Check platform capabilities
 * const info = Storage.getPlatformInfo();
 * console.log(`Platform: ${info.platform}, Has Keychain: ${info.hasKeychain}`);
 * ```
 *
 * ## Advanced Usage
 *
 * ```typescript
 * import { ACPES } from "xypriss-acpes";
 *
 * // Create custom instance with specific configuration
 * const customStorage = new ACPES({
 *     nodeStoragePath: "/custom/secure/path"
 * });
 *
 * // Store with compression and custom options
 * await customStorage.setItem("large-data", jsonData, {
 *     compressionEnabled: true,
 *     useIndexedDB: true,
 *     expiresIn: 86400 // 24 hours
 * });
 *
 * // Monitor security metrics
 * const metrics = customStorage.getSecurityMetrics("sensitive-key");
 * if (metrics.isLocked) {
 *     console.log("Service is temporarily locked due to failed attempts");
 * }
 * ```
 *
 * @author Nehonix
 * @version 1.0.0
 * @license MIT
 */

export * from "./core";
export * from "./components";
export * from "./platforms";
export * from "./types";
export * from "./utils";

// Main class and singleton exports
export {
    crossPlatformStorage as Storage,
    CrossPlatformSecureStorage as ACPES,
} from "./core";

// Storage keys and constants
export { STORAGE_KEYS, type StorageKey } from "./utils/constants";

