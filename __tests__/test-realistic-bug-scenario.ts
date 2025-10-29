/**
 * Realistic test simulating the actual bug scenario from the bug report
 * This simulates importing the same cache instance from a utils file
 * Run with: bun run __tests__/test-realistic-bug-scenario.ts
 */

import { cache } from "./utils/cache";

console.log("🧪 Testing Realistic Bug Scenario (Shared Cache Import)\n");
console.log("=".repeat(50));

// Simulate Request 1: User says "je m'appelle Eleazar"
async function request1() {
    console.log("\n📝 Request 1: User sends first message");
    console.log("-".repeat(50));
    
    const sessionId = "session_abc123";
    
    // Add user message
    await cache.write(sessionId, [
        { role: "user", content: "je m'appelle Eleazar" },
    ]);
    console.log("🔑 Added user message");
    
    // Read back to verify
    const messages = await cache.read<any[]>(sessionId);
    console.log(`📊 Messages in cache: ${messages?.length || 0}`);
    
    if (messages && messages.length === 1) {
        console.log("✅ Request 1: Message stored successfully");
    } else {
        console.log("❌ Request 1: Failed to store message");
    }
    
    // Add assistant response
    const existing = await cache.read<any[]>(sessionId);
    if (existing) {
        await cache.write(sessionId, [
            ...existing,
            { role: "assistant", content: "Enchanté Eleazar!" },
        ]);
    }
    console.log("🔑 Added assistant response");
    
    const finalMessages = await cache.read<any[]>(sessionId);
    console.log(`📊 Total messages after response: ${finalMessages?.length || 0}`);
}

// Simulate Request 2: User asks "comment je m'appelle?"
async function request2() {
    console.log("\n📝 Request 2: User sends second message (NEW REQUEST)");
    console.log("-".repeat(50));
    
    const sessionId = "session_abc123";
    
    // This is the critical test - can we retrieve the history from Request 1?
    const history = await cache.read<any[]>(sessionId);
    console.log(`📦 Retrieved history: ${history?.length || 0} messages`);
    
    if (history && history.length === 2) {
        console.log("✅ SUCCESS: Chat history preserved across requests!");
        console.log(`   Message 1: ${history[0].content}`);
        console.log(`   Message 2: ${history[1].content}`);
        
        // Add new user message
        await cache.write(sessionId, [
            ...history,
            { role: "user", content: "comment je m'appelle?" },
        ]);
        
        const updatedHistory = await cache.read<any[]>(sessionId);
        console.log(`📊 Updated history: ${updatedHistory?.length || 0} messages`);
        
    } else {
        console.log("❌ FAILED: Chat history lost between requests!");
        console.log("   Expected: 2 messages");
        console.log("   Got:", history?.length || 0, "messages");
        console.log("\n   This is the BUG reported in BUG-REPORT-Xypriss-Cache-Memory-Mode.md");
    }
}

// Run the simulation
async function runSimulation() {
    try {
        await request1();
        
        // Simulate some time passing between requests
        await new Promise(resolve => setTimeout(resolve, 100));
        
        await request2();
        
        console.log("\n" + "=".repeat(50));
        console.log("🎉 Simulation completed!");
        console.log("=".repeat(50) + "\n");
    } catch (error) {
        console.error("\n❌ Simulation failed:", error);
        process.exit(1);
    }
}

runSimulation();
