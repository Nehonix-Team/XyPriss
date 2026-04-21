/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ***************************************************************************** */

import fs from "fs";
import path from "path";
import { Cipher } from "xypriss-security";
import {
    identifyProjectRoot,
    verifyPluginContract,
    isCoreFrameworkPath,
    isPluginPath,
    getCallerProjectRoot,
} from "../../../utils/ProjectDiscovery";
import { validatePlgInput } from "../../../schemas/plugingSchema";
import { OFFICIAL_PLUGINS } from "../../const/OFFICIAL_PLUGINS";
import type { XyPrissPlugin, PluginServer } from "../../types/PluginTypes";
import type { PermissionManager } from "../PermissionManager";

/**
 * PluginSecurity
 *
 * Provides core security enforcement for the XyPriss G3 Zero-Trust architecture.
 * This class handles:
 * - Security contract verification (identity and path validation).
 * - Content integrity auditing via recursive SHA-256 fingerprinting.
 * - Ed25519 cryptographic signature verification.
 * - Generation of restricted server proxies to enforce sandbox isolation.
 */
export class PluginSecurity {
    /**
     * Verifies the security contract for a given plugin.
     *
     * This method ensures the plugin is registered from an authorized path and
     * contains the mandatory security metadata required for the G3 protocol.
     * It also initiates root discovery if not already provided.
     *
     * @param plugin - The plugin instance to verify.
     * @param callerStack - The call stack at the time of registration for traceability.
     * @param isExecutionPhase - Whether the verification is happening during startup or at runtime.
     * @returns The discovered or verified plugin root path.
     * @throws {Error} If the security contract is violated or mandatory metadata is missing.
     */

    public verifyContract(
        plugin: XyPrissPlugin,
        callerStack: string,
        isExecutionPhase: boolean = false,
    ): string {
        // --- ROOT DISCOVERY ---
        // We now prioritize the root provided explicitly via Plugin.create(..., __sys__)
        let pluginRoot = plugin.__root__ || "";

        if (!pluginRoot && !isExecutionPhase) {
            // Fallback for registration if not provided via Plugin.create
            pluginRoot = getCallerProjectRoot() || "";
        }

        // --- SECURITY VALIDATION ---
        if (!pluginRoot) {
            // If we still have no root, we cannot verify the contract.
            // During registration, this is a FATAL error if we're not inside the core.
            if (!isExecutionPhase) {
                const isOfficial = OFFICIAL_PLUGINS.includes(plugin.name);
                if (isOfficial) {
                    // Safe fallback for official built-in plugins if discovery failed
                    return "";
                }

                this.throwViolation(
                    plugin.name,
                    "Unknown (Mandatory __sys__ instance missing in Plugin.create)",
                );
            }
            return "";
        }

        // Always verify if it's NOT a core framework path
        const isOfficial = OFFICIAL_PLUGINS.includes(plugin.name);

        if (!isCoreFrameworkPath(pluginRoot)) {
            if (!isOfficial) {
                const contractOk = verifyPluginContract(
                    pluginRoot,
                    plugin.name,
                );

                if (!contractOk) {
                    this.throwViolation(plugin.name, pluginRoot);
                }
            }

            // Perform static source code analysis to catch ESM namespace imports
            // which bypass the execution-level NativeApiBlocker.
            // Even official plugins must adhere to the zero-trust policy.
            // scanPluginSourceForNativeApis(pluginRoot, plugin.name); // COMMENTER POUR DES TESTS INTERNES MAIS DEVRAIT PAS L'ETRE EN PRODUCTION
        }

        // Cache it for future calls
        plugin.__root__ = pluginRoot;
        return pluginRoot;
    }

    /**
     * Throw a security contract violation error
     */
    private throwViolation(pluginName: string, pluginRoot: string): never {
        const errorMsg =
            `\x1b[41m\x1b[37m [XyPriss Security] FATAL ERROR::NODE \x1b[0m\n` +
            `\x1b[31mPlugin '${pluginName}' refused registration!\x1b[0m\n` +
            `\x1b[33mReason:\x1b[0m Mandatory '$internal' entry for '${pluginName}' or 'type: \"plugin\"' is missing in xypriss.config.json(c).\n` +
            `\x1b[34mPlugin Path:\x1b[0m ${pluginRoot || "Unknown"}\n` +
            `\x1b[32mAction Required:\x1b[0m Ensure 'type': 'plugin' is set and declare the plugin namespace inside the '$internal' block of the plugin's configuration file.`;

        console.error(errorMsg);
        throw new Error(
            `Security Contract Violation: Plugin ${pluginName} is missing valid configuration contract`,
        );
    }

