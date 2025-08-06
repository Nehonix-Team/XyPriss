/**
 * Debug test to isolate the URI malformed error
 */

import { crossPlatformStorage } from "../mods/ACPES/dist/esm/index.js";

async function debugTest() {
    console.log("🔍 Debug Test - Isolating URI malformed error...\n");

    try {
        // Test 1: Simple string without compression
        console.log("1. Testing simple string without compression...");
        const simpleKey = "simple-test";
        const simpleValue = "Hello World";

        const simpleStored = await crossPlatformStorage.setItem(
            simpleKey,
            simpleValue
        );
        console.log(`Simple storage result: ${simpleStored}`);

        if (simpleStored) {
            const simpleRetrieved = await crossPlatformStorage.getItem(
                simpleKey
            );
            console.log(
                `Simple retrieval: ${
                    simpleRetrieved === simpleValue ? "SUCCESS" : "FAILED"
                }`
            );
        }

        // Test 2: Large string without compression
        console.log("\n2. Testing large string without compression...");
        const largeKey = "large-test";
        const largeValue = "x".repeat(2000);

        const largeStored = await crossPlatformStorage.setItem(
            largeKey,
            largeValue
        );
        console.log(`Large storage result: ${largeStored}`);

        // Test 3: Large string with compression (this should fail)
        console.log("\n3. Testing large string with compression...");
        const compressedKey = "compressed-test";
        const compressedValue = "x".repeat(2000);

        try {
            const compressedStored = await crossPlatformStorage.setItem(
                compressedKey,
                compressedValue,
                {
                    compressionEnabled: true,
                }
            );
            console.log(`Compressed storage result: ${compressedStored}`);
        } catch (error) {
            console.error("Compression error:", error.message);
        }

        // Test 4: Check platform info
        console.log("\n4. Platform info:");
        const platformInfo = crossPlatformStorage.getPlatformInfo();
        console.log(`Platform: ${platformInfo.platform}`);
        console.log(`Has file system: ${platformInfo.hasFileSystem}`);
    } catch (error) {
        console.error("❌ Debug test failed:", error);
    }
}

debugTest();

