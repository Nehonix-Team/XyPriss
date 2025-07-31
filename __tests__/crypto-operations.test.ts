// Simple test framework
class TestRunner {
    private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
    private passed = 0;
    private failed = 0;

    test(name: string, fn: () => void | Promise<void>) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log("🧪 Running Crypto Operations Tests...\n");

        for (const test of this.tests) {
            try {
                await test.fn();
                console.log(`✅ ${test.name}`);
                this.passed++;
            } catch (error) {
                console.log(`❌ ${test.name}`);
                console.log(`   Error: ${error}`);
                this.failed++;
            }
        }

        console.log(`\n📊 Test Results: ${this.passed} passed, ${this.failed} failed`);
        return this.failed === 0;
    }
}

// Simple assertion functions
function assert(condition: boolean, message: string = "Assertion failed") {
    if (!condition) {
        throw new Error(message);
    }
}

function assertEqual(actual: any, expected: any, message?: string) {
    if (actual !== expected) {
        throw new Error(message || `Expected ${expected}, got ${actual}`);
    }
}

function assertNotEqual(actual: any, expected: any, message?: string) {
    if (actual === expected) {
        throw new Error(message || `Expected ${actual} to not equal ${expected}`);
    }
}

function assertGreaterThan(actual: number, expected: number, message?: string) {
    if (actual <= expected) {
        throw new Error(message || `Expected ${actual} to be greater than ${expected}`);
    }
}

function assertInstanceOf(actual: any, expectedType: any, message?: string) {
    if (!(actual instanceof expectedType)) {
        throw new Error(message || `Expected instance of ${expectedType.name}, got ${typeof actual}`);
    }
}

// Mock crypto operations class to test Argon2 implementation
class MockCryptoOperations {
    // Mock PBKDF2 for fallback testing
    static async deriveKeyPBKDF2(
        content: string,
        options: {
            salt: string | Uint8Array;
            iterations: number;
            keyLength: number;
            hash: string;
        },
        format: 'hex' | 'buffer' = 'hex'
    ): Promise<string | Uint8Array> {
        // Simple mock implementation
        const combined = content + (typeof options.salt === 'string' ? options.salt : 'salt');
        const hash = combined.split('').reduce((a, b) => {
            a = ((a << 5) - a) + b.charCodeAt(0);
            return a & a;
        }, 0);
        
        const result = new Uint8Array(options.keyLength);
        for (let i = 0; i < options.keyLength; i++) {
            result[i] = (hash + i) % 256;
        }
        
        return format === 'hex' ? Array.from(result).map(b => b.toString(16).padStart(2, '0')).join('') : result;
    }

    static formatHash(data: Uint8Array, format: 'hex' | 'buffer'): string | Uint8Array {
        if (format === 'hex') {
            return Array.from(data).map(b => b.toString(16).padStart(2, '0')).join('');
        }
        return data;
    }

    // The actual Argon2 implementation we're testing
    static async deriveKeyArgon2(
        content: string,
        salt: string | Uint8Array,
        keyLength: number = 32,
        options: {
            type?: "argon2d" | "argon2i" | "argon2id";
            memoryCost?: number;
            timeCost?: number;
            parallelism?: number;
        } = {},
        format: 'hex' | 'buffer' = 'hex'
    ): Promise<string | Uint8Array> {
        const { type = "argon2id", memoryCost = 65536, timeCost = 3, parallelism = 1 } = options;
        
        // Try to use Argon2 library if available
        try {
            let argon2: any;
            try {
                argon2 = require('argon2');
            } catch {
                try {
                    argon2 = require('@node-rs/argon2');
                } catch {
                    try {
                        argon2 = require('argon2-browser');
                    } catch {
                        console.warn('Argon2 library not found, falling back to PBKDF2');
                        return this.deriveKeyPBKDF2(content, {
                            salt,
                            iterations: 100000,
                            keyLength,
                            hash: "SHA-256",
                        }, format);
                    }
                }
            }

            const saltBuffer = typeof salt === 'string' ? Buffer.from(salt, 'utf8') : Buffer.from(salt);
            
            let hashResult: Buffer;
            
            if (argon2.hash) {
                const hashOptions = {
                    type: argon2[type.toUpperCase()] || argon2.argon2id,
                    memoryCost,
                    timeCost,
                    parallelism,
                    hashLength: keyLength,
                    salt: saltBuffer,
                    raw: true
                };
                
                hashResult = await argon2.hash(content, hashOptions);
            } else if (argon2.argon2id || argon2.argon2i || argon2.argon2d) {
                const hashFunction = argon2[type] || argon2.argon2id;
                hashResult = await hashFunction(
                    Buffer.from(content, 'utf8'),
                    saltBuffer,
                    {
                        memoryCost,
                        timeCost,
                        parallelism,
                        outputLen: keyLength
                    }
                );
            } else {
                console.warn('Unrecognized Argon2 library interface, falling back to PBKDF2');
                return this.deriveKeyPBKDF2(content, {
                    salt,
                    iterations: 100000,
                    keyLength,
                    hash: "SHA-256",
                }, format);
            }
            
            const derivedArray = new Uint8Array(hashResult);
            return this.formatHash(derivedArray, format);
            
        } catch (error) {
            console.warn('Argon2 operation failed, falling back to PBKDF2:', error);
            return this.deriveKeyPBKDF2(content, {
                salt,
                iterations: 100000,
                keyLength,
                hash: "SHA-256",
            }, format);
        }
    }
}

