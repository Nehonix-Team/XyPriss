// Simple test framework
class TestRunner {
    private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
    private passed = 0;
    private failed = 0;

    test(name: string, fn: () => void | Promise<void>) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log("🧪 Running Optimization Engine Tests...\n");

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

// Mock the optimization engine to test the private methods
class MockOptimizationEngine {
    private callFrequencyMap = new Map<string, {
        count: number;
        firstCall: number;
        lastCall: number;
        intervals: number[];
    }>();
    
    private parameterPatterns = new Map<string, {
        frequency: number;
        lastSeen: number;
        variations: Set<string>;
        suspiciousCount: number;
    }>();

    // Expose the private methods for testing
    public detectRapidCalls(executionContext: any): boolean {
        const functionId = executionContext?.functionId || 'unknown';
        const now = Date.now();
        
        let callData = this.callFrequencyMap.get(functionId);
        
        if (!callData) {
            callData = {
                count: 1,
                firstCall: now,
                lastCall: now,
                intervals: []
            };
            this.callFrequencyMap.set(functionId, callData);
            return false;
        }
        
        const interval = now - callData.lastCall;
        callData.intervals.push(interval);
        callData.count++;
        callData.lastCall = now;
        
        if (callData.intervals.length > 10) {
            callData.intervals.shift();
        }
        
        const recentCalls = callData.intervals.filter(interval => interval < 1000).length;
        if (recentCalls >= 5) {
            return true;
        }
        
        if (callData.intervals.length >= 5) {
            const recentIntervals = callData.intervals.slice(-5);
            const avgInterval = recentIntervals.reduce((sum, interval) => sum + interval, 0) / recentIntervals.length;
            if (avgInterval < 200) {
                return true;
            }
        }
        
        return false;
    }

    public detectSuspiciousParameters(executionContext: any): boolean {
        const parametersHash = executionContext?.parametersHash || 'unknown';
        const parameters = executionContext?.parameters;
        
        if (!parameters) return false;
        
        const now = Date.now();
        let patternData = this.parameterPatterns.get(parametersHash);
        
        if (!patternData) {
            patternData = {
                frequency: 1,
                lastSeen: now,
                variations: new Set([JSON.stringify(parameters)]),
                suspiciousCount: 0
            };
            this.parameterPatterns.set(parametersHash, patternData);
            return false;
        }
        
        patternData.frequency++;
        patternData.lastSeen = now;
        patternData.variations.add(JSON.stringify(parameters));
        
        let suspicious = false;
        
        if (patternData.variations.size > 10) {
            suspicious = true;
        }
        
        if (patternData.frequency > 1000) {
            suspicious = true;
        }
        
        const paramString = JSON.stringify(parameters).toLowerCase();
        const injectionPatterns = [
            'script', 'javascript:', 'eval(', 'function(',
            'select * from', 'union select', 'drop table',
            '../', '..\\', 'file://', 'http://', 'https://'
        ];
        
        for (const pattern of injectionPatterns) {
            if (paramString.includes(pattern)) {
                suspicious = true;
                break;
            }
        }
        
        if (suspicious) {
            patternData.suspiciousCount++;
        }
        
        const oneHourAgo = now - 3600000;
        for (const [hash, data] of this.parameterPatterns.entries()) {
            if (data.lastSeen < oneHourAgo) {
                this.parameterPatterns.delete(hash);
            }
        }
        
        return suspicious;
    }

    // Helper methods for testing
    public getCallData(functionId: string) {
        return this.callFrequencyMap.get(functionId);
    }

    public getParameterPattern(hash: string) {
        return this.parameterPatterns.get(hash);
    }

    public clearData() {
        this.callFrequencyMap.clear();
        this.parameterPatterns.clear();
    }

