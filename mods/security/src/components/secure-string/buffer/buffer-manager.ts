/**
 * Buffer Manager Module
 * Handles secure buffer operations for SecureString
 */ 
 
import { SecureBuffer } from "../../secure-memory";
import { SecureStringOptions, DEFAULT_SECURE_STRING_OPTIONS } from "../types";
 
/** 
 * Manages secure buffer operations for SecureString
 */
export class BufferManager {
    private buffer: SecureBuffer;
    private options: Required<SecureStringOptions>;
    private _isDestroyed: boolean = false;

    constructor(initialValue: string = "", options: SecureStringOptions = {}) {
        this.options = { ...DEFAULT_SECURE_STRING_OPTIONS, ...options };
        this.buffer = this.createBuffer(initialValue);
    }

    /**
     * Creates a new secure buffer with the specified value
     */
    private createBuffer(value: string): SecureBuffer {
        return SecureBuffer.from(value, {
            protectionLevel: this.options.protectionLevel as any,
            enableEncryption: this.options.enableEncryption,
            enableFragmentation: this.options.enableFragmentation,
            enableCanaries: this.options.enableCanaries,
            enableObfuscation: this.options.enableObfuscation,
            autoLock: this.options.autoLock,
            quantumSafe: this.options.quantumSafe,
        });
    }

    /**
     * Gets the current buffer (read-only access)
     */
    getBuffer(): Uint8Array {
        this.ensureNotDestroyed();
        return this.buffer.getBuffer();
    }

    /**
     * Gets the string value from the buffer
     */
    getString(): string {
        this.ensureNotDestroyed();
        const buffer = this.buffer.getBuffer();
        return new TextDecoder(this.options.encoding).decode(buffer);
    }

    /**
     * Updates the buffer with a new string value
     */
    updateBuffer(newValue: string): void {
        this.ensureNotDestroyed();
        
        // Destroy the old buffer
        this.buffer.destroy();
        
        // Create a new buffer with the new value
        this.buffer = this.createBuffer(newValue);
    }

    /**
     * Gets the byte length of the buffer
     */
    getByteLength(): number {
        this.ensureNotDestroyed();
        return this.buffer.getBuffer().length;
    }

    /**
     * Gets the character length of the string
     */
    getCharacterLength(): number {
        this.ensureNotDestroyed();
        return this.getString().length;
    }

    /**
     * Checks if the buffer is empty
     */
    isEmpty(): boolean {
        this.ensureNotDestroyed();
        return this.getCharacterLength() === 0;
    }

    /**
     * Creates a copy of the current buffer
     */
    clone(): BufferManager {
        this.ensureNotDestroyed();
        const currentValue = this.getString();
        return new BufferManager(currentValue, this.options);
    }

    /**
     * Converts the buffer to a Uint8Array (copy)
     */
    toUint8Array(): Uint8Array {
        this.ensureNotDestroyed();
        const buffer = this.buffer.getBuffer();
        return new Uint8Array(buffer);
    }

    /**
     * Creates a buffer from a Uint8Array
     */
    static fromUint8Array(
        data: Uint8Array, 
        options: SecureStringOptions = {},
        encoding: string = "utf-8"
    ): BufferManager {
        const decoder = new TextDecoder(encoding);
        const value = decoder.decode(data);
        return new BufferManager(value, { ...options, encoding });
    }

    /**
     * Gets memory usage information
     */
    getMemoryUsage(): {
        bufferSize: number;
        actualLength: number;
        overhead: number;
        isFragmented: boolean;
        isEncrypted: boolean;
    } {
        this.ensureNotDestroyed();
        const bufferSize = this.getByteLength();
        const actualLength = this.getCharacterLength();
        
        return {
            bufferSize,
            actualLength,
            overhead: bufferSize - actualLength,
            isFragmented: this.options.enableFragmentation,
            isEncrypted: this.options.enableEncryption,
        };
    }

    /**
     * Gets the current options
     */
    getOptions(): Required<SecureStringOptions> {
        return { ...this.options };
    }

    /**
     * Updates the options (creates new buffer if needed)
     */
    updateOptions(newOptions: Partial<SecureStringOptions>): void {
        this.ensureNotDestroyed();
        
        const oldOptions = this.options;
        this.options = { ...this.options, ...newOptions };
        
        // Check if we need to recreate the buffer
        const needsRecreation = 
            oldOptions.protectionLevel !== this.options.protectionLevel ||
            oldOptions.enableEncryption !== this.options.enableEncryption ||
            oldOptions.enableFragmentation !== this.options.enableFragmentation ||
            oldOptions.enableCanaries !== this.options.enableCanaries ||
            oldOptions.enableObfuscation !== this.options.enableObfuscation ||
            oldOptions.autoLock !== this.options.autoLock ||
            oldOptions.quantumSafe !== this.options.quantumSafe;

        if (needsRecreation) {
            const currentValue = this.getString();
            this.buffer.destroy();
            this.buffer = this.createBuffer(currentValue);
        }
    }

    /**
     * Ensures the buffer manager hasn't been destroyed
     */
    private ensureNotDestroyed(): void {
        if (this._isDestroyed) {
            throw new Error("BufferManager has been destroyed and cannot be used");
        }
    }

    /**
     * Checks if the buffer manager is destroyed
     */
    isDestroyed(): boolean {
        return this._isDestroyed;
    }

    /**
     * Destroys the buffer and clears all data
     */
    destroy(): void {
        if (!this._isDestroyed) {
            this.buffer.destroy();
            this._isDestroyed = true;
        }
    }

    /**
     * Securely wipes the buffer content
     */
    wipe(): void {
        this.ensureNotDestroyed();
        this.updateBuffer("");
    }

    /**
     * Gets debug information about the buffer
     */
    getDebugInfo(): {
        isDestroyed: boolean;
        options: Required<SecureStringOptions>;
        memoryUsage: ReturnType<BufferManager['getMemoryUsage']>;
        characterLength: number;
        byteLength: number;
    } {
        if (this._isDestroyed) {
            return {
                isDestroyed: true,
                options: this.options,
                memoryUsage: {
                    bufferSize: 0,
                    actualLength: 0,
                    overhead: 0,
                    isFragmented: false,
                    isEncrypted: false,
                },
                characterLength: 0,
                byteLength: 0,
            };
        }

        return {
            isDestroyed: false,
            options: this.options,
            memoryUsage: this.getMemoryUsage(),
            characterLength: this.getCharacterLength(),
            byteLength: this.getByteLength(),
        };
    }
}
