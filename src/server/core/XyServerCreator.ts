/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * XyServerCreator is a centralized factory class for creating and
 * configuring XyPriss server instances (XyPrissApp).
 ***************************************************************************/

import { Logger } from "../../shared/logger/Logger";
import { ServerOptions, XyPrissApp } from "../../types/types";
import { XyPrissServer } from "../FastServer";
import { Configs } from "../../config";
import { configLoader } from "../utils/ConfigLoader";
import { handleWorkerMode } from "../utils/WorkerModeHandler";
import { XyPluginManager as PluginManager } from "../../plugins/core/XPluginManager";

/**
 * XyServerCreator - Centralized logic for creating XyPrissApp instances.
 */
export class XyServerCreator {
    /**
     * Create and configure a single XyPrissApp instance.
     * This is the single source of truth for creating a server instance.
     *
     * @param options - Server configuration options
     * @returns A fully configured XyPrissApp instance
     */
    public static create(options: ServerOptions = {}): XyPrissApp {
        // 1. Load system configuration
        configLoader.loadAndApplySysConfig();

        // 2. Initialize Logger singleton early
        Logger.getInstance(options.logging || Configs.get("logging"));

        // 3. Setup environment
        if (options.env) {
            process.env["NODE_ENV"] = options.env;
            if (
                typeof globalThis !== "undefined" &&
                (globalThis as any).__sys__
            ) {
                (globalThis as any).__sys__.vars.update({
                    __env__: options.env,
                });
            }
        }

        // 4. Update __sys__ with port if provided
        if (
            options.server?.port &&
            typeof globalThis !== "undefined" &&
            (globalThis as any).__sys__
        ) {
            (globalThis as any).__sys__.vars.update({
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
        const pluginManager = new PluginManager(server as any);
        const registrationPromises: Promise<void>[] = [];

        if (!options.isAuxiliary) {
            // Register custom plugins from config if any
            const pluginsConfig = Configs.get("plugins");
            if (
                pluginsConfig &&
                pluginsConfig.register &&
                pluginsConfig.register.length > 0
            ) {
                for (const plugin of pluginsConfig.register) {
                    registrationPromises.push(pluginManager.register(plugin));
                }
            }
        }

        // 8. Set global plugin manager for imperative API
        const pluginInitPromise = pluginManager.initialize();

        // 8. Attach plugin system to app for easy access
        (app as any).xyPluginManager = pluginManager;
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

        // 11. Automated Security: XEMS Session Handling
        // XEMS is now managed as a built-in plugin via PluginManager.
        // Session middleware and persistence are handled in the plugin lifecycle.

        return app;
    }
}

