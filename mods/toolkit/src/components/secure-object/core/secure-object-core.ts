/***************************************************************************
 * XyPrissSecurity - Secure Array Types
 *
 * This file contains type definitions for the SecureArray modular architecture
 *
 * @author Nehonix
 *
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
 * @license MIT
 * @see https://lab.nehonix.space
 * @description SecureObject Core Module
 *
 * Main SecureObject class
 */

import { HashAlgorithm, HashOutputFormat } from "../../../types/string";
import { SecureBuffer } from "../../secure-memory";
import {
    memoryManager,
    MemoryEventType,
    PoolStrategy,
    MemoryUtils,
} from "../../../utils/memory";
import {
    SecureValue,
    SerializationOptions,
    ValueMetadata,
    SecureObjectEvent,
    EventListener,
    SecureObjectOptions,
} from "../types";
import { SensitiveKeysManager } from "../encryption/sensitive-keys";
import { CryptoHandler } from "../encryption/crypto-handler";
import { MetadataManager } from "../metadata/metadata-manager";
import { EventManager } from "../events/event-manager";
import { SerializationHandler } from "../serialization/serialization-handler";
import { IdGenerator } from "../utils/id-generator";
import { ValidationUtils } from "../utils/validation";
import SecureString from "../../secure-string";

/**
 * A secure object that can store sensitive data
 * T represents the initial type, but the object can be extended with additional keys
 */
export class SecureObject<
    T extends Record<string, SecureValue> = Record<string, SecureValue>
