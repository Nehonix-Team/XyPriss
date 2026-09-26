/**
 * PortManager - Unified Native Port Management Engine for XyPriss.
 *
 * Consolidates port checking, conflict resolution (forceClosePort / killProcessOnPort),
 * and automatic port switching by delegating all heavy operations directly to XHSC (Go).
 */
import net from "net";
import { Logger } from "../../shared/logger/Logger";
import { XyPrissRunner } from "../../xhsc/XyPrissRunner";

export interface PortSwitchResult {
    success: boolean;
    port: number;
    originalPort: number;
    attempts: number;
    switched: boolean;
}

export interface AutoPortSwitchConfig {
    enabled?: boolean;
    maxAttempts?: number;
    startPort?: number;
    endPort?: number;
    skipPorts?: number[];
    strategy?: "increment" | "random" | "predefined";
    portRange?: [number, number];
    predefinedPorts?: number[];
    onPortSwitch?: (originalPort: number, newPort: number) => void;
    autoKillConflict?: boolean;
}

export class PortManager {
    private port: number;
    private config: AutoPortSwitchConfig;
    private runner?: XyPrissRunner;
    private logger: Logger;

    constructor(port: number = 0, config?: AutoPortSwitchConfig) {
        this.port = port;
        this.logger = Logger.getInstance();
        this.config = {
            enabled: false,
            maxAttempts: 10,
            startPort: port,
            strategy: "increment",
            autoKillConflict: false,
            ...config,
        };
    }

    private getRunner(): XyPrissRunner {
        if (!this.runner) {
            this.runner = new XyPrissRunner(process.cwd());
        }
        return this.runner;
    }

    /**
     * Forcefully close/free up a port by terminating any conflicting process via XHSC Go engine.
     */
    public async forceClosePort(port?: number): Promise<boolean> {
        const targetPort = port || this.port;
        if (!targetPort) {
            throw new Error("PortManager: No port specified to force close.");
        }

        try {
            const runner = this.getRunner();
            const res = runner.runSync("port", "kill", ["--port", String(targetPort)]);
            if (res && typeof res.success === "boolean") {
                if (res.success) {
                    this.logger.debug("server", `PortManager (Go): Port ${targetPort} freed successfully.`);
                }
                return res.success;
            }
        } catch (err: any) {
            this.logger.debug("server", `PortManager XHSC invocation error: ${err.message}`);
        }

        // Fallback: check if port is free
        return !(await this.isPortAvailable(targetPort));
    }

    /**
     * Alias to forceClosePort for backwards compatibility with PortManager API
     */
    public async killProcessOnPort(port?: number): Promise<boolean> {
        return this.forceClosePort(port);
    }

    /**
     * Check if a port is available and free of active listeners via XHSC Go engine.
     */
    public async isPortAvailable(
        port?: number,
        host: string = "localhost",
    ): Promise<boolean> {
        const targetPort = port || this.port;
        if (!targetPort) return false;
        const checkHost = host === "localhost" ? "127.0.0.1" : host;

        try {
            const runner = this.getRunner();
            const res = runner.runSync("port", "check", [
                "--port",
                String(targetPort),
                "--host",
                checkHost,
            ]);
            if (res && typeof res.available === "boolean") {
                return res.available;
            }
        } catch {
            // Fallback to active TCP probe
        }

        return new Promise((resolve) => {
            const socket = new net.Socket();
            let resolved = false;

            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    try {
                        socket.destroy();
                    } catch {}
                }
            };

            const timeout = setTimeout(() => {
                cleanup();
                resolve(true);
            }, 250);

            socket.setTimeout(250);

            socket.on("connect", () => {
                clearTimeout(timeout);
                cleanup();
                resolve(false);
            });

            socket.on("error", () => {
                clearTimeout(timeout);
                cleanup();
                resolve(true);
            });

            socket.on("timeout", () => {
                clearTimeout(timeout);
                cleanup();
                resolve(true);
            });

            try {
                socket.connect(targetPort, checkHost);
            } catch {
                clearTimeout(timeout);
                cleanup();
                resolve(true);
            }
        });
    }

    /**
     * Find an available port based on strategy using XHSC Go core.
     */
    public async findAvailablePort(
        host: string = "localhost",
    ): Promise<PortSwitchResult> {
        const checkHost = host === "localhost" ? "127.0.0.1" : host;
        const startPort = this.config.startPort || this.port;

        if (!this.config?.enabled) {
            const available = await this.isPortAvailable(startPort, checkHost);
            return {
                success: available,
                port: startPort,
                originalPort: startPort,
                attempts: 1,
                switched: false,
            };
        }

        try {
            const runner = this.getRunner();
            const args = [
                "--port",
                String(startPort),
                "--host",
                checkHost,
                "--max-attempts",
                String(this.config.maxAttempts || 10),
                "--strategy",
                this.config.strategy || "increment",
            ];
            const res = runner.runSync("port", "find", args);
            if (res && res.success !== undefined) {
                if (res.switched && this.config?.onPortSwitch) {
                    this.config.onPortSwitch(startPort, res.port);
                }
                return {
                    success: Boolean(res.success),
                    port: res.port || startPort,
                    originalPort: startPort,
                    attempts: res.attempts || 1,
                    switched: Boolean(res.switched),
                };
            }
        } catch {
            // Fallback
        }

        return {
            success: false,
            port: startPort,
            originalPort: startPort,
            attempts: 1,
            switched: false,
        };
    }

    public getConfig(): AutoPortSwitchConfig {
        return { ...this.config };
    }

    public updateConfig(newConfig: Partial<AutoPortSwitchConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    // Static utilities
    public static async forceClosePort(port: number): Promise<boolean> {
        return new PortManager(port).forceClosePort();
    }

    public static async isPortAvailable(
        port: number,
        host: string = "localhost",
    ): Promise<boolean> {
        return new PortManager(port).isPortAvailable(port, host);
    }

    public static async findAvailablePort(
        port: number,
        config?: AutoPortSwitchConfig,
        host: string = "localhost",
    ): Promise<PortSwitchResult> {
        return new PortManager(port, config).findAvailablePort(host);
    }
}

// Aliases for full compatibility
export { PortManager as Port };

export function createPortManager(
    port: number,
    config?: AutoPortSwitchConfig,
): PortManager {
    return new PortManager(port, config);
}

export async function findAvailablePort(
    port: number,
    config?: AutoPortSwitchConfig,
    host: string = "localhost",
): Promise<PortSwitchResult> {
    return PortManager.findAvailablePort(port, config, host);
}
