// Simple test framework
class TestRunner {
    private tests: Array<{ name: string; fn: () => void | Promise<void> }> = [];
    private passed = 0;
    private failed = 0;

    test(name: string, fn: () => void | Promise<void>) {
        this.tests.push({ name, fn });
    }

    async run() {
        console.log("🧪 Running Object Collection Tracking Tests...\n");

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

function assertGreaterThanOrEqual(actual: number, expected: number, message?: string) {
    if (actual < expected) {
        throw new Error(message || `Expected ${actual} to be greater than or equal to ${expected}`);
    }
}

// Mock the object collection tracking functionality
class MockObjectCollectionTracker {
    private objectTracker = new Map<string, {
        count: number;
        totalSize: number;
        lastSeen: number;
        type: string;
        weakRefs: WeakRef<any>[];
    }>();
    
    private collectionHistory: Array<{
        timestamp: number;
        objectsCollected: number;
        typesCollected: Map<string, number>;
        memoryFreed: number;
        gcDuration: number;
    }> = [];

    public trackObject(obj: any, type: string = 'unknown', estimatedSize: number = 0): string {
        const objectId = this.generateObjectId();
        
        let tracker = this.objectTracker.get(type);
        if (!tracker) {
            tracker = {
                count: 0,
                totalSize: 0,
                lastSeen: Date.now(),
                type,
                weakRefs: [],
            };
            this.objectTracker.set(type, tracker);
        }

        const weakRef = new WeakRef(obj);
        tracker.weakRefs.push(weakRef);
        tracker.count++;
        tracker.totalSize += estimatedSize;
        tracker.lastSeen = Date.now();

        return objectId;
    }

    public trackObjectCollection(beforeUsage: number, afterUsage: number): number {
        const memoryFreed = beforeUsage - afterUsage;
        const gcStartTime = Date.now();

        let objectsCollected = 0;
        const typesCollected = new Map<string, number>();

        for (const [objectId, tracker] of this.objectTracker.entries()) {
            let collectedCount = 0;
            
            tracker.weakRefs = tracker.weakRefs.filter(weakRef => {
                const obj = weakRef.deref();
                if (obj === undefined) {
                    collectedCount++;
                    return false;
                }
                return true;
            });

            if (collectedCount > 0) {
                objectsCollected += collectedCount;
                tracker.count -= collectedCount;
                
                const currentTypeCount = typesCollected.get(tracker.type) || 0;
                typesCollected.set(tracker.type, currentTypeCount + collectedCount);

                if (tracker.count <= 0) {
                    this.objectTracker.delete(objectId);
                }
            }
        }

        if (objectsCollected === 0 && memoryFreed > 0) {
            objectsCollected = Math.floor(memoryFreed / 1024);
        }

        const gcDuration = Date.now() - gcStartTime;
        this.collectionHistory.push({
            timestamp: Date.now(),
            objectsCollected,
            typesCollected,
            memoryFreed,
            gcDuration,
        });

        if (this.collectionHistory.length > 100) {
            this.collectionHistory.shift();
        }

        return objectsCollected;
    }

    private generateObjectId(): string {
        return `obj_${Date.now()}_${Math.random().toString(36).substring(2, 11)}`;
    }

    public getObjectCollectionStats(): {
        totalTracked: number;
        byType: Map<string, { count: number; totalSize: number }>;
        recentCollections: Array<{
            timestamp: number;
            objectsCollected: number;
            typesCollected: Map<string, number>;
            memoryFreed: number;
            gcDuration: number;
        }>;
        averageCollectionRate: number;
    } {
        const totalTracked = Array.from(this.objectTracker.values()).reduce(
            (sum, tracker) => sum + tracker.count,
            0
        );

        const byType = new Map();
        for (const [type, tracker] of this.objectTracker.entries()) {
            byType.set(type, {
                count: tracker.count,
                totalSize: tracker.totalSize,
            });
        }

        const recentCollections = this.collectionHistory.slice(-10);
        const averageCollectionRate = recentCollections.length > 0
            ? recentCollections.reduce((sum, entry) => sum + entry.objectsCollected, 0) / recentCollections.length
            : 0;

        return {
            totalTracked,
            byType,
            recentCollections: this.collectionHistory.slice(-20),
            averageCollectionRate,
        };
    }

    // Helper methods for testing
    public clearTracking(): void {
        this.objectTracker.clear();
        this.collectionHistory.length = 0;
    }
}

// Test suite
async function runObjectCollectionTrackingTests() {
    const runner = new TestRunner();
    let tracker: MockObjectCollectionTracker;

    function beforeEach() {
        tracker = new MockObjectCollectionTracker();
    }

    runner.test('should track objects correctly', () => {
        beforeEach();
        const obj = { test: 'data' };
        
        const objectId = tracker.trackObject(obj, 'TestObject', 100);
        
        assert(typeof objectId === 'string', 'Should return object ID');
        assert(objectId.startsWith('obj_'), 'Object ID should have correct prefix');
        
        const stats = tracker.getObjectCollectionStats();
        assertEqual(stats.totalTracked, 1, 'Should track one object');
        assert(stats.byType.has('TestObject'), 'Should track by type');
        assertEqual(stats.byType.get('TestObject').count, 1, 'Should have correct count');
        assertEqual(stats.byType.get('TestObject').totalSize, 100, 'Should track size');
    });

    runner.test('should track multiple objects of same type', () => {
        beforeEach();
        const obj1 = { test: 'data1' };
        const obj2 = { test: 'data2' };
        
        tracker.trackObject(obj1, 'TestObject', 50);
        tracker.trackObject(obj2, 'TestObject', 75);
        
        const stats = tracker.getObjectCollectionStats();
        assertEqual(stats.totalTracked, 2, 'Should track two objects');
        assertEqual(stats.byType.get('TestObject').count, 2, 'Should have correct count');
        assertEqual(stats.byType.get('TestObject').totalSize, 125, 'Should sum sizes');
    });

    runner.test('should track object collection with memory estimation', () => {
        beforeEach();
        
        const beforeUsage = 1000000; // 1MB
        const afterUsage = 800000;   // 800KB
        
        const objectsCollected = tracker.trackObjectCollection(beforeUsage, afterUsage);
        
        // Should estimate based on memory freed (200KB / 1KB = 200 objects)
        assertEqual(objectsCollected, 195, 'Should estimate objects from memory freed');
        
        const stats = tracker.getObjectCollectionStats();
        assertEqual(stats.recentCollections.length, 1, 'Should record collection event');
        
        const collection = stats.recentCollections[0];
        assertEqual(collection.memoryFreed, 200000, 'Should calculate memory freed');
        assertGreaterThan(collection.timestamp, 0, 'Should have timestamp');
        assertGreaterThanOrEqual(collection.gcDuration, 0, 'Should have GC duration');
    });

    runner.test('should maintain collection history', () => {
        beforeEach();
        
        for (let i = 0; i < 5; i++) {
            tracker.trackObjectCollection(1000000, 900000);
        }
        
        const stats = tracker.getObjectCollectionStats();
        assertEqual(stats.recentCollections.length, 5, 'Should maintain collection history');
        assertGreaterThan(stats.averageCollectionRate, 0, 'Should calculate average collection rate');
    });

    runner.test('should limit collection history size', () => {
        beforeEach();
        
        for (let i = 0; i < 105; i++) {
            tracker.trackObjectCollection(1000000, 900000);
        }
        
        const stats = tracker.getObjectCollectionStats();
        assertEqual(stats.recentCollections.length, 20, 'Should limit recent collections to 20');
    });

    runner.test('should generate unique object IDs', () => {
        beforeEach();
        
        const obj1 = { test: 'data1' };
        const obj2 = { test: 'data2' };
        
        const id1 = tracker.trackObject(obj1, 'TestObject');
        const id2 = tracker.trackObject(obj2, 'TestObject');
        
        assert(id1 !== id2, 'Should generate unique object IDs');
        assert(id1.startsWith('obj_'), 'ID1 should have correct format');
        assert(id2.startsWith('obj_'), 'ID2 should have correct format');
    });

    runner.test('should handle default parameters', () => {
        beforeEach();
        
        const obj = { test: 'data' };
        const objectId = tracker.trackObject(obj); // No type or size
        
        assert(typeof objectId === 'string', 'Should handle default parameters');
        
        const stats = tracker.getObjectCollectionStats();
        assertEqual(stats.totalTracked, 1, 'Should track object with defaults');
        assert(stats.byType.has('unknown'), 'Should use default type');
        assertEqual(stats.byType.get('unknown').totalSize, 0, 'Should use default size');
    });

    runner.test('should clear tracking data', () => {
        beforeEach();
        
        const obj = { test: 'data' };
        tracker.trackObject(obj, 'TestObject', 100);
        tracker.trackObjectCollection(1000000, 900000);
        
        let stats = tracker.getObjectCollectionStats();
        assertGreaterThan(stats.totalTracked, 0, 'Should have tracked objects');
        assertGreaterThan(stats.recentCollections.length, 0, 'Should have collection history');
        
        tracker.clearTracking();
        stats = tracker.getObjectCollectionStats();
        assertEqual(stats.totalTracked, 0, 'Should clear tracked objects');
        assertEqual(stats.recentCollections.length, 0, 'Should clear collection history');
    });

    return await runner.run();
}

// Export for running
export { runObjectCollectionTrackingTests };

// Run tests if this file is executed directly
if (typeof require !== 'undefined' && require.main === module) {
    runObjectCollectionTrackingTests().then(success => {
        process.exit(success ? 0 : 1);
    });
}
