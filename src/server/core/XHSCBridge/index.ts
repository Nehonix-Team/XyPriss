import * as net from "node:net";
import { initializeLogger, Logger } from "../../../shared/logger/Logger";
import { XyPrissRunner } from "../../../xhsc/XyPrissRunner";
import { XyprissApp } from "../XyprissApp";
import { Configs } from "../../../ConfigurationManager";
import { XHSCWorker } from "../../../xhsc/cluster/XHSCWorker";
import { SocketManager } from "./SocketManager";
import { LogProcessor } from "./LogProcessor";
import { EngineManager } from "./EngineManager";
import { ConsoleInterceptor } from "../../components/fastapi/console/ConsoleInterceptor";
import { getSysApi } from "../../../plugins/const/getSysApi";

/**
 * XHSCBridge - The high-performance bridge between Go (XHSC) and Node.js.
 * Handles the IPC communication via Unix Domain Sockets.
 * Modularized version.
 */
export class XHSCBridge {
    private socketPath: string;
    private server: net.Server | null = null;
    private runner: XyPrissRunner;
    private isServerRunning: boolean = false;
    private logger: Logger;

    private socketManager: SocketManager;
    private logProcessor: LogProcessor;
    private engineManager: EngineManager;

    constructor(
        private app: XyprissApp,
        logger?: Logger,
        socketPath?: string,
    ) {
        this.runner = new XyPrissRunner(process.cwd());
        this.logger =
            logger ||
            (app as any).logger ||
            initializeLogger(Configs.get("logging"));

        this.socketManager = new SocketManager(this.logger);
        this.logProcessor = new LogProcessor(this.logger);
        this.engineManager = new EngineManager(
            this.app,
            this.logger,
            this.runner,
        );

        this.socketPath = this.socketManager.configuredSocketPath(socketPath);
    }

    /**
     * Start the XHSC Go engine and the IPC bridge.
     */
    public async start(
        port: number = 5628,
        host: string = "127.0.0.1",
        consoleInterceptor?: ConsoleInterceptor,
    ): Promise<void> {
        if (consoleInterceptor) {
            (this.logProcessor as any).consoleInterceptor = consoleInterceptor;
        }
        // 0. Check if we are a worker spawned by Go (Clustering mode)
        // Auxiliary servers should NEVER act as cluster workers for the primary instance.
        // Issue #43: Access workerId via getSysApi() to adhere to XyPriss zero-trust environment model
        const sysApi = getSysApi();
        const currentWorkerId = sysApi?.__env__?.get("XYPRISS_WORKER_ID");

        if (currentWorkerId && currentWorkerId !== "master" && !this.app.configs?.isAuxiliary) {
            this.logger.info(
                "cluster",
                `Worker ${currentWorkerId} starting...`,
            );
            const worker = new XHSCWorker(this.app, { workerId: currentWorkerId });
            await worker.connect();
            return;
        }

        if (!this.app.configs?.isAuxiliary) {
            this.logger.info("server", "XHSC Bridge initializing...");
        }

        // 1. Cleanup orphaned sockets from previous crashes or ungraceful exits
        await this.socketManager.cleanupStaleSockets(this.socketPath);

        // 2. Cleanup current socket path if it exists (safety)
        this.socketManager.cleanupSocket(this.socketPath);

        // 3. Logic for starting Go Engine
        await this.engineManager.start(
            port,
            host,
            this.socketPath,
            this.logProcessor,
            () => {
                // Startup Success Callback
                this.isServerRunning = true;
            },
            (code, combinedOutput) => {
                // Exit Callback
                if (code !== 0 && code !== null) {
                    const formattedMsg = combinedOutput.startsWith("[")
                        ? combinedOutput
                        : `[XHSC] ${combinedOutput}`;

                    this.logger.error(
                        "server",
                        `XHSC Engine exited with code ${code}`,
                    );
                    this.logger.error("server", formattedMsg);
                }
                this.isServerRunning = false;
            },
        );

        // 4. If not in clustering mode, this process acts as the single worker.
        const appConfigs = this.app.configs || {};
        const clusterConfig = appConfigs.cluster || Configs.get("cluster");

        if (!clusterConfig?.enabled) {
            if (!this.app.configs?.isAuxiliary) {
                this.logger.info(
                    "server",
                    "Single process mode: Initializing XHSC connection...",
                );
                // Issue #43: Use getSysApi().__env__.set() instead of assigning to process.env directly.
                // In strict JS runtimes like Bun (multi-server mode), mutating process.env when wrapped
                // in an immutable descriptor causes fatal descriptor rejection exceptions.
                const sys = getSysApi();
                sys?.__env__?.set("XYPRISS_WORKER_ID", "master");
                sys?.__env__?.set("XYPRISS_IPC_PATH", this.socketPath);
            } else {
                this.logger.info(
                    "server",
                    "Auxiliary server: Initializing independent XHSC connection...",
                );
            }

            const worker = new XHSCWorker(this.app, {
                workerId: "master",
                ipcPath: this.socketPath
            });
            await worker.connect();
        }
    }

    public stop(): void {
        this.engineManager.stop();

        if (this.server) {
            this.logger.debug("server", "Bridge: Stopping Node.js server...");
            this.server.close();
        }

        this.socketManager.cleanupSocket(this.socketPath);
        this.isServerRunning = false;
    }

    // These getters might be needed by other parts of the system if they were accessing private fields (though they shouldn't)
    public get isRunning(): boolean {
        return this.isServerRunning;
    }

    public get rustPid(): number | null {
        return this.engineManager.getPid();
    }
}

