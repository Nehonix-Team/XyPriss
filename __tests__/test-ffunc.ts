/**
 * Test file for XyPrissSecurity fFunc modular architecture
 */

import {
    func,
    createFortifiedFunction,
} from "../components/fortified-function";

async function testBasicFFunc() {
    console.log("🧪 Testing Basic fFunc...");

    // Create a simple secure function
    const secureAdd = func(
        async (a: number, b: number) => {
            return a + b;
        },
        {
            auditLog: true,
            performanceTracking: true,
        }
    );

    // Test execution
    const result = await secureAdd(5, 3);
    console.log("✔ Basic fFunc result:", result);

    return result === 8;
}

async function testAdvancedFFunc() {
    console.log("🧪 Testing Advanced fFunc...");

    // Create an advanced fortified function
    const fortified = createFortifiedFunction(
        async (data: string, password: string) => {
            // Simulate processing sensitive data
            return `Processed: ${data.length} characters`;
        },
        {
            autoEncrypt: true,
            secureParameters: [1], // Encrypt password parameter
            memoize: true,
            auditLog: true,
            stackTraceProtection: true,
        }
    );

    // Test execution
    const result = await fortified.execute("sensitive data", "secret123");
    console.log("✔ Advanced fFunc result:", result);

    // Test stats
    const stats = fortified.getStats();
    console.log("📊 Execution stats:", {
        executionCount: stats.executionCount,
        securityEvents: stats.securityEvents,
    });

    // Test audit log
    const auditLog = fortified.getAuditLog();
    console.log("📋 Audit entries:", auditLog.length);

    // Clean up
    fortified.destroy();

    return result.includes("14 characters");
}

async function testCachedFFunc() {
    console.log("🧪 Testing Cached fFunc...");

    const cachedFunc = func(
        async (input: number) => {
            // Simulate expensive operation
            await new Promise((resolve) => setTimeout(resolve, 100));
            return input * input;
        },
        {
            memoize: true,
            performanceTracking: true,
        }
    );

    // First call (should be slow)
    console.time("First call");
    const result1 = await cachedFunc(10);
    console.timeEnd("First call");

    // Second call (should be fast - cached)
    console.time("Second call (cached)");
    const result2 = await cachedFunc(10);
    console.timeEnd("Second call (cached)");

    console.log("✔ Cached results:", { result1, result2 });

    return result1 === 100 && result2 === 100;
}

async function runTests() {
    console.log(" XyPrissSecurity fFunc Modular Architecture Test\n");

    try {
        const test1 = await testBasicFFunc();
        console.log("");

        const test2 = await testAdvancedFFunc();
        console.log("");

        const test3 = await testCachedFFunc();
        console.log("");

        const allPassed = test1 && test2 && test3;

        if (allPassed) {
            console.log(
                "🎉 All tests passed! fFunc modular architecture is working correctly."
            );
        } else {
            console.log("❌ Some tests failed.");
        }

        return allPassed;
    } catch (error) {
        console.error("❌ Test error:", error);
        return false;
    }
}

// Run tests if this file is executed directly
if (require.main === module) {
    runTests().then((success) => {
        process.exit(success ? 0 : 1);
    });
}

export { runTests };

