// Test script to verify module resolution works correctly
// This simulates how users would import the package

import { existsSync } from "fs";

console.log("🧪 Testing XyPriss module resolution...\n");

try {
    // Test 1: Check if the main export paths exist
    console.log("1. Checking export file paths...");

    const paths = [
        "./dist/esm/index.js",
        "./dist/cjs/index.js",
        "./dist/index.d.ts",
    ];

    for (const path of paths) {
        if (existsSync(path)) {
            console.log(`   ✅ ${path} exists`);
        } else {
            console.log(`   ❌ ${path} missing`);
        }
    }

    // Test 2: Try to import the main module
    console.log("\n2. Testing ESM import...");

    try {
        const xypriss = await import("../dist/esm/index.js");
        console.log(`   ✅ ESM import successful`);
        console.log(
            `   📦 Available exports: ${Object.keys(xypriss)
                .slice(0, 5)
                .join(", ")}...`
        );
    } catch (error) {
        console.log(`   ❌ ESM import failed: ${error.message}`);
    }

    // Test 3: Check CommonJS compatibility
    console.log("\n3. Testing CommonJS compatibility...");

    try {
        const { createRequire } = await import("module");
        const require = createRequire(import.meta.url);
        const xypriss = require("../dist/cjs/index.js");
        console.log(`   ✅ CommonJS import successful`);
        console.log(
            `   📦 Available exports: ${Object.keys(xypriss)
                .slice(0, 5)
                .join(", ")}...`
        );
    } catch (error) {
        console.log(`   ❌ CommonJS import failed: ${error.message}`);
    }

    console.log("\n🎉 Module resolution test completed!");
} catch (error) {
    console.error("❌ Test failed:", error.message);
    process.exit(1);
}

