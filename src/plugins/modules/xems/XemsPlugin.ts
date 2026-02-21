import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";

interface XemsCommand {
    action: string;
    key?: string;
    value?: string;
    sandbox?: string;
    ttl?: string;
}

interface XemsResponse {
    status: string;
    data?: string;
    error?: string;
}

export class XemsError extends Error {
    constructor(
        public action: string,
        public details: string,
    ) {
        super(`[XEMS Error] ${action}: ${details}`);
        this.name = "XemsError";
    }
}

/**
 * XEMS Runner (Long-running process manager)
 * Manages the persistent Rust process for in-memory storage.
 */
export class XemsRunner {
    private process: ChildProcess | null = null;
    private queue: Array<(resolve: XemsResponse, reject: any) => void> = [];
    private isReady: boolean = false;
    private binaryPath: string;

    constructor() {
        this.binaryPath = this.discoverBinary();
        this.init();
    }

    /**
     * Finds the XEMS binary location.
     * Starts with development paths, falls back to production locations.
     */
    /**
     * Strategic discovery of the xems binary across different environments.
     * Robust logic handling dev, prod, and installed contexts.
     */
    private discoverBinary(): string {
        const binName = process.platform === "win32" ? "xems.exe" : "xems";

        // 1. Try discovery relative to this script (Best for npm/production installs)
        try {
            // Support both ESM and CJS environments
            const currentDir =
                typeof __dirname !== "undefined"
                    ? __dirname
                    : path.dirname(fileURLToPath(import.meta.url));

            const locations = [
                // Standard Project Structure: src/plugins/modules/xems/ -> bin/
                path.resolve(
                    currentDir,
                    "..",
                    "..",
                    "..",
                    "..",
                    "bin",
                    binName,
                ),
                // Dist structure (e.g. dist/src/plugins/...)
                path.resolve(
                    currentDir,
                    "..",
                    "..",
                    "..",
                    "..",
                    "..",
                    "bin",
                    binName,
                ),
            ];

            for (const loc of locations) {
                if (fs.existsSync(loc)) return loc;
            }
        } catch (e) {
            // Silently continue if path resolution fails
        }

        // 2. Try project root bin (Standard Local Production)
        const projectBin = path.resolve(process.cwd(), "bin", binName);
        if (fs.existsSync(projectBin)) return projectBin;

        // 3. Try development targets (Rust Cargo)
        // Check Release first for better performance if available
        const devTargets = [
            path.resolve(process.cwd(), "tools/XEMS/target/release", binName),
            path.resolve(process.cwd(), "tools/XEMS/target/debug", binName),
        ];

        for (const target of devTargets) {
            if (fs.existsSync(target)) return target;
        }

        // 4. Global fallback to PATH
        // We return the name hoping it's in the system PATH
        return binName;
    }

    private init() {
        if (
            !fs.existsSync(this.binaryPath) &&
            !this.binaryPath.endsWith("xems")
        ) {
            console.error(
                `[XEMS] Critical: Binary not found at ${this.binaryPath}`,
            );
            return; // Cannot spawn
        }

        try {
            this.process = spawn(this.binaryPath);

            this.process.stdout?.on("data", (data) => {
                const lines = data.toString().split("\n");
                for (const line of lines) {
                    if (line.trim()) {
                        this.handleResponse(line);
                    }
                }
            });

            this.process.stderr?.on("data", (data) => {
                // StdErr in Rust is used for logs, not necessarily fatal errors
                // console.error(`[XEMS Log] ${data}`);
            });

            this.process.on("close", (code) => {
                console.warn(
                    `[XEMS] Process exited with code ${code}. Restarting...`,
                );
                this.isReady = false;
                setTimeout(() => this.init(), 1000); // Simple auto-respawn
            });

            this.isReady = true;
        } catch (e) {
            console.error("[XEMS] Failed to spawn process", e);
        }
    }

    private handleResponse(jsonString: string) {
        if (this.queue.length > 0) {
            const resolver = this.queue.shift();
            try {
                const response = JSON.parse(jsonString) as XemsResponse;
                if (response.status === "error") {
                    // We resolve even on error to let the caller handle it via the response object,
                    // or we could reject. For XyPriss style, let's just return the response object.
                    resolver && resolver(response, null);
                } else {
                    resolver && resolver(response, null);
                }
            } catch (e) {
                console.error("[XEMS] Failed to parse response", e);
            }
        }
    }

    public execute(cmd: XemsCommand): Promise<XemsResponse> {
        return new Promise((resolve, reject) => {
            if (!this.isReady || !this.process || !this.process.stdin) {
                // If not ready, maybe try to wait or init? For now, fail fast.
                reject(
                    new XemsError(
                        cmd.action,
                        "XEMS not ready (process dead or initializing)",
                    ),
                );
                return;
            }

            this.queue.push((res, _err) => resolve(res));

            const payload = JSON.stringify(cmd) + "\n";
            this.process.stdin.write(payload);
        });
    }

    // --- Public API Sugar ---

    public async ping(): Promise<string> {
        const res = await this.execute({ action: "ping" });
        return res.data || "no-data";
    }

    public async set(
        sandbox: string,
        key: string,
        value: string,
    ): Promise<boolean> {
        const res = await this.execute({ action: "set", sandbox, key, value });
        return res.status === "ok";
    }

    public async get(sandbox: string, key: string): Promise<string | null> {
        const res = await this.execute({ action: "get", sandbox, key });
        return res.status === "ok" ? res.data || null : null;
    }
}

// Export singleton instance as the plugin interface
export const xems = new XemsRunner();

