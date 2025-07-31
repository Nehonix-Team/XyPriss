// Simplified cache testing with the new memoize method

import { Hash } from "../../core";
import { cache } from "../redis_cache_test";

// Create a memoized math function
const memoizedSum = cache.memoize(
    // Key generator: creates consistent hash from parameters
    (a: number, b: number) => Hash.create(String(a + b)).toString("hex"),
    // Compute function: the actual logic to execute
    (a: number, b: number): number => {
        console.log(`🧮 Computing ${a} + ${b}`);
        return a + b;
    },
    // Cache options
    { ttl: 3600, tags: ["math", "operations"] }
);

// Create a memoized async function
const memoizedAsyncOperation = cache.memoize(
    // Key generator
    (input: string) => `async:${Hash.create(input).toString("hex")}`,
    // Async compute function
    async (input: string): Promise<string> => {
        console.log(`⏳ Processing async operation for: ${input}`);
        // Simulate async work
        await new Promise((resolve) => setTimeout(resolve, 100));
        return input.toUpperCase();
    },
    // Cache options
    { ttl: 1800, tags: ["async", "processing"] }
);

// Create a memoized complex object function
interface User {
    id: number;
    name: string;
    email: string;
}

const memoizedUserLookup = cache.memoize(
    // Key generator
    (userId: number) => `user:${userId}`,
    // Compute function returning complex object
    (userId: number): User => {
        console.log(`👤 Looking up user ${userId}`);
        return {
            id: userId,
            name: `User ${userId}`,
            email: `user${userId}@example.com`,
        };
    },
    // Cache options
    { ttl: 7200, tags: ["users", "lookup"] }
);

async function runSimplifiedTests() {
    console.log("🚀 Starting memoization tests...\n");

    // Test 1: Simple math function
    console.log("📊 Test 1: Memoized Math Function");
    console.log("First call (should compute):");
    const result1 = await memoizedSum(5, 10);
    console.log(`Result: ${result1}\n`);

    console.log("Second call (should use cache):");
    const result2 = await memoizedSum(5, 10);
    console.log(`Result: ${result2}\n`);

    // Test 2: Async function
    console.log("⚡ Test 2: Memoized Async Function");
    console.log("First call (should compute):");
    const asyncResult1 = await memoizedAsyncOperation("hello world");
    console.log(`Result: ${asyncResult1}\n`);

    console.log("Second call (should use cache):");
    const asyncResult2 = await memoizedAsyncOperation("hello world");
    console.log(`Result: ${asyncResult2}\n`);

    // Test 3: Complex object function
    console.log("👥 Test 3: Memoized User Lookup");
    console.log("First call (should compute):");
    const user1 = await memoizedUserLookup(123);
    console.log(`User: ${JSON.stringify(user1)}\n`);

    console.log("Second call (should use cache):");
    const user2 = await memoizedUserLookup(123);
    console.log(`User: ${JSON.stringify(user2)}\n`);

    // Test 4: Different parameters
    console.log("🔄 Test 4: Different Parameters");
    console.log("Different math operation:");
    const result3 = await memoizedSum(20, 30);
    console.log(`Result: ${result3}\n`);

    console.log("Different user lookup:");
    const user3 = await memoizedUserLookup(456);
    console.log(`User: ${JSON.stringify(user3)}\n`);

    // Test 5: Cache statistics
    console.log("📈 Test 5: Cache Statistics");
    const stats = await cache.getStats();
    console.log(`Memory hit rate: ${(stats.memory.hitRate * 100).toFixed(2)}%`);
    console.log(`Total operations: ${stats.operations.total}`);

    console.log("\n✅ Memoization tests completed!");
}

if (require.main === module) {
    runSimplifiedTests().catch(console.error);
}

export { memoizedSum, memoizedAsyncOperation, memoizedUserLookup };

