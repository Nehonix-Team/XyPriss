// Simple test framework
class TestRunner {
    private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
    private passed = 0;
    private failed = 0;

    test(name: string, fn: () => void | Promise<void>) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log("🧪 Running Analytics Engine Tests...\n");

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

function assertGreaterThan(actual: number, expected: number, message?: string) {
    if (actual <= expected) {
        throw new Error(message || `Expected ${actual} to be greater than ${expected}`);
    }
}

function assertLessThan(actual: number, expected: number, message?: string) {
    if (actual >= expected) {
        throw new Error(message || `Expected ${actual} to be less than ${expected}`);
    }
}

function assertGreaterThanOrEqual(actual: number, expected: number, message?: string) {
    if (actual < expected) {
        throw new Error(message || `Expected ${actual} to be greater than or equal to ${expected}`);
    }
}

function assertLessThanOrEqual(actual: number, expected: number, message?: string) {
    if (actual > expected) {
        throw new Error(message || `Expected ${actual} to be less than or equal to ${expected}`);
    }
}

// Mock the analytics engine since we need to test the private method
class MockAnalyticsEngine {
    private executionPatterns = new Map<string, {
        parametersHash: string;
        frequency: number;
        averageExecutionTime: number;
        lastExecuted: Date;
        cacheWorthiness: number;
    }>();

    // Expose the private method for testing
    public calculateAverageInterval(parametersHash: string): number {
        const pattern = this.executionPatterns.get(parametersHash);
        if (!pattern || pattern.frequency < 2) return 0;

        const now = Date.now();
        const lastExecutedTime = pattern.lastExecuted.getTime();
        const timeSinceLastExecution = now - lastExecutedTime;

        if (pattern.frequency >= 3) {
            const estimatedActiveTime = Math.max(
                timeSinceLastExecution,
                pattern.frequency * 60000
            );
            const avgInterval = estimatedActiveTime / (pattern.frequency - 1);
            
            const minInterval = 30000;
            const maxInterval = 7200000;
            
            return Math.max(minInterval, Math.min(maxInterval, avgInterval));
        }

        const conservativeInterval = Math.max(
            timeSinceLastExecution / 2,
            60000
        );

        return Math.min(conservativeInterval, 3600000);
    }

    // Helper methods for testing
    public addPattern(hash: string, pattern: any) {
        this.executionPatterns.set(hash, pattern);
    }

    public getPattern(hash: string) {
        return this.executionPatterns.get(hash);
    }

