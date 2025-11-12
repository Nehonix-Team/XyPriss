/**
 * Cross-Platform Memory Detection using Go CLI
 * Provides accurate memory information across all platforms
 */

import { spawn } from "child_process";
import { logger } from "../../../shared/logger/Logger";
import { join } from "path";
import { existsSync, readFileSync } from "fs";

// Handle ES modules where __dirname is not available
const __dirname =
    typeof globalThis !== "undefined" && (globalThis as any).__dirname
        ? (globalThis as any).__dirname
        : typeof import.meta !== "undefined" && import.meta.url
        ? new URL(".", import.meta.url).pathname.slice(1)
        : process.cwd();

/**
 * Memory information from Go CLI
 */
export interface CrossPlatformMemoryInfo {
    platform: string;
    totalMemory: number; // Total system memory in bytes
    availableMemory: number; // Available memory for applications
    freeMemory: number; // Truly free memory
    usedMemory: number; // Used memory
    usagePercentage: number; // Memory usage percentage
    buffersMemory: number; // Buffers (Linux/Unix)
    cachedMemory: number; // Cached memory (Linux/Unix)
    swapTotal: number; // Total swap space
    swapUsed: number; // Used swap space
    swapFree: number; // Free swap space
}

/**
 * Cross-platform memory detector using Go CLI
 */
export class CrossPlatformMemory {
    private cliPath: string;
    private fallbackEnabled: boolean;

    constructor(fallbackEnabled: boolean = true) {
        this.fallbackEnabled = fallbackEnabled;
        this.cliPath = this.findMemoryCLI();
    }

