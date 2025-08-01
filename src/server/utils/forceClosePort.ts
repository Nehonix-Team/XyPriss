import { Logger } from "../../../shared/logger/Logger";

export class Port {
    private logger: Logger;
    private port: number;

    constructor(port: number) {
        this.port = port;
        this.logger = Logger.getInstance();
    }
    /**
     * Attempt to forcefully close/free up the specified port
     * @param port - The port number to force close
     * @returns Promise<boolean> - true if successful, false if failed
     */
    public async forceClosePort(): Promise<boolean> {
        try {
            this.logger.debug(
                "server",
                `Attempting to force close port ${this.port}...`
            );

            // Import required modules
            const { exec } = require("child_process");
            const { promisify } = require("util");
            const execAsync = promisify(exec);

            // Platform-specific port closing logic
            if (process.platform === "win32") {
                // Windows: Find and kill process using the port
                try {
                    const { stdout } = await execAsync(
                        `netstat -ano | findstr :${this.port}`
                    );
                    const lines = stdout
                        .split("\n")
                        .filter((line: string) => line.trim());

                    for (const line of lines) {
                        const parts = line.trim().split(/\s+/);
                        if (parts.length >= 5) {
                            const pid = parts[4];
                            if (pid && pid !== "0") {
                                try {
                                    await execAsync(`taskkill /F /PID ${pid}`);
                                    this.logger.info(
                                        "server",
                                        `Forcefully closed process ${pid} using port ${this.port}`
                                    );
                                } catch (killError: any) {
                                    // Handle race condition - process may have already exited
                                    if (
                                        killError.message.includes(
                                            "n'a pas pu être arrêté"
                                        ) ||
                                        killError.message.includes(
                                            "could not be terminated"
                                        ) ||
                                        killError.message.includes(
                                            "No such process"
                                        )
                                    ) {
                                        this.logger.info(
                                            "server",
                                            `Process ${pid} using port ${this.port} had already exited`
                                        );
                                    } else {
                                        this.logger.warn(
                                            "server",
                                            `Failed to kill process ${pid}: ${killError.message}`
                                        );
                                    }
                                }
                            }
                        }
                    }
                } catch (error: any) {
                    this.logger.warn(
                        "server",
                        `Failed to close port ${this.port} on Windows: ${error.message}`
                    );
                    return false;
                }
            } else {
                // Unix/Linux/macOS: Find and kill process using the port
                try {
                    const { stdout } = await execAsync(`lsof -ti:${this.port}`);
                    const pids = stdout
                        .trim()
                        .split("\n")
                        .filter((pid: string) => pid);

                    for (const pid of pids) {
                        if (pid) {
                            try {
                                await execAsync(`kill -9 ${pid}`);
                                this.logger.info(
                                    "server",
                                    `Forcefully closed process ${pid} using port ${this.port}`
                                );
                            } catch (killError: any) {
                                // Handle race condition - process may have already exited
                                if (
                                    killError.message.includes(
                                        "No such process"
                                    ) ||
                                    killError.message.includes(
                                        "Operation not permitted"
                                    )
                                ) {
                                    this.logger.info(
                                        "server",
                                        `Process ${pid} using port ${this.port} had already exited or is protected`
                                    );
                                } else {
                                    this.logger.warn(
                                        "server",
                                        `Failed to kill process ${pid}: ${killError.message}`
                                    );
                                }
                            }
                        }
                    }
                } catch (error: any) {
                    this.logger.warn(
                        "server",
                        `Failed to close port ${this.port} on Unix: ${error.message}`
                    );
                    return false;
                }
            }

            // Wait a moment for the port to be freed
            await new Promise((resolve) => setTimeout(resolve, 1000));

            // Verify the port is now free
            try {
                if (process.platform === "win32") {
                    const { stdout } = await execAsync(
                        `netstat -ano | findstr :${this.port}`
                    );
                    if (!stdout.trim()) {
                        this.logger.info(
                            "server",
                            `Port ${this.port} is now free`
                        );
                        return true;
                    }
                } else {
                    const { stdout } = await execAsync(`lsof -ti:${this.port}`);
                    if (!stdout.trim()) {
                        this.logger.info(
                            "server",
                            `Port ${this.port} is now free`
                        );
                        return true;
                    }
                }
            } catch (verifyError) {
                // If the command fails, it likely means no process is using the port
                this.logger.info(
                    "server",
                    `Port ${this.port} appears to be free`
                );
                return true;
            }

            this.logger.info(
                "server",
                `Successfully processed port ${this.port} closure request`
            );
            return true;
        } catch (error: any) {
            this.logger.error(
                "server",
                `Error force closing port ${this.port}:`,
                error.message
            );
            return false;
        }
    }
}

