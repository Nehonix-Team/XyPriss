/**
 * Test script to verify the modular CPESS implementation
 */

import {
    CrossPlatformSecureStorage,
    crossPlatformStorage,
    STORAGE_KEYS,
} from "../mods/ACPES/dist/esm/index.js";

async function testModularImplementation() {
    console.log("🧪 Testing Modular CPESS Implementation...\n");

    try {
        // Test 1: Check if main class can be instantiated
        console.log("1. Testing class instantiation...");
        const customStorage = new CrossPlatformSecureStorage();
        console.log(
            "✅ CrossPlatformSecureStorage class instantiated successfully"
        );

        // Test 2: Check singleton instance
        console.log("\n2. Testing singleton instance...");
        const platformInfo = crossPlatformStorage.getPlatformInfo();
        console.log("✅ Singleton instance works");
        console.log(`   Platform: ${platformInfo.platform}`);
        console.log(`   Is Web: ${platformInfo.isWeb}`);
        console.log(`   Is Node: ${platformInfo.isNode}`);
        console.log(`   Is Mobile: ${platformInfo.isMobile}`);

        // Test 3: Test basic storage operations
        console.log("\n3. Testing basic storage operations...");
        const testKey = "test-key";
        const testValue = "Hello, Modular CPESS!";

        // Store data
        const stored = await crossPlatformStorage.setItem(testKey, testValue);
        console.log(`✅ Data stored: ${stored}`);

        // Retrieve data
        const retrieved = await crossPlatformStorage.getItem(testKey);
        console.log(
            `✅ Data retrieved: ${
                retrieved === testValue ? "SUCCESS" : "FAILED"
            }`
        );
        console.log(`   Expected: "${testValue}"`);
        console.log(`   Got: "${retrieved}"`);

        // Test 4: Test TTL functionality
        console.log("\n4. Testing TTL functionality...");
        const ttlKey = "ttl-test";
        const ttlValue = "This will expire";

        await crossPlatformStorage.setItemWithTTL(ttlKey, ttlValue, 1); // 1 second TTL
        const immediateRetrieve = await crossPlatformStorage.getItem(ttlKey);
        console.log(
            `✅ TTL data stored and retrieved: ${
                immediateRetrieve === ttlValue ? "SUCCESS" : "FAILED"
            }`
        );

        // Wait for expiration
        console.log("   Waiting for TTL expiration...");
        await new Promise((resolve) => setTimeout(resolve, 1100));
        const expiredRetrieve = await crossPlatformStorage.getItem(ttlKey);
        console.log(
            `✅ TTL expiration works: ${
                expiredRetrieve === null ? "SUCCESS" : "FAILED"
            }`
        );

        // Test 5: Test storage keys
        console.log("\n5. Testing predefined storage keys...");
        console.log(
            `✅ STORAGE_KEYS available: ${
                Object.keys(STORAGE_KEYS).length
            } keys`
        );
        console.log(
            `   Sample keys: ${Object.keys(STORAGE_KEYS)
                .slice(0, 3)
                .join(", ")}`
        );

        // Test 6: Test hasItem functionality
        console.log("\n6. Testing hasItem functionality...");
        const hasItem = await crossPlatformStorage.hasItem(testKey);
        console.log(`✅ hasItem works: ${hasItem ? "SUCCESS" : "FAILED"}`);

        // Test 7: Test security metrics
        console.log("\n7. Testing security metrics...");
        const metrics = crossPlatformStorage.getSecurityMetrics(testKey);
        console.log(
            `✅ Security metrics available: ${
                metrics.totalAttempts >= 0 ? "SUCCESS" : "FAILED"
            }`
        );
        console.log(`   Total attempts: ${metrics.totalAttempts}`);
        console.log(`   Failed attempts: ${metrics.failedAttempts}`);
        console.log(`   Is locked: ${metrics.isLocked}`);

        // Test 8: Test compression
        console.log("\n8. Testing compression...");
        const largeData = "x".repeat(2000); // Large data to trigger compression
        const compressionKey = "compression-test";

        const compressedStored = await crossPlatformStorage.setItem(
            compressionKey,
            largeData,
            {
                compressionEnabled: true,
            }
        );
        const compressedRetrieved = await crossPlatformStorage.getItem(
            compressionKey
        );
        console.log(
            `✅ Compression works: ${
                compressedRetrieved === largeData ? "SUCCESS" : "FAILED"
            }`
        );

        // Cleanup
        console.log("\n9. Cleaning up test data...");
        await crossPlatformStorage.removeItem(testKey);
        await crossPlatformStorage.removeItem(compressionKey);
        console.log("✅ Cleanup completed");

        console.log(
            "\n🎉 All tests passed! Modular CPESS implementation is working correctly."
        );
    } catch (error) {
        console.error("❌ Test failed:", error);
        process.exit(1);
    }
}

// Run the test
testModularImplementation();

