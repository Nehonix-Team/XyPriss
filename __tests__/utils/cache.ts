/**
 * Simulated cache utility - like in the bug report
 */
import { SCC } from "xypriss-security";

export const cache = new SCC({
    strategy: "memory",
    memory: {
        maxSize: 100,
        maxEntries: 10000,
    },
});

// Auto-connect
cache.connect();
