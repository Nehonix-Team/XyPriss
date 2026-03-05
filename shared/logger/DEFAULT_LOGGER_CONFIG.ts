import { DEFAULT_CONSOLE_CONFIG } from "../../src/server/components/fastapi/console/types";

export type LoggerConfig = NonNullable<ServerOptions["logging"]>;

export const DEFAULT_LOGGER_CONFIG: LoggerConfig = {
    enabled: true,
    level: "info",
    components: {
        server: true,
        cache: true,
        cluster: true,
        performance: true,
        fileWatcher: true,
        plugins: true,
        security: true,
        monitoring: true, 
        routes: true,
        userApp: true,
        middleware: true,
        router: true,
        typescript: true,
        acpes: true,
        other: true,
        ipc: true,
        memory: true,
        lifecycle: true,
        routing: true,
        xems: true,
        console: false, // noisy by default
    },
    types: {
        startup: true,
        warnings: true,
        errors: true,
        performance: true,
        debug: false,
        hotReload: true,
        portSwitching: true,
        lifecycle: true,
    },
    format: {
        timestamps: true,
        colors: true,
        prefix: true,
        compact: false,
        includeMemory: false,
        includeProcessId: false,
        maxLineLength: 0,
    },
    buffer: {
        enabled: false,
        maxSize: 1000,
        flushInterval: 5000,
        autoFlush: true,
    },
    errorHandling: {
        maxErrorsPerMinute: 100,
        suppressRepeatedErrors: true,
        suppressAfterCount: 5,
        resetSuppressionAfter: 300_000,
    },
     // Console Interception with Encryption Support
        consoleInterception: {
            ...DEFAULT_CONSOLE_CONFIG,
            enabled: false, // Disabled by default (user can enable when needed)
            preserveOriginal: true,
        },

};
