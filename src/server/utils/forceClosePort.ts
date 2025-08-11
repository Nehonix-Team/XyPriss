import { Logger } from "../../../shared/logger/Logger";
import { exec } from "child_process";
import { promisify } from "util";

interface PortProcess {
    pid: string;
    protocol: string;
    state?: string;
}

interface PortCheckResult {
    isInUse: boolean;
    processes: PortProcess[];
}

export class Port {
    private logger: Logger;
    private port: number;
    private execAsync: (
        command: string
    ) => Promise<{ stdout: string; stderr: string }>;
    private readonly MAX_RETRIES = 3;
    private readonly RETRY_DELAY = 500;
    private readonly PORT_FREE_WAIT = 1000;

    constructor(port: number) {
        this.port = this._validatePort(port);
        this.logger = Logger.getInstance();
        this.execAsync = promisify(exec);
    }

    /**
     * Attempt to forcefully close/free up the specified port
     * @returns Promise<boolean> - true if successful, false if failed
     */
    public async forceClosePort(): Promise<boolean> {
        try {
            this.logger.debug(
                "server",
                `Attempting to force close port ${this.port}...`
            );

            // Check if port is actually in use
            const portCheck = await this._checkPortStatus();
            if (!portCheck.isInUse) {
                this.logger.debug("server", `Port ${this.port} is already free`);
                return true;
            }

            // Kill processes using the port
            const success = await this._killPortProcesses(portCheck.processes);
            if (!success) {
                return false;
            }

            // Wait for port to be freed
            await this._waitForPortFree();

            // Final verification
            const finalCheck = await this._verifyPortIsFree();
            if (finalCheck) {
                this.logger.info("server", `Port ${this.port} is now free`);
                return true;
            } else {
                this.logger.warn(
                    "server",
                    `Port ${this.port} may still be in use after cleanup attempt`
                );
                return false;
            }
        } catch (error: any) {
            this.logger.error(
                "server",
                `Error force closing port ${this.port}:`,
                error.message
            );
            return false;
        }
    }

    /**
     * Validates that the port number is within valid range
     * @param port - The port number to validate
     * @returns The validated port number
     * @throws Error if port is invalid
     */
    private _validatePort(port: number): number {
        if (!Number.isInteger(port) || port < 1 || port > 65535) {
            throw new Error(
                `Invalid port number: ${port}. Port must be between 1 and 65535.`
            );
        }
        return port;
    }

    /**
     * Checks the current status of the port
     * @returns Promise<PortCheckResult> - Information about port usage
     */
    private async _checkPortStatus(): Promise<PortCheckResult> {
        try {
            const processes = await this._getPortProcesses();
            return {
                isInUse: processes.length > 0,
                processes,
            };
        } catch (error: any) {
            this.logger.debug(
                "server",
                `Error checking port status: ${error.message}`
            );
            return { isInUse: false, processes: [] };
        }
    }

    /**
     * Gets list of processes using the port
     * @returns Promise<PortProcess[]> - Array of processes using the port
     */
    private async _getPortProcesses(): Promise<PortProcess[]> {
        const processes: PortProcess[] = [];

        if (process.platform === "win32") {
            return this._getWindowsPortProcesses();
        } else {
            return this._getUnixPortProcesses();
        }
    }

    /**
     * Gets processes using the port on Windows
     * @returns Promise<PortProcess[]> - Array of Windows processes
     */
    private async _getWindowsPortProcesses(): Promise<PortProcess[]> {
        const processes: PortProcess[] = [];

        try {
            const { stdout } = await this._executeWithRetry(
                `netstat -ano | findstr :${this.port}`
            );
            const lines = stdout.split("\n").filter((line) => line.trim());

            for (const line of lines) {
                const parts = line.trim().split(/\s+/);
                if (parts.length >= 5) {
                    const localAddress = parts[1];
                    const protocol = parts[0];
                    const state = parts[3];
                    const pid = parts[4];

                    // Ensure this is exactly our port (not a port that contains our port number)
                    if (
                        this._isExactPortMatch(localAddress, this.port) &&
                        pid &&
                        pid !== "0"
                    ) {
                        processes.push({ pid, protocol, state });
                    }
                }
            }
        } catch (error: any) {
            this.logger.debug(
                "server",
                `Windows netstat command failed: ${error.message}`
            );
        }

        return processes;
    }

    /**
     * Gets processes using the port on Unix-like systems
     * @returns Promise<PortProcess[]> - Array of Unix processes
     */
    private async _getUnixPortProcesses(): Promise<PortProcess[]> {
        const processes: PortProcess[] = [];

        try {
            const { stdout } = await this._executeWithRetry(
                `lsof -ti:${this.port}`
            );
            const pids = stdout
                .trim()
                .split("\n")
                .filter((pid) => pid && pid.trim());

            for (const pid of pids) {
                if (pid.trim()) {
                    // Get additional process info
                    try {
                        const { stdout: processInfo } = await this.execAsync(
                            `lsof -p ${pid.trim()} | grep :${this.port}`
                        );
                        const protocol =
                            this._extractProtocolFromLsof(processInfo);
                        processes.push({ pid: pid.trim(), protocol });
                    } catch {
                        // Fallback if detailed info fails
                        processes.push({
                            pid: pid.trim(),
                            protocol: "unknown",
                        });
                    }
                }
            }
        } catch (error: any) {
            this.logger.debug(
                "server",
                `Unix lsof command failed: ${error.message}`
            );
        }

        return processes;
    }

