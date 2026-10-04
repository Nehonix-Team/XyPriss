import path from "node:path";
import fs from "node:fs";
import { execFileSync, spawn, ChildProcess } from "node:child_process";
import { Readable, Writable } from "node:stream";
import { fileURLToPath } from "node:url";
import { Logger } from "../shared/logger/Logger";
import { CommandResult } from "./cmdr";
import { getInternalSignature } from "../server/const/XHSC_SIGNATURE";
import { Platform } from "./utils/Platform";
import { Discovery } from "./utils/Discovery";
import { getSysApi } from "../plugins/const/getSysApi";
import { SynapxClient } from "./synapx/SynapxClient";

/**
 * Custom error class for XyPriss system operations.
 */
export class XyPrissError extends Error {
    constructor(
        public module: string,
        public action: string,
        public details: string,
        public raw?: any,
    ) {
        super(`[XyPriss Error] ${module}.${action} failed: ${details}`);
        this.name = "XyPrissError";
    }
}

/**
 * **Native System Runner**
 *
 * This class serves as the core bridge between the Node.js runtime and the
 * high-performance system core. It manages process spawning, argument
 * serialization, and bidirectional streaming.
 */
export class XyPrissRunner {
    private binaryPath: string;

    constructor(private root: string) {
        this.binaryPath = this.discoverBinary();
        //  console.log(
        //      "[XyPrissRunner:getBinaryPath] Binary path: ",
        //      this.discoverBinary(),
        //  );
    }

    public getRoot(): string {
        // console.log("[XyPrissRunner:getRoot] Binary root: ", this.root);
        return this.root;
    }

    public getBinaryPath(): string {
        return this.binaryPath;
    }

    /**
     * Strategic discovery of the XyPriss System binary.
     * Prioritizes the high-performance Go implementation (XHSC-GO).
     */
    private discoverBinary(): string {
        // 1. Environment Variable Override (Highest Priority)
        const envPath = Discovery.getFromEnv("XYPRISS_XHSC_PATH");
        if (envPath) return envPath;

        const osPart = Platform.getOsPart();
        const archPart = Platform.getArchPart();
        const suffix = Platform.getBinarySuffix();

        // Candidate names in order of preference
        const goBinName = `xhsc-${osPart}-${archPart}${suffix}`;
        const genericBinName = osPart === "windows" ? "xhsc.exe" : "xhsc";
        const candidates = [goBinName, genericBinName];

        const searchBases: string[] = [];

        // 2. Add Script Directory (where the library is located)
        const scriptDir = Discovery.getScriptDir();
        if (scriptDir) searchBases.push(scriptDir);

        // 3. Add Current Working Directory
        searchBases.push(process.cwd());

        // Perform recursive search from all bases using Discovery engine
        const resolved = Discovery.resolveBinary(candidates, searchBases);
        if (resolved) return resolved;

        // Final fallback (generic name which might be in PATH via system spawn)
        return genericBinName;
    }

    /**
     * Executes a command synchronously and returns the parsed JSON result.
     * Standardizes all responses into a Promise-like data structure.
     */
    /**
     * Executes a command synchronously via libSynapx IPC and returns the parsed result.
     */
    public runSync<T = any>(
        module: string,
        action: string, 
        args: string[] = [],
        options: any = {},
    ): T {
        try {
            const synapx = SynapxClient.getInstance();
            return synapx.callSync<T>(module, action, args, options);
        } catch (error: any) {
            if (error instanceof XyPrissError) throw error;
            throw new XyPrissError(module, action, error.message || String(error), error);
        }
    }

    /**
     * Executes a command asynchronously via libSynapx IPC and returns the parsed result.
     */
    public async runAsync<T = any>(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {},
    ): Promise<T> {
        try {
            const synapx = SynapxClient.getInstance();
            return await synapx.call<T>(module, action, args, options);
        } catch (error: any) {
            if (error instanceof XyPrissError) throw error;
            throw new XyPrissError(module, action, error.message || String(error), error);
        }
    }

    /**
     * Run a module action and return the stdout as a Readable stream
     */
    public runStream(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {},
    ): Readable {
        const internalSig = getInternalSignature();
        const cmdArgs = [
            "--root",
            this.root,
            module,
            action,
            ...args,
        ];

        for (const [key, value] of Object.entries(options)) {
            if (["input"].includes(key)) continue;

            const flag = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
            if (value === true) cmdArgs.push(`--${flag}`);
            else if (value !== false && value !== undefined) {
                cmdArgs.push(`--${flag}`, String(value));
            }
        }

        const child = spawn(this.binaryPath, cmdArgs, {
            cwd: this.root,
            env: {
                ...process.env,
                ...(internalSig ? { XYPRISS_INTERNAL_TOKEN: internalSig } : {}),
            },
        });

        if (options.input !== undefined) {
            child.stdin.write(options.input);
            child.stdin.end();
        }

        // Return the stdout stream
        return child.stdout;
    }

    /**
     * Run a module action and return the stdin as a Writable stream
     */
    public runWritableStream(
        module: string,
        action: string,
        args: string[] = [],
        options: any = {},
    ): Writable {
        const internalSig = getInternalSignature();
        const cmdArgs = [
            "--root",
            this.root,
            module,
            action,
            ...args,
        ];

        for (const [key, value] of Object.entries(options)) {
            const flag = key.replace(/[A-Z]/g, (m) => "-" + m.toLowerCase());
            if (value === true) cmdArgs.push(`--${flag}`);
            else if (value !== false && value !== undefined) {
                cmdArgs.push(`--${flag}`, String(value));
            }
        }

        const child = spawn(this.binaryPath, cmdArgs, {
            cwd: this.root,
            env: {
                ...process.env,
                ...(internalSig ? { XYPRISS_INTERNAL_TOKEN: internalSig } : {}),
            },
        });

        // Return the stdin stream with an explicit close() method
        const stdin = child.stdin;
        // @ts-ignore
        stdin.close = () => stdin.end();
        return stdin;
    }
}

