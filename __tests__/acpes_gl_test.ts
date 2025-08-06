import { ACPES, Storage, KeyRotationManager } from "../mods/ACPES/src";

const STORAGE_KEYS = {
    SESSION_TOKEN: "session_token",
};
// Store sensitive data
const store = await Storage.setItem(STORAGE_KEYS.SESSION_TOKEN, "Hello world", {
    expiresIn: 1,
    requireAuth: true,
    service: "XyPriss.test",
});

console.log("Stored token: ", store);

// Retrieve data immediately (should work)
const token = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);
console.log("Retrieved token immediately: ", token);

// Wait for expiration (1 second + buffer)
console.log("Waiting for TTL expiration...");
await new Promise((resolve) => setTimeout(resolve, 1100));

// Try to retrieve after expiration (should return null)
const expiredToken = await Storage.getItem(STORAGE_KEYS.SESSION_TOKEN);
console.log("Retrieved token after expiration: ", expiredToken);

// Store with TTL (expires in 1 hour)
await Storage.setItemWithTTL("temp-data", "value", 10000);

// Check platform capabilities
const info = Storage.getPlatformInfo();
console.log(`Platform: ${info.platform}, Has Keychain: ${info.hasKeychain}`);

