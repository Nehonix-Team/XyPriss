import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import { randomBytes } from "node:crypto";
import { Logger } from "../../../../shared/logger";

interface XemsCommand {
    action: string;
    key?: string;
    value?: string;
    sandbox?: string;
    ttl?: string;
}

interface XemsOptions {
    persistPath?: string;
    cacheSize?: number;
    secret?: string;
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
    private options: XemsOptions = {};
    private logger: Logger;

    constructor(options: XemsOptions = {}) {
        this.options = options;
        this.binaryPath = this.discoverBinary();
        this.logger = new Logger();

        // Lazy load: init() is now called either when persistence is enabled
        // or during the first command if needed.
    }

    /**
     * Enables hardware-bound persistent storage for XEMS.
     */
    public enablePersistence(
        path: string,
        secret: string,
        resources?: { cacheSize?: number },
    ) {
        this.options.persistPath = path;
        this.options.secret = secret;
        if (resources?.cacheSize) {
            this.options.cacheSize = resources.cacheSize;
        }
        if (!path) {
            throw new XemsError(
                "EPNOTDEF",
                "Path is required when persistence is enabled",
            );
        }

        this.logger.warn(
            "plugins",
            `Persistence enabled: ${path}. Restarting process...`,
        );

        if (this.process) {
            // Remove the close listener before killing to prevent auto-respawn in a loop
            this.process.removeAllListeners("close");
            this.process.kill();
        }

        // Re-init immediately
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
            this.logger.error(
                "xems",
                `Critical: Binary not found at ${this.binaryPath}`,
            );
            return; // Cannot spawn
        }

        try {
            const args = [];
            if (this.options.persistPath) {
                args.push("--persist", this.options.persistPath);
            }
            if (this.options.secret) {
                args.push("--secret", this.options.secret);
            }
            if (this.options.cacheSize) {
                args.push("--cache-size", this.options.cacheSize.toString());
            }

            this.process = spawn(this.binaryPath, args);

            this.process.stdout?.on("data", (data) => {
                const lines = data.toString().split("\n");
                for (const line of lines) {
                    if (line.trim()) {
                        this.handleResponse(line);
                    }
                }
            });

            this.process.stderr?.on("data", (data) => {
                this.logger.error("xems", `[XEMS Log] ${data}`);
            });

            this.process.on("close", (code) => {
                this.isReady = false;
                if (code !== 0 && code !== null) {
                    this.logger.warn(
                        "xems",
                        `Process exited unexpectedly with code ${code}. Restarting in 2s...`,
                    );
                    setTimeout(() => this.init(), 2000);
                }
            });

            this.isReady = true;
        } catch (e) {
            this.logger.error("xems", `Failed to spawn process ${e}`);
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
                this.logger.error("xems", `Failed to parse response ${e}`);
            }
        }
    }

    public async execute(cmd: XemsCommand): Promise<XemsResponse> {
        // Auto-initialize if process not started
        if (!this.process) {
            this.init();
        }

        // Wait a bit if not ready (startup grace period)
        if (!this.isReady) {
            for (let i = 0; i < 10; i++) {
                if (this.isReady) break;
                await new Promise((r) => setTimeout(r, 100));
            }
        }

        return new Promise((resolve, reject) => {
            if (!this.isReady || !this.process || !this.process.stdin) {
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

    /**
     * Set a value in a sandbox with optional TTL.
     */
    public async set(
        sandbox: string,
        key: string,
        value: string,
        ttl?: string,
    ): Promise<boolean> {
        const res = await this.execute({
            action: "set",
            sandbox,
            key,
            value,
            ttl,
        });
        return res.status === "ok";
    }

    /**
     * Get a value from a sandbox.
     */
    public async get(sandbox: string, key: string): Promise<string | null> {
        const res = await this.execute({ action: "get", sandbox, key });
        return res.status === "ok" ? res.data || null : null;
    }

    /**
     * [SESSION LAYER] Creates a new session entry.
     * Generates a random opaque token, stores `data` under it, and returns the token.
     * Use this when you don't care about the key — you just want a session handle.
     *
     * @param sandbox - The isolated namespace to store the session in
     * @param data    - Any serializable data to associate with the session
     * @param options - Optional TTL and rotation settings
     * @returns The generated session token (opaque handle)
     */
    public async createSession(
        sandbox: string,
        data: any,
        options: { ttl?: string; rotate?: boolean } = {},
    ): Promise<string> {
        const token = randomBytes(24).toString("hex");
        const value = typeof data === "string" ? data : JSON.stringify(data);

        await this.set(sandbox, token, value, options.ttl);
        return token;
    }

    /**
     * [SESSION LAYER] Resolves a session token back to its data.
     * Optionally rotates the token (invalidates old one, issues a new one) to
     * prevent replay attacks.
     *
     * @param token   - The opaque session token previously returned by createSession
     * @param options - sandbox, optional rotation, optional new TTL
     * @returns `{ data, newToken? }` or `null` if the token is expired/unknown
     */
    public async resolveSession(
        token: string,
        options: { sandbox: string; rotate?: boolean; ttl?: string },
    ): Promise<{ data: any; newToken?: string } | null> {
        const raw = await this.get(options.sandbox, token);
        if (!raw) return null;

        let data;
        try {
            data = JSON.parse(raw);
        } catch {
            data = raw;
        }

        if (options.rotate) {
            const newToken = await this.createSession(options.sandbox, data, {
                ttl: options.ttl,
            });
            // Invalidate the old token immediately
            await this.execute({
                action: "del",
                sandbox: options.sandbox,
                key: token,
            });
            return { data, newToken };
        }

        return { data };
    }
}

// Export singleton instance as the plugin interface
export const xems = new XemsRunner();