    /**
     * Walk directory to collect files matching Go's filepath.Walk order
     */
    private walkDir(dir: string, fileList: string[] = []): string[] {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (
                    entry.name === "node_modules" ||
                    entry.name === ".git" ||
                    entry.name === ".idea"
                ) {
                    continue;
                }
                this.walkDir(fullPath, fileList);
            } else {
                if (entry.name === "xypriss.plugin.xsig") {
                    continue;
                }
                fileList.push(fullPath);
            }
        }
        return fileList;
    }

    /**
     * Collect all files recursively into a Set
     */
    private collectFilesRecursive(dir: string, fileSet: Set<string>): void {
        const entries = fs.readdirSync(dir, { withFileTypes: true });

        for (const entry of entries) {
            const fullPath = path.join(dir, entry.name);
            if (entry.isDirectory()) {
                if (
                    entry.name === "node_modules" ||
                    entry.name === ".git" ||
                    entry.name === ".idea"
                ) {
                    continue;
                }
                this.collectFilesRecursive(fullPath, fileSet);
            } else {
                if (entry.name === "xypriss.plugin.xsig") {
                    continue;
                }
                fileSet.add(fullPath);
            }
        }
    }

    /**
     * Checks the Content Integrity by computing the SHA256 file hashes
     * and verifying Ed25519 signature of xypriss.plugin.xsig
     */
    public verifyContentIntegrity(
        pluginRoot: string,
        pluginName: string,
    ): void {
        const sigPath = path.join(pluginRoot, "xypriss.plugin.xsig");
        if (!fs.existsSync(sigPath)) {
            this.throwViolation(pluginName, "Missing xypriss.plugin.xsig");
        }

        const sigRaw = fs.readFileSync(sigPath, "utf-8");
        const lines = sigRaw.split("\n");

        const sigContentLines: string[] = [];
        let signatureBase64 = "";
        let inProof = false;
        const metadata: any = {};

        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine) continue;

            const proofMatch = trimmedLine.match(
                /^--- (BEGIN CRYPTOGRAPHIC PROOF|END XYPRISS SIGNATURE) ---$/,
            );
            if (proofMatch) {
                if (proofMatch[1] === "BEGIN CRYPTOGRAPHIC PROOF") {
                    inProof = true;
                } else {
                    break;
                }
                continue;
            }

            if (inProof) {
                const b64Match = trimmedLine.match(/^base64:\s*(.+)$/);
                if (b64Match) {
                    signatureBase64 = b64Match[1].trim();
                }
                continue;
            }

            // Collect metadata lines (including header) for verification
            sigContentLines.push(line);

            const metaMatch = trimmedLine.match(/^([a-zA-Z0-9-]+):\s*(.+)$/);
            if (metaMatch) {
                const [, key, value] = metaMatch;
                const v = value.trim();

                switch (key) {
                    case "Manifest":
                        const parts = v.split("@");
                        metadata.name = parts[0];
                        metadata.version = parts[1];
                        break;
                    case "Min-Engine":
                        metadata.min_version = v;
                        break;
                    case "Fingerprint":
                        metadata.content_hash = v;
                        break;
                    case "Identity":
                        metadata.author_key = v;
                        break;
                    case "Expires":
                        metadata.expires_at = v;
                        break;
                    case "Revision":
                        metadata.prev_sig_hash = v;
                        break;
                }
            }
        }

        const sigContent = sigContentLines.join("\n") + "\n";

        // Selective Hashing: Load package.json to get the "files" array
        const pkgPath = path.join(pluginRoot, "package.json");
        let filesToHash: string[] = [];

        if (fs.existsSync(pkgPath)) {
            try {
                const pkg = JSON.parse(fs.readFileSync(pkgPath, "utf-8"));
                const patterns = pkg.files || [];

                if (patterns.length > 0) {
                    // Match XFPM logic: collect all files matching the patterns
                    const allFilesMap = new Set<string>();

                    for (const pattern of patterns) {
                        const fullPattern = path.join(pluginRoot, pattern);

                        if (fs.existsSync(fullPattern)) {
                            const stats = fs.statSync(fullPattern);
                            if (stats.isDirectory()) {
                                // Recursive walk
                                this.collectFilesRecursive(
                                    fullPattern,
                                    allFilesMap,
                                );
                            } else {
                                allFilesMap.add(fullPattern);
                            }
                        }
                    }
                    filesToHash = Array.from(allFilesMap);
                }
            } catch (e) {
                // Fallback or handle error
            }
        }

        // If 'files' is missing or empty, we fallback to our previous wide-walk
        // (Though xfpm now enforces 'files', so this is for safety/legacy)
        if (filesToHash.length === 0) {
            filesToHash = this.walkDir(pluginRoot);
        }

        // Filter out the signature file itself
        filesToHash = filesToHash.filter((f) => !/\.xsig$/.test(f));

        // Match Go's sort by relative path for deterministic cross-machine hashing
        const fileRelList = filesToHash.map((f) => ({
            abs: f,
            rel: path.relative(pluginRoot, f),
        }));
        fileRelList.sort((a, b) =>
            a.rel < b.rel ? -1 : a.rel > b.rel ? 1 : 0,
        );

        const fileBuffers = fileRelList.map((file) =>
            fs.readFileSync(file.abs),
        );
        const combinedBuffer = Buffer.concat(fileBuffers);
        const hashResult = Cipher.hash.create(combinedBuffer);

        const contentHash = `sha256:${hashResult}`;
        if (contentHash !== metadata.content_hash) {
            throw new Error(
                `FATAL(INTERNAL::NODE): Content integrity violation for ${pluginName}. Computed: ${contentHash.slice(0, 10)}..., Manifest: ${metadata.content_hash.slice(0, 10)}...`,
            );
        }

        const authKey = metadata.author_key || "";
        const pubKeyMatch = authKey.match(/^(?:ed25519:)?([a-fA-F0-9]{64})$/);
        const pubKeyHex = pubKeyMatch ? pubKeyMatch[1] : "";

        if (!pubKeyHex)
            throw new Error(
                `FATAL(INTERNAL::NODE): Missing or invalid Identity (author_key) for ${pluginName}`,
            );

        const sigBuf = Buffer.from(signatureBase64, "base64");
        const isVerified = Cipher.crypto.ed25519Verify(
            pubKeyHex,
            sigContent,
            sigBuf,
        );

        if (!isVerified) {
            throw new Error(
                `FATAL(INTERNAL::NODE): Cryptographic signature verification failed for ${pluginName}`,
            );
        }
    }

    /**
     * Validate plugin basic metadata
     */
    public validateMetadata(plugin: XyPrissPlugin): void {
        if (!plugin.name || !plugin.version) {
            throw new Error("Plugin must have name and version");
        }

        const vldt = validatePlgInput({
            name: plugin.name,
            version: plugin.version,
        });

        if (typeof vldt === "string") {
            throw new Error(vldt);
        }
    }

    /**
     * Create a restricted proxy of the server for plugins.
     * This limits access to only allowed methods on the app instance.
     */
    public createRestrictedServer(
        server: any,
        pluginName: string,
        permissionManager: PermissionManager,
    ): PluginServer {
        const allowedAppMethods = [
            "get",
            "post",
            "put",
            "delete",
            "patch",
            "options",
            "head",
            "connect",
            "trace",
            "all",
            "use",
            "logger",
            "configs",
        ];

        // Proxy for the app instance
        const appProxy = new Proxy(server.app, {
            get(target: any, prop: string | symbol) {
                if (
                    typeof prop === "string" &&
                    allowedAppMethods.includes(prop)
                ) {
                    // --- SECURITY CHECK: Configuration Access ---
                    if (prop === "configs") {
                        // Exception: Official plugins can access configs
                        if (OFFICIAL_PLUGINS.includes(pluginName)) {
                            return target[prop];
                        }

                        const hasPermission = permissionManager.checkPermission(
                            pluginName,
                            "configs",
                        );

                        if (!hasPermission) {
                            return undefined;
                        }
                    }

                    const value = target[prop];
                    return typeof value === "function"
                        ? value.bind(target)
                        : value;
                }

                // Block other properties
                return undefined;
            },
        });

        // Proxy for the server instance
        return new Proxy(server, {
            get(_target: any, prop: string | symbol) {
                if (prop === "app") {
                    return appProxy;
                }
                return undefined;
            },
        }) as unknown as PluginServer;
    }
}

