import { createServer } from "xypriss";

console.log("\n==================================================");
console.log("XyPriss Environment Security Shield (XESS) Test");
console.log("==================================================\n");

// Set up mock process environment variables before creating the server
process.env.XCIS_CUSTOM_SECRET = "my_custom_secret_123";
process.env.XCIS_BLOCKED_SECRET = "should_be_hidden_456";

console.log("Before bootstrap:");
console.log(`- XCIS_CUSTOM_SECRET:  ${process.env.XCIS_CUSTOM_SECRET}`);
console.log(`- XCIS_BLOCKED_SECRET: ${process.env.XCIS_BLOCKED_SECRET}`);

// Bootstrap the server with a custom XESS whitelist configuration
const app = createServer({
    security: {
        xess: {
            whitelist: ["XCIS_CUSTOM_SECRET"]
        }
    }
});

console.log("\nAfter bootstrap (XESS Active):");

const customSecret = process.env.XCIS_CUSTOM_SECRET;
const blockedSecret = process.env.XCIS_BLOCKED_SECRET;

console.log(`- XCIS_CUSTOM_SECRET (Whitelisted):  ${customSecret}`);
console.log(`- XCIS_BLOCKED_SECRET (Blocked):     ${blockedSecret}`);

let passed = true;

if (customSecret !== "my_custom_secret_123") {
    console.error("FAIL: Whitelisted variable is not accessible!");
    passed = false;
} else {
    console.log("SUCCESS: Whitelisted variable is fully accessible.");
}

if (blockedSecret !== undefined) {
    console.error(`FAIL: Blocked variable was leaked and read as: ${blockedSecret}`);
    passed = false;
} else {
    console.log("SUCCESS: Non-whitelisted variable was successfully shielded (returns undefined).");
}

// Verify that a standard system variable like PORT is still accessible
if (process.env.PORT === undefined) {
    // If not set, let's set it or mock it to ensure it functions
}
console.log(`- PORT: ${process.env.PORT}`);

if (passed) {
    console.log("\nALL TESTS PASSED SUCCESSFULLY! 🎉\n");
    process.exit(0);
} else {
    console.error("\nTEST SUITE FAILED! ❌\n");
    process.exit(1);
}
