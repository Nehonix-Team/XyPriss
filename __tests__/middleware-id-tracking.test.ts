// Simple test framework
class TestRunner {
    private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
    private passed = 0;
    private failed = 0;

    test(name: string, fn: () => void | Promise<void>) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log("🧪 Running Middleware ID Tracking Tests...\n");

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

// Mock middleware API to test ID tracking
class MockMiddlewareAPI {
    private nameToIdMap = new Map<string, string>();
    private registeredMiddleware = new Map<string, any>();

    public register(
        middleware: any,
        options?: {
            name?: string;
            priority?: string;
            routes?: string[];
            cacheable?: boolean;
            ttl?: number;
        }
    ): string {
        // Generate a mock ID
        const id = `mw_${Date.now()}_${Math.random().toString(36).substring(2, 8)}`;
        const name = options?.name || `middleware-${id.slice(0, 8)}`;
        
        // Track the name-to-ID mapping
        this.nameToIdMap.set(name, id);
        this.registeredMiddleware.set(id, {
            id,
            name,
            middleware,
            options,
            enabled: true
        });
        
        return id;
    }

    public removeByName(name: string): boolean {
        const id = this.nameToIdMap.get(name);
        if (id) {
            const success = this.unregister(id);
            if (success) {
                this.nameToIdMap.delete(name);
                return true;
            }
        }
        return false;
    }

    public unregister(id: string): boolean {
        const exists = this.registeredMiddleware.has(id);
        if (exists) {
            this.registeredMiddleware.delete(id);
            return true;
        }
        return false;
    }

    public clear(): number {
        const idsToRemove: string[] = [];
        
        // Collect all IDs from our name-to-ID mapping
        for (const [, id] of this.nameToIdMap.entries()) {
            idsToRemove.push(id);
        }
        
        // Unregister all found middleware
        let removedCount = 0;
        for (const id of idsToRemove) {
            if (this.unregister(id)) {
                removedCount++;
                // Remove from our tracking map
                for (const [name, mappedId] of this.nameToIdMap.entries()) {
                    if (mappedId === id) {
                        this.nameToIdMap.delete(name);
                        break;
                    }
                }
            }
        }
        
        return removedCount;
    }

    public getInfo(): any[] {
        return Array.from(this.registeredMiddleware.values()).map(entry => ({
            name: entry.name,
            enabled: entry.enabled,
            priority: entry.options?.priority || 'normal'
        }));
    }

    // Helper methods for testing
    public getNameToIdMap(): Map<string, string> {
        return new Map(this.nameToIdMap);
    }

    public getRegisteredCount(): number {
        return this.registeredMiddleware.size;
    }

    public hasMiddleware(name: string): boolean {
        return this.nameToIdMap.has(name);
    }

    public getMiddlewareId(name: string): string | undefined {
        return this.nameToIdMap.get(name);
    }
}

// Mock middleware methods manager to test ID finding
class MockMiddlewareMethodsManager {
    private middlewareRegistry = new Map<string, any>();

    public addMiddleware(id: string, name: string, middleware: any): void {
        this.middlewareRegistry.set(id, {
            id,
            name,
            handler: middleware,
            enabled: true
        });
    }

    public findMiddlewareIdByName(name: string): string | null {
        // Simulate the actual implementation
        for (const [id, entry] of this.middlewareRegistry.entries()) {
            if (entry.name === name) {
                return id;
            }
        }
        return null;
    }

    public removeMiddleware(name: string): boolean {
        const middlewareId = this.findMiddlewareIdByName(name);
        
        if (middlewareId) {
            const success = this.middlewareRegistry.delete(middlewareId);
            return success;
        }
        
        return false;
    }

    // Helper methods for testing
    public getRegistrySize(): number {
        return this.middlewareRegistry.size;
    }

