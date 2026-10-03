import fs from "node:fs";
import path from "node:path";
import { getRandomBytes } from "xypriss-security";
import { spawn, ChildProcess } from "node:child_process";
import { XyPrissRunner } from "../../../xhsc/XyPrissRunner";
import { XyprissApp } from "../XyprissApp";
import { Logger } from "../../../shared/logger/Logger";
import { Configs } from "../../../ConfigurationManager";
import { LogProcessor } from "./LogProcessor";
import { TempFileManager } from "../../../xhsc/fs/TempFileManager";
import { deriveKey, pack } from "../../../xhsc/synapx/SynapxSchemaPacker";
import {
    getCallerProjectRoot,
    identifyProjectRoot,
} from "../../../utils/ProjectDiscovery";
import { getSysApi } from "../../../plugins/const/getSysApi";
import { getInternalSignature } from "../../const/XHSC_SIGNATURE";
import { XessIpcClient } from "../../../xhsc/api/env/XessIpcClient";

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
        onStartupSuccess: (boundPort?: number) => void,
        onExit: (code: number | null, combinedOutput: string) => void,
    ): Promise<number> {
        if (!this.app.configs?.isAuxiliary) {
            this.logger.info("server", "Starting XHSC engine...");
        }

        return new Promise((resolve, reject) => {
            let isResolved = false;

            const appConfigs = this.app.configs || {};

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

            // Access project root lazily via getSysApi() to break circular imports
            const sys = getSysApi();
            const projectRoot =
                sys?.__root__ ||
                getCallerProjectRoot() ||
                identifyProjectRoot(process.cwd()) ||
                process.cwd();

            const entryPoint =
                process.argv[1] ||
                (appConfigs?.cluster as any)?.entryPoint ||
                path.join(projectRoot, "src", "server.ts");

            const fullConfig = {
                ...appConfigs,
                port,
                host,
                ipcPath: socketPath,
                socketPath,
                projectRoot,
                entryPoint,
                pluginPaths: uniquePluginPaths,
            };

            const tmpDir = sys?.path?.tmpUserDir || process.env.XYPRISS_USER_TMP || "/tmp";
            const sessionHash = path.basename(tmpDir);

            // Read session auth token for hardware/session bound encryption
            let sessionToken = "";
            try {
                const tokenFile = path.join(tmpDir, ".auth_token");
                if (fs.existsSync(tokenFile)) {
                    sessionToken = fs.readFileSync(tokenFile, "utf8").trim();
                }
            } catch {}

            const configPath = path.join(
                tmpDir,
                `.xhsc-cfg-${getRandomBytes(8).toString("hex")}.synapx`,
            );

            try {
                if (sessionToken) {
                    const encKey = deriveKey(sessionToken, sessionHash);
                    const envelope = pack(fullConfig, encKey);
                    fs.writeFileSync(configPath, envelope, { mode: 0o600 });
                } else {
                    fs.writeFileSync(configPath, JSON.stringify(fullConfig), { mode: 0o600 });
                }
            } catch (err) {
                this.logger.error("server", `Failed to write secure .synapx config: ${err}`);
            }

            // Zero CLI Flags: 100% encrypted single descriptor argument
            const args = [configPath];

            const internalSig = getInternalSignature();
            let sessionKey = "";
            try {
                sessionKey = XessIpcClient.getActiveSessionKey();
            } catch {}

            this.logger.debug(
                "server",
                `Starting XHSC engine: ${args.join(" ")}`,
            );

            const binaryPath = this.runner.getBinaryPath();

            const child = spawn(binaryPath, args, {
                stdio: ["ignore", "pipe", "pipe"],
                detached: true,
                env: {
                    ...process.env,
                    ...(sessionKey ? { XYPRISS_XESS_SESSION_KEY: sessionKey } : {}),
                    ...(internalSig
                        ? { XYPRISS_INTERNAL_TOKEN: internalSig }
                        : {}),
                    NO_COLOR: "1",
                },
            });

            this.childProcess = child;
            this.rustPid = child.pid || null;

            this.logger.debug(
                "server",
                `XHSC Engine spawned with PID: ${this.rustPid}`,
            );

            const handleStartupSuccess = (boundPort?: number) => {
                if (!isResolved) {
                    isResolved = true;
                    const finalPort = boundPort || port;
                    onStartupSuccess(finalPort);
                    resolve(finalPort);
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
        try {
            TempFileManager.getInstance().cleanupAll();
        } catch {}

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

