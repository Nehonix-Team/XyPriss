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
 * SecureString Core Module
 * Main SecureString class with modular architecture
 */

import type {
    HashAlgorithm,
    HashOutputFormat,
    HMACOptions,
    PBKDF2Options,
} from "../../../types/string";

// Import modular components
import {
    SecureStringOptions,
    SecureStringEvent,
    SecureStringEventListener,
    ComparisonResult,
    SearchOptions,
    SplitOptions,
    ValidationResult,
    StringStatistics,
    MemoryUsage,
    DEFAULT_SECURE_STRING_OPTIONS,
    EntropyAnalysisResult,
    PatternAnalysisResult,
} from "../types";

// Import enhanced memory management
import {
    memoryManager,
    MemoryEventType,
    PoolStrategy,
    MemoryUtils,
} from "../../../utils/memory";
import { BufferManager } from "../buffer/buffer-manager";
import { StringOperations } from "../operations/string-operations";
import { ComparisonOperations } from "../operations/comparison-operations";
import { CryptoOperations } from "../crypto/crypto-operations";
import { StringValidator } from "../validation/string-validator";

// Import advanced features
import { EntropyAnalyzer } from "../advanced/entropy-analyzer";
import {
    QuantumSafeOperations,
    QuantumSafeOptions,
    QuantumSafeHashResult,
    QuantumSafeKeyResult,
} from "../advanced/quantum-safe";
import {
    PerformanceMonitor,
    PerformanceStats,
    BenchmarkResult,
} from "../advanced/performance-monitor";

/**
 * A secure string that can be explicitly cleared from memory with modular architecture
 */
export class SecureString {
    // Core components
    private bufferManager: BufferManager;
    private eventListeners: Map<
        SecureStringEvent,
        Set<SecureStringEventListener>
    > = new Map();
    private _isDestroyed: boolean = false;

    // Enhanced memory management
    private readonly _id: string;
    private _memoryTracking: boolean = false;
    private _createdAt: number = Date.now();
    private secureStringPool?: any;

