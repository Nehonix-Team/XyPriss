// Test local import to verify the module works
const { createRequire } = require("module");
const require = createRequire(import.meta.url);

console.log("🔍 Testing local XyPrissSecurity import...");

try {
    // Test importing from local dist
    console.log("1. Testing local CJS import...");
    const xypriss = require("../../dist/cjs/index.js");
    console.log("✅ Local CJS import successful");
    console.log("Available exports:", Object.keys(xypriss).slice(0, 10), "...");

    // Test creating a secure object
    console.log("\n2. Testing createSecureObject...");
    if (xypriss.createSecureObject) {
        const obj = xypriss.createSecureObject({ test: "data" });
        console.log("✅ createSecureObject works:", obj.toString());
    } else {
        console.log("❌ createSecureObject not found");
    }

    console.log("\n🎉 Local import test completed successfully!");
} catch (error) {
    console.error("❌ Local import test failed:", error.message);
    console.error("Stack:", error.stack);
}

