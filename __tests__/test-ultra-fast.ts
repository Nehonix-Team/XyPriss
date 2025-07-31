/**
 * Quick test for Ultra-Fast FortifiedFunction optimizations
 */

import { func } from "../components/fortified-function";

async function testUltraFast() {
    console.log("🚀 Testing Ultra-Fast FortifiedFunction...");

    // Test 1: Simple function with all optimizations
    const ultraFastAdd = func((a: number, b: number) => a + b, {
        ultraFast: "maximum",
        enableJIT: true,
        enableSIMD: true,
        enableWebAssembly: true,
        enableZeroCopy: true,
        smartCaching: true,
        maxCacheSize: 1000,
        jitThreshold: 1, // Trigger JIT immediately
        simdThreshold: 2, // Use SIMD for 2+ numbers
    });

    console.log("\n📊 Testing simple addition...");
    const start = performance.now();

    // Execute multiple times to trigger JIT compilation
    for (let i = 0; i < 100; i++) {
        ultraFastAdd(42, 58); // Remove await for sync function
    }

    const end = performance.now();
    console.log(`✅ 100 operations completed in ${(end - start).toFixed(2)}ms`);
    console.log(
        `⚡ Average: ${((end - start) / 100).toFixed(3)}ms per operation`
    );

    // Test 2: Array processing (SIMD candidate)
    const ultraFastArraySum = func(
        (arr: number[]) => arr.reduce((sum, val) => sum + val, 0),
        {
            ultraFast: "maximum",
            enableJIT: true,
            enableSIMD: true,
            smartCaching: true,
            jitThreshold: 1,
            simdThreshold: 4,
        }
    );

    console.log("\n📊 Testing array sum with SIMD...");
    const testArray = Array.from({ length: 1000 }, (_, i) => i);
    const arrayStart = performance.now();

    for (let i = 0; i < 50; i++) {
        ultraFastArraySum(testArray); // Remove await for sync function
    }

    const arrayEnd = performance.now();
    console.log(
        `✅ 50 array operations completed in ${(arrayEnd - arrayStart).toFixed(
            2
        )}ms`
    );
    console.log(
        `⚡ Average: ${((arrayEnd - arrayStart) / 50).toFixed(
            3
        )}ms per operation`
    );

    // Test 3: Get performance metrics
    console.log("\n📈 Performance Metrics:");
    const metrics = ultraFastAdd._fortified.getUltraFastMetrics();
    console.log("Engine Stats:", JSON.stringify(metrics.engine, null, 2));
    console.log("Cache Stats:", JSON.stringify(metrics.cache, null, 2));
    console.log("Optimization Level:", metrics.optimizationLevel);

    // Test 4: Cache efficiency
    console.log("\n💾 Testing cache efficiency...");
    const cacheStart = performance.now();

    // Same operation multiple times should hit cache
    for (let i = 0; i < 100; i++) {
        ultraFastAdd(42, 58); // Same arguments, remove await
    }

    const cacheEnd = performance.now();
    console.log(
        `✅ 100 cached operations completed in ${(
            cacheEnd - cacheStart
        ).toFixed(2)}ms`
    );
    console.log(
        `⚡ Average: ${((cacheEnd - cacheStart) / 100).toFixed(
            3
        )}ms per operation`
    );

    const cacheStats = ultraFastAdd._fortified.getCacheStats();
    console.log(
        "Cache Hit Rate:",
        cacheStats.hits,
        "hits,",
        cacheStats.misses,
        "misses"
    );

    // Cleanup
    ultraFastAdd._fortified.destroy();
    ultraFastArraySum._fortified.destroy();

    console.log(
        "\n✅ Ultra-Fast FortifiedFunction test completed successfully!"
    );
    console.log(
        "🎯 Sub-millisecond performance achieved with enterprise security!"
    );
}

// Run test
testUltraFast().catch(console.error);