    /**
     * Creates a new secure string with enhanced memory management
     */
    constructor(value: string = "", options: SecureStringOptions = {}) {
        this._id = `secure-string-${Date.now()}-${Math.random()
            .toString(36)
            .substring(2, 9)}`;
        this.bufferManager = new BufferManager(value, options);

        // Enable memory tracking by default for security
        this._memoryTracking = options.enableMemoryTracking ?? true;

        // Register with advanced memory manager
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
                        `Potential memory leak detected in SecureString ${this._id}`
                    );
                }
            });
        }

        // Initialize secure string pool for efficient reuse
        this.initializeSecureStringPool();

        this.emit("created", {
            value: value.length,
            id: this._id,
            memoryTracking: this._memoryTracking,
        });
    }

    /**
     * Creates a SecureString from another SecureString (copy constructor)
     */
    public static from(other: SecureString): SecureString {
        other.ensureNotDestroyed();
        const value = other.toString();
        const options = other.bufferManager.getOptions();
        return new SecureString(value, options);
    }

    /**
     * Creates a SecureString from a buffer
     */
    public static fromBuffer(
        buffer: Uint8Array,
        options: SecureStringOptions = {},
        encoding: string = "utf-8"
    ): SecureString {
        const bufferManager = BufferManager.fromUint8Array(
            buffer,
            options,
            encoding
        );
        const secureString = Object.create(SecureString.prototype);
        secureString.bufferManager = bufferManager;
        secureString.eventListeners = new Map();
        secureString._isDestroyed = false;
        secureString.emit("created", { fromBuffer: true });
        return secureString;
    }

    // ===== PROPERTY ACCESSORS =====

    /**
     * Gets the string value
     */
    public toString(): string {
        this.ensureNotDestroyed();
        const value = this.bufferManager.getString();
        this.emit("accessed", { operation: "toString" });
        return value;
    }

    /**
     * Gets the raw buffer (copy)
     */
    public toBuffer(): Uint8Array {
        this.ensureNotDestroyed();
        const buffer = this.bufferManager.toUint8Array();
        this.emit("accessed", { operation: "toBuffer" });
        return buffer;
    }

    /**
     * Gets the length of the string
     */
    public length(): number {
        this.ensureNotDestroyed();
        return this.bufferManager.getCharacterLength();
    }

    /**
     * Gets the byte length of the string in UTF-8 encoding
     */
    public byteLength(): number {
        this.ensureNotDestroyed();
        return this.bufferManager.getByteLength();
    }

    /**
     * Checks if the string is empty
     */
    public isEmpty(): boolean {
        this.ensureNotDestroyed();
        return this.bufferManager.isEmpty();
    }

    /**
     * Checks if the SecureString has been destroyed
     */
    public isDestroyed(): boolean {
        return this._isDestroyed;
    }

    // ===== STRING MANIPULATION METHODS =====

    /**
     * Appends another string
     */
    public append(value: string | SecureString): SecureString {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const appendValue =
            value instanceof SecureString ? value.toString() : value;
        const newValue = StringOperations.append(currentValue, appendValue);

        this.bufferManager.updateBuffer(newValue);
        this.emit("modified", {
            operation: "append",
            length: appendValue.length,
        });

        return this;
    }

    /**
     * Prepends another string
     */
    public prepend(value: string | SecureString): SecureString {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const prependValue =
            value instanceof SecureString ? value.toString() : value;
        const newValue = StringOperations.prepend(currentValue, prependValue);

        this.bufferManager.updateBuffer(newValue);
        this.emit("modified", {
            operation: "prepend",
            length: prependValue.length,
        });

        return this;
    }

    /**
     * Replaces the entire content with a new value
     */
    public replace(value: string | SecureString): SecureString {
        this.ensureNotDestroyed();

        const newValue =
            value instanceof SecureString ? value.toString() : value;
        this.bufferManager.updateBuffer(newValue);
        this.emit("modified", {
            operation: "replace",
            newLength: newValue.length,
        });

        return this;
    }

    /**
     * Extracts a substring
     */
    public substring(start: number, end?: number): SecureString {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const substr = StringOperations.substring(currentValue, start, end);

        return new SecureString(substr, this.bufferManager.getOptions());
    }

    /**
     * Splits the string into an array of SecureStrings
     */
    public split(
        separator: string | RegExp,
        options: SplitOptions = {}
    ): SecureString[] {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const parts = StringOperations.split(currentValue, separator, options);
        const stringOptions = this.bufferManager.getOptions();

        return parts.map((part) => new SecureString(part, stringOptions));
    }

    /**
     * Trims whitespace from both ends
     */
    public trim(): SecureString {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const trimmedValue = StringOperations.trim(currentValue);

        this.bufferManager.updateBuffer(trimmedValue);
        this.emit("modified", { operation: "trim" });

        return this;
    }

    /**
     * Converts to uppercase
     */
    public toUpperCase(): SecureString {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const upperValue = StringOperations.toUpperCase(currentValue);

        return new SecureString(upperValue, this.bufferManager.getOptions());
    }

    /**
     * Converts to lowercase
     */
    public toLowerCase(): SecureString {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const lowerValue = StringOperations.toLowerCase(currentValue);

        return new SecureString(lowerValue, this.bufferManager.getOptions());
    }

    // ===== COMPARISON METHODS =====

    /**
     * Compares this SecureString with another string (constant-time comparison)
     */
    public equals(
        other: string | SecureString,
        constantTime: boolean = true
    ): boolean {
        this.ensureNotDestroyed();

        const thisValue = this.toString();
        const otherValue =
            other instanceof SecureString ? other.toString() : other;

        const result = constantTime
            ? ComparisonOperations.constantTimeEquals(thisValue, otherValue)
            : ComparisonOperations.regularEquals(thisValue, otherValue);

        this.emit("compared", {
            operation: "equals",
            constantTime,
            result: result.isEqual,
        });

        return result.isEqual;
    }

    /**
     * Performs detailed comparison with timing information
     */
    public compare(
        other: string | SecureString,
        constantTime: boolean = true
    ): ComparisonResult {
        this.ensureNotDestroyed();

        const thisValue = this.toString();
        const otherValue =
            other instanceof SecureString ? other.toString() : other;

        const result = constantTime
            ? ComparisonOperations.constantTimeEquals(thisValue, otherValue)
            : ComparisonOperations.regularEquals(thisValue, otherValue);

        this.emit("compared", {
            operation: "compare",
            constantTime,
            result: result.isEqual,
        });

        return result;
    }

    // ===== SEARCH METHODS =====

    /**
     * Checks if the string contains a substring
     */
    public includes(
        searchString: string | SecureString,
        options: SearchOptions = {}
    ): boolean {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const search =
            searchString instanceof SecureString
                ? searchString.toString()
                : searchString;

        return StringOperations.includes(currentValue, search, options);
    }

    /**
     * Checks if the string starts with a prefix
     */
    public startsWith(
        searchString: string | SecureString,
        options: SearchOptions = {}
    ): boolean {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const search =
            searchString instanceof SecureString
                ? searchString.toString()
                : searchString;

        return StringOperations.startsWith(currentValue, search, options);
    }

    /**
     * Checks if the string ends with a suffix
     */
    public endsWith(
        searchString: string | SecureString,
        options: SearchOptions = {}
    ): boolean {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        const search =
            searchString instanceof SecureString
                ? searchString.toString()
                : searchString;

        return StringOperations.endsWith(currentValue, search, options);
    }

    // ===== VALIDATION METHODS =====

    /**
     * Validates the string as a password
     */
    public validatePassword(
        requirements: Parameters<
            typeof StringValidator.validatePassword
        >[1] = {}
    ): ValidationResult {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        return StringValidator.validatePassword(currentValue, requirements);
    }

    /**
     * Validates the string as an email
     */
    public validateEmail(): ValidationResult {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        return StringValidator.validateEmail(currentValue);
    }

    /**
     * Gets detailed string statistics
     */
    public getStatistics(): StringStatistics {
        this.ensureNotDestroyed();

        const currentValue = this.toString();
        return StringValidator.getStringStatistics(currentValue);
    }

    // ===== VALIDATION METHODS =====

    /**
     * Ensures the SecureString hasn't been destroyed
     */
    private ensureNotDestroyed(): void {
        if (this._isDestroyed) {
            throw new Error("String has been destroyed and cannot be used");
        }
    }

    /**
     * Emits an event to all registered listeners
     */
    private emit(event: SecureStringEvent, details?: any): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            for (const listener of listeners) {
                try {
                    listener(event, details);
                } catch (error) {
                    console.error(
                        `Error in SecureString event listener:`,
                        error
                    );
                }
            }
        }
    }

    // ===== CRYPTOGRAPHIC METHODS =====

    /**
     * Creates a hash of the string content
     */
    public async hash(
        algorithm: HashAlgorithm = "SHA-256",
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        this.ensureNotDestroyed();

        const content = this.toString();
        const result = await CryptoOperations.hash(content, algorithm, format);

        this.emit("hashed", { algorithm, format });

        return result;
    }

    /**
     * Creates an HMAC of the string content
     */
    public async hmac(
        options: HMACOptions,
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        this.ensureNotDestroyed();

        const content = this.toString();
        const result = await CryptoOperations.hmac(content, options, format);

        this.emit("hashed", {
            type: "hmac",
            algorithm: options.algorithm,
            format,
        });

        return result;
    }

    /**
     * Derives a key using PBKDF2
     */
    public async deriveKeyPBKDF2(
        options: PBKDF2Options,
        format: HashOutputFormat = "hex"
    ): Promise<string | Uint8Array> {
        this.ensureNotDestroyed();

        const content = this.toString();
        const result = await CryptoOperations.deriveKeyPBKDF2(
            content,
            options,
            format
        );

        this.emit("hashed", {
            type: "pbkdf2",
            iterations: options.iterations,
            format,
        });

        return result;
    }

    // ===== ADVANCED FEATURES =====

    /**
     * Performs comprehensive entropy analysis
     */
    public analyzeEntropy(): EntropyAnalysisResult {
        this.ensureNotDestroyed();

        const content = this.toString();
        return EntropyAnalyzer.analyzeEntropy(content);
    }

    /**
     * Analyzes patterns in the string
     */
    public analyzePatterns(): PatternAnalysisResult {
        this.ensureNotDestroyed();

        const content = this.toString();
        return EntropyAnalyzer.analyzePatterns(content);
    }

    /**
     * Creates a quantum-safe hash
     */
    public async createQuantumSafeHash(
        options: QuantumSafeOptions,
        format: HashOutputFormat = "hex"
    ): Promise<QuantumSafeHashResult> {
        this.ensureNotDestroyed();

        const content = this.toString();
        const result = await QuantumSafeOperations.createQuantumSafeHash(
            content,
            options,
            format
        );

        this.emit("hashed", {
            type: "quantum-safe",
            algorithm: options.algorithm,
            format,
        });

        return result;
    }

    /**
     * Derives a quantum-safe key
     */
    public async deriveQuantumSafeKey(
        options: QuantumSafeOptions,
        keyLength: number = 32,
        format: HashOutputFormat = "hex"
    ): Promise<QuantumSafeKeyResult> {
        this.ensureNotDestroyed();

        const content = this.toString();
        const result = await QuantumSafeOperations.deriveQuantumSafeKey(
            content,
            options,
            keyLength,
            format
        );

        this.emit("hashed", {
            type: "quantum-safe-kdf",
            algorithm: options.algorithm,
            format,
        });

        return result;
    }

    /**
     * Verifies a quantum-safe hash
     */
    public async verifyQuantumSafeHash(
        expectedHash: string | Uint8Array,
        options: QuantumSafeOptions,
        format: HashOutputFormat = "hex"
    ): Promise<boolean> {
        this.ensureNotDestroyed();

        const content = this.toString();
        return QuantumSafeOperations.verifyQuantumSafeHash(
            content,
            expectedHash,
            options,
            format
        );
    }

    /**
     * Starts performance monitoring for this SecureString
     */
    public startPerformanceMonitoring(): void {
        PerformanceMonitor.startMonitoring();
    }

    /**
     * Stops performance monitoring
     */
    public stopPerformanceMonitoring(): void {
        PerformanceMonitor.stopMonitoring();
    }

    /**
     * Gets performance statistics
     */
    public getPerformanceStats(): PerformanceStats {
        return PerformanceMonitor.getStats();
    }

    /**
     * Benchmarks a specific operation on this SecureString
     */
    public async benchmarkOperation(
        operation: () => Promise<any> | any,
        operationName: string,
        iterations: number = 100
    ): Promise<BenchmarkResult> {
        return PerformanceMonitor.benchmark(
            operation,
            operationName,
            iterations
        );
    }

    /**
     * Measures an operation with automatic performance recording
     */
    public async measureOperation<T>(
        operation: () => Promise<T> | T,
        operationType: string
    ): Promise<T> {
        const operationSize = this.length();
        return PerformanceMonitor.measure(
            operation,
            operationType,
            operationSize
        );
    }

    // ===== EVENT MANAGEMENT =====

    /**
     * Adds an event listener
     */
    public addEventListener(
        event: SecureStringEvent,
        listener: SecureStringEventListener
    ): void {
        if (!this.eventListeners.has(event)) {
            this.eventListeners.set(event, new Set());
        }
        this.eventListeners.get(event)!.add(listener);
    }

    /**
     * Removes an event listener
     */
    public removeEventListener(
        event: SecureStringEvent,
        listener: SecureStringEventListener
    ): void {
        const listeners = this.eventListeners.get(event);
        if (listeners) {
            listeners.delete(listener);
            if (listeners.size === 0) {
                this.eventListeners.delete(event);
            }
        }
    }

    /**
     * Removes all event listeners
     */
    public removeAllEventListeners(event?: SecureStringEvent): void {
        if (event) {
            this.eventListeners.delete(event);
        } else {
            this.eventListeners.clear();
        }
    }

    // ===== UTILITY METHODS =====

    /**
     * Gets memory usage information
     */
    public getMemoryUsage(): MemoryUsage {
        this.ensureNotDestroyed();
        return this.bufferManager.getMemoryUsage();
    }

    /**
     * Gets the current options
     */
    public getOptions(): Required<SecureStringOptions> {
        this.ensureNotDestroyed();
        return this.bufferManager.getOptions();
    }

    /**
     * Updates the options (may recreate buffer)
     */
    public updateOptions(newOptions: Partial<SecureStringOptions>): void {
        this.ensureNotDestroyed();
        this.bufferManager.updateOptions(newOptions);
        this.emit("modified", {
            operation: "updateOptions",
            options: newOptions,
        });
    }

    /**
     * Creates a shallow copy of the SecureString
     */
    public clone(): SecureString {
        this.ensureNotDestroyed();
        return SecureString.from(this);
    }

    /**
     * Executes a function with the string value and optionally clears it afterward
     */
    public use<T>(fn: (value: string) => T, autoClear: boolean = false): T {
        this.ensureNotDestroyed();

        try {
            const value = this.toString();
            return fn(value);
        } finally {
            if (autoClear) {
                this.clear();
            }
        }
    }

    // ===== ENHANCED MEMORY MANAGEMENT METHODS =====

    /**
     * Initialize secure string pool for efficient memory reuse
     */
    private initializeSecureStringPool(): void {
        if (!this.secureStringPool) {
            try {
                this.secureStringPool =
                    memoryManager.getPool("secure-string-pool") ||
                    memoryManager.createPool({
                        name: "secure-string-pool",
                        factory: () => new Uint8Array(256), // 256 byte buffers for strings
                        reset: (buffer) => {
                            // Secure wipe before reuse
                            this.secureWipe(buffer);
                        },
                        capacity: 30,
                        strategy: PoolStrategy.LRU,
                        validator: (buffer) => buffer instanceof Uint8Array,
                    });
            } catch (error) {
                // Pool might already exist, try to get it
                this.secureStringPool =
                    memoryManager.getPool("secure-string-pool");
            }
        }
    }

    /**
     * Handle memory pressure situations
     */
    private handleMemoryPressure(): void {
        // Force cleanup of the buffer manager
        try {
            this.bufferManager.wipe(); // Use wipe() method instead of cleanup()
        } catch (error) {
            // Buffer might already be destroyed
        }

        // Emit event for external handlers
        this.emit("destroyed", {
            reason: "memory_pressure_cleanup",
            timestamp: Date.now(),
            objectId: this._id,
        });
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
     * Get enhanced memory usage statistics
     */
    public getEnhancedMemoryUsage(): {
        bufferSize: number;
        actualLength: number;
        overhead: number;
        isFragmented: boolean;
        isEncrypted: boolean;
        formattedSize: string;
        age: number;
        poolStats?: any;
    } {
        this.ensureNotDestroyed();

        const basicUsage = this.getMemoryUsage();
        const now = Date.now();

        return {
            ...basicUsage,
            formattedSize: MemoryUtils.formatBytes(basicUsage.bufferSize),
            age: now - this._createdAt,
            poolStats: this.secureStringPool?.getStats(),
        };
    }

    /**
     * Force garbage collection for this SecureString
     */
    public forceGarbageCollection(): void {
        this.ensureNotDestroyed();

        if (this._memoryTracking) {
            const beforeUsage = this.getEnhancedMemoryUsage();

            // Clean up buffer manager
            try {
                this.bufferManager.wipe(); // Use wipe() method instead of cleanup()
            } catch (error) {
                // Buffer might already be cleaned
            }

            // Trigger global GC
            const gcResult = memoryManager.forceGC();

            const afterUsage = this.getEnhancedMemoryUsage();
            const freedMemory = beforeUsage.bufferSize - afterUsage.bufferSize;

            this.emit("destroyed", {
                operation: "gc",
                timestamp: Date.now(),
                freedMemory,
                gcDuration: gcResult.duration,
                gcSuccess: gcResult.success,
                beforeUsage: beforeUsage.formattedSize,
                afterUsage: afterUsage.formattedSize,
            });
        }
    }

    /**
     * Enable memory tracking for this SecureString
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
     * Disable memory tracking for this SecureString
     */
    public disableMemoryTracking(): this {
        this.ensureNotDestroyed();

        if (this._memoryTracking) {
            this._memoryTracking = false;
            memoryManager.removeReference(this._id);
        }

        return this;
    }

    /**
     * Clears the string by zeroing its contents and marks as destroyed
     */
    public clear(): void {
        if (!this._isDestroyed) {
            // Clean up memory tracking
            if (this._memoryTracking) {
                memoryManager.removeReference(this._id);
            }

            this.bufferManager.destroy();
            this._isDestroyed = true;
            this.emit("destroyed", { operation: "clear" });
            this.eventListeners.clear();
        }
    }

    /**
     * Alias for clear() - destroys the SecureString
     */
    public destroy(): void {
        this.clear();
    }

    /**
     * Securely wipes the content without destroying the SecureString
     */
    public wipe(): void {
        this.ensureNotDestroyed();
        this.bufferManager.wipe();
        this.emit("modified", { operation: "wipe" });
    }

    // ===== SERIALIZATION METHODS =====

    /**
     * Creates a JSON representation (warning: exposes the value)
     */
    public toJSON(): { value: string; length: number; byteLength: number } {
        this.ensureNotDestroyed();

        return {
            value: this.toString(),
            length: this.length(),
            byteLength: this.byteLength(),
        };
    }

    /**
     * Custom inspection for debugging (masks the actual value)
     */
    public [Symbol.for("nodejs.util.inspect.custom")](): string {
        if (this._isDestroyed) {
            return "SecureString [DESTROYED]";
        }

        const memUsage = this.getMemoryUsage();
        return `SecureString [${this.length()} chars, ${
            memUsage.bufferSize
        } bytes${memUsage.isEncrypted ? ", encrypted" : ""}]`;
    }

    // ===== STATIC UTILITY METHODS =====

    /**
     * Gets information about available algorithms
     */
    public static getAlgorithmInfo() {
        return CryptoOperations.getAlgorithmInfo();
    }

    /**
     * Lists all supported hash algorithms
     */
    public static getSupportedHashAlgorithms(): HashAlgorithm[] {
        return CryptoOperations.getSupportedHashAlgorithms();
    }

    /**
     * Lists all supported HMAC algorithms
     */
    public static getSupportedHMACAlgorithms() {
        return CryptoOperations.getSupportedHMACAlgorithms();
    }

    /**
     * Generates a cryptographically secure salt
     */
    public static generateSalt(
        length: number = 32,
        format: HashOutputFormat = "hex"
    ) {
        if (format === "uint8array") {
            return CryptoOperations.generateSalt(length);
        } else if (format === "base64") {
            return CryptoOperations.generateSaltBase64(length);
        } else {
            return CryptoOperations.generateSaltHex(length);
        }
    }

    /**
     * Performs constant-time hash comparison
     */
    public static constantTimeHashCompare(
        hash1: string,
        hash2: string
    ): boolean {
        return CryptoOperations.constantTimeHashCompare(hash1, hash2);
    }
}

