import { Logger } from "../../shared/logger/Logger";
import { XyLifecycleManager } from "../core/XyLifecycleManager";
import { SecureInMemoryCache } from "xypriss-security";
import { XyPrissApp } from "../../types/types";
import { ServerPluginManager } from "../../plugins/ServerPluginManager";

export class ShutdownManager {
    constructor(
        private app: XyPrissApp,
        private logger: Logger,
        private lifecycleManager: XyLifecycleManager,
        private serverPluginManagerRef: {
            instance: ServerPluginManager | undefined;
        },
    ) {}

    public setupGracefulShutdown(stopCallback: () => Promise<void>): void {
        const gracefulShutdown = async (signal: string) => {
            this.logger.debug(
                "server",
                `Shutting down XyPrissSecurity CS gracefully... (Signal: ${signal})`,
            );
            try {
                this.logger.debug("server", "Calling this.stop()...");
                await stopCallback();
                this.logger.debug(
                    "server",
                    "this.stop() completed successfully",
                );
                process.exit(0);
            } catch (error) {
                this.logger.error(
                    "server",
                    "Error during graceful shutdown:",
                    error,
                );
                process.exit(1);
            }
        };

        process.on("SIGTERM", () => gracefulShutdown("SIGTERM"));
        process.on("SIGINT", () => gracefulShutdown("SIGINT"));
        process.on("SIGHUP", () => gracefulShutdown("SIGHUP"));
        process.on("uncaughtException", (error) => {
            this.logger.error("server", "Uncaught exception:", error);
            gracefulShutdown("UNCAUGHT_EXCEPTION");
        });
        process.on("unhandledRejection", (reason) => {
            this.logger.error("server", "Unhandled promise rejection:", reason);
        });
    }

    public async stop(): Promise<void> {
        this.logger.debug("server", "Starting server shutdown...");
        try {
            const pluginManager = (this.app as any).pluginManager;
            if (pluginManager && typeof pluginManager.shutdown === "function") {
                await pluginManager.shutdown();
                this.logger.debug("server", "Plugin shutdown hooks executed");
            }

            if (
                this.serverPluginManagerRef.instance &&
                typeof this.serverPluginManagerRef.instance.destroy ===
                    "function"
            ) {
                this.serverPluginManagerRef.instance.destroy();
                this.logger.debug("server", "Server plugin manager destroyed");
            }

            const httpServer = this.lifecycleManager?.getHttpServer();
            if (httpServer) {
                await new Promise<void>((resolve) => {
                    httpServer.close(() => {
                        this.logger.debug("server", "HTTP server closed");
                        resolve();
                    });
                });
            }

            const cs = new SecureInMemoryCache();
            this.logger.debug("server", "Closing SecureInMemoryCache...");
            await cs.shutdown();
            await this.lifecycleManager.stop();
            console.info("SIMC closed");

            this.logger.success("server", "Server stopped successfully");
        } catch (error) {
            this.logger.error("server", "Error stopping server:", error);
            throw error;
        }
    }
}

