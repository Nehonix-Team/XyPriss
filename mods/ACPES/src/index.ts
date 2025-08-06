/***************************************************************************
 * XyPrissJS - Advanced JavaScript Security Library
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

export { KeyRotationManager } from "./components";
export * from "./platforms";
export * from "./types";

// Main class and singleton exports
export {
    crossPlatformStorage as Storage,
    CrossPlatformSecureStorage as ACPES,
} from "./core";

// Storage keys and constants
export { STORAGE_KEYS, type StorageKey } from "./utils/constants";

