/**
 * Port Manager - Handles automatic port switching when ports are in use
 */
// ServerConfig removed - using ServerOptions instead
import net from "net";

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
    private config: AutoPortSwitchConfig;
    private originalPort: number;

    constructor(originalPort: number, config?: AutoPortSwitchConfig) {
        this.originalPort = originalPort;
        this.config = {
            enabled: false,
            maxAttempts: 10,
            startPort: originalPort,
            strategy: "increment",
            autoKillConflict: false,
            ...config,
        };
    }

    /**
     * Attempts to kill the process listening on a specific port
     */
    public async killProcessOnPort(port: number): Promise<boolean> {
        const { execSync } = await import("node:child_process");
        const os = await import("node:os");

        try {
            if (os.platform() === "win32") {
                try {
                    const output = execSync(
                        `netstat -ano | findstr :${port}`,
                    ).toString();
                    const lines = output.split("\n");
                    let killed = false;
                    for (const line of lines) {
                        if (line.includes("LISTENING")) {
                            const parts = line.trim().split(/\s+/);
                            const pid = parts[parts.length - 1];
                            if (pid && pid !== "0") {
                                execSync(`taskkill /F /PID ${pid}`, {
                                    stdio: "ignore",
                                });
                                killed = true;
                            }
                        }
                    }
                    return killed;
                } catch (e) {
                    return false;
                }
            } else {
                // Try fuser first (LinuX)
                try {
                    execSync(`fuser -k ${port}/tcp`, { stdio: "ignore" });
                    return true;
                } catch (e) {
                    // Fallback to lsof (macOS / Linux without psmisc)
                    try {
                        const pidOutput = execSync(`lsof -t -i:${port}`, {
                            stdio: ["ignore", "pipe", "ignore"],
                        })
                            .toString()
                            .trim();
                        if (pidOutput) {
                            const pids = pidOutput.split("\n");
                            for (const pid of pids) {
                                execSync(`kill -9 ${pid}`, { stdio: "ignore" });
                            }
                            return true;
                        }
                    } catch (e2) {
                        return false;
                    }
                }
            }
        } catch (error) {
            return false;
        }
        return false;
    }

    /**
     * Check if a port is available
     */
    public async isPortAvailable(
        port: number,
        host: string = "localhost",
    ): Promise<boolean> {
        return new Promise((resolve) => {
            // Use net.connect to test port availability more reliably
            const socket = new net.Socket();
            let resolved = false;

            const cleanup = () => {
                if (!resolved) {
                    resolved = true;
                    try {
                        socket.destroy();
                    } catch (e) {
                        // Ignore cleanup errors
                    }
                }
            };

            // Set a timeout to avoid hanging
            const timeout = setTimeout(() => {
                cleanup();
                resolve(true); // If connection times out, assume port is available
            }, 1000);

            // Use the same host for port availability check to ensure proper conflict detection
            const checkHost = host;

            socket.setTimeout(1000);

            socket.on("connect", () => {
                // If we can connect, the port is in use
                clearTimeout(timeout);
                cleanup();
                resolve(false);
            });

            socket.on("error", (err: any) => {
                clearTimeout(timeout);
                cleanup();
                // If connection fails, the port is likely available
                resolve(true);
            });

            socket.on("timeout", () => {
                clearTimeout(timeout);
                cleanup();
                resolve(true);
            });

            try {
                socket.connect(port, checkHost);
            } catch (error) {
                clearTimeout(timeout);
                cleanup();
                resolve(true);
            }
        });
    }

    /**
     * Generate next port based on strategy
     */
    private getNextPort(currentPort: number, attempt: number): number {
        const { strategy, portRange, predefinedPorts } = this.config!;

        switch (strategy) {
            case "increment":
                return currentPort + attempt;

            case "random":
                if (portRange) {
                    const [min, max] = portRange;
                    return Math.floor(Math.random() * (max - min + 1)) + min;
                }
                return currentPort + Math.floor(Math.random() * 1000) + 1;

            case "predefined":
                if (predefinedPorts && predefinedPorts.length > 0) {
                    return predefinedPorts[attempt % predefinedPorts.length];
                }
                // Fallback to increment if no predefined ports
                return currentPort + attempt;

            default:
                return currentPort + attempt;
        }
    }

    /**
     * Validate port number
     */
    private isValidPort(port: number): boolean {
        return port >= 1 && port <= 65535;
    }

    /**
     * Find an available port automatically
     */
    public async findAvailablePort(
        host: string = "localhost",
    ): Promise<PortSwitchResult> {
        const result: PortSwitchResult = {
            success: false,
            port: this.originalPort,
            originalPort: this.originalPort,
            attempts: 0,
            switched: false,
        };

        // If auto port switch is disabled, just check the original port
        if (!this.config?.enabled) {
            const available = await this.isPortAvailable(
                this.originalPort,
                host,
            );
            result.success = available;
            result.attempts = 1;
            return result;
        }

        const { maxAttempts, startPort, portRange } = this.config!;
        let currentPort = startPort || this.originalPort;

        // First, try the original port
        if (await this.isPortAvailable(this.originalPort, host)) {
            result.success = true;
            result.attempts = 1;
            return result;
        }

        // If original port is not available, start searching
        for (let attempt = 1; attempt <= maxAttempts!; attempt++) {
            currentPort = this.getNextPort(
                startPort || this.originalPort,
                attempt,
            );

            // Validate port range if specified
            if (portRange) {
                const [min, max] = portRange;
                if (currentPort < min || currentPort > max) {
                    continue;
                }
            }

            // Validate port number
            if (!this.isValidPort(currentPort)) {
                continue;
            }

            result.attempts = attempt + 1;

            if (await this.isPortAvailable(currentPort, host)) {
                result.success = true;
                result.port = currentPort;
                result.switched = true;

                // Call the callback if provided
                if (this.config?.onPortSwitch) {
                    this.config.onPortSwitch(this.originalPort, currentPort);
                }

                break;
            }
        }

        return result;
    }

    /**
     * Get configuration summary
     */
    public getConfig(): AutoPortSwitchConfig {
        return { ...this.config };
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<AutoPortSwitchConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }
}

/**
 * Utility function to create a PortManager instance
 */
export function createPortManager(
    port: number,
    config?: AutoPortSwitchConfig,
): PortManager {
    return new PortManager(port, config);
}

/**
 * Quick utility to find an available port
 */
export async function findAvailablePort(
    port: number,
    config?: AutoPortSwitchConfig,
    host: string = "localhost",
): Promise<PortSwitchResult> {
    const manager = new PortManager(port, config);
    return manager.findAvailablePort(host);
}

