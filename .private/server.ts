import { createServer } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
    logging: {
        consoleInterception: {
            enabled: true,
            tracing: {
                enabled: true,
                maxBufferSize: 100,
            },
        },
    },
    plugins: {
        register: [
            {
                name: "test",
                version: "1.0.0",
                onServerStart(server) {
                    console.log("Server started");
                },
                onConsoleIntercept(log) {
                    process.stdout.write(`\n--- PLUGIN CAPTURE LOG ---\n`);
                    process.stdout.write(`Method: ${log.method}\n`);
                    process.stdout.write(`Message: ${log.args.join(" ")}\n`);
                    process.stdout.write(`Category: ${log.category}\n`);
                    process.stdout.write(`--------------------------\n\n`);
                },
            },
        ],
    },
    pluginPermissions: [
        {
            name: "test",
            allowedHooks: [
                // "PLG.LOGGING.CONSOLE_INTERCEPT",
                "PLG.LIFECYCLE.SERVER_START",
            ],
        },
    ],
});

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.json({ message: "Hello World" });
});

app.start();

