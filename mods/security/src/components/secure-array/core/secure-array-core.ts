/***************************************************************************
 * XyPrissSecurity - Enhanced Secure Array Core Implementation
 *
 *  security features and array methods
 *
 * @author Nehonix & Community
 *
 * @license MIT
 ***************************************************************************** */

import {
    SecureArrayValue,
    SecureArrayOptions,
    SecureArraySerializationOptions,
    SecureArrayEvent,
    SecureArrayEventListener,
    ElementMetadata,
    SecureArrayStats,
    DEFAULT_SECURE_ARRAY_OPTIONS,
    PredicateFn,
    ComparatorFn,
    MapperFn,
    ReducerFn,
} from "../types";

// Import modular components
import { ArrayMetadataManager } from "../metadata/metadata-manager";
import { ArrayValidationUtils } from "../utils/validation";
import { ArrayIdGenerator } from "../utils/id-generator";

// Import existing XyPrissSecurity utilities
import { SecureBuffer } from "../../secure-memory";
import { memoryManager, MemoryEventType } from "../../../utils/memory";

// Use existing event manager from secure-array
import { ArrayEventManager } from "../events/event-manager";
import { ArrayCryptoHandler } from "../crypto/ArrayCryptoHandler";
import { ArraySerializationHandler } from "../serialization/ArraySerializationHandler";
import { XyPriss } from "../../..";

/**
 * A secure array that can store sensitive data with enhanced security features
 * T represents the type of elements stored in the array
 */