    public hasMiddleware(name: string): boolean {
        return this.findMiddlewareIdByName(name) !== null;
    }
}

// Test suite
async function runMiddlewareIdTrackingTests() {
    const runner = new TestRunner();

    runner.test('should track middleware name-to-ID mapping on registration', () => {
        const api = new MockMiddlewareAPI();
        const middleware = () => {};
        
        const id = api.register(middleware, { name: 'test-middleware' });
        
        assert(typeof id === 'string', 'Should return middleware ID');
        assert(id.startsWith('mw_'), 'ID should have correct prefix');
        assertEqual(api.getMiddlewareId('test-middleware'), id, 'Should track name-to-ID mapping');
        assert(api.hasMiddleware('test-middleware'), 'Should track middleware by name');
    });

    runner.test('should generate unique IDs for different middleware', () => {
        const api = new MockMiddlewareAPI();
        
        const id1 = api.register(() => {}, { name: 'middleware-1' });
        const id2 = api.register(() => {}, { name: 'middleware-2' });
        
        assertNotEqual(id1, id2, 'Should generate unique IDs');
        assertEqual(api.getRegisteredCount(), 2, 'Should track both middleware');
    });

    runner.test('should remove middleware by name using ID tracking', () => {
        const api = new MockMiddlewareAPI();
        
        api.register(() => {}, { name: 'test-middleware' });
        assertEqual(api.getRegisteredCount(), 1, 'Should have one middleware');
        
        const success = api.removeByName('test-middleware');
        assert(success, 'Should successfully remove middleware');
        assertEqual(api.getRegisteredCount(), 0, 'Should have no middleware after removal');
        assert(!api.hasMiddleware('test-middleware'), 'Should not track removed middleware');
    });

    runner.test('should return false when removing non-existent middleware', () => {
        const api = new MockMiddlewareAPI();
        
        const success = api.removeByName('non-existent');
        assert(!success, 'Should return false for non-existent middleware');
    });

    runner.test('should clear all middleware and update tracking', () => {
        const api = new MockMiddlewareAPI();
        
        api.register(() => {}, { name: 'middleware-1' });
        api.register(() => {}, { name: 'middleware-2' });
        api.register(() => {}, { name: 'middleware-3' });
        
        assertEqual(api.getRegisteredCount(), 3, 'Should have three middleware');
        
        const removedCount = api.clear();
        assertEqual(removedCount, 3, 'Should remove all three middleware');
        assertEqual(api.getRegisteredCount(), 0, 'Should have no middleware after clear');
        
        assert(!api.hasMiddleware('middleware-1'), 'Should not track cleared middleware');
        assert(!api.hasMiddleware('middleware-2'), 'Should not track cleared middleware');
        assert(!api.hasMiddleware('middleware-3'), 'Should not track cleared middleware');
    });

    runner.test('should find middleware ID by name in registry', () => {
        const manager = new MockMiddlewareMethodsManager();
        
        const id = 'test-id-123';
        manager.addMiddleware(id, 'test-middleware', () => {});
        
        const foundId = manager.findMiddlewareIdByName('test-middleware');
        assertEqual(foundId, id, 'Should find correct middleware ID');
    });

    runner.test('should return null for non-existent middleware in registry', () => {
        const manager = new MockMiddlewareMethodsManager();
        
        const foundId = manager.findMiddlewareIdByName('non-existent');
        assertEqual(foundId, null, 'Should return null for non-existent middleware');
    });

    runner.test('should remove middleware using ID lookup', () => {
        const manager = new MockMiddlewareMethodsManager();
        
        manager.addMiddleware('id-1', 'middleware-1', () => {});
        manager.addMiddleware('id-2', 'middleware-2', () => {});
        
        assertEqual(manager.getRegistrySize(), 2, 'Should have two middleware');
        
        const success = manager.removeMiddleware('middleware-1');
        assert(success, 'Should successfully remove middleware');
        assertEqual(manager.getRegistrySize(), 1, 'Should have one middleware remaining');
        assert(!manager.hasMiddleware('middleware-1'), 'Should not have removed middleware');
        assert(manager.hasMiddleware('middleware-2'), 'Should still have other middleware');
    });

    runner.test('should handle middleware with auto-generated names', () => {
        const api = new MockMiddlewareAPI();
        
        // Register without explicit name
        const id = api.register(() => {});
        const expectedName = `middleware-${id.slice(0, 8)}`;
        
        assert(api.hasMiddleware(expectedName), 'Should track auto-generated name');
        assertEqual(api.getMiddlewareId(expectedName), id, 'Should map auto-generated name to ID');
    });

    runner.test('should maintain tracking consistency during multiple operations', () => {
        const api = new MockMiddlewareAPI();
        
        // Register multiple middleware
        api.register(() => {}, { name: 'auth' });
        api.register(() => {}, { name: 'cors' });
        api.register(() => {}, { name: 'compression' });
        
        assertEqual(api.getRegisteredCount(), 3, 'Should have three middleware');
        
        // Remove one
        api.removeByName('cors');
        assertEqual(api.getRegisteredCount(), 2, 'Should have two middleware');
        assert(!api.hasMiddleware('cors'), 'Should not track removed middleware');
        assert(api.hasMiddleware('auth'), 'Should still track remaining middleware');
        assert(api.hasMiddleware('compression'), 'Should still track remaining middleware');
        
        // Add another
        api.register(() => {}, { name: 'rate-limit' });
        assertEqual(api.getRegisteredCount(), 3, 'Should have three middleware again');
        assert(api.hasMiddleware('rate-limit'), 'Should track new middleware');
        
        // Clear all
        const cleared = api.clear();
        assertEqual(cleared, 3, 'Should clear all middleware');
        assertEqual(api.getRegisteredCount(), 0, 'Should have no middleware');
    });

    return await runner.run();
}

// Export for running
export { runMiddlewareIdTrackingTests };

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runMiddlewareIdTrackingTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}
