/**
 * Dynamic Node.js module loader
 * Uses dynamic imports to avoid bundling Node.js modules in browser builds
 */

/**
 * Safely import Node.js modules without bundling them
 */
export class NodeModules {
    private static cache = new Map<string, any>();

    /**
     * Dynamically import a Node.js module
     * @param moduleName - Name of the module to import
     * @returns The module or null if not available
     */
    static async importModule(moduleName: string): Promise<any> {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            return null;
        }

        // Check cache first
        if (this.cache.has(moduleName)) {
            return this.cache.get(moduleName);
        }

        try {
            // Use dynamic import to avoid bundling
            const moduleLoader = new Function('moduleName', 'return require(moduleName)');
            const module = moduleLoader(moduleName);
            this.cache.set(moduleName, module);
            return module;
        } catch (error) {
            console.warn(`Failed to import ${moduleName}:`, error);
            this.cache.set(moduleName, null);
            return null;
        }
    }

    /**
     * Synchronously import a Node.js module (fallback)
     * @param moduleName - Name of the module to import
     * @returns The module or null if not available
     */
    static importModuleSync(moduleName: string): any {
        // Check if we're in a browser environment
        if (typeof window !== 'undefined') {
            return null;
        }

        // Check cache first
        if (this.cache.has(moduleName)) {
            return this.cache.get(moduleName);
        }

        try {
            // Use dynamic require to avoid bundling
            const moduleLoader = new Function('moduleName', 'return require(moduleName)');
            const module = moduleLoader(moduleName);
            this.cache.set(moduleName, module);
            return module;
        } catch (error) {
            console.warn(`Failed to import ${moduleName}:`, error);
            this.cache.set(moduleName, null);
            return null;
        }
    }

    /**
     * Get crypto module
     */
    static getCrypto(): any {
        return this.importModuleSync('crypto');
    }

    /**
     * Get child_process module
     */
    static getChildProcess(): any {
        return this.importModuleSync('child_process');
    }

    /**
     * Get fs module
     */
    static getFs(): any {
        return this.importModuleSync('fs');
    }

    /**
     * Get os module
     */
    static getOs(): any {
        return this.importModuleSync('os');
    }

    /**
     * Get path module
     */
    static getPath(): any {
        return this.importModuleSync('path');
    }

    /**
     * Get events module
     */
    static getEvents(): any {
        return this.importModuleSync('events');
    }

    /**
     * Get perf_hooks module
     */
    static getPerfHooks(): any {
        return this.importModuleSync('perf_hooks');
    }

    /**
     * Check if a module is available
     */
    static isModuleAvailable(moduleName: string): boolean {
        if (typeof window !== 'undefined') {
            return false;
        }

        try {
            const moduleLoader = new Function('moduleName', 'return require.resolve(moduleName)');
            moduleLoader(moduleName);
            return true;
        } catch {
            return false;
        }
    }
}

/**
 * Browser-safe crypto utilities
 */
export class SafeCrypto {
    /**
     * Generate random bytes
     */
    static randomBytes(size: number): Uint8Array {
        const crypto = NodeModules.getCrypto();
        if (crypto && crypto.randomBytes) {
            return new Uint8Array(crypto.randomBytes(size));
        }

        // Browser fallback
        if (typeof window !== 'undefined' && window.crypto && window.crypto.getRandomValues) {
            const array = new Uint8Array(size);
            window.crypto.getRandomValues(array);
            return array;
        }

        // Last resort fallback (not cryptographically secure)
        console.warn('Using Math.random() fallback - not cryptographically secure!');
        const array = new Uint8Array(size);
        for (let i = 0; i < size; i++) {
            array[i] = Math.floor(Math.random() * 256);
        }
        return array;
    }

    /**
     * Timing-safe comparison
     */
    static timingSafeEqual(a: Uint8Array, b: Uint8Array): boolean {
        const crypto = NodeModules.getCrypto();
        if (crypto && crypto.timingSafeEqual) {
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
    }

    /**
     * Create hash
     */
    static createHash(algorithm: string): any {
        const crypto = NodeModules.getCrypto();
        if (crypto && crypto.createHash) {
            return crypto.createHash(algorithm);
        }

        // Browser fallback using Web Crypto API
        if (typeof window !== 'undefined' && window.crypto && window.crypto.subtle) {
            return {
                _data: new Uint8Array(0),
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

    /**
     * PBKDF2 key derivation
     */
    static pbkdf2Sync(password: Uint8Array, salt: Uint8Array, iterations: number, keyLength: number, digest: string): Uint8Array {
        const crypto = NodeModules.getCrypto();
        if (crypto && crypto.pbkdf2Sync) {
            const result = crypto.pbkdf2Sync(password, salt, iterations, keyLength, digest);
            return new Uint8Array(result);
        }

        throw new Error('PBKDF2 not available in browser environment');
    }

    /**
     * Scrypt key derivation
     */
    static scryptSync(password: Uint8Array, salt: Uint8Array, keyLength: number, options: any): Uint8Array {
        const crypto = NodeModules.getCrypto();
        if (crypto && crypto.scryptSync) {
            const result = crypto.scryptSync(password, salt, keyLength, options);
            return new Uint8Array(result);
        }

        throw new Error('Scrypt not available in browser environment');
    }
}

/**
 * Browser-safe Buffer utilities
 */
export class SafeBuffer {
    /**
     * Create a Buffer-like object
     */
    static from(data: Uint8Array | string | number[], encoding?: string): any {
        const Buffer = NodeModules.importModuleSync('buffer')?.Buffer;
        if (Buffer) {
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

        buffer.fill = function(this: Uint8Array, value: number) {
            for (let i = 0; i < this.length; i++) {
                this[i] = value;
            }
            return this;
        };

        return buffer;
    }
}