export class SecureArray<T extends SecureArrayValue = SecureArrayValue>
    implements Iterable<T>
{
    // Core data storage
    private elements: T[] = [];
    private secureBuffers: Map<number, SecureBuffer> = new Map();

    // Modular components
    private metadataManager: ArrayMetadataManager;
    private eventManager: ArrayEventManager;
    private cryptoHandler: ArrayCryptoHandler;
    private serializationHandler: ArraySerializationHandler;

    // State management
    private _isDestroyed: boolean = false;
    private _isReadOnly: boolean = false;
    private _isFrozen: boolean = false;
    private readonly _id: string;
    private _version: number = 1;
    private _lastModified: number = Date.now();
    private _createdAt: number = Date.now();

    // Memory management
    private _memoryTracking: boolean = false;
    private secureBufferPool?: any;
    private _maxSize?: number;

    // Configuration
    private options: Required<SecureArrayOptions>;

    // Snapshot functionality
    private snapshots: Map<
        string,
        {
            elements: T[];
            metadata: Map<number, ElementMetadata>;
            timestamp: number;
        }
    > = new Map();

    /**
     * Creates a new secure array
     */
    constructor(initialData?: T[], options?: SecureArrayOptions) {
        this._id = ArrayIdGenerator.generate();
        this.options = { ...DEFAULT_SECURE_ARRAY_OPTIONS, ...options };
        this._isReadOnly = this.options.readOnly;
        this._maxSize = this.options.maxSize;

        // Initialize modular components
        this.metadataManager = new ArrayMetadataManager();
        this.eventManager = new ArrayEventManager();
        this.cryptoHandler = new ArrayCryptoHandler(this._id);
        this.serializationHandler = new ArraySerializationHandler(
            this.cryptoHandler,
            this.metadataManager
        );

        // Set encryption key if provided
        if (this.options.encryptionKey) {
            this.cryptoHandler.setEncryptionKey(this.options.encryptionKey);
        }

        // Enable memory tracking
        this._memoryTracking = this.options.enableMemoryTracking;

        // Register with advanced memory manager if tracking is enabled
        if (this._memoryTracking) {
            memoryManager.registerObject(this, this._id);

            // Listen to memory events for proactive management
            memoryManager.on(MemoryEventType.MEMORY_PRESSURE, (event: any) => {
                if (event.data?.pressure > 0.8) {
                    this.handleMemoryPressure();
                }
            });

            memoryManager.on(MemoryEventType.LEAK_DETECTED, (event: any) => {
                if (event.data?.leaks?.includes(this._id)) {
                    console.warn(
                        `Potential memory leak detected in SecureArray ${this._id}`
                    );
                }
            });
        }

        // Initialize secure buffer pool
        this.initializeSecureBufferPool();

        // Set initial data
        if (initialData) {
            this.pushAll(initialData);
        }

        this.eventManager.emit("created", -1, undefined, { id: this._id });
    }

    // ===== MEMORY MANAGEMENT =====

    /**
     * Initialize secure buffer pool for efficient memory reuse
     */
    private initializeSecureBufferPool(): void {
        if (!this.secureBufferPool) {
            try {
                this.secureBufferPool =
                    memoryManager.getPool("secure-array-buffer-pool") ||
                    memoryManager.createPool({
                        name: "secure-array-buffer-pool",
                        factory: () => new Uint8Array(1024), // 1KB buffers
                        reset: (buffer: any) => {
                            // Secure wipe before reuse
                            this.secureWipe(buffer);
                        },
                        capacity: 50,
                        strategy: "LRU" as any,
                        validator: (buffer: any) =>
                            buffer instanceof Uint8Array,
                    });
            } catch (error) {
                // Pool might already exist, try to get it
                this.secureBufferPool = memoryManager.getPool(
                    "secure-array-buffer-pool"
                );
            }
        }
    }

    /**
     * Handle memory pressure by cleaning up unused resources
     */
    private handleMemoryPressure(): void {
        // Clean up unused secure buffers
        for (const [index, buffer] of this.secureBuffers.entries()) {
            if (index >= this.elements.length) {
                buffer.destroy();
                this.secureBuffers.delete(index);
            }
        }

        // Clear old snapshots (keep only the latest 3)
        const sortedSnapshots = Array.from(this.snapshots.entries()).sort(
            ([, a], [, b]) => b.timestamp - a.timestamp
        );

        if (sortedSnapshots.length > 3) {
            for (let i = 3; i < sortedSnapshots.length; i++) {
                this.snapshots.delete(sortedSnapshots[i][0]);
            }
        }

        // Trigger garbage collection if available
        if (global.gc) {
            global.gc();
        }

        this.eventManager.emit("gc", -1, undefined, {
            operation: "memory_pressure_cleanup",
            buffersCleared: this.secureBuffers.size,
        });
    }

    /**
     * Secure wipe of buffer contents
     */
    private secureWipe(buffer: Uint8Array): void {
        return XyPriss.secureWipe(buffer);
    }

    // ===== UTILITY METHODS =====

    /**
     * Ensures the array is not destroyed
     */
    private ensureNotDestroyed(): void {
        if (this._isDestroyed) {
            console.error("Array has been destroyed and cannot be used.");
            throw new Error("Cannot use destroyed fortified Array. ");
        }
    }

    /**
     * Ensures the array is not read-only
     */
    private ensureNotReadOnly(): void {
        if (this._isReadOnly) {
            throw new Error("SecureArray is read-only");
        }
    }

    /**
     * Ensures the array is not frozen
     */
    private ensureNotFrozen(): void {
        if (this._isFrozen) {
            throw new Error("SecureArray is frozen");
        }
    }

    /**
     * Check if adding elements would exceed max size
     */
    private checkSizeLimit(additionalElements: number = 1): void {
        if (
            this._maxSize &&
            this.elements.length + additionalElements > this._maxSize
        ) {
            throw new Error(
                `Operation would exceed maximum size limit of ${this._maxSize}`
            );
        }
    }

    /**
     * Updates the last modified timestamp and version
     */
    private updateLastModified(): void {
        this._lastModified = Date.now();
        this._version++;
    }

    /**
     * Validates an index
     */
    private validateIndex(index: number): void {
        if (this.options.enableIndexValidation) {
            if (!Number.isInteger(index) || index < 0) {
                throw new Error(`Invalid index: ${index}`);
            }
        }
    }

    /**
     * Validates a value
     */
    private validateValue(value: T): void {
        if (this.options.enableTypeValidation) {
            ArrayValidationUtils.validateSecureArrayValue(value);
        }
    }

    // ===== CORE ARRAY OPERATIONS =====

    /**
     * Gets the length of the array
     */
    public get length(): number {
        this.ensureNotDestroyed();
        return this.elements.length;
    }

    /**
     * Gets the unique identifier of this array
     */
    public get id(): string {
        return this._id;
    }

    /**
     * Gets the version number (increments on each mutation)
     */
    public get version(): number {
        return this._version;
    }

    /**
     * Gets when the array was last modified
     */
    public get lastModified(): number {
        return this._lastModified;
    }

    /**
     * Gets when the array was created
     */
    public get createdAt(): number {
        return this._createdAt;
    }

    /**
     * Check if the array is empty
     */
    public get isEmpty(): boolean {
        return this.elements.length === 0;
    }

    /**
     * Check if the array is read-only
     */
    public get isReadOnly(): boolean {
        return this._isReadOnly;
    }

    /**
     * Check if the array is frozen
     */
    public get isFrozen(): boolean {
        return this._isFrozen;
    }

    /**
     * Check if the array is destroyed
     */
    public get isDestroyed(): boolean {
        return this._isDestroyed;
    }

    /**
     * Gets an element at the specified index with automatic decryption
     */
    public get(index: number): T | undefined {
        this.ensureNotDestroyed();
        this.validateIndex(index);

        if (index >= this.elements.length) {
            return undefined;
        }

        const value = this.elements[index];

        // Update access metadata
        if (this.metadataManager.has(index)) {
            const metadata = this.metadataManager.get(index)!;
            this.metadataManager.update(
                index,
                metadata.type,
                metadata.isSecure,
                true
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
                this.eventManager.emit("get", index, decryptedValue);
                return decryptedValue as T;
            } catch (error) {
                console.error(
                    `Failed to decrypt value at index ${index}:`,
                    error
                );
                // Return the encrypted value if decryption fails
                this.eventManager.emit("get", index, value);
                return value;
            }
        }

        // Convert SecureBuffer back to original type based on metadata
        if (value instanceof SecureBuffer) {
            const metadata = this.metadataManager.get(index);
            if (metadata?.type === "string") {
                // Convert SecureBuffer back to string
                const buffer = value.getBuffer();
                const result = new TextDecoder().decode(buffer) as unknown as T;
                this.eventManager.emit("get", index, result);
                return result;
            }
        }

        this.eventManager.emit("get", index, value);
        return value;
    }

    /**
     * Gets element at index with bounds checking
     */
    public at(index: number): T | undefined {
        this.ensureNotDestroyed();

        // Handle negative indices
        if (index < 0) {
            index = this.elements.length + index;
        }

        return this.get(index);
    }

    /**
     * Sets an element at the specified index
     */
    public set(index: number, value: T): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();
        this.validateIndex(index);
        this.validateValue(value);

        // Check size limit for new indices
        if (index >= this.elements.length) {
            this.checkSizeLimit(index - this.elements.length + 1);
        }

        // Extend array if necessary
        while (index >= this.elements.length) {
            this.elements.push(undefined as any);
        }

        // Clean up any existing secure buffer for this index
        this.cleanupIndex(index);

        // Handle secure storage for strings
        if (typeof value === "string") {
            const secureBuffer = SecureBuffer.from(value);
            this.secureBuffers.set(index, secureBuffer);
            this.elements[index] = secureBuffer as any;
            this.metadataManager.update(index, "string", true);
        } else {
            this.elements[index] = value;
            this.metadataManager.update(index, typeof value, false);
        }

        this.updateLastModified();
        this.eventManager.emit("set", index, value);
        return this;
    }

    /**
     * Cleans up resources associated with an index
     */
    private cleanupIndex(index: number): void {
        if (this.secureBuffers.has(index)) {
            this.secureBuffers.get(index)?.destroy();
            this.secureBuffers.delete(index);
        }
    }

    /**
     * Adds an element to the end of the array
     */
    public push(value: T): number {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();
        this.validateValue(value);
        this.checkSizeLimit(1);

        const index = this.elements.length;

        // Handle secure storage for strings
        if (typeof value === "string") {
            const secureBuffer = SecureBuffer.from(value);
            this.secureBuffers.set(index, secureBuffer);
            this.elements.push(secureBuffer as any);
            this.metadataManager.update(index, "string", true);
        } else {
            this.elements.push(value);
            this.metadataManager.update(index, typeof value, false);
        }

        this.updateLastModified();
        this.eventManager.emit("push", index, value);
        return this.elements.length;
    }

    /**
     * Removes and returns the last element
     */
    public pop(): T | undefined {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        if (this.elements.length === 0) {
            return undefined;
        }

        const index = this.elements.length - 1;
        const value = this.get(index);

        // Clean up resources
        this.cleanupIndex(index);
        this.elements.pop();
        this.metadataManager.delete(index);

        this.updateLastModified();
        this.eventManager.emit("pop", index, value);
        return value;
    }

    /**
     * Removes and returns the first element
     */
    public shift(): T | undefined {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        if (this.elements.length === 0) {
            return undefined;
        }

        const value = this.get(0);

        // Clean up resources for index 0
        this.cleanupIndex(0);
        this.elements.shift();

        // Shift all metadata indices down by 1
        this.metadataManager.shiftIndices(0, -1);

        // Shift all secure buffer indices down by 1
        const newSecureBuffers = new Map<number, SecureBuffer>();
        for (const [index, buffer] of this.secureBuffers.entries()) {
            if (index > 0) {
                newSecureBuffers.set(index - 1, buffer);
            }
        }
        this.secureBuffers = newSecureBuffers;

        this.updateLastModified();
        this.eventManager.emit("shift", 0, value);
        return value;
    }

    /**
     * Adds elements to the beginning of the array
     */
    public unshift(...values: T[]): number {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();
        this.checkSizeLimit(values.length);

        for (const value of values) {
            this.validateValue(value);
        }

        // Shift existing secure buffers and metadata
        const shiftAmount = values.length;
        this.metadataManager.shiftIndices(0, shiftAmount);

        const newSecureBuffers = new Map<number, SecureBuffer>();
        for (const [index, buffer] of this.secureBuffers.entries()) {
            newSecureBuffers.set(index + shiftAmount, buffer);
        }
        this.secureBuffers = newSecureBuffers;

        // Add new values at the beginning
        for (let i = 0; i < values.length; i++) {
            const value = values[i];

            if (typeof value === "string") {
                const secureBuffer = SecureBuffer.from(value);
                this.secureBuffers.set(i, secureBuffer);
                this.metadataManager.update(i, "string", true);
            } else {
                this.metadataManager.update(i, typeof value, false);
            }
        }

        this.elements.unshift(...values);
        this.updateLastModified();
        this.eventManager.emit("unshift", 0, values);
        return this.elements.length;
    }

    /**
     * Adds multiple elements to the array
     */
    public pushAll(values: T[]): number {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();
        this.checkSizeLimit(values.length);

        for (const value of values) {
            this.push(value);
        }

        return this.elements.length;
    }

    // ===== ENHANCED ARRAY METHODS =====

    /**
     * Removes elements from array and optionally inserts new elements
     */
    public splice(
        start: number,
        deleteCount?: number,
        ...items: T[]
    ): SecureArray<T> {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        if (start < 0) {
            start = Math.max(0, this.elements.length + start);
        }

        deleteCount =
            deleteCount === undefined
                ? this.elements.length - start
                : Math.max(0, deleteCount);

        if (items.length > 0) {
            this.checkSizeLimit(items.length - deleteCount);
            for (const item of items) {
                this.validateValue(item);
            }
        }

        // Create a new SecureArray for removed elements
        const removedElements = new SecureArray<T>();

        // Get elements to be removed
        for (
            let i = start;
            i < start + deleteCount && i < this.elements.length;
            i++
        ) {
            const value = this.get(i);
            if (value !== undefined) {
                removedElements.push(value);
            }
        }

        // Clean up secure buffers for removed elements
        for (let i = start; i < start + deleteCount; i++) {
            this.cleanupIndex(i);
        }

        // Perform the splice operation
        const removed = this.elements.splice(start, deleteCount, ...items);

        // Update metadata and secure buffers
        this.metadataManager.splice(start, deleteCount, items.length);

        // Handle secure storage for new items
        for (let i = 0; i < items.length; i++) {
            const value = items[i];
            const index = start + i;

            if (typeof value === "string") {
                const secureBuffer = SecureBuffer.from(value);
                this.secureBuffers.set(index, secureBuffer);
                this.metadataManager.update(index, "string", true);
            } else {
                this.metadataManager.update(index, typeof value, false);
            }
        }

        this.updateLastModified();
        this.eventManager.emit("splice", start, { removed, added: items });

        return removedElements;
    }

    /**
     * Returns a shallow copy of a portion of the array
     */
    public slice(start?: number, end?: number): SecureArray<T> {
        this.ensureNotDestroyed();

        const slicedElements: T[] = [];
        const actualStart =
            start === undefined
                ? 0
                : start < 0
                ? Math.max(0, this.elements.length + start)
                : start;
        const actualEnd =
            end === undefined
                ? this.elements.length
                : end < 0
                ? this.elements.length + end
                : end;

        for (
            let i = actualStart;
            i < actualEnd && i < this.elements.length;
            i++
        ) {
            const value = this.get(i);
            if (value !== undefined) {
                slicedElements.push(value);
            }
        }

        const newArray = new SecureArray<T>(slicedElements, {
            ...this.options,
        });
        this.eventManager.emit("slice", actualStart, {
            start: actualStart,
            end: actualEnd,
            result: newArray,
        });

        return newArray;
    }

    /**
     * Concatenates arrays and returns a new SecureArray
     */
    public concat(...arrays: (T[] | SecureArray<T>)[]): SecureArray<T> {
        this.ensureNotDestroyed();

        const newElements: T[] = [];

        // Add current array elements
        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                newElements.push(value);
            }
        }

        // Add elements from other arrays
        for (const arr of arrays) {
            if (arr instanceof SecureArray) {
                for (let i = 0; i < arr.length; i++) {
                    const value = arr.get(i);
                    if (value !== undefined) {
                        newElements.push(value);
                    }
                }
            } else {
                newElements.push(...arr);
            }
        }

        return new SecureArray<T>(newElements, { ...this.options });
    }

    /**
     * Joins all elements into a string
     */
    public join(separator: string = ","): string {
        this.ensureNotDestroyed();

        const stringElements: string[] = [];
        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            stringElements.push(value?.toString() ?? "");
        }

        return stringElements.join(separator);
    }

    /**
     * Reverses the array in place
     */
    public reverse(): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        // Create new mappings for secure buffers
        const newSecureBuffers = new Map<number, SecureBuffer>();
        const length = this.elements.length;

        for (const [index, buffer] of this.secureBuffers.entries()) {
            newSecureBuffers.set(length - 1 - index, buffer);
        }

        this.secureBuffers = newSecureBuffers;
        this.elements.reverse();
        this.metadataManager.reverse(length);

        this.updateLastModified();
        this.eventManager.emit("reverse", -1, undefined);

        return this;
    }

    /**
     * Sorts the array in place
     */
    public sort(compareFn?: ComparatorFn<T>): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        // Get actual values for sorting
        const indexValuePairs: Array<{ index: number; value: T }> = [];
        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                indexValuePairs.push({ index: i, value });
            }
        }

        // Sort the pairs
        indexValuePairs.sort((a, b) => {
            if (compareFn) {
                return compareFn(a.value, b.value);
            }

            const aStr = String(a.value);
            const bStr = String(b.value);
            return aStr < bStr ? -1 : aStr > bStr ? 1 : 0;
        });

        // Rebuild the array in sorted order
        const newElements: T[] = [];
        const newSecureBuffers = new Map<number, SecureBuffer>();

        for (let i = 0; i < indexValuePairs.length; i++) {
            const { index: oldIndex, value } = indexValuePairs[i];
            newElements[i] = this.elements[oldIndex];

            if (this.secureBuffers.has(oldIndex)) {
                newSecureBuffers.set(i, this.secureBuffers.get(oldIndex)!);
            }
        }

        this.elements = newElements;
        this.secureBuffers = newSecureBuffers;
        this.metadataManager.reorder(indexValuePairs.map((p) => p.index));

        this.updateLastModified();
        this.eventManager.emit("sort", -1, undefined);

        return this;
    }

    // ===== FUNCTIONAL PROGRAMMING METHODS =====

    /**
     * Calls a function for each element
     */
    public forEach(
        callback: (value: T, index: number, array: SecureArray<T>) => void,
        thisArg?: any
    ): void {
        this.ensureNotDestroyed();

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                callback.call(thisArg, value, i, this);
            }
        }
    }

    /**
     * Creates a new array with results of calling a function for every element
     */
    public map<U extends SecureArrayValue>(
        callback: MapperFn<T, U>,
        thisArg?: any
    ): SecureArray<U> {
        this.ensureNotDestroyed();

        const mappedElements: U[] = [];
        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                mappedElements.push(callback.call(thisArg, value, i, this));
            }
        }

        return new SecureArray<U>(mappedElements, { ...this.options });
    }

    /**
     * Creates a new array with elements that pass a test
     */
    public filter(predicate: PredicateFn<T>, thisArg?: any): SecureArray<T> {
        this.ensureNotDestroyed();

        const filteredElements: T[] = [];
        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (
                value !== undefined &&
                predicate.call(thisArg, value, i, this)
            ) {
                filteredElements.push(value);
            }
        }

        return new SecureArray<T>(filteredElements, { ...this.options });
    }

    /**
     * Reduces the array to a single value
     */
    public reduce<U>(callback: ReducerFn<T, U>, initialValue?: U): U {
        this.ensureNotDestroyed();

        let accumulator = initialValue;
        let startIndex = 0;

        if (accumulator === undefined) {
            if (this.elements.length === 0) {
                throw new TypeError(
                    "Reduce of empty array with no initial value"
                );
            }
            accumulator = this.get(0) as unknown as U;
            startIndex = 1;
        }

        for (let i = startIndex; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                accumulator = callback(accumulator!, value, i, this);
            }
        }

        return accumulator!;
    }

    /**
     * Tests whether at least one element passes the test
     */
    public some(predicate: PredicateFn<T>, thisArg?: any): boolean {
        this.ensureNotDestroyed();

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (
                value !== undefined &&
                predicate.call(thisArg, value, i, this)
            ) {
                return true;
            }
        }

        return false;
    }

    /**
     * Tests whether all elements pass the test
     */
    public every(predicate: PredicateFn<T>, thisArg?: any): boolean {
        this.ensureNotDestroyed();

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (
                value !== undefined &&
                !predicate.call(thisArg, value, i, this)
            ) {
                return false;
            }
        }

        return true;
    }

    /**
     * Finds the first element that satisfies the predicate
     */
    public find(predicate: PredicateFn<T>, thisArg?: any): T | undefined {
        this.ensureNotDestroyed();

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (
                value !== undefined &&
                predicate.call(thisArg, value, i, this)
            ) {
                return value;
            }
        }

        return undefined;
    }

    /**
     * Finds the index of the first element that satisfies the predicate
     */
    public findIndex(predicate: PredicateFn<T>, thisArg?: any): number {
        this.ensureNotDestroyed();

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (
                value !== undefined &&
                predicate.call(thisArg, value, i, this)
            ) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Finds the last element that satisfies the predicate
     */
    public findLast(predicate: PredicateFn<T>, thisArg?: any): T | undefined {
        this.ensureNotDestroyed();

        for (let i = this.elements.length - 1; i >= 0; i--) {
            const value = this.get(i);
            if (
                value !== undefined &&
                predicate.call(thisArg, value, i, this)
            ) {
                return value;
            }
        }

        return undefined;
    }

    /**
     * Finds the index of the last element that satisfies the predicate
     */
    public findLastIndex(predicate: PredicateFn<T>, thisArg?: any): number {
        this.ensureNotDestroyed();

        for (let i = this.elements.length - 1; i >= 0; i--) {
            const value = this.get(i);
            if (
                value !== undefined &&
                predicate.call(thisArg, value, i, this)
            ) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Returns the first index of an element
     */
    public indexOf(searchElement: T, fromIndex: number = 0): number {
        this.ensureNotDestroyed();

        const startIndex =
            fromIndex < 0
                ? Math.max(0, this.elements.length + fromIndex)
                : fromIndex;

        for (let i = startIndex; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value === searchElement) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Returns the last index of an element
     */
    public lastIndexOf(searchElement: T, fromIndex?: number): number {
        this.ensureNotDestroyed();

        const startIndex =
            fromIndex === undefined
                ? this.elements.length - 1
                : fromIndex < 0
                ? this.elements.length + fromIndex
                : fromIndex;

        for (
            let i = Math.min(startIndex, this.elements.length - 1);
            i >= 0;
            i--
        ) {
            const value = this.get(i);
            if (value === searchElement) {
                return i;
            }
        }

        return -1;
    }

    /**
     * Checks if an element exists in the array
     */
    public includes(searchElement: T, fromIndex: number = 0): boolean {
        return this.indexOf(searchElement, fromIndex) !== -1;
    }

    // ===== ENHANCED SECURITY METHODS =====

    /**
     * Creates a snapshot of the current array state
     */
    public createSnapshot(name?: string): string {
        this.ensureNotDestroyed();

        const snapshotId =
            name ||
            `snapshot_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

        // Deep copy elements
        const elementsCopy: T[] = [];
        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                elementsCopy.push(value);
            }
        }

        // Copy metadata
        const metadataCopy = new Map(this.metadataManager.getAllMetadata());

        this.snapshots.set(snapshotId, {
            elements: elementsCopy,
            metadata: metadataCopy,
            timestamp: Date.now(),
        });

        this.eventManager.emit("snapshot_created", -1, undefined, {
            snapshotId,
        });
        return snapshotId;
    }

    /**
     * Restores the array from a snapshot
     */
    public restoreFromSnapshot(snapshotId: string): boolean {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        const snapshot = this.snapshots.get(snapshotId);
        if (!snapshot) {
            return false;
        }

        // Clear current state
        this.clear();

        // Restore from snapshot
        for (const element of snapshot.elements) {
            this.push(element);
        }

        this.eventManager.emit("snapshot_restored", -1, undefined, {
            snapshotId,
        });
        return true;
    }

    /**
     * Lists available snapshots
     */
    public listSnapshots(): Array<{ id: string; timestamp: number }> {
        return Array.from(this.snapshots.entries()).map(([id, snapshot]) => ({
            id,
            timestamp: snapshot.timestamp,
        }));
    }

    /**
     * Deletes a snapshot
     */
    public deleteSnapshot(snapshotId: string): boolean {
        return this.snapshots.delete(snapshotId);
    }

    /**
     * Clears all elements from the array
     */
    public clear(): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        // Clean up all secure buffers
        for (const buffer of this.secureBuffers.values()) {
            buffer.destroy();
        }
        this.secureBuffers.clear();

        // Clear elements and metadata
        this.elements.length = 0;
        this.metadataManager.clear();

        this.updateLastModified();
        this.eventManager.emit("clear", -1, undefined);

        return this;
    }

    /**
     * Freezes the array to prevent modifications
     */
    public freeze(): this {
        this.ensureNotDestroyed();
        this._isFrozen = true;
        this.eventManager.emit("freeze", -1, undefined);
        return this;
    }

    /**
     * Unfreezes the array to allow modifications
     */
    public unfreeze(): this {
        this.ensureNotDestroyed();
        this._isFrozen = false;
        this.eventManager.emit("unfreeze", -1, undefined);
        return this;
    }

    /**
     * Makes the array read-only
     */
    public makeReadOnly(): this {
        this.ensureNotDestroyed();
        this._isReadOnly = true;
        this.eventManager.emit("readonly", -1, undefined);
        return this;
    }

    /**
     * Removes read-only restriction
     */
    public makeWritable(): this {
        this.ensureNotDestroyed();
        this._isReadOnly = false;
        this.eventManager.emit("writable", -1, undefined);
        return this;
    }

    /**
     * Securely wipes all data and destroys the array
     * @example
     * //===================== correct ===========
        const x = fArray([] as number[]);
        x.push(12);

        console.log(x._array);
        x.destroy();

        //================ incorrect ===============
        const x = fArray([] as number[]);
        x.destroy(); // will destroy the array
        x.push(12); // x.push will throw an error

        console.log(x._array); // will throw an error
     */
    public destroy(): void {
        if (this._isDestroyed) {
            return;
        }

        // Clean up all secure buffers
        for (const buffer of this.secureBuffers.values()) {
            buffer.destroy();
        }
        this.secureBuffers.clear();

        // Clear snapshots
        this.snapshots.clear();

        // Secure wipe of elements array
        if (this.elements.length > 0) {
            this.elements.fill(null as any);
            this.elements.length = 0;
        }

        // Clear metadata
        this.metadataManager.clear();

        // Unregister from memory manager
        if (this._memoryTracking) {
            memoryManager.unregisterObject(this._id);
        }

        this._isDestroyed = true;
        this.eventManager.emit("destroyed", -1, undefined);

        // Clear event listeners
        this.eventManager.removeAllListeners();
    }

    // ===== UTILITY AND STATISTICS METHODS =====

    /**
     * Gets comprehensive statistics about the array
     */
    public getStats(): SecureArrayStats {
        this.ensureNotDestroyed();

        const typeCount = new Map<string, number>();
        let secureElementCount = 0;
        let totalMemoryUsage = 0;
        let totalAccesses = 0;

        for (let i = 0; i < this.elements.length; i++) {
            const metadata = this.metadataManager.get(i);
            if (metadata) {
                const type = metadata.type;
                typeCount.set(type, (typeCount.get(type) || 0) + 1);

                if (metadata.isSecure) {
                    secureElementCount++;
                }

                totalAccesses += metadata.accessCount;
            }

            // Estimate memory usage
            const value = this.get(i);
            if (value !== undefined) {
                if (typeof value === "string") {
                    totalMemoryUsage += value.length * 2; // UTF-16
                } else if (typeof value === "number") {
                    totalMemoryUsage += 8; // 64-bit number
                } else if (typeof value === "boolean") {
                    totalMemoryUsage += 1;
                } else {
                    totalMemoryUsage += 64; // Estimate for objects
                }
            }
        }

        return {
            length: this.elements.length,
            secureElements: secureElementCount,
            totalAccesses,
            memoryUsage: totalMemoryUsage,
            lastModified: this._lastModified,
            version: this._version,
            createdAt: this._createdAt,
            isReadOnly: this._isReadOnly,
            isFrozen: this._isFrozen,
            typeDistribution: Object.fromEntries(typeCount),
            secureElementCount,
            estimatedMemoryUsage: totalMemoryUsage,
            snapshotCount: this.snapshots.size,
            encryptionEnabled:
                this.cryptoHandler.getEncryptionStatus().hasEncryptionKey,
        };
    }

    /**
     * Validates the integrity of the array
     */
    public validateIntegrity(): { isValid: boolean; errors: string[] } {
        this.ensureNotDestroyed();

        const errors: string[] = [];

        // Check if elements length matches metadata count
        const metadataCount = this.metadataManager.size();
        if (this.elements.length !== metadataCount) {
            errors.push(
                `Element count (${this.elements.length}) doesn't match metadata count (${metadataCount})`
            );
        }

        // Check secure buffer consistency
        for (const [index, buffer] of this.secureBuffers.entries()) {
            if (index >= this.elements.length) {
                errors.push(`Secure buffer exists for invalid index: ${index}`);
            }

            const metadata = this.metadataManager.get(index);
            if (!metadata || !metadata.isSecure) {
                errors.push(
                    `Secure buffer exists but metadata indicates non-secure element at index: ${index}`
                );
            }

            try {
                buffer.getBuffer(); // Test if buffer is still valid
            } catch (error) {
                errors.push(
                    `Invalid secure buffer at index ${index}: ${error}`
                );
            }
        }

        // Check for memory leaks in metadata
        for (let i = 0; i < this.metadataManager.size(); i++) {
            if (!this.metadataManager.has(i) && i < this.elements.length) {
                errors.push(`Missing metadata for element at index: ${i}`);
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
        };
    }

    /**
     * Compacts the array by removing undefined/null elements
     */
    public compact(): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        const compactedElements: T[] = [];
        const newSecureBuffers = new Map<number, SecureBuffer>();
        let newIndex = 0;

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== null && value !== undefined) {
                compactedElements.push(this.elements[i]);

                if (this.secureBuffers.has(i)) {
                    newSecureBuffers.set(newIndex, this.secureBuffers.get(i)!);
                }

                const metadata = this.metadataManager.get(i);
                if (metadata) {
                    this.metadataManager.update(
                        newIndex,
                        metadata.type,
                        metadata.isSecure
                    );
                }

                newIndex++;
            } else {
                // Clean up secure buffer for removed element
                this.cleanupIndex(i);
            }
        }

        // Clean up old metadata
        this.metadataManager.clear();

        this.elements = compactedElements;
        this.secureBuffers = newSecureBuffers;

        this.updateLastModified();
        this.eventManager.emit("compact", -1, undefined, {
            originalLength:
                this.elements.length +
                (this.elements.length - compactedElements.length),
            newLength: compactedElements.length,
        });

        return this;
    }

    /**
     * Removes duplicate elements
     */
    public unique(): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        const seen = new Set<T>();
        const uniqueElements: T[] = [];
        const newSecureBuffers = new Map<number, SecureBuffer>();
        let newIndex = 0;

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined && !seen.has(value)) {
                seen.add(value);
                uniqueElements.push(this.elements[i]);

                if (this.secureBuffers.has(i)) {
                    newSecureBuffers.set(newIndex, this.secureBuffers.get(i)!);
                }

                const metadata = this.metadataManager.get(i);
                if (metadata) {
                    this.metadataManager.update(
                        newIndex,
                        metadata.type,
                        metadata.isSecure
                    );
                }

                newIndex++;
            } else if (value !== undefined) {
                // Clean up duplicate's secure buffer
                this.cleanupIndex(i);
            }
        }

        // Clean up old metadata
        this.metadataManager.clear();

        this.elements = uniqueElements;
        this.secureBuffers = newSecureBuffers;

        this.updateLastModified();
        this.eventManager.emit("unique", -1, undefined, {
            originalLength:
                this.elements.length +
                (this.elements.length - uniqueElements.length),
            newLength: uniqueElements.length,
        });

        return this;
    }

    /**
     * Groups elements by a key function
     */
    public groupBy<K extends string | number>(
        keyFn: (value: T, index: number) => K
    ): Map<K, SecureArray<T>> {
        this.ensureNotDestroyed();

        const groups = new Map<K, SecureArray<T>>();

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                const key = keyFn(value, i);

                if (!groups.has(key)) {
                    groups.set(
                        key,
                        new SecureArray<T>([], { ...this.options })
                    );
                }

                groups.get(key)!.push(value);
            }
        }

        return groups;
    }

    /**
     * Returns the minimum value
     */
    public min(compareFn?: ComparatorFn<T>): T | undefined {
        this.ensureNotDestroyed();

        if (this.elements.length === 0) {
            return undefined;
        }

        let min = this.get(0);
        if (min === undefined) {
            return undefined;
        }

        for (let i = 1; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                if (compareFn) {
                    if (compareFn(value, min) < 0) {
                        min = value;
                    }
                } else {
                    if (value < min!) {
                        min = value;
                    }
                }
            }
        }

        return min;
    }

    /**
     * Returns the maximum value
     */
    public max(compareFn?: ComparatorFn<T>): T | undefined {
        this.ensureNotDestroyed();

        if (this.elements.length === 0) {
            return undefined;
        }

        let max = this.get(0);
        if (max === undefined) {
            return undefined;
        }

        for (let i = 1; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                if (compareFn) {
                    if (compareFn(value, max) > 0) {
                        max = value;
                    }
                } else {
                    if (value > max!) {
                        max = value;
                    }
                }
            }
        }

        return max;
    }

    /**
     * Shuffles the array in place using Fisher-Yates algorithm
     */
    public shuffle(): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        for (let i = this.elements.length - 1; i > 0; i--) {
            const j = Math.floor(Math.random() * (i + 1));

            // Swap elements
            [this.elements[i], this.elements[j]] = [
                this.elements[j],
                this.elements[i],
            ];

            // Swap secure buffers if they exist
            const bufferI = this.secureBuffers.get(i);
            const bufferJ = this.secureBuffers.get(j);

            if (bufferI) {
                this.secureBuffers.set(j, bufferI);
            } else {
                this.secureBuffers.delete(j);
            }

            if (bufferJ) {
                this.secureBuffers.set(i, bufferJ);
            } else {
                this.secureBuffers.delete(i);
            }

            // Swap metadata
            const metaI = this.metadataManager.get(i);
            const metaJ = this.metadataManager.get(j);

            if (metaI && metaJ) {
                this.metadataManager.update(i, metaJ.type, metaJ.isSecure);
                this.metadataManager.update(j, metaI.type, metaI.isSecure);
            }
        }

        this.updateLastModified();
        this.eventManager.emit("shuffle", -1, undefined);

        return this;
    }

    /**
     * Returns a random sample of elements
     */
    public sample(count: number = 1): SecureArray<T> {
        this.ensureNotDestroyed();

        if (count <= 0 || this.elements.length === 0) {
            return new SecureArray<T>([], { ...this.options });
        }

        const sampleCount = Math.min(count, this.elements.length);
        const indices = new Set<number>();
        const sampledElements: T[] = [];

        while (indices.size < sampleCount) {
            const randomIndex = Math.floor(
                Math.random() * this.elements.length
            );
            if (!indices.has(randomIndex)) {
                indices.add(randomIndex);
                const value = this.get(randomIndex);
                if (value !== undefined) {
                    sampledElements.push(value);
                }
            }
        }

        return new SecureArray<T>(sampledElements, { ...this.options });
    }

    // ===== ITERATOR IMPLEMENTATION =====

    /**
     * Returns an iterator for the array
     */
    public *[Symbol.iterator](): Iterator<T> {
        this.ensureNotDestroyed();

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                yield value;
            }
        }
    }

    /**
     * Returns an iterator for array entries [index, value]
     */
    public *entries(): Iterator<[number, T]> {
        this.ensureNotDestroyed();

        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                yield [i, value];
            }
        }
    }

    /**
     * Returns an iterator for array indices
     */
    public *keys(): Iterator<number> {
        this.ensureNotDestroyed();

        for (let i = 0; i < this.elements.length; i++) {
            yield i;
        }
    }

    /**
     * Returns an iterator for array values
     */
    public *values(): Iterator<T> {
        return this[Symbol.iterator]();
    }

    // ===== EVENT MANAGEMENT =====

    /**
     * Adds an event listener
     */
    public on(
        event: SecureArrayEvent,
        listener: SecureArrayEventListener
    ): this {
        this.eventManager.on(event, listener);
        return this;
    }

    /**
     * Removes an event listener
     */
    public off(
        event: SecureArrayEvent,
        listener: SecureArrayEventListener
    ): this {
        this.eventManager.off(event, listener);
        return this;
    }

    /**
     * Adds a one-time event listener
     */
    public once(
        event: SecureArrayEvent,
        listener: SecureArrayEventListener
    ): this {
        this.eventManager.once(event, listener);
        return this;
    }

    // ===== SERIALIZATION AND EXPORT =====

    /**
     * Serializes the SecureArray to a secure format
     */
    public serialize(options?: SecureArraySerializationOptions): string {
        this.ensureNotDestroyed();
        return this.serializationHandler.serialize(this.elements, options);
    }

    /**
     * Exports the SecureArray data in various formats
     */
    public exportData(
        format: "json" | "csv" | "xml" | "yaml" = "json"
    ): string {
        this.ensureNotDestroyed();

        // Get the actual values (not SecureBuffers)
        const actualElements: T[] = [];
        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                actualElements.push(value);
            }
        }

        return this.serializationHandler.exportData(actualElements, format);
    }

    /**
     * Converts to a regular JavaScript array (loses security features)
     */
    public toArray(): T[] {
        this.ensureNotDestroyed();

        const regularArray: T[] = [];
        for (let i = 0; i < this.elements.length; i++) {
            const value = this.get(i);
            if (value !== undefined) {
                regularArray.push(value);
            }
        }

        return regularArray;
    }

    /**
     * Converts to a regular JavaScript array (same as toArray method)
     */
    public get _array() {
        return this.toArray();
    }

    /**
     * Creates a SecureArray from a regular array
     */
    public static from<T extends SecureArrayValue>(
        arrayLike: ArrayLike<T> | Iterable<T>,
        options?: SecureArrayOptions
    ): SecureArray<T> {
        const elements = Array.from(arrayLike);
        return new SecureArray<T>(elements, options);
    }

    /**
     * Creates a SecureArray with specified length and fill value
     */
    public static of<T extends SecureArrayValue>(
        ...elements: T[]
    ): SecureArray<T> {
        return new SecureArray<T>(elements);
    }

    // ===== ENCRYPTION METHODS =====

    /**
     * Gets encryption status from the crypto handler
     */
    public getEncryptionStatus() {
        return this.cryptoHandler.getEncryptionStatus();
    }

    /**
     * Sets an encryption key for the array
     */
    public setEncryptionKey(key: string): void {
        this.ensureNotDestroyed();
        this.cryptoHandler.setEncryptionKey(key);
    }

    /**
     * Gets the raw encrypted data without decryption (for verification)
     */
    public getRawEncryptedData(): any[] {
        this.ensureNotDestroyed();
        return [...this.elements];
    }

    /**
     * Gets a specific element's raw encrypted form (for verification)
     */
    public getRawEncryptedElement(index: number): any {
        this.ensureNotDestroyed();
        this.validateIndex(index);

        if (index >= this.elements.length) {
            return undefined;
        }

        return this.elements[index];
    }

    /**
     * Encrypts all elements in the array using AES-256-CTR-HMAC encryption
     * with proper memory management and atomic operations
     */
    public encryptAll(): this {
        this.ensureNotDestroyed();
        this.ensureNotReadOnly();
        this.ensureNotFrozen();

        // Check if encryption key is set
        const encryptionStatus = this.cryptoHandler.getEncryptionStatus();
        if (!encryptionStatus.hasEncryptionKey) {
            throw new Error(
                "Encryption key must be set before calling encryptAll()"
            );
        }

        // Prepare temporary storage for atomic operation
        const encryptedValues: any[] = [];
        const originalMetadata = new Map<number, any>();
        const indicesToProcess: number[] = [];

        try {
            // First pass: encrypt all values into temporary storage
            for (let i = 0; i < this.elements.length; i++) {
                const value = this.elements[i]; // Get raw value, not through get() method
                if (value !== undefined) {
                    // Skip already encrypted values to avoid double encryption
                    if (
                        typeof value === "string" &&
                        this.cryptoHandler.isEncrypted(value)
                    ) {
                        continue;
                    }

                    // Store original metadata for rollback
                    if (this.metadataManager.has(i)) {
                        originalMetadata.set(i, this.metadataManager.get(i));
                    }

                    // Get the actual value to encrypt
                    let valueToEncrypt: any = value;

                    // If it's a SecureBuffer, convert it back to its original form
                    if (value instanceof SecureBuffer) {
                        const metadata = this.metadataManager.get(i);
                        if (metadata?.type === "string") {
                            valueToEncrypt = new TextDecoder().decode(
                                value.getBuffer()
                            ) as any;
                        } else if (metadata?.type === "Uint8Array") {
                            valueToEncrypt = new Uint8Array(
                                value.getBuffer()
                            ) as any;
                        } else {
                            valueToEncrypt = new TextDecoder().decode(
                                value.getBuffer()
                            ) as any;
                        }
                    }

                    // Encrypt the value
                    const encryptedValue =
                        this.cryptoHandler.encryptValue(valueToEncrypt);
                    encryptedValues[i] = encryptedValue;
                    indicesToProcess.push(i);
                }
            }

            // Second pass: atomically commit all changes
            for (const i of indicesToProcess) {
                const encryptedValue = encryptedValues[i];
                const originalValue = this.elements[i];

                // Clean up any existing SecureBuffer for this index
                this.cleanupIndex(i);

                // Store encrypted value
                this.elements[i] = encryptedValue;

                // Update metadata with correct type information
                // Store original type in the type field using special format
                const originalType = typeof originalValue;
                this.metadataManager.update(
                    i,
                    `encrypted:${originalType}`,
                    true
                );
            }
        } catch (error: any) {
            // Rollback: restore original state on any failure
            for (const i of indicesToProcess) {
                if (originalMetadata.has(i)) {
                    // Restore original metadata
                    const original = originalMetadata.get(i);
                    this.metadataManager.update(
                        i,
                        original.type,
                        original.isSecure
                    );
                }
            }

            throw new Error(
                `Encryption failed: ${error?.message || "Unknown error"}`
            );
        }

        this.updateLastModified();
        this.eventManager.emit(
            "encrypt_all",
            -1,
            `${indicesToProcess.length}_elements_encrypted`
        );

        return this;
    }
}

