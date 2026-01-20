/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * XyServerCreator is a centralized factory class for creating and
 * configuring XyPriss server instances (UltraFastApp).
 ***************************************************************************/

import { Logger, initializeLogger } from "../../../shared/logger/Logger";
import { ServerOptions, UltraFastApp } from "../../types/types";
import { XyPrissServer } from "../FastServer";
import { Configs } from "../../config";
import { PluginManager } from "../../plugins/core/PluginManager";
import { setGlobalPluginManager } from "../../plugins/api/PluginAPI";
import { configLoader } from "../utils/ConfigLoader";
import { handleWorkerMode } from "../utils/WorkerModeHandler";
import { RouteOptimizationPlugin } from "../../plugins/route-optimization-plugin";
import { ServerMaintenancePlugin } from "../../plugins/server-maintenance-plugin";

/**
 * XyServerCreator - Centralized logic for creating UltraFastApp instances.
 */
export class XyServerCreator {
    /**
     * Create and configure a single UltraFastApp instance.
     * This is the single source of truth for creating a server instance.
     *
     * @param options - Server configuration options
     * @returns A fully configured UltraFastApp instance
     */
    public static create(options: ServerOptions = {}): UltraFastApp {
        // 1. Load system configuration
        configLoader.loadAndApplySysConfig();

        // 2. Initialize Logger singleton early
        Logger.getInstance(options.logging);

        // 3. Setup environment
        if (options.env) {
            process.env["NODE_ENV"] = options.env;
            if (
                typeof globalThis !== "undefined" &&
                (globalThis as any).__sys__
            ) {
                (globalThis as any).__sys__.$update({ __env__: options.env });
            }
        }

        // 4. Update __sys__ with port if provided
        if (
            options.server?.port &&
            typeof globalThis !== "undefined" &&
            (globalThis as any).__sys__
        ) {
            (globalThis as any).__sys__.$update({
                __port__: options.server.port,
            });
        }

        // 5. Handle worker mode (if in cluster)
        const workerOptions = handleWorkerMode(options);
        Configs.merge(workerOptions);

        // 6. Create the server and get the app
        const server = new XyPrissServer();
        const app = server.getApp();

        // 7. Initialize Plugin system
        const pluginManager = new PluginManager({ app });

        // Register plugins from config
        const pluginsConfig = Configs.get("plugins");
        if (pluginsConfig) {
            // Register custom plugins
            if (pluginsConfig.register && pluginsConfig.register.length > 0) {
                for (const plugin of pluginsConfig.register) {
                    pluginManager.register(plugin);
                }
            }

            // Register built-in legacy plugins if enabled
            if (pluginsConfig.routeOptimization?.enabled !== false) {
                pluginManager.register(
                    new RouteOptimizationPlugin(
                        pluginsConfig.routeOptimization,
                    ),
                );
            }

            if (pluginsConfig.serverMaintenance?.enabled === true) {
                pluginManager.register(
                    new ServerMaintenancePlugin(
                        pluginsConfig.serverMaintenance,
                    ),
                );
            }
        }

        // 8. Set global plugin manager for imperative API
        setGlobalPluginManager(pluginManager);

        // 9. Initialize plugins (resolve deps, call onServerStart)
        const pluginInitPromise = pluginManager
            .initialize()
            .catch((error: any) => {
                const logger = Logger.getInstance();
                logger.error("plugins", "Failed to initialize plugins:", error);
            });

        // 10. Ingest plugin facets into the app
        (app as any).pluginManager = pluginManager;
        (app as any).pluginInitPromise = pluginInitPromise;

        app.registerPlugin = async (plugin: any, config?: any) => {
            return pluginManager.register(plugin, config);
        };

        app.getPlugin = (name: string) => {
            return pluginManager.getPlugin(name);
        };

        pluginManager.applyErrorHandlers(app);
        pluginManager.registerRoutes(app);
        pluginManager.applyMiddleware(app);

        return app;
    }
}

