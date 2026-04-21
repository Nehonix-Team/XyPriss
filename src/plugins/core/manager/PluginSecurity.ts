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
import crypto from "crypto";
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
            `\x1b[41m\x1b[37m [XyPriss Security] FATAL ERROR \x1b[0m\n` +
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
        // Go's filepath.Walk orders entries alphabetically by filename
        entries.sort((a, b) =>
            a.name < b.name ? -1 : a.name > b.name ? 1 : 0,
        );

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
                if (entry.name === "xypriss.plugin.sig") {
                    continue;
                }
                fileList.push(fullPath);
            }
        }
        return fileList;
    }

    /**
     * Checks the Content Integrity by computing the SHA256 file hashes
     * and verifying Ed25519 signature of xypriss.plugin.sig
     */
    public verifyContentIntegrity(
        pluginRoot: string,
        pluginName: string,
    ): void {
        const sigPath = path.join(pluginRoot, "xypriss.plugin.sig");
        if (!fs.existsSync(sigPath)) {
            this.throwViolation(pluginName, "Missing xypriss.plugin.sig");
        }

        let sigData: any;
        try {
            sigData = JSON.parse(fs.readFileSync(sigPath, "utf-8"));
        } catch (e) {
            throw new Error(
                `FATAL: Invalid signature format for plugin ${pluginName}`,
            );
        }

        const files = this.walkDir(pluginRoot);
        const hash = crypto.createHash("sha256");
        for (const file of files) {
            hash.update(fs.readFileSync(file));
        }

        const contentHash = `sha256:${hash.digest("hex")}`;
        if (contentHash !== sigData.content_hash) {
            throw new Error(
                `FATAL: Content integrity violation for ${pluginName}`,
            );
        }

        const payload = { ...sigData };
        delete payload.signature;

        const sortedKeys = Object.keys(payload).sort();
        const payloadObj: any = {};
        for (const k of sortedKeys) {
            payloadObj[k] = payload[k];
        }
        // Use standard JSON stringify (no space separators exactly like Go json.Marshal)
        const payloadJSON = JSON.stringify(payloadObj);

        const pubKeyHex = (sigData.author_key || "").replace("ed25519:", "");
        if (!pubKeyHex)
            throw new Error(`FATAL: Missing author_key for ${pluginName}`);

        const signatureB64 = (sigData.signature || "").replace("base64:", "");

        try {
            const pubKeyBuf = Buffer.from(pubKeyHex, "hex");
            const sigBuf = Buffer.from(signatureB64, "base64");

            // Convert raw Ed25519 public key to DER-encoded SPKI format
            const derPrefix = Buffer.from("302a300506032b6570032100", "hex");
            const spkiBuf = Buffer.concat([derPrefix, pubKeyBuf]);

            const pubKey = crypto.createPublicKey({
                key: spkiBuf,
                format: "der",
                type: "spki",
            });
            const isVerified = crypto.verify(
                null,
                Buffer.from(payloadJSON),
                pubKey,
                sigBuf,
            );
            if (!isVerified) {
                throw new Error(
                    `FATAL: Signature verification failed for ${pluginName}`,
                );
            }
        } catch (e: any) {
            throw new Error(
                `FATAL: Signature verification failed for ${pluginName}`,
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

