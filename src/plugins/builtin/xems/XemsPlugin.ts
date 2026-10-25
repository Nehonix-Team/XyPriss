import { spawn, ChildProcess } from "node:child_process";
import path from "node:path";
import fs from "node:fs";
import { fileURLToPath } from "node:url";
import * as readline from "node:readline";
import { Logger } from "../../../shared/logger";
import { XyApp } from "../../../types/XyApp.type";
import { XyAppInternal } from "../../../types/httpServer.type";
import { getRandomBytes } from "xypriss-security";
import { SynapxClient } from "../../../xhsc/synapx/SynapxClient";
// import { getSysApi } from "../../const/getSysApi";

// const path = getSysApi().path;
interface XemsCommand {
    action: string;
    key?: string;
    value?: string;
    sandbox?: string;
    ttl?: string;
    rotate?: boolean;
    grace_period?: number;
}

interface XemsOptions {
    persistPath?: string;
    cacheSize?: number;
    secret?: string;
    gracePeriod?: number; // ms, default 1000ms
}

interface XemsResponse {
    status: string;
    data?: string;
    new_token?: string;
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
    private synapxClient: SynapxClient | null = null;
    private socketPath: string | null = null;
    private initPromise: Promise<void> | null = null;
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
    private static runnersByPath = new Map<string, XemsRunner>();

    /**
     * Internal factory for getting or creating a runner for a specific path.
     * This ensures only one process exists for a given file in the entire process.
     */
    public static getInstance(
        pathStr: string,
        options: XemsOptions = {},
    ): XemsRunner {
        const absPath = path.resolve(process.cwd(), pathStr);
        const existing = XemsRunner.runnersByPath.get(absPath);

        if (existing) {
            // Merge options if provided
            if (options.secret) existing.options.secret = options.secret;
            return existing;
        }

        const runner = new XemsRunner({ ...options, persistPath: pathStr });
        XemsRunner.runnersByPath.set(absPath, runner);
        return runner;
    }

    public enablePersistence(
        pathStr: string,
        secret: string,
        resources?: { cacheSize?: number },
    ) {
        if (!pathStr) {
            throw new XemsError(
                "EPNOTDEF",
                "Path is required when persistence is enabled",
            );
        }

        const dir = path.dirname(pathStr);
        if (dir && dir !== "." && !fs.existsSync(dir)) {
            try {
                fs.mkdirSync(dir, { recursive: true });
            } catch (err) {
                this.logger.error(
                    "xems",
                    `Failed to create persistence directory: ${dir}`,
                );
            }
        }

        // Register this runner in the global registry for this path
        const absPath = path.resolve(process.cwd(), pathStr);
        const existing = XemsRunner.runnersByPath.get(absPath);
        if (existing && existing !== this) {
            this.logger.warn(
                "xems",
                `Path ${pathStr} is already being managed by another runner. Switching to shared mode.`,
            );
            // Transitions this instance to delegate to the existing one if needed?
            // Actually, for simplicity, we just ensure WE don't spawn if another one is already there.
        }
        XemsRunner.runnersByPath.set(absPath, this);

        // Avoid redundant restarts if path is the same
        if (this.options.persistPath === pathStr && this.process) {
            return;
        }

        this.options.persistPath = pathStr;
        this.options.secret = secret;
        if (resources?.cacheSize) {
            this.options.cacheSize = resources.cacheSize;
        }

        this.logger.warn(
            "plugins",
            `Persistence enabled: ${path.resolve(pathStr)}. Restarting process...`,
        );

        if (this.process) {
            // Remove the close listener before killing to prevent auto-respawn in a loop
            this.process.removeAllListeners("close");
            this.process.kill();
            this.process = null;
        }
        if (this.synapxClient) {
            try {
                this.synapxClient.destroy();
            } catch {}
            this.synapxClient = null;
        }
        this.isReady = false;
        this.initPromise = null;

        // Re-init immediately
        this.init().catch((err) => {
            this.logger.error("xems", `Failed to restart XEMS with persistence: ${err}`);
        });
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

        // 1. Precise discovery relative to the script location
        try {
            const currentFile = fileURLToPath(import.meta.url);
            const currentDir = path.dirname(currentFile);

            // We search up from the current file to find the package root
            let walkDir = currentDir;
            // Limit walk to 10 levels to prevent infinite loops or excessive searching
            for (let i = 0; i < 10; i++) {
                const potentialBin = path.join(walkDir, "bin", binName);
                if (fs.existsSync(potentialBin)) return potentialBin;

                const parent = path.dirname(walkDir);
                if (parent === walkDir || parent === path.parse(walkDir).root)
                    break;
                walkDir = parent;
            }
        } catch (e) {
            // Silently continue
        }

        // 2. Try project root bin (Standard Local Production)
        const projectBin = path.resolve(process.cwd(), "bin", binName);
        if (fs.existsSync(projectBin)) return projectBin;

        // 3. Deep discovery: Search up from CWD
        // This handles monorepos, symlinked packages, and subfolder execution.
        let walkDir = process.cwd();
        while (walkDir !== path.parse(walkDir).root) {
            // Check node_modules/.bin (Standard for installed packages)
            const nodeModulesBin = path.join(walkDir, "node_modules", ".bin");
            const potentialBin = path.join(nodeModulesBin, binName);
            if (fs.existsSync(potentialBin)) return potentialBin;

            // Also check a local "bin" folder at each level
            const localBin = path.join(walkDir, "bin");
            const localBinary = path.join(localBin, binName);
            if (fs.existsSync(localBinary)) return localBinary;

            walkDir = path.dirname(walkDir);
        }

        // 4. Try development target paths (Go build targets)
        const devTargets = [
            path.resolve(process.cwd(), "tools/XEMS/bin", binName),
            path.resolve(process.cwd(), "tools/XEMS/dist", binName),
            path.resolve(process.cwd(), "tools/XEMS/bin/xems"),
            path.resolve(process.cwd(), "tools/XEMS/dist/xems"),
        ];

        for (const target of devTargets) {
            if (fs.existsSync(target)) return target;
        }

        // 5. Global fallback to PATH (Binary must be globally available)
        return binName;
    }

