import { createServer, Router } from "../src";
import { SwaggerPlugin } from "../mods/swagger/src";

async function main() {
    console.log("\n--- TEST: Swagger Automatic Route Discovery ---");

    // Create a regular router with some routes
    const router = Router();
    router.get("/hello", (req: any, res: any) => res.send("world"));
    router.post("/api/data", (req: any, res: any) => res.json({ ok: true }));

    // Register SwaggerPlugin WITHOUT a router in config
    const server = createServer({
        server: { port: 3005 },
        plugins: {
            register: [
                SwaggerPlugin({
                    title: "Auto-Discovery Test API",
                    port: 8081,
                    // router: router <--- OMITTED on purpose
                }),
            ],
        },
        pluginPermissions: [
            {
                name: "@xypriss/swagger",
                allowedHooks: ["PLG.OPS.AUXILIARY_SERVER"],
            },
        ],
    });

    // Mount the router to the main app
    server.use("/", router);

    console.log("[TEST] Waiting for plugin initialization...");
    await (server as any).pluginInitPromise;

    console.log("[TEST] Starting server and auxiliary Swagger server...");
    await server.start();

    // Verify the OpenAPI spec from the auxiliary server
    try {
        // Wait a bit for the auxiliary server to be fully ready in the background
        await new Promise((resolve) => setTimeout(resolve, 1000));

        let response: any;
        let lastError: any;

        // Retry logic for the fetch (sometimes the auxiliary server needs a moment)
        for (let i = 0; i < 3; i++) {
            try {
                response = await fetch(
                    "http://localhost:8081/docs/swagger.json",
                );
                if (response.ok) break;
            } catch (e) {
                lastError = e;
            }
            await new Promise((resolve) => setTimeout(resolve, 500));
        }

        if (!response || !response.ok) {
            throw new Error(
                `HTTP error! status: ${response?.status} error: ${lastError?.message}`,
            );
        }

        const spec = (await response.json()) as any;
        console.log("[TEST] OpenAPI Paths found:", Object.keys(spec.paths));

        const hasHello = spec.paths["/hello"] !== undefined;
        const hasData = spec.paths["/api/data"] !== undefined;

        if (hasHello && hasData) {
            console.log(
                "\n✅ SUCCESS: Swagger correctly discovered routes from global registry!",
            );
        } else {
            console.error(
                "\n❌ FAILURE: Some routes were missing from the auto-generated spec.",
            );
            console.error("Expected /hello and /api/data to be present.");
            process.exit(1);
        }
    } catch (e) {
        console.error(
            "\n❌ FAILURE: Could not connect to or parse Swagger server response.",
            e,
        );
        process.exit(1);
    } finally {
        await (server as any).close();
        console.log("[TEST] Server stopped.");
    }

    process.exit(0);
}

main().catch((err) => {
    console.error(err);
    process.exit(1);
});

