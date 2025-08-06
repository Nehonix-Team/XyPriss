/**
 * Platform Detection Module
 *
 * Handles cross-platform detection for Web, Node.js, and Mobile environments
 * without requiring React Native dependency.
 */

import { Logger } from "../../../../shared/logger";

/**
 * Platform detection utility
 * Determines the current runtime environment
 */
export const Platform = {
    OS:
        typeof window !== "undefined"
            ? "web"
            : typeof global !== "undefined" && global.process?.versions?.node
            ? "node"
            : "unknown",
    get isWeb() {
        return this.OS === "web";
    },
    get isNode() {
        return this.OS === "node";
    },
    get isMobile() {
        return !this.isWeb && !this.isNode;
    },
};

/**
 * Conditional module imports based on platform
 * These are loaded dynamically to avoid import errors on unsupported platforms
 */
export class PlatformModules {
    public static Keychain: any = null;
    public static fs: any = null;
    public static path: any = null;
    private static logger: Logger;

    /**
     * Initialize platform-specific modules
     * This should be called once during application startup
     */
    public static async initialize(): Promise<void> {
        this.logger = new Logger({
            components: {
                acpes: true,
            },
        });
        try {
            if (Platform.isMobile) {
                // Try to dynamically import React Native keychain
                try {
                    // Use string-based import to avoid TypeScript resolution issues
                    const moduleName = "react-native-keychain";
                    const keychain = await import(moduleName);
                    this.Keychain = keychain;
                } catch (keychainError) {
                    this.logger.warn("acpes",
                        "React Native Keychain not available, using fallback storage"
                    );
                    this.Keychain = null;
                }
            } else if (Platform.isNode) {
                // Dynamic import for Node.js modules
                const fs = await import("fs");
                const path = await import("path");
                this.fs = fs.promises;
                this.path = path;
            }
        } catch (error: any) {
            this.logger.warn("acpes",
                "Platform-specific modules not available:",
                error.message
            );
        }
    }

    /**
     * Synchronous initialization for Node.js modules using require
     * This is a fallback for environments where dynamic imports don't work
     */
    public static initializeSync(): void {
        try {
            if (Platform.isMobile && typeof require !== "undefined") {
                // Try to require React Native keychain synchronously
                try {
                    this.Keychain = require("react-native-keychain");
                } catch (keychainError) {
                    this.logger.warn("acpes",
                        "React Native Keychain not available, using fallback storage"
                    );
                    this.Keychain = null;
                }
            } else if (Platform.isNode && typeof require !== "undefined") {
                this.fs = require("fs").promises;
                this.path = require("path");
            }
        } catch (error: any) {
            this.logger.warn("acpes",
                "Synchronous platform modules not available:",
                error.message
            );
        }
    }
}

// Initialize modules on import
PlatformModules.initialize();