    /**
     * Find the appropriate memory CLI binary for current platform
     */
    private findMemoryCLI(): string {
        // First, try to find the binary in the XyPriss package directory
        const possiblePackageRoots = [
            // When running from node_modules/xypriss
            join(__dirname, "../../../.."), // from src/cluster/modules to package root
            join(__dirname, "../../.."), // alternative path
            // When running in development
            process.cwd(),
        ];

        let xyprissPackageRoot = "";

        // Look for XyPriss package root (contains our bin directory)
        for (const root of possiblePackageRoots) {
            const packageJson = join(root, "package.json");
            const binDir = join(root, "bin");

            if (existsSync(packageJson) && existsSync(binDir)) {
                try {
                    const pkg = JSON.parse(readFileSync(packageJson, "utf8"));
                    if (pkg.name === "xypriss") {
                        xyprissPackageRoot = root;
                        break;
                    }
                } catch {
                    // Continue searching if package.json is invalid
                }
            }
        }

        // If we didn't find XyPriss package, try various node_modules locations
        if (!xyprissPackageRoot) {
            const nodeModulesPaths = [
                join(process.cwd(), "node_modules", "xypriss"),
                join(process.cwd(), "..", "node_modules", "xypriss"),
                join(process.cwd(), "../..", "node_modules", "xypriss"),
                // Global node_modules (less common but possible)
                join(__dirname, "../../../../../xypriss"),
            ];

            for (const nodeModulesPath of nodeModulesPaths) {
                if (existsSync(nodeModulesPath)) {
                    const binDir = join(nodeModulesPath, "bin");
                    if (existsSync(binDir)) {
                        xyprissPackageRoot = nodeModulesPath;
                        break;
                    }
                }
            }
        }

        // Fallback to current working directory (development mode)
        if (!xyprissPackageRoot) {
            xyprissPackageRoot = process.cwd();
        }

        const binDir = join(xyprissPackageRoot, "bin");

        // Platform-specific binary names
        const platform = process.platform;
        const arch = process.arch;

        let binaryName: string;

        if (platform === "win32") {
            binaryName =
                arch === "arm64"
                    ? "memory-cli-windows-arm64.exe"
                    : "memory-cli-windows-x64.exe";
        } else if (platform === "darwin") {
            binaryName =
                arch === "arm64"
                    ? "memory-cli-darwin-arm64"
                    : "memory-cli-darwin-x64";
        } else if (platform === "linux") {
            binaryName = "memory-cli-linux-x64";
        } else {
            binaryName = "memory-cli"; // Generic fallback
        }

        const genericName =
            platform === "win32" ? "memory-cli.exe" : "memory-cli";

        // Check platform-specific binary first
        const binaryPath = join(binDir, binaryName);
        if (existsSync(binaryPath)) {
            logger.debug(
                "memory",
                `Found platform-specific binary: ${binaryPath}`
            );
            return binaryPath;
        }

        // Check generic binary
        const genericPath = join(binDir, genericName);
        if (existsSync(genericPath)) {
            logger.debug("memory", `Found generic binary: ${genericPath}`);
            return genericPath;
        }

        // Check if we're in development and binaries are in tools/memory-cli
        const devBinaryPath = join(
            xyprissPackageRoot,
            "tools",
            "memory-cli",
            "../../bin",
            binaryName
        );
        if (existsSync(devBinaryPath)) {
            logger.debug(
                "memory",
                `Found development binary: ${devBinaryPath}`
            );
            return devBinaryPath;
        }

        // Get platform-specific binary name for download URL
        const currentPlatform = process.platform;
        const currentArch = process.arch;
        let downloadBinaryName: string;

        if (currentPlatform === "win32") {
            downloadBinaryName =
                currentArch === "arm64"
                    ? "memory-cli-windows-arm64.exe"
                    : "memory-cli-windows-x64.exe";
        } else if (currentPlatform === "darwin") {
            downloadBinaryName =
                currentArch === "arm64"
                    ? "memory-cli-darwin-arm64"
                    : "memory-cli-darwin-x64";
        } else if (currentPlatform === "linux") {
            downloadBinaryName = "memory-cli-linux-x64";
        } else {
            downloadBinaryName = "memory-cli"; // Generic fallback
        }

        const downloadUrl = `https://sdk.nehonix.space/dl/mds/xypriss/bin/${downloadBinaryName}`;

        // If no binary found, log helpful message with installation instructions
        logger.warn(
            "memory",
            `Memory CLI binary not found. Searched:\n` +
                `  - ${binaryPath}\n` +
                `  - ${genericPath}\n` +
                `  - ${devBinaryPath}\n` +
                `Package root: ${xyprissPackageRoot}\n` +
                `Current working directory: ${process.cwd()}\n\n` +
                `To install the Memory CLI binary manually:\n` +
                `1. Download the binary for your platform (${currentPlatform}-${currentArch}):\n` +
                `   ${downloadUrl}\n` +
                `   Or visit: https://sdk.nehonix.space/dl/mds/xypriss/bin/\n` +
                `2. Create a 'bin' directory in your project root\n` +
                `3. Place the downloaded binary in the bin directory\n` +
                `4. Make it executable (chmod +x on Unix-like systems)\n\n` +
                `Using fallback memory detection method.`
        );
        return "";
    }

    /**
     * Get system memory information using Go CLI
     */
    public async getMemoryInfo(): Promise<CrossPlatformMemoryInfo> {
        if (!this.cliPath) {
            if (this.fallbackEnabled) {
                logger.warn(
                    "memory",
                    "Memory CLI not available, using fallback method"
                );
                return this.getFallbackMemoryInfo();
            } else {
                throw new Error(
                    "Memory CLI binary not found and fallback disabled"
                );
            }
        }

        try {
            const result = await this.executeMemoryCLI();
            logger.debug(
                "memory",
                "Successfully retrieved memory info from MCLI"
            );
            return result;
        } catch (error) {
            logger.error(
                "memory",
                "Failed to get memory info from MCLI:",
                error
            );

            if (this.fallbackEnabled) {
                logger.warn("memory", "Falling back to Node.js os module");
                return this.getFallbackMemoryInfo();
            } else {
                throw error;
            }
        }
    }

