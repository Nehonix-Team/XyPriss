// Test CrossPlatformMemory CLI path resolution
import { CrossPlatformMemory } from "../src/cluster/modules/CrossPlatformMemory.ts";

console.log("🔍 Testing CrossPlatformMemory CLI...");

async function testMemoryCli() {
    const memory = new CrossPlatformMemory(true);

    console.log("CLI Path:", memory.getCliPath());
    console.log("CLI Available:", memory.isCliAvailable());

    const testResult = await memory.testCli();
    console.log("Test Result:", testResult);

    if (testResult.success && testResult.data) {
        console.log("Memory Summary:", await memory.getMemorySummary());
    }
}

testMemoryCli().catch(console.error);