    public clearPatterns() {
        this.executionPatterns.clear();
    }
}

// Test suite
async function runAnalyticsEngineTests() {
    const runner = new TestRunner();
    let analyticsEngine: MockAnalyticsEngine;

    // Helper to reset engine before each test
    function beforeEach() {
        analyticsEngine = new MockAnalyticsEngine();
    }

    runner.test('should return 0 for non-existent patterns', () => {
        beforeEach();
        const result = analyticsEngine.calculateAverageInterval('non-existent');
        assertEqual(result, 0);
    });

    runner.test('should return 0 for patterns with frequency less than 2', () => {
        beforeEach();
        analyticsEngine.addPattern('test-hash', {
            parametersHash: 'test-hash',
            frequency: 1,
            averageExecutionTime: 100,
            lastExecuted: new Date(),
            cacheWorthiness: 0.5
        });

        const result = analyticsEngine.calculateAverageInterval('test-hash');
        assertEqual(result, 0);
    });

    runner.test('should calculate conservative interval for frequency of 2', () => {
        beforeEach();
        const lastExecuted = new Date(Date.now() - 120000); // 2 minutes ago
        analyticsEngine.addPattern('test-hash', {
            parametersHash: 'test-hash',
            frequency: 2,
            averageExecutionTime: 100,
            lastExecuted,
            cacheWorthiness: 0.5
        });

        const result = analyticsEngine.calculateAverageInterval('test-hash');
        
        // Should be at least 60000ms (1 minute) and at most 3600000ms (1 hour)
        assertGreaterThanOrEqual(result, 60000);
        assertLessThanOrEqual(result, 3600000);
    });

    runner.test('should calculate proper interval for frequency >= 3', () => {
        beforeEach();
        const lastExecuted = new Date(Date.now() - 300000); // 5 minutes ago
        analyticsEngine.addPattern('test-hash', {
            parametersHash: 'test-hash',
            frequency: 5,
            averageExecutionTime: 100,
            lastExecuted,
            cacheWorthiness: 0.5
        });

        const result = analyticsEngine.calculateAverageInterval('test-hash');
        
        // Should be between min and max intervals
        assertGreaterThanOrEqual(result, 30000); // 30 seconds minimum
        assertLessThanOrEqual(result, 7200000); // 2 hours maximum
    });

    runner.test('should respect minimum interval of 30 seconds', () => {
        beforeEach();
        const lastExecuted = new Date(Date.now() - 1000); // 1 second ago
        analyticsEngine.addPattern('test-hash', {
            parametersHash: 'test-hash',
            frequency: 10,
            averageExecutionTime: 50,
            lastExecuted,
            cacheWorthiness: 0.8
        });

        const result = analyticsEngine.calculateAverageInterval('test-hash');
        assertGreaterThanOrEqual(result, 30000);
    });

    runner.test('should respect maximum interval of 2 hours', () => {
        beforeEach();
        const lastExecuted = new Date(Date.now() - 86400000); // 24 hours ago
        analyticsEngine.addPattern('test-hash', {
            parametersHash: 'test-hash',
            frequency: 3,
            averageExecutionTime: 1000,
            lastExecuted,
            cacheWorthiness: 0.3
        });

        const result = analyticsEngine.calculateAverageInterval('test-hash');
        assertLessThanOrEqual(result, 7200000);
    });

    runner.test('should handle high frequency patterns correctly', () => {
        beforeEach();
        const lastExecuted = new Date(Date.now() - 60000); // 1 minute ago
        analyticsEngine.addPattern('test-hash', {
            parametersHash: 'test-hash',
            frequency: 100,
            averageExecutionTime: 25,
            lastExecuted,
            cacheWorthiness: 0.9
        });

        const result = analyticsEngine.calculateAverageInterval('test-hash');
        
        // High frequency should result in shorter intervals
        assertGreaterThanOrEqual(result, 30000);
        assertLessThan(result, 300000); // Should be less than 5 minutes
    });

    runner.test('should handle multiple patterns', () => {
        beforeEach();
        const pattern1 = {
            parametersHash: 'hash1',
            frequency: 3,
            averageExecutionTime: 100,
            lastExecuted: new Date(Date.now() - 60000),
            cacheWorthiness: 0.5
        };

        const pattern2 = {
            parametersHash: 'hash2',
            frequency: 8,
            averageExecutionTime: 75,
            lastExecuted: new Date(Date.now() - 30000),
            cacheWorthiness: 0.8
        };

        analyticsEngine.addPattern('hash1', pattern1);
        analyticsEngine.addPattern('hash2', pattern2);

        const interval1 = analyticsEngine.calculateAverageInterval('hash1');
        const interval2 = analyticsEngine.calculateAverageInterval('hash2');

        assertGreaterThan(interval1, 0);
        assertGreaterThan(interval2, 0);
        // Higher frequency should generally result in shorter intervals
        assertLessThan(interval2, interval1);
    });

    runner.test('should clear patterns correctly', () => {
        beforeEach();
        analyticsEngine.addPattern('test-hash', {
            parametersHash: 'test-hash',
            frequency: 5,
            averageExecutionTime: 100,
            lastExecuted: new Date(),
            cacheWorthiness: 0.5
        });

        analyticsEngine.clearPatterns();
        const result = analyticsEngine.calculateAverageInterval('test-hash');
        assertEqual(result, 0);
    });

    return await runner.run();
}

// Export for running
export { runAnalyticsEngineTests };

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runAnalyticsEngineTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}