    /**
     * Execute the Go memory CLI and parse results
     */
    private async executeMemoryCLI(): Promise<CrossPlatformMemoryInfo> {
        return new Promise((resolve, reject) => {
            const child = spawn(this.cliPath, [], {
                stdio: ["pipe", "pipe", "pipe"],
                timeout: 5000, // 5 second timeout
            });

            let stdout = "";
            let stderr = "";

            child.stdout.on("data", (data) => {
                stdout += data.toString();
            });

            child.stderr.on("data", (data) => {
                stderr += data.toString();
            });

            child.on("close", (code) => {
                if (code === 0) {
                    try {
                        const memoryInfo: CrossPlatformMemoryInfo = JSON.parse(
                            stdout.trim()
                        );
                        resolve(memoryInfo);
                    } catch (parseError) {
                        reject(
                            new Error(
                                `Failed to parse memory CLI output: ${parseError}`
                            )
                        );
                    }
                } else {
                    reject(
                        new Error(
                            `Memory CLI exited with code ${code}: ${stderr}`
                        )
                    );
                }
            });

            child.on("error", (error) => {
                reject(
                    new Error(`Failed to execute memory CLI: ${error.message}`)
                );
            });
        });
    }

    /**
     * Fallback memory detection using Node.js os module
     */
    private async getFallbackMemoryInfo(): Promise<CrossPlatformMemoryInfo> {
        const os = await import("os");
        const totalMemory = os.totalmem();
        const freeMemory = os.freemem();
        const usedMemory = totalMemory - freeMemory;

        // Try to get more accurate available memory on Linux
        let availableMemory = freeMemory;
        if (process.platform === "linux") {
            try {
                const fs = await import("fs");
                const meminfo = await fs.promises.readFile(
                    "/proc/meminfo",
                    "utf8"
                );
                const availableMatch = meminfo.match(
                    /MemAvailable:\s+(\d+)\s+kB/
                );
                if (availableMatch) {
                    availableMemory = parseInt(availableMatch[1]) * 1024;
                }
            } catch {
                // Use os.freemem() as fallback
            }
        }

        const finalUsedMemory = totalMemory - availableMemory;

        return {
            platform: process.platform,
            totalMemory,
            availableMemory,
            freeMemory,
            usedMemory: finalUsedMemory,
            usagePercentage: (finalUsedMemory / totalMemory) * 100,
            buffersMemory: 0,
            cachedMemory: 0,
            swapTotal: 0,
            swapUsed: 0,
            swapFree: 0,
        };
    }

    /**
     * Check if Go CLI is available
     */
    public isCliAvailable(): boolean {
        return this.cliPath !== "" && existsSync(this.cliPath);
    }

    /**
     * Get CLI path for debugging
     */
    public getCliPath(): string {
        return this.cliPath;
    }

    /**
     * Test the memory CLI
     */
    public async testCli(): Promise<{
        success: boolean;
        error?: string;
        data?: CrossPlatformMemoryInfo;
    }> {
        try {
            const data = await this.getMemoryInfo();
            return { success: true, data };
        } catch (error) {
            return {
                success: false,
                error: error instanceof Error ? error.message : String(error),
            };
        }
    }

    /**
     * Format memory value for display
     */
    public static formatMemory(bytes: number): string {
        const units = ["B", "KB", "MB", "GB", "TB"];
        let size = bytes;
        let unitIndex = 0;

        while (size >= 1024 && unitIndex < units.length - 1) {
            size /= 1024;
            unitIndex++;
        }

        return `${size.toFixed(2)} ${units[unitIndex]}`;
    }

    /**
     * Get memory usage summary
     */
    public async getMemorySummary(): Promise<string> {
        try {
            const info = await this.getMemoryInfo();
            return [
                `Platform: ${info.platform}`,
                `Total: ${CrossPlatformMemory.formatMemory(info.totalMemory)}`,
                `Available: ${CrossPlatformMemory.formatMemory(
                    info.availableMemory
                )}`,
                `Used: ${CrossPlatformMemory.formatMemory(
                    info.usedMemory
                )} (${info.usagePercentage.toFixed(1)}%)`,
                info.swapTotal > 0
                    ? `Swap: ${CrossPlatformMemory.formatMemory(
                          info.swapUsed
                      )}/${CrossPlatformMemory.formatMemory(info.swapTotal)}`
                    : null,
            ]
                .filter(Boolean)
                .join(", ");
        } catch (error) {
            return `Memory info unavailable: ${
                error instanceof Error ? error.message : String(error)
            }`;
        }
    }
}

