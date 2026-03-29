import { createServer, FLA } from "../src";
import { Configs } from "../src/config";

async function testPathApi() {
    console.log("=== Testing PathApi ===");
    const path = globalThis.__sys__;

    try {
        console.log("isChild:", path.$isChild("/home/user", "/home/user/docs"));
        console.log(
            "secureJoin:",
            path.$secureJoin("/home/user", "docs", "file.txt"),
        );
        console.log(
            "metadata:",
            JSON.stringify(path.$metadata("src/index.ts")),
        );
        console.log(
            "normalizeSeparators:",
            path.$normalizeSeparators("a/b\\c"),
        );
        console.log(
            "commonBase:",
            path.$commonBase("/usr/bin/node", "/usr/bin/bash"),
        );
    } catch (e) {
        console.error("PathApi test failed:", e);
    }
}

async function testFileUpload() {
    console.log("\n=== Testing FileUploadAPI Lazy Init ===");

    // Set config manually for test
    Configs.set({
        fileUpload: {
            enabled: true,
            storage: {
                type: "disk",
                destination: "./uploads",
            },
        },
    });

    const upload = new FLA();
    console.log("Initial state - isEnabled:", upload.isEnabled());

    // This should trigger autoInitialize
    const middleware = upload.single("file");
    console.log("Middleware created.");

    // Simulate a request
    const req = { file: {} };
    const res = {
        status: () => ({ json: (v: any) => console.log("Response:", v) }),
    };
    const next = () => console.log("Next called (Success)");

    console.log("Simulating request...");
    await middleware(req, res, next);

    console.log("Post-request state - isEnabled:", upload.isEnabled());
}

async function run() {
    console.log("Starting verification...");
    // Initialize system to populate __sys__
    await createServer({
        port: 0,
        logger: { enabled: false },
    });

    await testPathApi();
    await testFileUpload();
    process.exit(0);
}

run().catch((err) => {
    console.error("Verification failed:", err);
    process.exit(1);
});

