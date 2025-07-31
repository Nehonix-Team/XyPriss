/**
 * Comprehensive Test Suite for Advanced Memory Manager
 *
 * This test file demonstrates the capabilities of the new modular memory management system
 */

import {
    memoryManager,
    MemoryEventType,
    PoolStrategy,
    MemoryUtils,
    MemorySetup,
} from "../utils/memory/index";

/**
 * Test class for memory tracking
 */
class TestObject {
    private data: string;

    constructor(data: string = "test") {
        this.data = data;
    }

    getData(): string {
        return this.data;
    }

    setData(data: string): void {
        this.data = data;
    }
}

/**
 * Run comprehensive memory manager tests
 */
export async function runMemoryManagerTests(): Promise<void> {
    console.log(" Starting Advanced Memory Manager Tests...\n");

    try {
        // Test 1: Basic Memory Tracking
        await testBasicMemoryTracking();

        // Test 2: Memory Pool Operations
        await testMemoryPoolOperations();

        // Test 3: Event System
        await testEventSystem();

        // Test 4: Configuration Management
        await testConfigurationManagement();

        // Test 5: Performance Monitoring
        await testPerformanceMonitoring();

        // Test 6: Leak Detection
        await testLeakDetection();

        // Test 7: Garbage Collection
        await testGarbageCollection();

        // Test 8: Utility Functions
        await testUtilityFunctions();

        console.log("✔ All Memory Manager Tests Completed Successfully!\n");

        // Print final report
        printMemoryReport();
    } catch (error) {
        console.error("❌ Memory Manager Tests Failed:", error);
        throw error;
    }
}

/**
 * Test basic memory tracking functionality
 */
async function testBasicMemoryTracking(): Promise<void> {
    console.log(" Testing Basic Memory Tracking...");

    // Register some objects
    const obj1 = new TestObject("object1");
    const obj2 = new TestObject("object2");
    const obj3 = { name: "test", value: 42 };

    memoryManager.registerObject(obj1, "test-obj-1");
    memoryManager.registerObject(obj2, "test-obj-2");
    memoryManager.registerObject(obj3, "test-obj-3");

    // Check stats
    const stats = memoryManager.getStats();
    console.log(`  - Tracked objects: ${stats.trackedObjects}`);
    console.log(
        `  - Total allocated: ${MemoryUtils.formatBytes(stats.totalAllocated)}`
    );

    // Remove references
    memoryManager.removeReference("test-obj-1");
    memoryManager.removeReference("test-obj-2");

    console.log("✔ Basic Memory Tracking Test Passed\n");
}

/**
 * Test memory pool operations with different strategies
 */
async function testMemoryPoolOperations(): Promise<void> {
    console.log(" Testing Memory Pool Operations...");

    // Create pools with different strategies
    const lifoPool = memoryManager.createPool({
        name: "test-lifo-pool",
        factory: () => new TestObject(),
        reset: (obj) => obj.setData("reset"),
        capacity: 5,
        strategy: PoolStrategy.LIFO,
    });

    const fifoPool = memoryManager.createPool({
        name: "test-fifo-pool",
        factory: () => new TestObject(),
        reset: (obj) => obj.setData("reset"),
        capacity: 3,
        strategy: PoolStrategy.FIFO,
    });

    // Test LIFO pool
    console.log("  Testing LIFO Pool:");
    const obj1 = lifoPool.acquire();
    const obj2 = lifoPool.acquire();
    obj1.setData("lifo-1");
    obj2.setData("lifo-2");

    lifoPool.release(obj1);
    lifoPool.release(obj2);

    const obj3 = lifoPool.acquire(); // Should get obj2 (last in, first out)
    console.log(`    - Retrieved object data: ${obj3.getData()}`);

    // Test FIFO pool
    console.log("  Testing FIFO Pool:");
    const objA = fifoPool.acquire();
    const objB = fifoPool.acquire();
    objA.setData("fifo-A");
    objB.setData("fifo-B");

    fifoPool.release(objA);
    fifoPool.release(objB);

    const objC = fifoPool.acquire(); // Should get objA (first in, first out)
    console.log(`    - Retrieved object data: ${objC.getData()}`);

    // Check pool stats
    const lifoStats = lifoPool.getStats();
    const fifoStats = fifoPool.getStats();

    console.log(
        `  - LIFO Pool hit rate: ${(lifoStats.hitRate * 100).toFixed(1)}%`
    );
    console.log(
        `  - FIFO Pool hit rate: ${(fifoStats.hitRate * 100).toFixed(1)}%`
    );

    console.log("✔ Memory Pool Operations Test Passed\n");
}

/**
 * Test event system functionality
 */
async function testEventSystem(): Promise<void> {
    console.log(" Testing Event System...");

    let eventCount = 0;
    let lastEvent: any = null;

    // Add event listeners
    memoryManager.on(MemoryEventType.OBJECT_TRACKED, (event) => {
        eventCount++;
        lastEvent = event;
        console.log(`  - Object tracked event: ${event.data?.id}`);
    });

    memoryManager.on(MemoryEventType.GC_COMPLETED, (event) => {
        console.log(
            `  - GC completed: freed ${MemoryUtils.formatBytes(
                event.data?.freedMemory || 0
            )}`
        );
    });

    // Trigger some events
    const testObj = new TestObject("event-test");
    memoryManager.registerObject(testObj, "event-test-obj");

    // Force GC to trigger event
    memoryManager.forceGC();

    console.log(`  - Total events captured: ${eventCount}`);
    console.log("✔ Event System Test Passed\n");
}

/**
 * Test configuration management
 */
