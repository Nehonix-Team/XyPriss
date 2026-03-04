/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */

import { ServerOptions, UFApp } from "../types/types";
import { MultiServerManager } from "./components/multi-server/MultiServerManager";
import { MultiServerApp } from "./components/multi-server/MultiServerApp";
import { XyServerCreator } from "./core/XyServerCreator";
import { Logger, initializeLogger } from "../../shared/logger/Logger";
import { Configs } from "../config";
import { configLoader } from "./utils/ConfigLoader";
import { handleWorkerMode } from "./utils/WorkerModeHandler";

// Re-export safe JSON utilities
export {
    createSafeJsonMiddleware,
    setupSafeJson,
    safeJsonStringify,
    sendSafeJson,
    createCircularRefDebugger,
} from "../middleware/safe-json-middleware";

export {
    expressStringify,
    safeStringify,
    fastStringify,
} from "../../mods/security/src/components/fortified-function/serializer/safe-serializer";
import { Interface } from "reliant-type";

/**
 * ## createServer — XyPriss Unified Server Factory
 *
 * Creates and returns a fully configured XyPriss UltraFast (UF) server instance.
 * The factory handles all internal bootstrapping synchronously — the returned `app`
 * is ready for route registration and `.start()` immediately.
 *
 * **Capabilities:**
 * - Zero-async initialization: routes can be registered right after creation.
 * - Automatic configuration loading from `xypriss.config.jsonc` (if present).
 * - Built-in support for **single-server** and **multi-server (XMS)** modes.
 * - Optional security middleware, XEMS session management, XHSC engine bridging,
 *   file upload handling, caching, worker pools, and more — all driven by `options`.
 *
 * @param {ServerOptions} [options={}] - Server configuration object. All fields are optional;
 *   sensible defaults are applied automatically. Key sections include:
 *   - `server` — Port, host, trust-proxy, XEMS, XHSC settings.
 *   - `security` — Enable/configure CSRF, Helmet, XSS, rate-limiting, etc.
 *   - `logging` — Logger level, console interception, and formatting.
 *   - `cache` — In-memory caching configuration.
 *   - `performance` — Request pre-compilation, compression, and profiling.
 *   - `multiServer` — XMS (XyPriss Multi-Server) configuration for running
 *     multiple isolated server instances within a single process.
 *
 * @returns {UFApp} A fully-initialized UltraFast application instance with methods:
 *   `get`, `post`, `put`, `delete`, `patch`, `use`, `start`, `middleware`, and more.
 *
 * @throws {Error} If `multiServer.enabled` is `true` but `multiServer.servers` is
 *   missing or empty.
 *
 * @example
 * ```typescript
 * // Basic server
 * import { createServer } from "xypriss";
 *
 * const app = createServer({ server: { port: 3000 } });
 *
 * app.get("/", (req, res) => res.json({ status: "ok" }));
 * app.start();
 * ```
 *
 * @example
 * ```typescript
 * // Server with security and XEMS sessions
 * const app = createServer({
 *     server: {
 *         port: 8080,
 *         xems: {
 *             enable: true,
 *             persistence: { enabled: true, path: "./store/app.xems", secret: "..." },
 *         },
 *     },
 *     security: {
 *         enabled: true,
 *         level: "enhanced",
 *         csrf: true,
 *         helmet: true,
 *     },
 * });
 * ```
 *
 * @see {@link https://xypriss.nehonix.com/docs/getting-started} Getting Started Guide
 * @see {@link https://xypriss.nehonix.com/docs/configuration} Configuration Reference
 */
export function createServer(options: ServerOptions = {}): UFApp {
    // 1. Initial setup
    configLoader.loadAndApplySysConfig();
    Logger.getInstance(options.logging);
    const xms = options?.multiServer?.servers; // XMS = Xypriss MultiServer

    // 2. Check for Multi-Server mode
    if (options.multiServer?.enabled) {
        if (!xms) {
            throw new Error(
                "XMS configuration error: no servers defined. Please configure `multiServer.servers` and try again.",
            );
        }

        if (xms.length === 0) {
            throw new Error(
                "XMS configuration error: at least one server must be defined in `multiServer.servers`. Please update your configuration and try again.",
            );
        }

        const workerOptions = handleWorkerMode(options);
        Configs.merge(workerOptions);

        const logger = initializeLogger(Configs.get("logging"));
        const multiServerManager = new MultiServerManager(
            Configs.getAll(),
            logger,
        );

        const multiApp = new MultiServerApp(multiServerManager, xms, logger);

        return multiApp as unknown as UFApp;
    }

    // 3. Fallback to Single Server mode via unified creator
    return XyServerCreator.create(options);
}

// Legacy / Helper exports
export type {
    ServerOptions,
    RouteOptions,
    UltraFastApp,
    Request,
    Response,
    NextFunction,
    RequestHandler,
    MultiServerConfig,
} from "../types/types";

export type { MultiServerApp as XyPMS };

