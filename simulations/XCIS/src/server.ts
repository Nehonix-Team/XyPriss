import { createServer, Plugin } from "xypriss";

const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            interceptMethods: ["log", "warn", "error", "info", "debug", "trace"],
            preserveOriginal: {
                enabled: true,
                mode: "intercepted",
                showPrefix: true, 
                separateStreams: true,
                allowDuplication: false,
                onlyUserApp: false,
                customPrefix: "[XCIS]",
                colorize: true,
            },
            performanceMode: true,
            maxInterceptionsPerSecond: 1000,
            sourceMapping: true,
            // encryption: {
            //     enabled: true,
            //     key: "1234567890123456", // 16 bytes for AES-128
            // },
            filters: {
                minLevel: "debug",
                excludePatterns: ["node_modules", "internal"],
                userAppPatterns: ["legacy"], // Tous les logs contenant "legacy" seront taggés [USERAPP]
                systemPatterns: ["PLUGINS", "SYSTEM", "XHSC", "XEMS"], // etc...
            },
        },
    },
});

app.start();

setTimeout(() => {
    setInterval(() => {
        console.log("This is a legacy log that should pass the XHSC filter");
        console.log("[INTERNAL] This log should be filtered out by XHSC");
        // process.stdout.write("Tracing output\n");
    }, 600);
}, 2000);




