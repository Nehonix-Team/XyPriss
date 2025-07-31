// testing redis cache sys

import { Hash } from "../../core";
import { cache } from "../redis_cache_test";

export async function testCache(a: number, b: number) {
    const opId = Hash.create(String(a + b)).toString("hex");
    console.log("🔍 opId: ", opId);

    // Check if key exists first
    const exists = await cache.exists(opId);
    console.log("🔍 Key exists:", exists);

    const cachedResult = await cache.read(opId);
    console.log("🔍 Cached result:", cachedResult);

    if (cachedResult !== null && cachedResult !== undefined) {
        console.log("✅ Using cached result:", cachedResult);
        return cachedResult;
    }

    const somme = a + b;
    console.log("💾 Writing to cache: ", somme);
    const w = await cache.write(opId, somme, { ttl: 3600 }); // Set 1 hour TTL
    console.log("💾 Written to cache: ", w);

    return somme;
}

async function runTests() {
    console.log("🚀 Starting cache tests...");

    // First call - should write to cache
    console.log("\n📝 First call (should write to cache):");
    const result1 = await testCache(1, 2);
    console.log("Result 1:", result1);

    // Second call - should read from cache
    console.log("\n📖 Second call (should read from cache):");
    const result2 = await testCache(1, 2);
    console.log("Result 2:", result2);

    // Third call with different values - should write to cache
    console.log(
        "\n📝 Third call with different values (should write to cache):"
    );
    const result3 = await testCache(5, 10);
    console.log("Result 3:", result3);

    // Fourth call with same values as third - should read from cache
    console.log("\n📖 Fourth call with same values (should read from cache):");
    const result4 = await testCache(5, 10);
    console.log("Result 4:", result4);

    console.log("\n✅ Cache tests completed!");
}

if (require.main === module) {
    runTests().catch(console.error);
}

// Ensure cache is connected