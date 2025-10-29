/**
 * Test to verify the cache persistence bug fix
 * 
 * This test verifies that the memory cache persists data between
 * different SCC instances, fixing the bug reported in:
 * private/BUG-REPORT-Xypriss-Cache-Memory-Mode.md
 */

import { SCC } from "../mods/security/src/components/cache/SCC";

describe("Cache Persistence Fix - Memory Mode", () => {
    it("should persist data between sequential write/read operations", async () => {
        const cache = new SCC({
            provider: "memory",
            config: {
                memory: {
                    maxSize: 100,
                    ttl: 3600,
                },
            },
        });

        await cache.connect();

        // Test 1: Write data
        await cache.write("test_key", ["message1"], { ttl: 3600 });
        console.log("✅ Written 1 message");

        // Test 2: Read data immediately
        const data = await cache.read<string[]>("test_key");
        console.log("📖 Read back:", data?.length || 0, "messages");

        expect(data).not.toBeNull();
        expect(data).toHaveLength(1);
        expect(data![0]).toBe("message1");

        await cache.disconnect();
    });

    it("should accumulate data across multiple writes", async () => {
        const cache = new SCC({
            provider: "memory",
            config: {
                memory: {
                    maxSize: 100,
                    ttl: 3600,
                },
            },
        });

        await cache.connect();

        // Message 1
        await cache.write("session_123", [{ role: "user", content: "Hello" }]);
        let messages = await cache.read<any[]>("session_123");
        console.log("Messages after first write:", messages?.length);
        expect(messages).toHaveLength(1);

        // Message 2 - accumulate
        const existing = await cache.read<any[]>("session_123");
        await cache.write("session_123", [
            ...existing!,
            { role: "assistant", content: "Hi" },
        ]);
        messages = await cache.read<any[]>("session_123");
        console.log("Messages after second write:", messages?.length);
        expect(messages).toHaveLength(2);

        await cache.disconnect();
    });

    it("should share data across different SCC instances (singleton pattern)", async () => {
        // Create first instance and write data
        const cache1 = new SCC({
            provider: "memory",
            config: {
                memory: {
                    maxSize: 100,
                    ttl: 3600,
                },
            },
        });

        await cache1.connect();
        await cache1.write("shared_key", "shared_data");
        console.log("✅ Cache1 wrote data");

        // Create second instance and read data
        const cache2 = new SCC({
            provider: "memory",
            config: {
                memory: {
                    maxSize: 100,
                    ttl: 3600,
                },
            },
        });

        await cache2.connect();
        const result = await cache2.read<string>("shared_key");
        console.log("📖 Cache2 read:", result);

        expect(result).toBe("shared_data");

        await cache1.disconnect();
        await cache2.disconnect();
    });

    it("should handle real-world chat scenario", async () => {
        const cache = new SCC({
            provider: "memory",
            config: {
                memory: {
                    maxSize: 100,
                    ttl: 3600,
                },
            },
        });

        await cache.connect();

        const sessionId = "session_xyz";

        // Request 1: User says "je m'appelle Eleazar"
        await cache.write(sessionId, [
            { role: "user", content: "je m'appelle Eleazar" },
        ]);
        console.log("🔑 Added user message");

        // Add assistant response
        const existing1 = await cache.read<any[]>(sessionId);
        await cache.write(sessionId, [
            ...existing1!,
            { role: "assistant", content: "Enchanté Eleazar!" },
        ]);
        console.log("🔑 Added assistant message");

        // Request 2: User asks "comment je m'appelle?"
        const history = await cache.read<any[]>(sessionId);
        console.log("📦 History length:", history?.length);

        expect(history).not.toBeNull();
        expect(history).toHaveLength(2);
        expect(history![0].content).toBe("je m'appelle Eleazar");
        expect(history![1].content).toBe("Enchanté Eleazar!");

        await cache.disconnect();
    });
});