    private async init(): Promise<void> {
        if (this.initPromise) {
            return this.initPromise;
        }

        this.initPromise = (async () => {
            if (
                !fs.existsSync(this.binaryPath) &&
                !this.binaryPath.endsWith("xems")
            ) {
                this.logger.error(
                    "xems",
                    `Critical: Binary not found at ${this.binaryPath}`,
                );
                return;
            }

            try {
                // Determine isolated session directory (inherits from libXESS confinement environment)
                const sessionDir =
                    process.env.XYPRISS_USER_TMP ||
                    process.env.XESS_SESSION_TMP ||
                    path.resolve(process.cwd(), ".private");

                if (!fs.existsSync(sessionDir)) {
                    try {
                        fs.mkdirSync(sessionDir, { recursive: true });
                    } catch {}
                }

                // Dedicated private socket inside the mode 0700 session folder
                const hash = process.env.XYPRISS_SESSION_HASH || String(process.pid);
                this.socketPath = path.join(sessionDir, `xems_${hash}.sock`);

                // Clean stale socket if it exists
                if (fs.existsSync(this.socketPath)) {
                    try {
                        fs.unlinkSync(this.socketPath);
                    } catch {}
                }

                const args = ["--socket", this.socketPath];
                if (this.options.persistPath) {
                    args.push("--persist", this.options.persistPath);
                }
                // CRITICAL SECURITY REMEDIATION:
                // NEVER pass this.options.secret in CLI args!
                // It is transmitted exclusively over the authenticated libSynapx private IPC stream.
                if (this.options.cacheSize) {
                    args.push("--cache-size", this.options.cacheSize.toString());
                }

                this.process = spawn(this.binaryPath, args, {
                    stdio: ["ignore", "pipe", "pipe"],
                });

                this.process.stderr?.on("data", (data) => {
                    this.logger.error("xems", `[XEMS Log] ${data}`);
                });

                this.process.on("close", (code) => {
                    this.isReady = false;
                    if (this.synapxClient) {
                        try {
                            this.synapxClient.destroy();
                        } catch {}
                        this.synapxClient = null;
                    }
                    this.initPromise = null;
                    if (code !== 0 && code !== null) {
                        this.logger.warn(
                            "xems",
                            `Process exited unexpectedly with code ${code}. Restarting in 2s...`,
                        );
                        setTimeout(() => this.init(), 2000);
                    }
                });

                // Wait for socket to become active (up to 3 seconds)
                let connected = false;
                for (let i = 0; i < 30; i++) {
                    if (fs.existsSync(this.socketPath)) {
                        connected = true;
                        break;
                    }
                    await new Promise((r) => setTimeout(r, 100));
                }

                if (!connected) {
                    throw new Error(`Timeout waiting for XEMS IPC socket at ${this.socketPath}`);
                }

                // Connect SynapxClient to xems.sock
                this.synapxClient = new SynapxClient(this.socketPath);
                await this.synapxClient.connect();

                // Zero-Trust Handshake: Transmit vault secret over private IPC stream
                if (this.options.secret || this.options.persistPath) {
                    await this.synapxClient.call("xems", "init", [], {
                        secret: this.options.secret || "",
                        persistPath: this.options.persistPath || "",
                    });
                }

                this.isReady = true;
            } catch (e) {
                this.logger.error("xems", `Failed to spawn/initialize XEMS process: ${e}`);
                this.initPromise = null;
            }
        })();

        return this.initPromise;
    }

