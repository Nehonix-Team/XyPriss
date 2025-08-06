/**
 * Node.js platform storage implementation for CPESS
 * Uses file system for secure storage
 */

import { SecureStorageOptions } from "../types/options";
import { PlatformModules } from "../core/platform";
import { TerminalPrompt } from "../utils/prompt";

/**
 * Node.js storage implementation using file system
 */
export class NodeStorage {
    private storagePath: string;

    constructor(storagePath: string) {
        this.storagePath = storagePath;
        // Directory creation will happen on first use in ensureDirectoryExists
    }

    /**
     * Ensure directory exists for a given file path
     */
    private async ensureDirectoryExists(filePath: string): Promise<void> {
        if (PlatformModules.fs && PlatformModules.path) {
            try {
                const dir = PlatformModules.path.dirname(filePath);
                await PlatformModules.fs.mkdir(dir, { recursive: true });
            } catch (error) {
                // Directory might already exist, ignore error
            }
        }
    }

    /**
     * Store data in Node.js file system
     */
    async setItem(
        key: string,
        data: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        if (!PlatformModules.fs || !PlatformModules.path) {
            return false;
        }

        // Handle authentication prompt for Node.js
        // Only show prompt if explicitly requested via showModal
        if (options.showModal === true) {
            const message = options.requireAuth
                ? "Authentication required to store secure data"
                : "Confirm storage of secure data";

            const authenticated = await TerminalPrompt.showAuthenticationPrompt(
                message
            );
            if (!authenticated) {
                return false;
            }
        }

        // Use custom filePath if provided, otherwise use default storage path
        const filePath =
            options.filePath ||
            PlatformModules.path.join(
                this.storagePath,
                `${key.slice(0, 9)}:nehonix.${key.slice(4, 14)}.enc`
            );

        // Ensure directory exists for the file path
        await this.ensureDirectoryExists(filePath);

        // Also ensure the default storage directory exists if not using custom path
        if (!options.filePath) {
            await this.ensureDirectoryExists(this.storagePath + "/dummy");
        }

        await PlatformModules.fs.writeFile(filePath, data, "utf8");
        return true;
    }

    /**
     * Retrieve data from Node.js file system
     */
    async getItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<string | null> {
        if (!PlatformModules.fs || !PlatformModules.path) {
            return null;
        }

        // Handle authentication prompt for Node.js
        // Only show prompt if explicitly requested via showModal
        if (options.showModal === true) {
            const message = options.requireAuth
                ? "Authentication required to access secure data"
                : "Confirm access to secure data";

            const authenticated = await TerminalPrompt.showAuthenticationPrompt(
                message
            );
            if (!authenticated) {
                return null;
            }
        }

        try {
            // Use custom filePath if provided, otherwise use default storage path
            const filePath =
                options.filePath ||
                PlatformModules.path.join(
                    this.storagePath,
                    `${key.slice(0, 9)}:nehonix.${key.slice(4, 14)}.enc`
                );
            return await PlatformModules.fs.readFile(filePath, "utf8");
        } catch (error) {
            return null;
        }
    }

    /**
     * Remove data from Node.js file system
     */
    async removeItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        if (!PlatformModules.fs || !PlatformModules.path) {
            return false;
        }

        try {
            // Use custom filePath if provided, otherwise use default storage path
            const filePath =
                options.filePath ||
                PlatformModules.path.join(
                    this.storagePath,
                    `${key.slice(0, 9)}:nehonix.${key.slice(4, 14)}.enc`
                );
            await PlatformModules.fs.unlink(filePath);
            return true;
        } catch (error) {
            return false;
        }
    }

    /**
     * Clear all data from Node.js file system
     */
    async clear(): Promise<boolean> {
        if (!PlatformModules.fs || !PlatformModules.path) {
            return false;
        }

        try {
            const files = await PlatformModules.fs.readdir(this.storagePath);
            const encFiles = files.filter((file: string) =>
                file.endsWith(".enc")
            );

            await Promise.all(
                encFiles.map((file: string) =>
                    PlatformModules.fs.unlink(
                        PlatformModules.path.join(this.storagePath, file)
                    )
                )
            );
            return true;
        } catch (error) {
            return false;
        }
    }
}