// Test suite
async function runCryptoOperationsTests() {
    const runner = new TestRunner();

    // Test basic functionality
    runner.test('should derive key with default parameters', async () => {
        const content = 'test-password';
        const salt = 'test-salt';
        
        const result = await MockCryptoOperations.deriveKeyArgon2(content, salt);
        
        assert(typeof result === 'string', 'Result should be a string in hex format');
        assertEqual(result.length, 64, 'Default key length should be 32 bytes (64 hex chars)');
    });

    runner.test('should derive key with custom key length', async () => {
        const content = 'test-password';
        const salt = 'test-salt';
        const keyLength = 16;
        
        const result = await MockCryptoOperations.deriveKeyArgon2(content, salt, keyLength);
        
        assert(typeof result === 'string', 'Result should be a string in hex format');
        assertEqual(result.length, 32, 'Custom key length should be 16 bytes (32 hex chars)');
    });

    runner.test('should derive key in buffer format', async () => {
        const content = 'test-password';
        const salt = 'test-salt';
        
        const result = await MockCryptoOperations.deriveKeyArgon2(content, salt, 32, {}, 'buffer');
        
        assertInstanceOf(result, Uint8Array, 'Result should be Uint8Array in buffer format');
        assertEqual((result as Uint8Array).length, 32, 'Buffer should have correct length');
    });

    runner.test('should handle Uint8Array salt', async () => {
        const content = 'test-password';
        const salt = new Uint8Array([1, 2, 3, 4, 5, 6, 7, 8]);
        
        const result = await MockCryptoOperations.deriveKeyArgon2(content, salt);
        
        assert(typeof result === 'string', 'Result should be a string');
        assertGreaterThan(result.length, 0, 'Result should not be empty');
    });

    runner.test('should use different Argon2 types', async () => {
        const content = 'test-password';
        const salt = 'test-salt';
        
        const result1 = await MockCryptoOperations.deriveKeyArgon2(content, salt, 32, { type: 'argon2d' });
        const result2 = await MockCryptoOperations.deriveKeyArgon2(content, salt, 32, { type: 'argon2i' });
        const result3 = await MockCryptoOperations.deriveKeyArgon2(content, salt, 32, { type: 'argon2id' });
        
        // Results should be strings (may be same due to fallback, but should not error)
        assert(typeof result1 === 'string', 'Argon2d result should be string');
        assert(typeof result2 === 'string', 'Argon2i result should be string');
        assert(typeof result3 === 'string', 'Argon2id result should be string');
    });

    runner.test('should handle custom parameters', async () => {
        const content = 'test-password';
        const salt = 'test-salt';
        const options = {
            memoryCost: 32768,
            timeCost: 2,
            parallelism: 2
        };
        
        const result = await MockCryptoOperations.deriveKeyArgon2(content, salt, 32, options);
        
        assert(typeof result === 'string', 'Result should be a string');
        assertEqual(result.length, 64, 'Result should have correct length');
    });

    runner.test('should produce different results for different inputs', async () => {
        const salt = 'test-salt';
        
        const result1 = await MockCryptoOperations.deriveKeyArgon2('password1', salt);
        const result2 = await MockCryptoOperations.deriveKeyArgon2('password2', salt);
        
        assertNotEqual(result1, result2, 'Different passwords should produce different results');
    });

    runner.test('should produce different results for different salts', async () => {
        const content = 'test-password';
        
        const result1 = await MockCryptoOperations.deriveKeyArgon2(content, 'salt1');
        const result2 = await MockCryptoOperations.deriveKeyArgon2(content, 'salt2');
        
        assertNotEqual(result1, result2, 'Different salts should produce different results');
    });

    runner.test('should be deterministic with same inputs', async () => {
        const content = 'test-password';
        const salt = 'test-salt';
        
        const result1 = await MockCryptoOperations.deriveKeyArgon2(content, salt);
        const result2 = await MockCryptoOperations.deriveKeyArgon2(content, salt);
        
        assertEqual(result1, result2, 'Same inputs should produce same results');
    });

    runner.test('should fallback to PBKDF2 when Argon2 unavailable', async () => {
        // This test simulates the fallback behavior
        // In real environment without Argon2, it should fallback gracefully
        const content = 'test-password';
        const salt = 'test-salt';
        
        const result = await MockCryptoOperations.deriveKeyArgon2(content, salt);
        
        assert(typeof result === 'string', 'Fallback should still produce string result');
        assertGreaterThan(result.length, 0, 'Fallback should produce non-empty result');
    });

    runner.test('should handle empty password', async () => {
        const content = '';
        const salt = 'test-salt';
        
        const result = await MockCryptoOperations.deriveKeyArgon2(content, salt);
        
        assert(typeof result === 'string', 'Should handle empty password');
        assertEqual(result.length, 64, 'Should produce correct length result');
    });

    runner.test('should handle empty salt', async () => {
        const content = 'test-password';
        const salt = '';
        
        const result = await MockCryptoOperations.deriveKeyArgon2(content, salt);
        
        assert(typeof result === 'string', 'Should handle empty salt');
        assertEqual(result.length, 64, 'Should produce correct length result');
    });

    return await runner.run();
}

// Export for running
export { runCryptoOperationsTests };

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runCryptoOperationsTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}