    /**
     * Kills all processes using the port
     * @param processes - Array of processes to kill
     * @returns Promise<boolean> - true if all processes were handled successfully
     */
    private async _killPortProcesses(
        processes: PortProcess[]
    ): Promise<boolean> {
        let allSuccessful = true;

        for (const process of processes) {
            const success = await this._killSingleProcess(process);
            if (!success) {
                allSuccessful = false;
            }
        }

        return allSuccessful;
    }

    /**
     * Kills a single process
     * @param process - The process to kill
     * @returns Promise<boolean> - true if successful or process no longer exists
     */
    private async _killSingleProcess(process: PortProcess): Promise<boolean> {
        try {
            this.logger.debug(
                "server",
                `Attempting to kill process ${process.pid} (${process.protocol}) using port ${this.port}`
            );

            if (globalThis.process.platform === "win32") {
                await this._executeWithRetry(`taskkill /F /PID ${process.pid}`);
            } else {
                // Try graceful kill first, then force kill
                try {
                    await this._executeWithRetry(`kill ${process.pid}`);
                    await new Promise((resolve) => setTimeout(resolve, 500));

                    // Check if process still exists
                    const stillExists = await this._processExists(process.pid);
                    if (stillExists) {
                        await this._executeWithRetry(`kill -9 ${process.pid}`);
                    }
                } catch {
                    // Fallback to force kill
                    await this._executeWithRetry(`kill -9 ${process.pid}`);
                }
            }

            this.logger.info(
                "server",
                `Successfully killed process ${process.pid} using port ${this.port}`
            );
            return true;
        } catch (error: any) {
            // Handle common scenarios where process is already gone or protected
            if (this._isProcessAlreadyGoneError(error.message)) {
                this.logger.info(
                    "server",
                    `Process ${process.pid} using port ${this.port} had already exited`
                );
                return true;
            } else if (this._isProcessProtectedError(error.message)) {
                this.logger.warn(
                    "server",
                    `Process ${process.pid} is protected and cannot be killed`
                );
                return false;
            } else {
                this.logger.warn(
                    "server",
                    `Failed to kill process ${process.pid}: ${error.message}`
                );
                return false;
            }
        }
    }

    /**
     * Executes a command with retry logic
     * @param command - Command to execute
     * @returns Promise with command result
     */
    private async _executeWithRetry(
        command: string
    ): Promise<{ stdout: string; stderr: string }> {
        let lastError: any;

        for (let attempt = 1; attempt <= this.MAX_RETRIES; attempt++) {
            try {
                return await this.execAsync(command);
            } catch (error) {
                lastError = error;
                if (attempt < this.MAX_RETRIES) {
                    this.logger.debug(
                        "server",
                        `Command failed (attempt ${attempt}/${this.MAX_RETRIES}), retrying: ${command}`
                    );
                    await new Promise((resolve) =>
                        setTimeout(resolve, this.RETRY_DELAY)
                    );
                }
            }
        }

        throw lastError;
    }

    /**
     * Waits for the port to be freed
     */
    private async _waitForPortFree(): Promise<void> {
        await new Promise((resolve) =>
            setTimeout(resolve, this.PORT_FREE_WAIT)
        );
    }

    /**
     * Verifies that the port is now free
     * @returns Promise<boolean> - true if port is free
     */
    private async _verifyPortIsFree(): Promise<boolean> {
        try {
            const portCheck = await this._checkPortStatus();
            return !portCheck.isInUse;
        } catch (error) {
            // If check fails, assume port is free (commands typically fail when nothing is using the port)
            return true;
        }
    }

    /**
     * Checks if a process still exists
     * @param pid - Process ID to check
     * @returns Promise<boolean> - true if process exists
     */
    private async _processExists(pid: string): Promise<boolean> {
        try {
            if (process.platform === "win32") {
                await this.execAsync(
                    `tasklist /FI "PID eq ${pid}" | findstr ${pid}`
                );
            } else {
                await this.execAsync(`kill -0 ${pid}`);
            }
            return true;
        } catch {
            return false;
        }
    }

    /**
     * Checks if the address exactly matches our port
     * @param address - Network address string (e.g., "0.0.0.0:3000")
     * @param port - Port number to match
     * @returns boolean - true if exact match
     */
    private _isExactPortMatch(address: string, port: number): boolean {
        const portPattern = new RegExp(`:${port}$`);
        return portPattern.test(address);
    }

    /**
     * Extracts protocol information from lsof output
     * @param lsofOutput - Output from lsof command
     * @returns string - Protocol type
     */
    private _extractProtocolFromLsof(lsofOutput: string): string {
        if (lsofOutput.includes("TCP")) return "TCP";
        if (lsofOutput.includes("UDP")) return "UDP";
        return "unknown";
    }

    /**
     * Determines if error indicates process is already gone
     * @param errorMessage - Error message to check
     * @returns boolean - true if process no longer exists
     */
    private _isProcessAlreadyGoneError(errorMessage: string): boolean {
        const goneIndicators = [
            "n'a pas pu être arrêté",
            "could not be terminated",
            "No such process",
            "not found",
            "ERROR: The process",
        ];

        return goneIndicators.some((indicator) =>
            errorMessage.toLowerCase().includes(indicator.toLowerCase())
        );
    }

    /**
     * Determines if error indicates process is protected
     * @param errorMessage - Error message to check
     * @returns boolean - true if process is protected
     */
    private _isProcessProtectedError(errorMessage: string): boolean {
        const protectedIndicators = [
            "Operation not permitted",
            "Access denied",
            "insufficient privilege",
        ];

        return protectedIndicators.some((indicator) =>
            errorMessage.toLowerCase().includes(indicator.toLowerCase())
        );
    }
}