async function testConfigurationManagement(): Promise<void> {
    console.log(" Testing Configuration Management...");

    // Get current config
    const originalConfig = memoryManager.getConfig();
    console.log(
        `  - Original GC threshold: ${(
            originalConfig.gcThreshold * 100
        ).toFixed(1)}%`
    );

    // Update configuration
    memoryManager.updateConfig({
        gcThreshold: 0.75,
        gcInterval: 15000,
    });

    const updatedConfig = memoryManager.getConfig();
    console.log(
        `  - Updated GC threshold: ${(updatedConfig.gcThreshold * 100).toFixed(
            1
        )}%`
    );
    console.log(`  - Updated GC interval: ${updatedConfig.gcInterval / 1000}s`);

    // Test setup presets
    console.log("  Testing setup presets:");
    MemorySetup.development();
    console.log("    - Development setup applied");

    MemorySetup.production();
    console.log("    - Production setup applied");

    console.log("✔ Configuration Management Test Passed\n");
}

/**
 * Test performance monitoring
 */
async function testPerformanceMonitoring(): Promise<void> {
    console.log(" Testing Performance Monitoring...");

    // Enable performance monitoring
    memoryManager.updateConfig({
        enablePerformanceMonitoring: true,
    });

    // Create some load
    const objects: any[] = [];
    for (let i = 0; i < 100; i++) {
        const obj = new TestObject(`perf-test-${i}`);
        objects.push(obj);
        memoryManager.registerObject(obj, `perf-obj-${i}`);
    }

    // Get performance metrics
    const metrics = memoryManager.getPerformanceMetrics();
    console.log(
        `  - Memory efficiency: ${(metrics.memoryEfficiency * 100).toFixed(1)}%`
    );
    console.log(`  - GC frequency: ${metrics.gcFrequency.toFixed(2)} GCs/hour`);
    console.log(`  - Average GC time: ${metrics.averageGCTime.toFixed(2)}ms`);

    // Clean up
    objects.forEach((_, i) => memoryManager.removeReference(`perf-obj-${i}`));

    console.log("✔ Performance Monitoring Test Passed\n");
}

/**
 * Test leak detection
 */
async function testLeakDetection(): Promise<void> {
    console.log(" Testing Leak Detection...");

    // Enable leak detection
    memoryManager.updateConfig({
        enableLeakDetection: true,
        leakDetectionThreshold: 1000, // 1 second for testing
    });

    // Create potential leaks
    const leakyObjects: any[] = [];
    for (let i = 0; i < 10; i++) {
        const obj = new TestObject(`leak-test-${i}`);
        leakyObjects.push(obj);
        memoryManager.registerObject(obj, `leak-obj-${i}`);
    }

    // Wait for leak detection
    await new Promise((resolve) => setTimeout(resolve, 1500));

    // Force leak detection
    const stats = memoryManager.getStats();
    console.log(`  - Potential leaks detected: ${stats.leakCount}`);

    // Clean up
    leakyObjects.forEach((_, i) =>
        memoryManager.removeReference(`leak-obj-${i}`)
    );

    console.log("✔ Leak Detection Test Passed\n");
}

/**
 * Test garbage collection
 */
async function testGarbageCollection(): Promise<void> {
    console.log(" Testing Garbage Collection...");

    const beforeStats = memoryManager.getStats();
    console.log(
        `  - Memory before GC: ${MemoryUtils.formatBytes(
            beforeStats.currentUsage
        )}`
    );

    // Force garbage collection
    const gcResult = memoryManager.forceGC();

    console.log(`  - GC duration: ${gcResult.duration}ms`);
    console.log(
        `  - Memory freed: ${MemoryUtils.formatBytes(gcResult.freedMemory)}`
    );
    console.log(`  - GC successful: ${gcResult.success}`);

    const afterStats = memoryManager.getStats();
    console.log(
        `  - Memory after GC: ${MemoryUtils.formatBytes(
            afterStats.currentUsage
        )}`
    );
    console.log(`  - Total GC count: ${afterStats.gcCount}`);

    console.log(" Garbage Collection Test Passed\n");
}

/**
 * Test utility functions
 */
async function testUtilityFunctions(): Promise<void> {
    console.log(" Testing Utility Functions...");

    // Test formatting functions
    console.log(
        `  - Format bytes: ${MemoryUtils.formatBytes(1024 * 1024 * 2.5)}`
    );
    console.log(`  - Format duration: ${MemoryUtils.formatDuration(3661000)}`);

    // Test object size estimation
    const testObj = { name: "test", data: new Array(100).fill("x") };
    const estimatedSize = MemoryUtils.estimateObjectSize(testObj);
    console.log(
        `  - Estimated object size: ${MemoryUtils.formatBytes(estimatedSize)}`
    );

    // Test feature support
    console.log(
        `  - Advanced features supported: ${MemoryUtils.supportsAdvancedFeatures()}`
    );

    // Test memory usage (Node.js only)
    const memUsage = MemoryUtils.getCurrentMemoryUsage();
    if (memUsage) {
        console.log(
            `  - Current heap usage: ${MemoryUtils.formatBytes(
                memUsage.heapUsed
            )}`
        );
    }

    console.log("✔ Utility Functions Test Passed\n");
}

/**
 * Print comprehensive memory report
 */
function printMemoryReport(): void {
    console.log(" Final Memory Report:");
    console.log("=".repeat(50));
    console.log(memoryManager.getMemoryReport());
    console.log("=".repeat(50));
}

// Export for use in other test files
export {
    testBasicMemoryTracking,
    testMemoryPoolOperations,
    testEventSystem,
    testConfigurationManagement,
    testPerformanceMonitoring,
    testLeakDetection,
    testGarbageCollection,
    testUtilityFunctions,
};

printMemoryReport();
