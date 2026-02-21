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
 * Create a new XyPriss UF server (zero-async)
 * Returns app instance ready to use immediately
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