    public async execute(cmd: XemsCommand): Promise<XemsResponse> {
        if (!this.process || !this.synapxClient) {
            await this.init();
        }

        if (!this.isReady) {
            for (let i = 0; i < 30; i++) {
                if (this.isReady) break;
                await new Promise((r) => setTimeout(r, 100));
            }
        }

        if (!this.isReady || !this.synapxClient) {
            throw new XemsError(
                cmd.action,
                "XEMS not ready (process dead or initializing)",
            );
        }

        try {
            switch (cmd.action) {
                case "ping": {
                    const res = await this.synapxClient.call<any>("xems", "ping");
                    return { status: "ok", data: typeof res === "object" ? res.data : res };
                }
                case "set": {
                    const args = [cmd.sandbox || "default", cmd.key || "", cmd.value || ""];
                    const opts: Record<string, any> = {};
                    if (cmd.ttl) opts.ttl = cmd.ttl;
                    const res = await this.synapxClient.call<any>("xems", "set", args, opts);
                    return { status: "ok", data: typeof res === "object" ? res.data : res };
                }
                case "get": {
                    const args = [cmd.sandbox || "default", cmd.key || ""];
                    const opts: Record<string, any> = {};
                    if (cmd.rotate) opts.rotate = true;
                    if (cmd.grace_period) opts.gracePeriod = cmd.grace_period;
                    if (cmd.ttl) opts.ttl = cmd.ttl;
                    const res = await this.synapxClient.call<any>("xems", "get", args, opts);
                    if (typeof res === "object" && res !== null) {
                        return {
                            status: "ok",
                            data: res.data !== undefined ? res.data : res.value,
                            new_token: res.new_token || res.newToken,
                        };
                    }
                    return { status: "ok", data: res };
                }
                case "del": {
                    const args = [cmd.sandbox || "default", cmd.key || ""];
                    const res = await this.synapxClient.call<any>("xems", "del", args);
                    return { status: "ok", data: typeof res === "object" ? res.data : res };
                }
                default: {
                    const res = await this.synapxClient.call<any>("xems", cmd.action, [
                        cmd.sandbox || "",
                        cmd.key || "",
                        cmd.value || "",
                    ]);
                    return { status: "ok", data: typeof res === "object" ? res.data : res };
                }
            }
        } catch (err: any) {
            return {
                status: "error",
                error: err?.message || String(err),
            };
        }
    }

    // --- Public API Sugar ---

    public async ping(): Promise<string> {
        const res = await this.execute({ action: "ping" });
        return res.data || "no-data";
    }

    /**
     * Set a value in a sandbox with optional TTL.
     */
    private async set(
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
        this.logger.debug(
            "xems",
            `set execute result: status=${res.status}${res.data ? " data=" + res.data : ""}`,
        );
        return res.status === "ok";
    }

    /**
     * Get a value from a sandbox.
     */
    private async get(sandbox: string, key: string): Promise<string | null> {
        const res = await this.execute({ action: "get", sandbox, key });
        return res.status === "ok" ? res.data || null : null;
    }

    /**
     * Delete/Invalidate a key in a sandbox.
     */
    private async del(sandbox: string, key: string): Promise<boolean> {
        const res = await this.execute({ action: "del", sandbox, key });
        return res.status === "ok";
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
        const token = getRandomBytes(24).toString("hex");
        const value = typeof data === "string" ? data : JSON.stringify(data);

        await this.set(sandbox, token, value, options.ttl);
        return token;
    }

