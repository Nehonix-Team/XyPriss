/**
 * Browser Polyfills for Node.js functionality
 * Provides browser-compatible alternatives for Node.js modules
 */

/**
 * Environment detection utilities
 */
export const Environment = {
    /**
     * Check if we're running in Node.js
     */
    isNode(): boolean {
        return typeof process !== 'undefined' &&
               process.versions &&
               typeof process.versions.node === 'string';
    },

    /**
     * Check if we're running in a browser
     */
    isBrowser(): boolean {
        return typeof window !== 'undefined' &&
               typeof document !== 'undefined';
    },

    /**
     * Check if Web Crypto API is available
     */
    hasWebCrypto(): boolean {
        return typeof window !== 'undefined' &&
               !!window.crypto &&
               !!window.crypto.subtle;
    },

    /**
     * Check if crypto.getRandomValues is available
     */
    hasGetRandomValues(): boolean {
        return typeof window !== 'undefined' &&
               !!window.crypto &&
               typeof window.crypto.getRandomValues === 'function';
    }
};

/**
 * Buffer polyfill for browsers
 */
export const BufferPolyfill = {
    /**
     * Create a Buffer-like object from Uint8Array
     */
    from(data: Uint8Array | string | number[], encoding?: string): any {
        if (Environment.isNode()) {
            const Buffer = require('buffer').Buffer;
            return Buffer.from(data, encoding);
        }

        // Browser polyfill
        let uint8Array: Uint8Array;
        
        if (typeof data === 'string') {
            const encoder = new TextEncoder();
            uint8Array = encoder.encode(data);
        } else if (Array.isArray(data)) {
            uint8Array = new Uint8Array(data);
        } else {
            uint8Array = data;
        }

        // Add Buffer-like methods
        const buffer = uint8Array as any;
        
        buffer.toString = function(this: Uint8Array, encoding?: string) {
            if (encoding === 'hex') {
                return Array.from(this)
                    .map((b: number) => b.toString(16).padStart(2, '0'))
                    .join('');
            } else if (encoding === 'base64') {
                const binary = Array.from(this)
                    .map((b: number) => String.fromCharCode(b))
                    .join('');
                return btoa(binary);
            } else {
                const decoder = new TextDecoder();
                return decoder.decode(this);
            }
        };

        buffer.copy = function(this: Uint8Array, target: Uint8Array, targetStart = 0, sourceStart = 0, sourceEnd = this.length) {
            const source = this.subarray(sourceStart, sourceEnd);
            target.set(source, targetStart);
            return source.length;
        };

        buffer.fill = function(value: number) {
            for (let i = 0; i < this.length; i++) {
                this[i] = value;
            }
            return this;
        };

        return buffer;
    }
};

/**
 * Crypto polyfill for browsers
 */
export const CryptoPolyfill = {
    /**
     * Generate random bytes
     */
    randomBytes(size: number): Uint8Array {
        if (Environment.isNode()) {
            const crypto = require('crypto');
            return new Uint8Array(crypto.randomBytes(size));
        }

        if (Environment.hasGetRandomValues()) {
            const array = new Uint8Array(size);
            window.crypto.getRandomValues(array);
            return array;
        }

        // Fallback (not cryptographically secure)
        console.warn('Using Math.random() fallback - not cryptographically secure!');
        const array = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    },

    /**
     * Timing-safe comparison
     */
    timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
        if (Environment.isNode()) {
            const crypto = require('crypto');
            return crypto.timingSafeEqual(a, b);
        }

        // Browser fallback
        if (a.length !== b.length) {
            return false;
        }

        let result = 0;
        for (let i = 0; i < a.length; i++) {
            result |= a[i] ^ b[i];
        }
        return result === 0;
    },

    /**
     * Create hash (simplified)
     */
    createHash(algorithm: string): any {
        if (Environment.isNode()) {
            const crypto = require('crypto');
            return crypto.createHash(algorithm);
        }

        // Browser fallback using Web Crypto API
        if (Environment.hasWebCrypto()) {
            return {
                update: function(data: Uint8Array) {
                    this._data = data;
                    return this;
                },
                digest: async function() {
                    const algoMap: Record<string, string> = {
                        'sha256': 'SHA-256',
                        'sha512': 'SHA-512',
                        'sha1': 'SHA-1'
                    };
                    
                    const algoName = algoMap[algorithm] || 'SHA-256';
                    const hashBuffer = await window.crypto.subtle.digest(algoName, this._data);
                    return new Uint8Array(hashBuffer);
                }
            };
        }

        throw new Error(`Hash algorithm ${algorithm} not available in browser environment`);
    }
};

/**
 * Performance polyfill
 */
export const PerformancePolyfill = {
    /**
     * High resolution time
     */
    now(): number {
        if (Environment.isNode()) {
            const { performance } = require('perf_hooks');
            return performance.now();
        }

        if (typeof performance !== 'undefined' && performance.now) {
            return performance.now();
        }

        return Date.now();
    },

    /**
     * Process hrtime equivalent
     */
    hrtime(time?: [number, number]): [number, number] {
        if (Environment.isNode()) {
            return process.hrtime(time);
        }

        // Browser fallback
        const now = this.now();
        if (time) {
            const diff = now - (time[0] * 1000 + time[1] / 1000000);
            return [Math.floor(diff / 1000), (diff % 1000) * 1000000];
        }
        return [Math.floor(now / 1000), (now % 1000) * 1000000];
    }
};

/**
 * Simple EventEmitter implementation for browsers
 */
export class BrowserEventEmitter {
    private events: Map<string, Function[]> = new Map();

    on(event: string, listener: Function): this {
        if (!this.events.has(event)) {
            this.events.set(event, []);
        }
        this.events.get(event)!.push(listener);
        return this;
    }

    emit(event: string, ...args: any[]): boolean {
        const listeners = this.events.get(event);
        if (listeners) {
            listeners.forEach(listener => listener(...args));
            return true;
        }
        return false;
    }

    removeListener(event: string, listener: Function): this {
        const listeners = this.events.get(event);
        if (listeners) {
            const index = listeners.indexOf(listener);
            if (index > -1) {
                listeners.splice(index, 1);
            }
        }
        return this;
    }

    removeAllListeners(event?: string): this {
        if (event) {
            this.events.delete(event);
        } else {
            this.events.clear();
        }
        return this;
    }
}

/**
 * Events polyfill
 */
export const EventsPolyfill = {
    EventEmitter: BrowserEventEmitter
};

/**
 * Utility to get the appropriate implementation based on environment
 */
export function getEnvironmentImplementation<T>(nodeImpl: () => T, browserImpl: () => T): T {
    if (Environment.isNode()) {
        return nodeImpl();
    } else {
        return browserImpl();
    }
}