    public simulateTime(ms: number) {
        // Helper to simulate time passage for testing
        const now = Date.now();
        for (const [, data] of this.callFrequencyMap.entries()) {
            data.lastCall = now - ms;
        }
        for (const [, data] of this.parameterPatterns.entries()) {
            data.lastSeen = now - ms;
        }
    }
}

// Test suite
async function runOptimizationEngineTests() {
    const runner = new TestRunner();
    let optimizationEngine: MockOptimizationEngine;

    function beforeEach() {
        optimizationEngine = new MockOptimizationEngine();
    }

    // Rapid calls detection tests
    runner.test('should not detect rapid calls on first call', () => {
        beforeEach();
        const context = { functionId: 'test-func' };
        const result = optimizationEngine.detectRapidCalls(context);
        assertEqual(result, false);
    });

    runner.test('should detect rapid calls with 5+ calls in 1 second', () => {
        beforeEach();
        const context = { functionId: 'test-func' };
        
        // Simulate 6 rapid calls
        for (let i = 0; i < 6; i++) {
            const result = optimizationEngine.detectRapidCalls(context);
            if (i >= 5) {
                assertEqual(result, true, 'Should detect rapid calls after 5+ calls');
            }
        }
    });

    runner.test('should detect sustained rapid calls with avg interval < 200ms', () => {
        beforeEach();
        const context = { functionId: 'test-func' };
        
        // Simulate calls with intervals just under 200ms
        for (let i = 0; i < 6; i++) {
            optimizationEngine.detectRapidCalls(context);
            // Simulate 150ms delay between calls
            const callData = optimizationEngine.getCallData('test-func');
            if (callData && i > 0) {
                callData.intervals[callData.intervals.length - 1] = 150;
            }
        }
        
        const result = optimizationEngine.detectRapidCalls(context);
        assertEqual(result, true, 'Should detect sustained rapid calls');
    });

    runner.test('should not detect rapid calls with normal intervals', () => {
        beforeEach();
        const context = { functionId: 'test-func' };
        
        // Simulate normal calls with 1 second intervals
        for (let i = 0; i < 6; i++) {
            optimizationEngine.detectRapidCalls(context);
            const callData = optimizationEngine.getCallData('test-func');
            if (callData && i > 0) {
                callData.intervals[callData.intervals.length - 1] = 1000;
            }
        }
        
        const result = optimizationEngine.detectRapidCalls(context);
        assertEqual(result, false, 'Should not detect rapid calls with normal intervals');
    });

    // Parameter pattern detection tests
    runner.test('should not detect suspicious parameters on first occurrence', () => {
        beforeEach();
        const context = {
            parametersHash: 'test-hash',
            parameters: { name: 'test', value: 123 }
        };
        
        const result = optimizationEngine.detectSuspiciousParameters(context);
        assertEqual(result, false);
    });

    runner.test('should detect suspicious parameters with injection patterns', () => {
        beforeEach();
        const context = {
            parametersHash: 'test-hash',
            parameters: { query: 'SELECT * FROM users' }
        };
        
        const result = optimizationEngine.detectSuspiciousParameters(context);
        assertEqual(result, true, 'Should detect SQL injection pattern');
    });

    runner.test('should detect suspicious parameters with script injection', () => {
        beforeEach();
        const context = {
            parametersHash: 'test-hash',
            parameters: { content: '<script>alert("xss")</script>' }
        };
        
        const result = optimizationEngine.detectSuspiciousParameters(context);
        assertEqual(result, true, 'Should detect script injection pattern');
    });

    runner.test('should detect suspicious parameters with too many variations', () => {
        beforeEach();
        const context = { parametersHash: 'test-hash' };
        
        // Add 12 different parameter variations
        for (let i = 0; i < 12; i++) {
            context.parameters = { id: i, data: `test-${i}` };
            optimizationEngine.detectSuspiciousParameters(context);
        }
        
        const result = optimizationEngine.detectSuspiciousParameters(context);
        assertEqual(result, true, 'Should detect too many parameter variations');
    });

    runner.test('should detect suspicious parameters with high frequency', () => {
        beforeEach();
        const context = {
            parametersHash: 'test-hash',
            parameters: { test: 'data' }
        };
        
        // Simulate high frequency calls
        const pattern = optimizationEngine.getParameterPattern('test-hash');
        if (pattern) {
            pattern.frequency = 1001; // Above threshold
        } else {
            // First call to establish pattern
            optimizationEngine.detectSuspiciousParameters(context);
            const newPattern = optimizationEngine.getParameterPattern('test-hash');
            if (newPattern) {
                newPattern.frequency = 1001;
            }
        }
        
        const result = optimizationEngine.detectSuspiciousParameters(context);
        assertEqual(result, true, 'Should detect high frequency pattern');
    });

    runner.test('should clean up old patterns', () => {
        beforeEach();
        const context = {
            parametersHash: 'test-hash',
            parameters: { test: 'data' }
        };
        
        // Add a pattern
        optimizationEngine.detectSuspiciousParameters(context);
        
        // Simulate time passage (more than 1 hour)
        optimizationEngine.simulateTime(3700000);
        
        // This should trigger cleanup
        optimizationEngine.detectSuspiciousParameters({
            parametersHash: 'new-hash',
            parameters: { new: 'data' }
        });
        
        const oldPattern = optimizationEngine.getParameterPattern('test-hash');
        assertEqual(oldPattern, undefined, 'Old pattern should be cleaned up');
    });

    runner.test('should handle missing parameters gracefully', () => {
        beforeEach();
        const context = { parametersHash: 'test-hash' }; // No parameters
        
        const result = optimizationEngine.detectSuspiciousParameters(context);
        assertEqual(result, false, 'Should handle missing parameters');
    });

    return await runner.run();
}

// Export for running
export { runOptimizationEngineTests };

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runOptimizationEngineTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}