> {
    // Core data storage
    private data: Map<string, any> = new Map();
    private secureBuffers: Map<string, SecureBuffer> = new Map();

    // Modular components
    private sensitiveKeysManager: SensitiveKeysManager;
    private cryptoHandler: CryptoHandler;
    private metadataManager: MetadataManager;
    private eventManager: EventManager;
    private serializationHandler: SerializationHandler;

    // State management
    private _isDestroyed: boolean = false;
    private _isReadOnly: boolean = false;
    private readonly _id: string;

    // Enhanced memory management
    private _memoryTracking: boolean = false;
    private _autoCleanup: boolean = false;
    private _createdAt: number = Date.now();
    private _lastAccessed: number = Date.now();
    private secureBufferPool?: any;

    /**
     * Creates a new secure object
     */
    constructor(initialData?: Partial<T>, options?: SecureObjectOptions) {
        this._id = IdGenerator.generate();
        this._isReadOnly = false; // Start as writable

        // Initialize modular components
        this.sensitiveKeysManager = new SensitiveKeysManager();
        this.cryptoHandler = new CryptoHandler(this._id);
        this.metadataManager = new MetadataManager();
        this.eventManager = new EventManager();
        this.serializationHandler = new SerializationHandler(
            this.cryptoHandler,
            this.metadataManager
        );

        // Set encryption key if provided
        if (options?.encryptionKey) {
            this.cryptoHandler.setEncryptionKey(options.encryptionKey);
        }

        // Configure memory management with enhanced features
        this._memoryTracking = options?.enableMemoryTracking ?? true; // Enable by default
        this._autoCleanup = options?.autoCleanup ?? true; // Enable by default

        // Set memory limits if provided
        if (options?.maxMemory) {
            memoryManager.setLimits(
                options.maxMemory,
                options.gcThreshold || 0.8
            );
        }

        // Register with advanced memory manager if tracking is enabled
        if (this._memoryTracking) {
            memoryManager.registerObject(this, this._id);

            // Listen to memory events for proactive management
            memoryManager.on(MemoryEventType.MEMORY_PRESSURE, (event) => {
                if (event.data?.pressure > 0.8) {
                    this.handleMemoryPressure();
                }
            });

            memoryManager.on(MemoryEventType.LEAK_DETECTED, (event) => {
                if (event.data?.leaks?.includes(this._id)) {
                    console.warn(
                        `Potential memory leak detected in SecureObject ${this._id}`
                    );
                }
            });
        }

        // Create memory pool for secure buffers if not exists
        this.initializeSecureBufferPool();

        // Set initial data
        if (initialData) {
            this.setAll(initialData);
        }

        // Set read-only status after initial data is set
        this._isReadOnly = options?.readOnly ?? false;
    }

    /**
     * Creates a SecureObject from another SecureObject (deep copy)
     */
    public static from<T extends Record<string, SecureValue>>(
        other: SecureObject<T>
    ): SecureObject<T> {
        other.ensureNotDestroyed();
        const copy = new SecureObject<T>();

        for (const key of other.keys()) {
            const value = other.get(key);
            copy.set(String(key), value);
        }

        return copy;
    }

    /**
     * Creates a read-only SecureObject
     */
    public static readOnly<T extends Record<string, SecureValue>>(
        data: Partial<T>
    ): SecureObject<T> {
        return new SecureObject(data, { readOnly: true });
    }

    /**
     * Creates a read-only SecureObject (public usage)
     */

    /** Permanently enable read-only mode (cannot be disabled). */
    public enableReadOnly(): this {
        this.ensureNotDestroyed();
        this._isReadOnly = true;
        return this;
    }

    // ===== PROPERTY ACCESSORS =====

    /**
     * Gets the unique ID of this SecureObject
     */
    public get id(): string {
        return this._id;
    }

    /**
     * Checks if the SecureObject is read-only
     */
    public get isReadOnly(): boolean {
        return this._isReadOnly;
    }

    /**
     * Checks if the SecureObject has been destroyed
     */
    public get isDestroyed(): boolean {
        return this._isDestroyed;
    }

    /**
     * Gets the number of stored values
     */
    public get size(): number {
        this.ensureNotDestroyed();
        return this.data.size;
    }

    /**
     * Checks if the object is empty
     */
    public get isEmpty(): boolean {
        this.ensureNotDestroyed();
        return this.data.size === 0;
    }

    // ===== VALIDATION METHODS =====

    /**
     * Ensures the SecureObject hasn't been destroyed
     */
    private ensureNotDestroyed(): void {
        if (this._isDestroyed) {
            throw new Error(
                "SecureObject has been destroyed and cannot be used"
            );
        }
    }

    /**
     * Ensures the SecureObject is not read-only for write operations
     */
    private ensureNotReadOnly(): void {
        if (this._isReadOnly) {
            throw new Error("SecureObject is read-only");
        }
    }

    /**
     * Updates the last accessed timestamp for memory management
     */
    private updateLastAccessed(): void {
        this._lastAccessed = Date.now();
    }

    // ===== MEMORY MANAGEMENT =====

    /**
     * Initialize secure buffer pool for efficient memory reuse
     */
    private initializeSecureBufferPool(): void {
        if (!this.secureBufferPool) {
            try {
                this.secureBufferPool =
                    memoryManager.getPool("secure-buffer-pool") ||
                    memoryManager.createPool({
                        name: "secure-buffer-pool",
                        factory: () => new Uint8Array(1024), // 1KB buffers
                        reset: (buffer) => {
                            // Secure wipe before reuse
                            this.secureWipe(buffer);
                        },
                        capacity: 50,
                        strategy: PoolStrategy.LRU,
                        validator: (buffer) => buffer instanceof Uint8Array,
                    });
            } catch (error) {
                // Pool might already exist, try to get it
                this.secureBufferPool =
                    memoryManager.getPool("secure-buffer-pool");
            }
        }
    }

    /**
     * Handle memory pressure situations
     */
    private handleMemoryPressure(): void {
        if (this._autoCleanup) {
            // Clean up unused secure buffers
            this.forceGarbageCollection();

            // Emit event for external handlers
            this.eventManager.emit("gc", undefined, {
                timestamp: Date.now(),
                objectId: this._id,
                action: "memory_pressure_cleanup",
            });
        }
    }

    /**
     * Secure wipe of buffer memory
     */
    private secureWipe(buffer: Uint8Array): void {
        if (!buffer || buffer.length === 0) return;

        // Multiple-pass secure wipe
        const passes = [0x00, 0xff, 0xaa, 0x55, 0x00];

        for (const pattern of passes) {
            buffer.fill(pattern);
        }

        // Final random pass if crypto is available
        if (typeof crypto !== "undefined" && crypto.getRandomValues) {
            crypto.getRandomValues(buffer);
        }

        buffer.fill(0x00); // Final zero pass
    }

    /**
     * Gets enhanced memory usage statistics for this SecureObject
     */
    public getMemoryUsage(): {
        allocatedMemory: number;
        bufferCount: number;
        dataSize: number;
        createdAt: number;
        lastAccessed: number;
        age: number;
        formattedMemory: string;
        poolStats?: any;
    } {
        this.ensureNotDestroyed();

        let allocatedMemory = 0;
        for (const buffer of this.secureBuffers.values()) {
            allocatedMemory += buffer.length();
        }

        const now = Date.now();
        const usage = {
            allocatedMemory,
            bufferCount: this.secureBuffers.size,
            dataSize: this.data.size,
            createdAt: this._createdAt,
            lastAccessed: this._lastAccessed,
            age: now - this._createdAt,
            formattedMemory: MemoryUtils.formatBytes(allocatedMemory),
            poolStats: this.secureBufferPool?.getStats(),
        };

        return usage;
    }

    /**
     * Forces enhanced garbage collection for this SecureObject
     */
    public forceGarbageCollection(): void {
        this.ensureNotDestroyed();

        if (this._memoryTracking) {
            const beforeUsage = this.getMemoryUsage();

            // Clean up unused secure buffers with secure wipe
            for (const [key, buffer] of this.secureBuffers.entries()) {
                if (!this.data.has(key)) {
                    // Secure wipe before destroying (get buffer data safely)
                    try {
                        const bufferData = buffer.getBuffer(); // Use correct method
                        if (bufferData instanceof Uint8Array) {
                            this.secureWipe(bufferData);
                        }
                    } catch (error) {
                        // Buffer might already be destroyed, continue
                    }
                    buffer.destroy();
                    this.secureBuffers.delete(key);
                }
            }

            // Return unused buffers to pool
            if (this.secureBufferPool) {
                // Pool cleanup is handled automatically by the advanced memory manager
            }

            // Trigger global GC with enhanced features
            const gcResult = memoryManager.forceGC();

            const afterUsage = this.getMemoryUsage();
            const freedMemory =
                beforeUsage.allocatedMemory - afterUsage.allocatedMemory;

            this.eventManager.emit("gc", undefined, {
                timestamp: Date.now(),
                bufferCount: this.secureBuffers.size,
                freedMemory,
                gcDuration: gcResult.duration,
                gcSuccess: gcResult.success,
                beforeUsage: beforeUsage.formattedMemory,
                afterUsage: afterUsage.formattedMemory,
            });
        }
    }

    /**
     * Enables memory tracking for this SecureObject
     */
    public enableMemoryTracking(): this {
        this.ensureNotDestroyed();

        if (!this._memoryTracking) {
            this._memoryTracking = true;
            memoryManager.registerObject(this, this._id);
        }

        return this;
    }

    /**
     * Disables memory tracking for this SecureObject
     */
    public disableMemoryTracking(): this {
        this.ensureNotDestroyed();

        if (this._memoryTracking) {
            this._memoryTracking = false;
            memoryManager.removeReference(this._id);
        }

        return this;
    }

    // ===== SENSITIVE KEYS MANAGEMENT =====

    /**
     * Adds keys to the sensitive keys list
     */
    public addSensitiveKeys(...keys: string[]): this {
        this.ensureNotDestroyed();
        ValidationUtils.validateKeys(keys);
        this.sensitiveKeysManager.add(...keys);
        return this;
    }

    /**
     * Removes keys from the sensitive keys list
     */
    public removeSensitiveKeys(...keys: string[]): this {
        this.ensureNotDestroyed();
        ValidationUtils.validateKeys(keys);
        this.sensitiveKeysManager.remove(...keys);
        return this;
    }

    /**
     * Sets the complete list of sensitive keys (replaces existing list)
     */
    public setSensitiveKeys(keys: string[]): this {
        this.ensureNotDestroyed();
        ValidationUtils.validateKeys(keys);
        this.sensitiveKeysManager.set(keys);
        return this;
    }

    /**
     * Gets the current list of sensitive keys
     */
    public getSensitiveKeys(): string[] {
        this.ensureNotDestroyed();
        return this.sensitiveKeysManager.getAll();
    }

    /**
     * Checks if a key is marked as sensitive
     */
    public isSensitiveKey(key: string): boolean {
        ValidationUtils.validateKey(key);
        return this.sensitiveKeysManager.isSensitive(key);
    }

    /**
     * Clears all sensitive keys
     */
    public clearSensitiveKeys(): this {
        this.ensureNotDestroyed();
        this.sensitiveKeysManager.clear();
        return this;
    }

    /**
     * Resets sensitive keys to default values
     */
    public resetToDefaultSensitiveKeys(): this {
        this.ensureNotDestroyed();
        this.sensitiveKeysManager.resetToDefault();
        return this;
    }

    /**
     * Gets the default sensitive keys that are automatically initialized
     */
    public static get getDefaultSensitiveKeys(): string[] {
        return SensitiveKeysManager.getDefaultKeys();
    }

    /**
     * Adds custom regex patterns for sensitive key detection
     * @param patterns - Regex patterns or strings to match sensitive keys
     */
    public addSensitivePatterns(...patterns: (RegExp | string)[]): this {
        this.ensureNotDestroyed();
        this.sensitiveKeysManager.addCustomPatterns(...patterns);
        return this;
    }

    /**
     * Removes custom sensitive patterns
     */
    public removeSensitivePatterns(...patterns: (RegExp | string)[]): this {
        this.ensureNotDestroyed();
        this.sensitiveKeysManager.removeCustomPatterns(...patterns);
        return this;
    }

    /**
     * Clears all custom sensitive patterns
     */
    public clearSensitivePatterns(): this {
        this.ensureNotDestroyed();
        this.sensitiveKeysManager.clearCustomPatterns();
        return this;
    }

    /**
     * Gets all custom sensitive patterns
     */
    public getSensitivePatterns(): RegExp[] {
        this.ensureNotDestroyed();
        return this.sensitiveKeysManager.getCustomPatterns();
    }

    // ===== ENCRYPTION MANAGEMENT =====

    /**
     * Sets the encryption key for sensitive data encryption
     */
    public setEncryptionKey(key: string | null = null): this {
        this.ensureNotDestroyed();
        ValidationUtils.validateEncryptionKey(key);
        this.cryptoHandler.setEncryptionKey(key);
        return this;
    }

    /**
     * Gets the current encryption key
     */
    public get getEncryptionKey(): string | null {
        return this.cryptoHandler.getEncryptionKey();
    }

    /**
     * Decrypts a value using the encryption key
     */
    public decryptValue(encryptedValue: string): any {
        this.ensureNotDestroyed();
        return this.cryptoHandler.decryptValue(encryptedValue);
    }

    /**
     * Decrypts all encrypted values in an object
     */
    public decryptObject(obj: any): any {
        this.ensureNotDestroyed();
        return this.cryptoHandler.decryptObject(obj);
    }

    /**
     * Encrypts all values in the object using AES-256-CTR-HMAC encryption
     * with proper memory management and atomic operations
     */
    public encryptAll(): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();

        // Check if encryption key is set
        const encryptionStatus = this.cryptoHandler.getEncryptionStatus();
        if (!encryptionStatus.hasEncryptionKey) {
            throw new Error(
                "Encryption key must be set before calling encryptAll()"
            );
        }

        // Prepare temporary map for atomic operation
        const encryptedEntries = new Map<string, any>();
        const originalMetadata = new Map<string, any>();
        const keysToProcess: string[] = [];

        try {
            // First pass: encrypt all values into temporary storage
            for (const [key, value] of this.data.entries()) {
                if (value !== undefined) {
                    // Skip already encrypted values to avoid double encryption
                    if (
                        typeof value === "string" &&
                        this.cryptoHandler.isEncrypted(value)
                    ) {
                        continue;
                    }

                    // Store original metadata for rollback
                    if (this.metadataManager.has(key)) {
                        originalMetadata.set(
                            key,
                            this.metadataManager.get(key)
                        );
                    }

                    // Get the actual value to encrypt
                    let valueToEncrypt = value;

                    // If it's a SecureBuffer, convert it back to its original form
                    if (value instanceof SecureBuffer) {
                        const metadata = this.metadataManager.get(key);
                        if (metadata?.type === "string") {
                            valueToEncrypt = new TextDecoder().decode(
                                value.getBuffer()
                            );
                        } else if (metadata?.type === "Uint8Array") {
                            valueToEncrypt = new Uint8Array(value.getBuffer());
                        } else {
                            valueToEncrypt = new TextDecoder().decode(
                                value.getBuffer()
                            );
                        }
                    }

                    // Encrypt the value
                    const encryptedValue =
                        this.cryptoHandler.encryptValue(valueToEncrypt);
                    encryptedEntries.set(key, encryptedValue);
                    keysToProcess.push(key);
                }
            }

            // Second pass: atomically commit all changes
            for (const key of keysToProcess) {
                const encryptedValue = encryptedEntries.get(key);
                const originalValue = this.data.get(key);

                // Clean up any existing SecureBuffer for this key
                this.cleanupKey(key);

                // Store encrypted value
                this.data.set(key, encryptedValue);

                // Update metadata with correct type information
                // Store original type in the type field using special format
                const originalType = typeof originalValue;
                this.metadataManager.update(
                    key,
                    `encrypted:${originalType}`,
                    true
                );
            }
        } catch (error: any) {
            // Rollback: restore original state on any failure
            for (const key of keysToProcess) {
                if (originalMetadata.has(key)) {
                    // Restore original metadata
                    const original = originalMetadata.get(key);
                    this.metadataManager.update(
                        key,
                        original.type,
                        original.isSecure
                    );
                }
            }

            throw new Error(`Encryption failed: ${error.message}`);
        }

        this.updateLastAccessed();
        this.eventManager.emit(
            "set",
            "encrypt_all",
            `${keysToProcess.length}_values_encrypted`
        );

        return this;
    }

    /**
     * Gets the raw encrypted data without decryption (for verification)
     */
    public getRawEncryptedData(): Map<string, any> {
        this.ensureNotDestroyed();
        return new Map(this.data);
    }

    /**
     * Gets a specific key's raw encrypted form (for verification)
     */
    public getRawEncryptedValue(key: string): any {
        this.ensureNotDestroyed();
        const stringKey = ValidationUtils.sanitizeKey(key);
        return this.data.get(stringKey);
    }

    /**
     * Gets encryption status from the crypto handler
     */
    public getEncryptionStatus() {
        return this.cryptoHandler.getEncryptionStatus();
    }

    // ===== EVENT MANAGEMENT =====

    /**
     * Adds an event listener
     */
    public addEventListener(
        event: SecureObjectEvent,
        listener: EventListener
    ): void {
        ValidationUtils.validateEventType(event);
        ValidationUtils.validateEventListener(listener);
        this.eventManager.addEventListener(event, listener);
    }

    /**
     * Removes an event listener
     */
    public removeEventListener(
        event: SecureObjectEvent,
        listener: EventListener
    ): void {
        ValidationUtils.validateEventType(event);
        ValidationUtils.validateEventListener(listener);
        this.eventManager.removeEventListener(event, listener);
    }

    /**
     * Creates a one-time event listener
     */
    public once(event: SecureObjectEvent, listener: EventListener): void {
        ValidationUtils.validateEventType(event);
        ValidationUtils.validateEventListener(listener);
        this.eventManager.once(event, listener);
    }

    /**
     * Waits for a specific event to be emitted
     */
    public waitFor(
        event: SecureObjectEvent,
        timeout?: number
    ): Promise<{ key?: string; value?: any }> {
        ValidationUtils.validateEventType(event);
        if (timeout !== undefined) {
            ValidationUtils.validateTimeout(timeout);
        }
        return this.eventManager.waitFor(event, timeout);
    }

    // ===== CORE DATA OPERATIONS =====

    /**
     * Sets a value - allows both existing keys and new dynamic keys
     */
    public set<K extends string>(key: K, value: SecureValue): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.updateLastAccessed();

        const stringKey = ValidationUtils.sanitizeKey(key);
        ValidationUtils.isValidSecureValue(value);

        // Clean up any existing secure buffer for this key
        this.cleanupKey(stringKey);

        // Handle different types of values
        if (
            value &&
            typeof value === "object" &&
            value.constructor.name === "Uint8Array"
        ) {
            // Store Uint8Array in a secure buffer
            const secureBuffer = SecureBuffer.from(value as Uint8Array);
            this.secureBuffers.set(stringKey, secureBuffer);
            this.data.set(stringKey, secureBuffer);
            this.metadataManager.update(stringKey, "Uint8Array", true);
        } else if (typeof value === "string") {
            // Store strings in secure buffers
            const secureBuffer = SecureBuffer.from(value);
            this.secureBuffers.set(stringKey, secureBuffer);
            this.data.set(stringKey, secureBuffer);
            this.metadataManager.update(stringKey, "string", true);
        } else if (ValidationUtils.isSecureString(value)) {
            // Store SecureString reference
            this.data.set(stringKey, value);
            this.metadataManager.update(stringKey, "SecureString", true);
        } else if (ValidationUtils.isSecureObject(value)) {
            // Store SecureObject reference
            this.data.set(stringKey, value);
            this.metadataManager.update(stringKey, "SecureObject", true);
        } else {
            // Store other values directly (numbers, booleans, null, undefined)
            this.data.set(stringKey, value);
            this.metadataManager.update(stringKey, typeof value, false);
        }

        this.eventManager.emit("set", stringKey, value);
        return this;
    }

    /**
     * Sets multiple values at once
     */
    public setAll(values: Partial<T>): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();

        for (const key in values) {
            if (Object.prototype.hasOwnProperty.call(values, key)) {
                this.set(String(key), values[key] as SecureValue);
            }
        }
        return this;
    }

    /**
     * Gets a value with automatic decryption
     */
    public get<K extends keyof T>(key: K): T[K] {
        this.ensureNotDestroyed();
        this.updateLastAccessed();

        const stringKey = ValidationUtils.sanitizeKey(key);
        const value = this.data.get(stringKey);

        // Update access metadata
        if (this.metadataManager.has(stringKey)) {
            const metadata = this.metadataManager.get(stringKey)!;
            this.metadataManager.update(
                stringKey,
                metadata.type,
                metadata.isSecure
            );
        }

        // Check if value is encrypted (starts with [ENCRYPTED:)
        if (
            typeof value === "string" &&
            this.cryptoHandler.isEncrypted(value)
        ) {
            try {
                // Decrypt the value automatically
                const decryptedValue = this.cryptoHandler.decryptValue(value);
                this.eventManager.emit("get", stringKey, decryptedValue);
                return decryptedValue as T[K];
            } catch (error) {
                console.error(
                    `Failed to decrypt value for key ${stringKey}:`,
                    error
                );
                // Return the encrypted value if decryption fails
                this.eventManager.emit("get", stringKey, value);
                return value as T[K];
            }
        }

        if (value instanceof SecureBuffer) {
            // Convert SecureBuffer back to original type based on metadata
            const buffer = value.getBuffer();
            const metadata = this.metadataManager.get(stringKey);

            if (
                metadata?.type === "Uint8Array" ||
                metadata?.type === "encrypted:Uint8Array"
            ) {
                // Return as Uint8Array for binary data
                const result = new Uint8Array(buffer) as unknown as T[K];
                this.eventManager.emit("get", stringKey, result);
                return result;
            } else {
                // Return as string for text data
                const result = new TextDecoder().decode(
                    buffer
                ) as unknown as T[K];
                this.eventManager.emit("get", stringKey, result);
                return result;
            }
        }

        this.eventManager.emit("get", stringKey, value);
        return value as T[K];
    }

    /**
     * Gets a value safely, returning undefined if key doesn't exist
     */
    public getSafe<K extends keyof T>(key: K): T[K] | undefined {
        try {
            return this.has(key) ? this.get(key) : undefined;
        } catch {
            return undefined;
        }
    }

    /**
     * Gets a value with a default fallback
     */
    public getWithDefault<K extends keyof T>(key: K, defaultValue: T[K]): T[K] {
        return this.has(key) ? this.get(key) : defaultValue;
    }

    /**
     * Checks if a key exists
     */
    public has<K extends keyof T>(key: K): boolean {
        this.ensureNotDestroyed();
        const stringKey = ValidationUtils.sanitizeKey(key);
        return this.data.has(stringKey);
    }

    /**
     * Deletes a key - allows both existing keys and dynamic keys
     */
    public delete<K extends string>(key: K): boolean {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();

        const stringKey = ValidationUtils.sanitizeKey(key);

        if (!this.data.has(stringKey)) {
            return false;
        }

        // Clean up any secure buffer
        this.cleanupKey(stringKey);

        const deleted = this.data.delete(stringKey);
        this.metadataManager.delete(stringKey);

        this.eventManager.emit("delete", stringKey);
        return deleted;
    }

    /**
     * Cleans up resources associated with a key
     */
    private cleanupKey(key: string): void {
        if (this.secureBuffers.has(key)) {
            this.secureBuffers.get(key)?.destroy();
            this.secureBuffers.delete(key);
        }
        // Note: We don't destroy SecureString or SecureObject instances
        // as they might be used elsewhere
    }

    /**
     * Clears all data
     */
    public clear(): void {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();

        // Destroy all secure buffers
        for (const buffer of this.secureBuffers.values()) {
            buffer.destroy();
        }

        this.secureBuffers.clear();
        this.data.clear();
        this.metadataManager.clear();

        this.eventManager.emit("clear");
    }

    // ===== ITERATION AND COLLECTION METHODS =====

    /**
     * Gets all keys
     */
    public keys(): Array<keyof T> {
        this.ensureNotDestroyed();
        return Array.from(this.data.keys()) as Array<keyof T>;
    }

    /**
     * Gets all values
     */
    public values(): Array<T[keyof T]> {
        this.ensureNotDestroyed();
        return this.keys().map((key) => this.get(key));
    }

    /**
     * Gets all entries as [key, value] pairs
     */
    public entries(): Array<[keyof T, T[keyof T]]> {
        this.ensureNotDestroyed();
        return this.keys().map(
            (key) => [key, this.get(key)] as [keyof T, T[keyof T]]
        );
    }

    /**
     * Iterates over each key-value pair
     */
    public forEach(
        callback: (value: T[keyof T], key: keyof T, obj: this) => void
    ): void {
        this.ensureNotDestroyed();
        ValidationUtils.validateCallback(callback, "forEach callback");

        for (const key of this.keys()) {
            callback(this.get(key), key, this);
        }
    }

    /**
     * Maps over values and returns a new array
     */
    public map<U>(
        callback: (value: T[keyof T], key: keyof T, obj: this) => U
    ): U[] {
        this.ensureNotDestroyed();
        ValidationUtils.validateMapper(callback);

        return this.keys().map((key) => callback(this.get(key), key, this));
    }

    /**
     * Filters entries based on a predicate function (like Array.filter)
     * Returns a new SecureObject with only the entries that match the condition
     */
    public filter(
        predicate: (value: T[keyof T], key: keyof T, obj: this) => boolean
    ): SecureObject<Partial<T>> {
        this.ensureNotDestroyed();
        ValidationUtils.validatePredicate(predicate);

        const filtered = new SecureObject<Partial<T>>();

        for (const key of this.keys()) {
            const value = this.get(key);
            if (predicate(value, key, this)) {
                filtered.set(String(key), value);
            }
        }

        // Emit event with filter details
        this.eventManager.emit("filtered", undefined, {
            operation: "filter",
            resultSize: filtered.size,
            originalSize: this.size,
        });

        return filtered;
    }

    /**
     * Filters entries by specific key names (type-safe for known keys)
     * Returns a new SecureObject with only the specified keys
     *
     * @example
     * const user = createSecureObject({ name: "John", password: "secret", age: 30 });
     * const credentials = user.filterByKeys("name", "password");
     */
    public filterByKeys<K extends keyof T>(
        ...keys: K[]
    ): SecureObject<Pick<T, K>> {
        this.ensureNotDestroyed();

        const filtered = new SecureObject<Pick<T, K>>();

        for (const key of keys) {
            if (this.has(key)) {
                const stringKey = String(key);
                (filtered as any).set(stringKey, this.get(key));
            }
        }

        // Copy sensitive keys that are included in the filter
        const relevantSensitiveKeys = this.getSensitiveKeys().filter((k) =>
            keys.includes(k as K)
        );
        if (relevantSensitiveKeys.length > 0) {
            filtered.setSensitiveKeys(relevantSensitiveKeys);
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "filterByKeys",
            keys: keys.map((k) => String(k)),
            resultSize: filtered.size,
        });

        return filtered;
    }

    /**
     * Filters entries by value type using a type guard function
     * Returns a new SecureObject with only values of the specified type
     *
     * @example
     * const data = createSecureObject({ name: "John", age: 30, active: true });
     * const strings = data.filterByType((v): v is string => typeof v === "string");
     */
    public filterByType<U>(
        typeGuard: (value: any) => value is U
    ): SecureObject<Record<string, U>> {
        this.ensureNotDestroyed();

        const filtered = new SecureObject<Record<string, U>>();

        for (const key of this.keys()) {
            const value = this.get(key);
            if (typeGuard(value)) {
                const stringKey = String(key);
                (filtered as any).set(stringKey, value as U);
            }
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "filterByType",
            resultSize: filtered.size,
        });

        return filtered;
    }

    /**
     * Filters entries to only include sensitive keys
     * Returns a new SecureObject with only sensitive data
     *
     * @example
     * const user = createSecureObject({ name: "John", password: "secret", age: 30 });
     * user.addSensitiveKeys("password");
     * const sensitiveData = user.filterSensitive(); // Only contains password
     */
    public filterSensitive(): SecureObject<Partial<T>> {
        this.ensureNotDestroyed();

        const filtered = new SecureObject<Partial<T>>();
        const sensitiveKeys = this.getSensitiveKeys();

        for (const key of this.keys()) {
            const stringKey = String(key);
            if (sensitiveKeys.includes(stringKey)) {
                (filtered as any).set(stringKey, this.get(key));
            }
        }

        // Copy all sensitive keys to the filtered object
        filtered.setSensitiveKeys([...sensitiveKeys]);

        this.eventManager.emit("filtered", undefined, {
            operation: "filterSensitive",
            resultSize: filtered.size,
        });

        return filtered;
    }

    /**
     * Filters entries to exclude sensitive keys
     * Returns a new SecureObject with only non-sensitive data
     *
     * @example
     * const user = createSecureObject({ name: "John", password: "secret", age: 30 });
     * user.addSensitiveKeys("password");
     * const publicData = user.filterNonSensitive(); // Contains name and age
     */
    public filterNonSensitive(options?: {
        strictMode?: boolean;
    }): SecureObject<Partial<T>> {
        this.ensureNotDestroyed();
        // Default to non-strict mode (false) - only exact matches
        const strictMode = options?.strictMode === true;

        const filtered = new SecureObject<Partial<T>>();

        for (const key of this.keys()) {
            const stringKey = String(key);
            // Use the enhanced sensitive key detection with strictMode
            if (!this.sensitiveKeysManager.isSensitive(stringKey, strictMode)) {
                const value = this.get(key);

                // If the value is a nested object, process it with the same strictMode
                if (
                    value &&
                    typeof value === "object" &&
                    value !== null &&
                    !Array.isArray(value)
                ) {
                    // Process nested object with the same strict mode
                    const processedValue = this.processNestedObjectForFiltering(
                        value,
                        strictMode
                    );
                    (filtered as any).set(stringKey, processedValue);
                } else {
                    (filtered as any).set(stringKey, value);
                }
            }
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "filterNonSensitive",
            resultSize: filtered.size,
        });

        return filtered;
    }

    /**
     * Processes nested objects for filtering with the same strict mode
     */
    private processNestedObjectForFiltering(
        obj: any,
        strictMode: boolean
    ): any {
        if (Array.isArray(obj)) {
            // Handle arrays
            return obj.map((item) =>
                typeof item === "object" && item !== null
                    ? this.processNestedObjectForFiltering(item, strictMode)
                    : item
            );
        } else if (typeof obj === "object" && obj !== null) {
            // Handle objects
            const result: any = {};
            for (const [key, value] of Object.entries(obj)) {
                if (!this.sensitiveKeysManager.isSensitive(key, strictMode)) {
                    if (typeof value === "object" && value !== null) {
                        // Recursively process nested objects/arrays
                        result[key] = this.processNestedObjectForFiltering(
                            value,
                            strictMode
                        );
                    } else {
                        result[key] = value;
                    }
                }
                // If key is sensitive, skip it (don't add to result)
            }
            return result;
        }
        return obj;
    }

    // ===== METADATA OPERATIONS =====

    /**
     * Gets metadata for a specific key
     */
    public getMetadata<K extends keyof T>(key: K): ValueMetadata | undefined {
        this.ensureNotDestroyed();
        const stringKey = ValidationUtils.sanitizeKey(key);
        return this.metadataManager.get(stringKey);
    }

    /**
     * Gets metadata for all keys
     */
    public getAllMetadata(): Map<string, ValueMetadata> {
        this.ensureNotDestroyed();
        return this.metadataManager.getAll();
    }

    // ===== SERIALIZATION METHODS =====

    /**
     * Converts to a regular object with security-focused serialization
     *
     * BEHAVIOR: This is the security-focused method that handles sensitive key filtering.
     * Use this method when you need controlled access to data with security considerations.
     * For simple object conversion without filtering, use toObject().
     * 
     *  @example
     * const user = fObject({
        id: "1",
        email: "test@test.com",
        password: "test123",
        isVerified: true,
        userName: "test",
        firstName: "test",
        lastName: "test",
        bio: "test",
        });

        const getAllResult = user.getAll();
        console.log("getAllResult.email:", getAllResult.email);
        console.log("getAllResult.password:", getAllResult.password);
        console.log("Has password?", "password" in getAllResult);
        
        // Purpose: Security-conscious data access
        // Behavior: Filters out sensitive keys by default
        // Result:  password: undefined (filtered for security)
        // With encryptSensitive: true: ✔ password: "[ENCRYPTED:...]" (encrypted but included)
     */
    public getAll(
        options: SerializationOptions = {}
    ): T & { _metadata?: Record<string, ValueMetadata> } {
        this.ensureNotDestroyed();
        ValidationUtils.validateSerializationOptions(options);
        const sensitiveKeys = new Set(this.sensitiveKeysManager.getAll());

        return this.serializationHandler.toObject<T>(
            this.data,
            sensitiveKeys,
            options
        );
    }

    /**
     * Gets the full object as a regular JavaScript object
     *
     * BEHAVIOR: Returns ALL data including sensitive keys (like standard JS object conversion).
     * This method does NOT filter sensitive keys by default - use getAll() for security-focused serialization.
     * 
     * @example
     * const user = fObject({
        id: "1",
        email: "test@test.com",
        password: "test123",
        isVerified: true,
        userName: "test",
        firstName: "test",
        lastName: "test",
        bio: "test",
        });

        const toObjectResult = user.toObject();
        console.log("toObjectResult.email:", toObjectResult.email);
        console.log("toObjectResult.password:", toObjectResult.password);
        console.log("Has password?", "password" in toObjectResult);

        // Purpose: Standard JavaScript object conversion
        // Behavior: Returns ALL data including sensitive keys (like password)
        // Result: ✔ password: "test123" (included)

        Sensitive keys can be handled using .add/removeSensitiveKeys()
     */
    public toObject(
        options?: SerializationOptions
    ): T & { _metadata?: Record<string, ValueMetadata> } {
        // toObject() should return ALL data by default (no filtering)
        // Pass an empty Set to indicate no keys should be filtered
        const noFiltering = new Set<string>();
        return this.serializationHandler.toObject<T>(
            this.data,
            noFiltering,
            options
        );
    }

    /**
     * Converts to JSON string
     */
    public toJSON(
        options: SerializationOptions & {
            strictSensitiveKeys?: boolean;
        } = {}
    ): string {
        this.ensureNotDestroyed();
        ValidationUtils.validateSerializationOptions(options);

        // Use non-strict mode by default (only exact matches)
        const strictMode = options.strictSensitiveKeys === true;
        const isSensitiveKey = (key: string) =>
            this.sensitiveKeysManager.isSensitive(key, strictMode);
        return this.serializationHandler.toJSON<T>(
            this.data,
            isSensitiveKey,
            options
        );
    }

    // ===== UTILITY METHODS =====

    /**
     * Creates a hash of the entire object content
     */
    public async hash(
        algorithm: HashAlgorithm = "SHA-256",
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        this.ensureNotDestroyed();

        const serialized =
            this.serializationHandler.createHashableRepresentation(
                this.entries()
            );
        const secureString = new SecureString(serialized);

        try {
            return await secureString.hash(algorithm, format);
        } finally {
            secureString.destroy();
        }
    }

    /**
     * Executes a function with the object data and optionally clears it afterward
     */
    public use<U>(fn: (obj: this) => U, autoClear: boolean = false): U {
        this.ensureNotDestroyed();
        ValidationUtils.validateCallback(fn, "use function");

        try {
            return fn(this);
        } finally {
            if (autoClear) {
                this.destroy();
            }
        }
    }

    /**
     * Creates a shallow copy of the SecureObject
     */
    public clone(): SecureObject<T> {
        this.ensureNotDestroyed();
        return SecureObject.from(this);
    }

    /**
     * Merges another object into this one
     */
    public merge(
        other: Partial<T> | SecureObject<Partial<T>>,
        overwrite: boolean = true
    ): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();

        if (other instanceof SecureObject) {
            for (const key of other.keys()) {
                const stringKey = String(key);
                if (overwrite || !this.has(key as keyof T)) {
                    this.set(stringKey, other.get(key));
                }
            }
        } else {
            for (const key in other) {
                if (Object.prototype.hasOwnProperty.call(other, key)) {
                    if (overwrite || !this.has(key as keyof T)) {
                        this.set(String(key), other[key] as SecureValue);
                    }
                }
            }
        }

        return this;
    }

    // ===== AMAZING NEW FEATURES =====

    /**
     * Transform values with a mapper function (like Array.map but returns SecureObject)
     * Returns a new SecureObject with transformed values
     */
    public transform<U>(
        mapper: (value: T[keyof T], key: keyof T, obj: this) => U
    ): SecureObject<Record<string, U>> {
        this.ensureNotDestroyed();
        ValidationUtils.validateMapper(mapper);

        const transformed = new SecureObject<Record<string, U>>();

        for (const key of this.keys()) {
            const value = this.get(key);
            const newValue = mapper(value, key, this);
            const stringKey = String(key);
            (transformed as any).set(stringKey, newValue);
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "transform",
            resultSize: transformed.size,
        });

        return transformed;
    }

    /**
     * Group entries by a classifier function
     * Returns a Map where keys are group identifiers and values are SecureObjects
     */
    public groupBy<K extends string | number>(
        classifier: (value: T[keyof T], key: keyof T) => K
    ): Map<K, SecureObject<Partial<T>>> {
        this.ensureNotDestroyed();
        ValidationUtils.validateCallback(classifier, "Classifier function");

        const groups = new Map<K, SecureObject<Partial<T>>>();

        for (const key of this.keys()) {
            const value = this.get(key);
            const groupKey = classifier(value, key);

            if (!groups.has(groupKey)) {
                groups.set(groupKey, new SecureObject<Partial<T>>());
            }

            const group = groups.get(groupKey)!;
            const stringKey = String(key);
            (group as any).set(stringKey, value);
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "groupBy",
            resultSize: groups.size,
        });

        return groups;
    }

    /**
     * Partition entries into two groups based on a predicate
     * Returns [matching, notMatching] SecureObjects
     */
    public partition(
        predicate: (value: T[keyof T], key: keyof T) => boolean
    ): [SecureObject<Partial<T>>, SecureObject<Partial<T>>] {
        this.ensureNotDestroyed();
        ValidationUtils.validatePredicate(predicate);

        const matching = new SecureObject<Partial<T>>();
        const notMatching = new SecureObject<Partial<T>>();

        for (const key of this.keys()) {
            const value = this.get(key);
            const stringKey = String(key);

            if (predicate(value, key)) {
                (matching as any).set(stringKey, value);
            } else {
                (notMatching as any).set(stringKey, value);
            }
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "partition",
            resultSize: matching.size + notMatching.size,
        });

        return [matching, notMatching];
    }

    /**
     * Pick specific keys (like Lodash pick but type-safe)
     * Returns a new SecureObject with only the specified keys
     */
    public pick<K extends keyof T>(...keys: K[]): SecureObject<Pick<T, K>> {
        return this.filterByKeys(...keys);
    }

    /**
     * Omit specific keys (opposite of pick)
     * Returns a new SecureObject without the specified keys
     */
    public omit<K extends keyof T>(...keys: K[]): SecureObject<Omit<T, K>> {
        this.ensureNotDestroyed();

        const omitted = new SecureObject<Omit<T, K>>();
        const keysToOmit = new Set(keys.map((k) => String(k)));

        for (const key of this.keys()) {
            const stringKey = String(key);
            if (!keysToOmit.has(stringKey)) {
                (omitted as any).set(stringKey, this.get(key));
            }
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "omit",
            keys: keys.map((k) => String(k)),
            resultSize: omitted.size,
        });

        return omitted;
    }

    /**
     * Flatten nested objects (one level deep)
     * Converts { user: { name: "John" } } to { "user.name": "John" }
     */
    public flatten(separator: string = "."): SecureObject<Record<string, any>> {
        this.ensureNotDestroyed();

        const flattened = new SecureObject<Record<string, any>>();

        for (const key of this.keys()) {
            const value = this.get(key);
            const stringKey = String(key);

            if (
                value &&
                typeof value === "object" &&
                !Array.isArray(value) &&
                !((value as any) instanceof Date)
            ) {
                // Flatten nested object
                for (const [nestedKey, nestedValue] of Object.entries(value)) {
                    const flatKey = `${stringKey}${separator}${nestedKey}`;
                    (flattened as any).set(flatKey, nestedValue);
                }
            } else {
                (flattened as any).set(stringKey, value);
            }
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "flatten",
            resultSize: flattened.size,
        });

        return flattened;
    }

    /**
     * Compact - removes null, undefined, and empty values
     * Returns a new SecureObject with only truthy values
     */
    public compact(): SecureObject<Partial<T>> {
        return this.filter((value) => {
            if (value === null || value === undefined) return false;
            if (typeof value === "string" && value.trim() === "") return false;
            if (Array.isArray(value) && value.length === 0) return false;
            if (typeof value === "object" && Object.keys(value).length === 0)
                return false;
            return true;
        });
    }

    /**
     * Invert - swap keys and values
     * Returns a new SecureObject with keys and values swapped
     */
    public invert(): SecureObject<Record<string, string>> {
        this.ensureNotDestroyed();

        const inverted = new SecureObject<Record<string, string>>();

        for (const key of this.keys()) {
            const value = this.get(key);
            const stringValue = String(value);
            const stringKey = String(key);
            (inverted as any).set(stringValue, stringKey);
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "invert",
            resultSize: inverted.size,
        });

        return inverted;
    }

    /**
     * Defaults - merge with default values (only for missing keys)
     * Returns a new SecureObject with defaults applied
     */
    public defaults(defaultValues: Partial<T>): SecureObject<T> {
        this.ensureNotDestroyed();

        const result = new SecureObject<T>();

        // First, copy all existing values
        for (const key of this.keys()) {
            const stringKey = String(key);
            (result as any).set(stringKey, this.get(key));
        }

        // Then, add defaults for missing keys
        for (const [key, value] of Object.entries(defaultValues)) {
            if (!this.has(key as keyof T)) {
                (result as any).set(key, value);
            }
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "defaults",
            resultSize: result.size,
        });

        return result;
    }

    /**
     * Tap - execute a function with the object and return the object (for chaining)
     * Useful for debugging or side effects in method chains
     */
    public tap(fn: (obj: this) => void): this {
        this.ensureNotDestroyed();
        ValidationUtils.validateCallback(fn, "Tap function");

        fn(this);
        return this;
    }

    /**
     * Pipe - transform the object through a series of functions
     * Each function receives the result of the previous function
     */
    public pipe<U>(fn: (obj: this) => U): U;
    public pipe<U, V>(fn1: (obj: this) => U, fn2: (obj: U) => V): V;
    public pipe<U, V, W>(
        fn1: (obj: this) => U,
        fn2: (obj: U) => V,
        fn3: (obj: V) => W
    ): W;
    public pipe(...fns: Array<(obj: any) => any>): any {
        this.ensureNotDestroyed();

        return fns.reduce((result, fn) => {
            ValidationUtils.validateCallback(fn, "Pipe function");
            return fn(result);
        }, this as any);
    }

    /**
     * Sample - get random entries from the object
     * Returns a new SecureObject with randomly selected entries
     */
    public sample(count: number = 1): SecureObject<Partial<T>> {
        this.ensureNotDestroyed();

        if (count <= 0) {
            return new SecureObject<Partial<T>>();
        }

        const allKeys = this.keys();
        const sampleSize = Math.min(count, allKeys.length);
        const sampledKeys: (keyof T)[] = [];

        // Simple random sampling without replacement
        const availableKeys = [...allKeys];
        for (let i = 0; i < sampleSize; i++) {
            const randomIndex = Math.floor(
                Math.random() * availableKeys.length
            );
            sampledKeys.push(
                availableKeys.splice(randomIndex, 1)[0] as keyof T
            );
        }

        const sampled = new SecureObject<Partial<T>>();
        for (const key of sampledKeys) {
            const stringKey = String(key);
            (sampled as any).set(stringKey, this.get(key));
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "sample",
            resultSize: sampled.size,
        });

        return sampled;
    }

    /**
     * Shuffle - return a new SecureObject with keys in random order
     * Returns a new SecureObject with the same data but shuffled key order
     */
    public shuffle(): SecureObject<T> {
        this.ensureNotDestroyed();

        const allKeys = this.keys();
        const shuffledKeys = [...allKeys];

        // Fisher-Yates shuffle
        for (let i = shuffledKeys.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));
            [shuffledKeys[i], shuffledKeys[j]] = [
                shuffledKeys[j],
                shuffledKeys[i],
            ];
        }

        const shuffled = new SecureObject<T>();
        for (const key of shuffledKeys) {
            const stringKey = String(key);
            (shuffled as any).set(stringKey, this.get(key));
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "shuffle",
            resultSize: shuffled.size,
        });

        return shuffled;
    }

    /**
     * Chunk - split object into chunks of specified size
     * Returns an array of SecureObjects, each containing up to 'size' entries
     */
    public chunk(size: number): SecureObject<Partial<T>>[] {
        this.ensureNotDestroyed();

        if (size <= 0) {
            throw new Error("Chunk size must be greater than 0");
        }

        const allKeys = this.keys();
        const chunks: SecureObject<Partial<T>>[] = [];

        for (let i = 0; i < allKeys.length; i += size) {
            const chunk = new SecureObject<Partial<T>>();
            const chunkKeys = allKeys.slice(i, i + size);

            for (const key of chunkKeys) {
                const stringKey = String(key);
                (chunk as any).set(stringKey, this.get(key));
            }

            chunks.push(chunk);
        }

        this.eventManager.emit("filtered", undefined, {
            operation: "chunk",
            resultSize: chunks.length,
        });

        return chunks;
    }

    // ===== SERIALIZATION AND EXPORT =====

    /**
     * Serializes the SecureObject to a secure format
     */
    public serialize(options: SerializationOptions = {}): string {
        this.ensureNotDestroyed();

        try {
            const {
                includeMetadata = true,
                encryptSensitive = false,
                format = "json",
            } = options;

            // Create serialization package
            const package_ = {
                version: "2.0.0",
                format: "XyPrissSecurity-SecureObject",
                timestamp: Date.now(),
                objectId: this._id,
                data: this.serializationHandler.toObject(
                    this.data,
                    (key: string) =>
                        this.sensitiveKeysManager.isSensitive(key, true), // Use strict mode
                    options
                ),
                metadata: includeMetadata
                    ? this.getSerializationMetadata()
                    : null,
                size: this.size,
                isReadOnly: this._isReadOnly,
                encryptionEnabled:
                    this.cryptoHandler.getEncryptionStatus().hasEncryptionKey,
            };

            // Return as JSON string or binary based on format
            if (format === "binary") {
                const jsonString = JSON.stringify(package_);
                const binaryData = new TextEncoder().encode(jsonString);
                return Array.from(binaryData)
                    .map((b) => b.toString(16).padStart(2, "0"))
                    .join("");
            } else {
                return JSON.stringify(package_, null, 2);
            }
        } catch (error) {
            console.error("Serialization failed:", error);
            throw new Error(
                `Serialization failed: ${(error as Error).message}`
            );
        }
    }

    /**
     * Exports the SecureObject data in various formats
     */
    public exportData(
        format: "json" | "csv" | "xml" | "yaml" = "json"
    ): string {
        this.ensureNotDestroyed();

        try {
            const data = this.toObject();

            switch (format) {
                case "json":
                    return JSON.stringify(data, null, 2);

                case "csv":
                    return this.exportToCSV(data);

                case "xml":
                    return this.exportToXML(data);

                case "yaml":
                    return this.exportToYAML(data);

                default:
                    throw new Error(`Unsupported export format: ${format}`);
            }
        } catch (error) {
            console.error("Export failed:", error);
            throw new Error(`Export failed: ${(error as Error).message}`);
        }
    }

    /**
     * Gets serialization metadata
     */
    private getSerializationMetadata() {
        const stats = this.metadataManager.getStats();
        const memoryUsage = this.getMemoryUsage();
        return {
            totalEntries: stats.totalEntries,
            secureEntries: stats.secureEntries,
            memoryUsage: memoryUsage.allocatedMemory,
            lastModified: stats.newestEntry?.getTime() || this._createdAt,
            createdAt: this._createdAt,
            accessCount: stats.totalAccesses,
            averageAccesses: stats.averageAccesses,
            oldestEntry: stats.oldestEntry?.getTime() || null,
            newestEntry: stats.newestEntry?.getTime() || null,
        };
    }

    /**
     * Exports to CSV format
     */
    private exportToCSV(data: any): string {
        const entries = Object.entries(data);
        if (entries.length === 0) return "Key,Value,Type\n";

        let csv = "Key,Value,Type\n";
        for (const [key, value] of entries) {
            const type = typeof value;
            const valueStr =
                type === "object" ? JSON.stringify(value) : String(value);
            const escapedValue = `"${valueStr.replace(/"/g, '""')}"`;
            csv += `"${key}",${escapedValue},${type}\n`;
        }
        return csv;
    }

    /**
     * Exports to XML format
     */
    private exportToXML(data: any): string {
        let xml = '<?xml version="1.0" encoding="UTF-8"?>\n<SecureObject>\n';

        for (const [key, value] of Object.entries(data)) {
            const type = typeof value;
            const valueStr =
                type === "object" ? JSON.stringify(value) : String(value);
            xml += `  <entry key="${this.escapeXML(
                key
            )}" type="${type}">${this.escapeXML(valueStr)}</entry>\n`;
        }

        xml += "</SecureObject>";
        return xml;
    }

    /**
     * Exports to YAML format
     */
    private exportToYAML(data: any): string {
        let yaml = "# SecureObject Export\n";
        yaml += `# Generated: ${new Date().toISOString()}\n\n`;

        for (const [key, value] of Object.entries(data)) {
            const type = typeof value;
            if (type === "object") {
                yaml += `${key}:\n`;
                yaml += `  value: ${JSON.stringify(value)}\n`;
                yaml += `  type: ${type}\n\n`;
            } else {
                yaml += `${key}: ${JSON.stringify(value)}\n`;
            }
        }

        return yaml;
    }

    /**
     * Escapes XML special characters
     */
    private escapeXML(str: string): string {
        return str
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#39;");
    }

    /**
     * Destroys the SecureObject and clears all data
     */
    public destroy(): void {
        if (!this._isDestroyed) {
            // Clean up memory tracking
            if (this._memoryTracking) {
                memoryManager.removeReference(this._id);
            }

            this.clear();
            this.eventManager.clear();
            this._isDestroyed = true;
            this.eventManager.emit("destroy");
        }
    }

    /**
     * Custom inspection for debugging (masks sensitive data)
     */
    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        if (this._isDestroyed) {
            return "SecureObject [DESTROYED]";
        }

        const stats = this.metadataManager.getStats();
        return `SecureObject [${this.size} items, ${
            stats.secureEntries
        } secure] ${this._isReadOnly ? "[READ-ONLY]" : ""}`;
    }
}

