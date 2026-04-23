import { createServer , Plugin} from "xypriss";


const app = createServer({
    logging: {
        consoleInterception: {
            enabled: true,
            interceptMethods: ["log", "error", "warn", "info", "debug"],
            preserveOriginal: {
                enabled: true,
                mode: "intercepted",
                showPrefix: true,
                colorize: true,
            },
            performanceMode: true,
            maxInterceptionsPerSecond: 1000,
            sourceMapping: true,
            filters: {
                minLevel: "info",
                excludePatterns: ["node_modules", "internal"],
            },
        },
    },
});

app.start();

