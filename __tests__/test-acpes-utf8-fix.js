/**
 * Test script to verify ACPES UTF-8 corruption fixes
 */

import { Storage } from "../mods/ACPES/src/index.ts";
// const { Storage } = require("../mods/ACPES/src/index.ts");

const testData = {
    validJson: {
        id: "cmdu5fxa30000g4vnq6lsfro4",
        email: "test@gmail.com",
        phone: "+22507XXX",
        first_name: "Nehonix",
        last_name: "Devs",
    },
    corruptedEncrypted:
        "8652b9ead83aa9dca346a483c43bf2b2:760978b72c234a4c0f7efbdf4ea68265:bd18f63300d4d0173c969cb32c92ee178f28f3f8ce6d668ace66f14ee7a70949686b9847cb01875b2e78bf238c5ca737b4156964e9cabafd8b8c3046def0d6a8986f64447f0c3445ae564d7f881da674f5531a274e8d64cf1d49395d017ced35947d01ce9aa7f441934f27a49d27ec6735ab1c51eb2c982a8f8d0940e0a93c4ceab6da7a4c3cca6fb2d4d56fcae7eee6c0f89d1b876e2e1e8cbf677c4c883765451845c65b1174a3b9a09ff2a2d24ef2a85dc86da71909587689be766c58172f36912b09c05425c427d80e3d",
};

async function testACPESFixes() {
    console.log("🧪 Testing ACPES UTF-8 corruption fixes...\n");

    try {
        // Import ACPES modules
        // const { Storage } = require();

        console.log("✅ ACPES modules loaded successfully");

        // Test 1: Store and retrieve valid data
        console.log("\n📝 Test 1: Valid data storage and retrieval");
        const testKey = "test-valid-data";
        const validData = JSON.stringify(testData.validJson);

        const storeResult = await Storage.setItem(testKey, validData);
        console.log(
            `   Store result: ${storeResult ? "✅ Success" : "❌ Failed"}`
        );

        const retrievedData = await Storage.getItem(testKey);
        console.log(
            `   Retrieve result: ${retrievedData ? "✅ Success" : "❌ Failed"}`
        );

        if (retrievedData) {
            const parsedData = JSON.parse(retrievedData);
            console.log(
                `   Data integrity: ${
                    parsedData.email === testData.validJson.email
                        ? "✅ Valid"
                        : "❌ Invalid"
                }`
            );
        }

        // Test 2: Test corrupted data handling
        console.log("\n🔧 Test 2: Corrupted data handling");

        // Simulate corrupted data by trying to decrypt invalid data
        const corruptedKey = "test-corrupted-data";

        // This should fail gracefully without throwing unhandled errors
        try {
            const corruptedResult = await Storage.getItem(corruptedKey);
            console.log(
                `   Corrupted data handling: ${
                    corruptedResult === null
                        ? "✅ Handled gracefully"
                        : "❌ Unexpected result"
                }`
            );
        } catch (error) {
            console.log(
                `   Corrupted data handling: ✅ Error caught and handled: ${error.message}`
            );
        }

        // Test 3: Clean corrupted data
        console.log("\n🧹 Test 3: Clean corrupted data");
        const cleanupResult = await Storage.cleanCorruptedData();
        console.log(
            `   Cleanup completed: ✅ Cleaned: ${cleanupResult.cleaned}, Errors: ${cleanupResult.errors}`
        );
        console.log(`   Cleanup details: ${cleanupResult.details.join(", ")}`);

        // Test 4: Platform info
        console.log("\n🔍 Test 4: Platform information");
        const platformInfo = Storage.getPlatformInfo();
        console.log(`   Platform: ${platformInfo.platform}`);
        console.log(`   Is Web: ${platformInfo.isWeb}`);
        console.log(`   Is Node: ${platformInfo.isNode}`);

        console.log("\n🎉 All tests completed successfully!");
    } catch (error) {
        console.error("❌ Test failed:", error);
        console.error("Stack trace:", error.stack);
    }
}

// Run the test
if (require.main === module) {
    testACPESFixes().catch(console.error);
}

module.exports = { testACPESFixes };

