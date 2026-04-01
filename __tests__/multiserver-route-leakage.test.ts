/**
 * XyPriss MultiServer Route Leakage Reproduction Test
 */

import { createServer } from "../src/server/ServerFactory";
import { Router } from "../src/server/routing/Router";
import { __sys__ } from "../src/sys";

console.log("🧪 Starting MultiServer Route Leakage Reproduction Test...\n");

// Test utilities
function assert(condition: boolean, message: string) {
    if (!condition) {
        console.error(`❌ ASSERTION FAILED: ${message}`);
        process.exit(1);
    } else {
        console.log(`✅ ${message}`);
    }
}

async function makeRequest(
    url: string,
    options: any = {},
): Promise<{ status: number; body: string }> {
    try {
        const response = await fetch(url, options);
        const body = await response.text();
        return { status: response.status, body };
    } catch (error) {
        return { status: 0, body: "" };
    }
}

async function testRouteLeakage() {
    console.log("Creating multiServer configuration...");

    const app = createServer({
        logging: { enabled: false },
        multiServer: {
            enabled: true,
            servers: [
                {
                    id: "main_server",
                    port: 8754,
                    routePrefix: "/file",
                    routePrefixStrategy: "auto-inject",
                },
                {
                    id: "admin_server",
                    port: 6728,
                    routePrefix: "/rest",
                    routePrefixStrategy: "auto-inject",
                },
            ],
        },
    });

    // Main Router
    const mainRouter = new Router();
    mainRouter.post("/upload", (req: any, res: any) => {
        res.status(200).send("Upload success");
    });

    // Admin Router
    const adminRouter = new Router();
    adminRouter.get("/users", (req: any, res: any) => {
        res.status(200).send("Admin users");
    });

    // Register routers
    app.use("/file", mainRouter);
    app.use("/rest", adminRouter);

    // Start servers
    await app.start();
    await __sys__.sleep(500);

    try {
        console.log("\n📡 Testing correct access...");

        const mainRes = await makeRequest("http://localhost:8754/file/upload", {
            method: "POST",
        });
        assert(
            mainRes.status === 200,
            "Main server should handle /file/upload",
        );

        const adminRes = await makeRequest("http://localhost:6728/rest/users");
        assert(
            adminRes.status === 200,
            "Admin server should handle /rest/users",
        );

        console.log("\n📡 Testing for route leakage (THE BUG)...");

        // THIS IS THE LEAK: adminServer (port 6728) should NOT handle /rest/file/upload
        // Because /file/upload clearly belongs to main_server's prefix /file.
        const leakedRes = await makeRequest(
            "http://localhost:6728/rest/file/upload",
            { method: "POST" },
        );

        console.log("Leaked Response Status (Admin Server):", leakedRes.status);

        if (leakedRes.status === 200 || leakedRes.status === 400) {
            console.log(
                "🐛 BUG REPRODUCED: Admin server handled a main server route!",
            );
        } else if (leakedRes.status === 404) {
            console.log(
                "✅ SUCCESS: Admin server correctly returned 404 for main server's route.",
            );
        } else {
            console.log(`Hmm, received status ${leakedRes.status}`);
        }
    } finally {
        await app.stop();
    }
}

testRouteLeakage()
    .then(() => {
        console.log("\n✅ Test completed successfully!");
        process.exit(0);
    })
    .catch((err) => {
        console.error("\n❌ Test failed:", err);
        process.exit(1);
    });

