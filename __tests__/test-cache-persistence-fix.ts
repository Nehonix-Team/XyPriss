/**
 * Simple test to verify the cache persistence bug fix
 * Run with: bun run __tests__/test-cache-persistence-fix.ts
 */

import { SCC } from "xypriss-security";

console.log("🧪 Testing Cache Persistence Fix\n");
console.log("=" .repeat(50));

// Test 1: Sequential Write/Read Operations
async function test1() {
    console.log("\n📝 Test 1: Sequential Write/Read Operations");
    console.log("-".repeat(50));
    
    const cache = new SCC({
        strategy: "memory",
        memory: {
            maxSize: 100,
            maxEntries: 10000,
        },
    });

    await cache.connect();

    // Write data
    await cache.write("test_key", ["message1"], { ttl: 3600 });
    console.log("✅ Written 1 message");

    // Read data immediately
    const data = await cache.read<string[]>("test_key");
    console.log(`📖 Read back: ${data?.length || 0} messages`);

    if (data && data.length === 1 && data[0] === "message1") {
        console.log("✅ Test 1 PASSED: Data persisted correctly");
    } else {
        console.log("❌ Test 1 FAILED: Data not found or incorrect");
        console.log("   Expected: ['message1']");
        console.log("   Got:", data);
    }

    await cache.disconnect();
}

// Test 2: Accumulation Test
async function test2() {
    console.log("\n📝 Test 2: Accumulation Test");
    console.log("-".repeat(50));
    
    const cache = new SCC({
        strategy: "memory",
        memory: {
            maxSize: 100,
            maxEntries: 10000,
        },
    });

    await cache.connect();

    // Message 1
    await cache.write("session_123", [{ role: "user", content: "Hello" }]);
    let messages = await cache.read<any[]>("session_123");
    console.log(`📊 Messages after first write: ${messages?.length || 0}`);

    // Message 2 - accumulate
    const existing = await cache.read<any[]>("session_123");
    if (existing) {
        await cache.write("session_123", [
            ...existing,
            { role: "assistant", content: "Hi" },
        ]);
    }
    messages = await cache.read<any[]>("session_123");
    console.log(`📊 Messages after second write: ${messages?.length || 0}`);

    if (messages && messages.length === 2) {
        console.log("✅ Test 2 PASSED: Data accumulated correctly");
    } else {
        console.log("❌ Test 2 FAILED: Data accumulation failed");
        console.log("   Expected: 2 messages");
        console.log("   Got:", messages?.length || 0, "messages");
    }

    await cache.disconnect();
}

// Test 3: Cross-Instance Persistence (The Main Bug)
async function test3() {
    console.log("\n📝 Test 3: Cross-Instance Persistence (Singleton Pattern)");
    console.log("-".repeat(50));
    
    // Create first instance and write data
    const cache1 = new SCC({
        strategy: "memory",
        memory: {
            maxSize: 100,
        },
    });

    await cache1.connect();
    await cache1.write("shared_key", "shared_data");
    console.log("✅ Cache1 wrote: 'shared_data'");

    // Create second instance and read data
    const cache2 = new SCC({
        strategy: "memory",
        memory: {
            maxSize: 100,
        },
    });

    await cache2.connect();
    const result = await cache2.read<string>("shared_key");
    console.log(`📖 Cache2 read: '${result}'`);

    if (result === "shared_data") {
        console.log("✅ Test 3 PASSED: Data shared across instances (Singleton works!)");
    } else {
        console.log("❌ Test 3 FAILED: Data NOT shared across instances");
        console.log("   Expected: 'shared_data'");
        console.log("   Got:", result);
    }

    await cache1.disconnect();
    await cache2.disconnect();
}

// Test 4: Real-World Chat Scenario
async function test4() {
    console.log("\n📝 Test 4: Real-World Chat Scenario");
    console.log("-".repeat(50));
    
    const cache = new SCC({
        strategy: "memory",
        memory: {
            maxSize: 100,
            maxEntries: 10000,
        },
    });

    await cache.connect();

    const sessionId = "session_xyz";

    // Request 1: User says "je m'appelle Eleazar"
    await cache.write(sessionId, [
        { role: "user", content: "je m'appelle Eleazar" },
    ]);
    console.log("🔑 Added user message");

    // Add assistant response
    const existing1 = await cache.read<any[]>(sessionId);
    if (existing1) {
        await cache.write(sessionId, [
            ...existing1,
            { role: "assistant", content: "Enchanté Eleazar!" },
        ]);
    }
    console.log("🔑 Added assistant message");

    // Request 2: User asks "comment je m'appelle?"
    const history = await cache.read<any[]>(sessionId);
    console.log(`📦 History length: ${history?.length || 0}`);

    if (history && history.length === 2) {
        console.log("✅ Test 4 PASSED: Chat history preserved");
        console.log(`   Message 1: ${history[0].content}`);
        console.log(`   Message 2: ${history[1].content}`);
    } else {
        console.log("❌ Test 4 FAILED: Chat history lost");
        console.log("   Expected: 2 messages");
        console.log("   Got:", history?.length || 0, "messages");
    }

    await cache.disconnect();
}

// Run all tests
async function runTests() {
    try {
        await test1();
        await test2();
        await test3();
        await test4();
        
        console.log("\n" + "=".repeat(50));
        console.log("🎉 All tests completed!");
        console.log("=".repeat(50) + "\n");
    } catch (error) {
        console.error("\n❌ Test execution failed:", error);
        process.exit(1);
    }
}

runTests();
