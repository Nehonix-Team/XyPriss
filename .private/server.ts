import { createServer } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },

    security: {
        rateLimit: {
            max: 4,
            skip(req, res) {
                console.log("Should skip rate limit for ", req.path, "?", req.path === "/test" ? "yes" : "no");
                const isTest = req.path === "/test";
                // On ne veut ignorer QUE /test, donc on renvoie true uniquement pour /test
                return isTest;
            },
        },
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
    // plugins: {
    //     register: [
    //         {
    //             name: "test",
    //             version: "1.0.0",
    //             onServerStart(server) {
    //                 console.log("Server started");
    //             },
    //             onConsoleIntercept(log) {
    //                 process.stdout.write(`\n--- PLUGIN CAPTURE LOG ---\n`);
    //                 process.stdout.write(`Method: ${log.method}\n`);
    //                 process.stdout.write(`Message: ${log.args.join(" ")}\n`);
    //                 process.stdout.write(`Category: ${log.category}\n`);
    //                 process.stdout.write(`--------------------------\n\n`);
    //             },
    //         },
    //     ],
    // },
    // pluginPermissions: [
    //     {
    //         name: "test",
    //         allowedHooks: [
    //             // "PLG.LOGGING.CONSOLE_INTERCEPT",
    //             "PLG.LIFECYCLE.SERVER_START",
    //         ],
    //     },
    // ],
});

app.get("/", (req, res) => {
    console.log("Request received on /");
    res.xJson({ message: "Hello World" });
});

app.start();




