import { createServer, Configs, Upload } from "../src";

const app = createServer({
    server: {
        autoParseJson: false,
    },
    fileUpload: {
        enabled: true,
        maxFileSize: 5 * 1024 * 1024, // 5MB
        storage: "memory",
    },

    network: {
        proxy: {},
    },
    plugins: {
        register: [
            // Test plugin
            () => ({
                name: "test-plugin",
                version: "1.0.0",
                onServerStart: (server) => {
                    console.log("[TestPlugin] Server successfully started!");
                },
                description: "Test plugin",
                registerRoutes: (app) => {
                    app.get("/plugin-test", (req, res) => {
                        // Intentional error to test onError hook
                        throw new Error("Test error from plugin route");
                    });
                },
                onError(error, req, res, next) {
                    console.log("[TestPlugin] Error caught:", error.message);
                    // res.status(500).json({
                    //     error: "Plugin caught this error",
                    //     message: error.message,
                    // });
                },
                onServerReady: (server) => {
                    console.log("[TestPlugin] Server ready!");
                },

                onRequest(req, res, next) {
                    console.log("[TestPlugin] Request hit!", req.url);
                    next();
                },
                onResponse(req, res) {
                    console.log("[TestPlugin] Response sent!", req.url);
                },
                onServerStop(server) {
                    console.log("[TestPlugin] Server stopped!", server);
                },
            }),
        ],
    },

    logging: {},
});

app.post("/upload", Upload.array("file", 3), (req, res) => {
    console.log("Upload route hit, req.file:", (req as any).files);
    console.log("Request headers:", req.headers);
    if ((req as any).files && (req as any).files.length > 0) {
        res.json({ success: true, files: (req as any).files });
    } else {
        res.json({ success: false, error: "No file uploaded" });
    }
});

app.start(undefined, async () => {
    await Upload.initialize(Configs);
});

