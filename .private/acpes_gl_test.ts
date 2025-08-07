import { ACPES, Storage, KeyRotationManager } from "../mods/ACPES/src";

const STORAGE_KEYS = {
    SESSION_TOKEN: "session_token",
};
const data = `
    "Hello world from XyPriss! I'm testing the new ACPES module with advanced encryption and biometric authentication. This is a long string to test the compression and encryption with large data."
    lorem ipsum dolor sit amet, consectetur adipiscing elit. Sed do eiusmod tempor incididunt ut labore et dolore magna aliqua. Ut enim ad minim veniam, quis nostrud exercitation ullamco laboris nisi ut aliquip ex ea commodo consequat. Duis aute irure dolor in reprehenderit in voluptate velit esse cillum dolore eu fugiat nulla pariatur. Excepteur sint occaecat cupidatat non proident, sunt in culpa qui officia deserunt mollit anim id est laborum.
`;
// Store sensitive data
const store = await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, data, {
    expiresIn: 20,
    requireAuth: true,
    advancedEncryption: true,
    service: "XyPriss.test",
});

console.log("Stored token: ", store);

// Retrieve data immediately (should work)
const token = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);
console.log("Retrieved token immediately: ", token);

// Wait for expiration (1 second + buffer)
console.log("Waiting for TTL expiration...");
await new Promise((resolve) => setTimeout(resolve, 2100));

// Try to retrieve after expiration (should return null)
const expiredToken = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);
console.log("Retrieved token after expiration: ", expiredToken);

// Store with TTL (expires in 1 hour)
await Storage.setItemWithTTL("temp-data", "value", 10000);

// Check platform capabilities
const info = Storage.getPlatformInfo();
console.log(`Platform: ${info.platform}, Has Keychain: ${info.hasKeychain}`);