    /**
     * [SESSION LAYER] Resolves a session token back to its data.
     * Optionally rotates the token (invalidates old one, issues a new one) to
     * prevent replay attacks.
     *
     * USES ATOMIC ROTATION with Grace Period to prevent race conditions on
     * simultaneous requests.
     *
     * @param token   - The opaque session token previously returned by createSession
     * @param options - sandbox, optional rotation, optional new TTL, optional custom grace period
     * @returns `{ data, newToken? }` or `null` if the token is expired/unknown
     */
    public async resolveSession(
        token: string,
        options: {
            sandbox: string;
            rotate?: boolean;
            ttl?: string;
            gracePeriod?: number;
        },
    ): Promise<{ data: any; newToken?: string } | null> {
        // Use atomic 'rotate' logic from Rust if rotate is requested
        const res = await this.execute({
            action: "get",
            sandbox: options.sandbox,
            key: token,
            rotate: options.rotate,
            ttl: options.ttl,
            grace_period:
                options.gracePeriod || this.options.gracePeriod || 1000,
        });

        this.logger.debug(
            "xems",
            `resolveSession execute result: status=${res.status}${res.error ? " error=" + res.error : ""}`,
        );

        if (res.status !== "ok" || !res.data) return null;

        let data;
        try {
            data = JSON.parse(res.data);
        } catch {
            data = res.data;
        }

        return {
            data,
            newToken: res.new_token,
        };
    }
    /**
     * Fluent API entry point. Returns a context for a specific sandbox.
     * @example xems.from("auth").set("user:1", data)
     */
    public from(sandbox: string): XemsSandboxContext {
        return new XemsSandboxContext(this, sandbox);
    }

    /**
     * Alias for from()
     * Fluent API entry point. Returns a context for a specific sandbox.
     * @example xems.select("auth").set("user:1", data)
     */
    public select(sandbox: string): XemsSandboxContext {
        return new XemsSandboxContext(this, sandbox);
    }

    /**
     * Contextual retrieval for multi-server environments.
     * Returns the XEMS instance attached to the provided app object if available,
     * otherwise returns this instance.
     */
    public forApp(app: XyAppInternal | XyApp): XemsRunner {
        if (!app) return this;
        const candidate =
            (app as any).xems ||
            (app as any)._xems ||
            ((app as any).appInstance && ((app as any).appInstance.xems || (app as any).appInstance._xems)) ||
            ((app as any).server && ((app as any).server.app?.xems || (app as any).server.xems));
        return candidate || this;
    }

    /**
     * Forcefully stops the XEMS process and cleans up resources.
     */
    public destroy(): void {
        if (this.synapxClient) {
            try {
                this.synapxClient.destroy();
            } catch {}
            this.synapxClient = null;
        }
        if (this.process) {
            this.process.removeAllListeners("close");
            this.process.kill();
            this.process = null;
        }
        if (this.socketPath && fs.existsSync(this.socketPath)) {
            try {
                fs.unlinkSync(this.socketPath);
            } catch {}
        }
        this.isReady = false;
        this.initPromise = null;
    }
}

/**
 * Contextual wrapper for XEMS operations within a specific sandbox.
 * Provides a cleaner, fluent API for advanced operations.
 */
class XemsSandboxContext {
    constructor(
        private runner: XemsRunner,
        private sandbox: string,
    ) {}

    /** Set a value in this sandbox */
    public async set(
        key: string,
        value: string,
        ttl?: string,
    ): Promise<boolean> {
        return (this.runner as any).set(this.sandbox, key, value, ttl);
    }

    /** Get a value from this sandbox */
    public async get(key: string): Promise<string | null> {
        return (this.runner as any).get(this.sandbox, key);
    }

    /** Remove a key from this sandbox */
    public async del(key: string): Promise<boolean> {
        return (this.runner as any).del(this.sandbox, key);
    }

    /**
     * Perform an atomic rotation of a token in this sandbox.
     * Returns the original data and the new rotated token.
     */
    public async rotate(
        token: string,
        options: { ttl?: string; gracePeriod?: number } = {},
    ): Promise<{ data: any; newToken?: string } | null> {
        return (this.runner as any).resolveSession(token, {
            sandbox: this.sandbox,
            rotate: true,
            ttl: options.ttl,
            gracePeriod: options.gracePeriod,
        });
    }

    /**
     * Create a new session in this sandbox.
     */
    public async createSession(
        data: any,
        options: { ttl?: string } = {},
    ): Promise<string> {
        return (this.runner as any).createSession(this.sandbox, data, options);
    }
}

// Export singleton instance as the plugin interface
export const xems = new XemsRunner();

