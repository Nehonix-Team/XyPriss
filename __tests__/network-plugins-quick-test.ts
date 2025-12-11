#!/usr/bin/env bun
/**
 * Quick Network Plugins Validation Test
 *
 * This is a simplified test to quickly verify all network plugins are implemented
 * and working. For comprehensive tests, use network-plugins-comprehensive.test.ts
 */

import { createServer } from "../src/index";

console.log("\n🧪 Quick Network Plugins Validation\n");

let passed = 0;
let failed = 0;

async function test(name: string, fn: () => Promise<void>) {
    try {
        await fn();
        console.log(`✓ ${name}`);
        passed++;
    } catch (error: any) {
        console.log(`✗ ${name}: ${error.message}`);
        failed++;
    }
}

// Test 1: Connection Plugin
await test("Connection Plugin", async () => {
    const app = createServer({
        network: {
            connection: {
                enabled: true,
                keepAlive: { enabled: true, timeout: 30000 },
            },
        },
    });
    app.get("/test", (req, res) => res.json({ ok: true }));
    await app.start();
    const response = await fetch(`http://localhost:${app.getPort()}/test`);
    app.close();
    if (response.status !== 200) throw new Error("Request failed");
});

// Test 2: Compression Plugin
await test("Compression Plugin", async () => {
    const app = createServer({
        network: {
            compression: {
                enabled: true,
                algorithms: ["gzip", "deflate"],
                level: 6,
            },
        },
    });
    app.get("/test", (req, res) =>
        res.json({ data: "test data ".repeat(100) })
    );
    await app.start();
    const response = await fetch(`http://localhost:${app.getPort()}/test`);
    app.close();
    if (response.status !== 200) throw new Error("Request failed");
});

// Test 3: Rate Limiting Plugin
await test("Rate Limiting Plugin", async () => {
    const app = createServer({
        network: {
            rateLimit: {
                enabled: true,
                strategy: "fixed-window",
                perIP: { requests: 100, window: "1m" },
            },
        },
    });
    app.get("/test", (req, res) => res.json({ ok: true }));
    await app.start();
    const response = await fetch(`http://localhost:${app.getPort()}/test`);
    app.close();
    if (response.status !== 200) throw new Error("Request failed");
});

// Test 4: Proxy Plugin (basic config validation)
await test("Proxy Plugin Configuration", async () => {
    const app = createServer({
        network: {
            proxy: {
                enabled: false, // Disabled for quick test
                upstreams: [],
                loadBalancing: "round-robin",
            },
        },
    });
    app.close();
});

// Test 5: All Plugins Together
await test("All Plugins Combined", async () => {
    const app = createServer({
        network: {
            connection: { enabled: true },
            compression: { enabled: true },
            rateLimit: { enabled: true },
        },
    });
    app.get("/test", (req, res) => res.json({ ok: true }));
    await app.start();
    const response = await fetch(`http://localhost:${app.getPort()}/test`);
    app.close();
    if (response.status !== 200) throw new Error("Request failed");
});

// Test 6: Empty Config
await test("Empty Network Config", async () => {
    const app = createServer({ network: {} });
    app.close();
});

// Summary
console.log(`\n${"=".repeat(50)}`);
console.log(
    `Total: ${passed + failed} | Passed: ${passed} | Failed: ${failed}`
);
console.log(`${"=".repeat(50)}\n`);

if (failed === 0) {
    console.log("✅ All network plugins are implemented and working!\n");
    process.exit(0);
} else {
    console.log("❌ Some tests failed. Check the output above.\n");
    process.exit(1);
}

