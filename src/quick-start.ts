/**
 * XyPrissJS Express Quick Start
 * Pre-configured server instances for rapid development (tests with limited configs)
 */

import { createServer, ServerOptions } from "./ServerFactory";

/**
 * Quick development server with sensible defaults
 */
export function quickServer(port: number = 3000) {
    const config: ServerOptions = {
        env: "test",
        server: {
            port,
            host: "localhost",
        },
        cluster: {
            enabled: false,
        },
        cache: {
            enabled: true,
            strategy: "memory",
        },
        security: {
            cors: false,
            helmet: false,
        },
        fileWatcher: {
            enabled: true,
            ignorePaths: [
                "node_modules",
                "dist",
                "logs",
                "coverage",
                "tmp",
                "build",
            ],
            watchPaths: [process.cwd()],
        },
    };

    return createServer(config);
}

