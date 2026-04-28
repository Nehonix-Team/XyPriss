import { spawn, ChildProcess } from "node:child_process";
import { XyPrissRunner } from "../../../xhsc/XyPrissRunner";
import { XyprissApp } from "../XyprissApp";
import { Logger } from "../../../shared/logger/Logger";
import { Configs } from "../../../ConfigurationManager";
import { LogProcessor } from "./LogProcessor";
import {
    getCallerProjectRoot,
    identifyProjectRoot,
} from "../../../utils/ProjectDiscovery";
import { __sys__ } from "../../../xhsc";

import { buildCoreArgs } from "./cmd/buildCoreArgs";
import { buildPerformanceArgs } from "./cmd/buildPerformanceArgs";
import { buildNetworkArgs } from "./cmd/buildNetworkArgs";
import { buildSecurityArgs } from "./cmd/buildSecurityArgs";
import { buildClusterArgs } from "./cmd/buildClusterArgs";
import { buildRequestArgs } from "./cmd/buildRequestArgs";
import { buildWorkerPoolArgs } from "./cmd/buildWorkerPoolArgs";
import { buildUploadArgs } from "./cmd/buildUploadArgs";
import { XHSC_SIGNATURE } from "../../const/XHSC_SIGNATURE";

export class EngineManager {
    private rustPid: number | null = null;
    private childProcess: ChildProcess | null = null;

    constructor(
        private app: XyprissApp,
        private logger: Logger,
        private runner: XyPrissRunner,
    ) {}

    public getPid(): number | null {
        return this.rustPid;
    }

    public start(
        port: number,
        host: string,
        socketPath: string,
        logProcessor: LogProcessor,
        onStartupSuccess: () => void,
        onExit: (code: number | null, combinedOutput: string) => void,
    ): Promise<void> {
        if (!this.app.configs?.isAuxiliary) {
            this.logger.info("server", "Starting XHSC engine...");
        }

        return new Promise((resolve, reject) => {
            let isResolved = false;

            const appConfigs = this.app.configs || {};
            const clconf = appConfigs.cluster || Configs.get("cluster");
            const rmconf =
                appConfigs.requestManagement ||
                Configs.get("requestManagement");
            const perfConf =
                appConfigs.performance || Configs.get("performance");
            const networkConf = appConfigs.network || Configs.get("network");
            const securityConf = appConfigs.security || Configs.get("security");
            const wpconf = appConfigs.workerPool || Configs.get("workerPool");
            const uploadConf =
                appConfigs.fileUpload || Configs.get("fileUpload");

            const pluginPaths: string[] = [];
            if (this.app.pluginManager && this.app.pluginManager.registry) {
                const plugins = this.app.pluginManager.registry.getAll() || [];
                plugins.forEach((p: any) => {
                    if (p.__root__) pluginPaths.push(p.__root__);
                });
            } else if (
                this.app.xyPluginManager &&
                this.app.xyPluginManager.registry
            ) {
                const plugins =
                    this.app.xyPluginManager.registry.getAll() || [];
                plugins.forEach((p: any) => {
                    if (p.__root__) pluginPaths.push(p.__root__);
                });
            }

            const uniquePluginPaths = [...new Set(pluginPaths)];
            const pluginArgs =
                uniquePluginPaths.length > 0
                    ? ["--plugins", uniquePluginPaths.join(",")]
                    : [];

            const projectRoot =
                __sys__.__root__ ||
                getCallerProjectRoot() ||
                identifyProjectRoot(process.cwd()) ||
                process.cwd();

            const args = [
                ...buildCoreArgs(port, host, socketPath, rmconf),
                ...buildPerformanceArgs(perfConf, networkConf),
                ...buildNetworkArgs(networkConf, this.app),
                ...buildSecurityArgs(securityConf, rmconf),
                ...buildClusterArgs(clconf),
                ...buildRequestArgs(rmconf),
                ...buildWorkerPoolArgs(wpconf),
                ...buildUploadArgs(uploadConf),
                ...pluginArgs,
                "--project-root",
                projectRoot,
            ];

            this.logger.debug(
                "server",
                `Starting XHSC engine: ${args.join(" ").replace(XHSC_SIGNATURE, "[SIG]")}`,
            );

            const binaryPath = this.runner.getBinaryPath();

            const child = spawn(binaryPath, args, {
                stdio: ["ignore", "pipe", "pipe"],
                detached: true,
                env: { ...process.env, NO_COLOR: "1" },
            });

            this.childProcess = child;
            this.rustPid = child.pid || null;
            this.logger.debug(
                "server",
                `XHSC Engine spawned with PID: ${this.rustPid}`,
            );

            const handleStartupSuccess = () => {
                if (!isResolved) {
                    isResolved = true;
                    onStartupSuccess();
                    resolve();
                }
            };

            child.on("error", (err) => {
                this.logger.error(
                    "server",
                    `Failed to spawn XHSC Engine: ${err.message}`,
                );
                if (!isResolved) {
                    isResolved = true;
                    reject(err);
                }
            });

            child.stdout?.on("data", (data) =>
                logProcessor.handleData(data, false, handleStartupSuccess),
            );
            child.stderr?.on("data", (data) =>
                logProcessor.handleData(data, true, handleStartupSuccess),
            );

            child.on("close", (code) => {
                const combinedOutput = logProcessor.getCombinedOutput();
                onExit(code, combinedOutput);

                if (!isResolved && code !== 0 && code !== null) {
                    isResolved = true;
                    reject(
                        this.buildStartupError(
                            code,
                            port,
                            host,
                            combinedOutput,
                            logProcessor,
                        ),
                    );
                }
            });

            child.unref();
        });
    }

    public stop(): void {
        if (!this.rustPid) return;

        this.logger.warn(
            "server",
            `Bridge: Stopping XHSC engine (P${this.rustPid})...`,
        );
        try {
            process.kill(this.rustPid, "SIGTERM");
        } catch (e: any) {
            if (e.code !== "ESRCH") {
                this.logger.error(
                    "server",
                    "Bridge: Failed to stop XHSC engine",
                    e,
                );
            }
        }
        this.rustPid = null;
    }

    private buildStartupError(
        code: number,
        port: number,
        host: string,
        combinedOutput: string,
        logProcessor: LogProcessor,
    ): Error {
        const isPortInUse =
            combinedOutput.includes("Address already in use") ||
            combinedOutput.includes("os error 98");

        const isPermissionDenied =
            combinedOutput.includes("permission denied") ||
            combinedOutput.includes("operation not permitted");

        let message: string;

        if (isPortInUse) {
            message = `XHSC failed to start: Port ${port} is already in use by another process. 
This often happens if a previous instance of XyPriss didn't shut down correctly.
TIP: We've now enabled 'server.autoKillConflict: true' by default to solve this for you automatically.`;
        } else if (isPermissionDenied) {
            message = `XHSC failed to start: Permission denied.
Make sure the binary is executable (chmod +x) and you have permissions to bind to port ${port}.`;
        } else {
            message = `XHSC Engine exited with code ${code}`;
            const history = logProcessor.getHistory();
            if (history.length > 0) {
                message += ` - Detail: ${history[history.length - 1]}`;
            } else if (combinedOutput.trim()) {
                message += ` - Last output: ${combinedOutput.trim().split("\n").pop()}`;
            }
        }

        const error: any = new Error(message);
        if (isPortInUse) {
            error.code = "EADDRINUSE";
            error.address = host;
            error.port = port;
        }
        return error;
    }
}

