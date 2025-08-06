/**
 * Node.js platform storage implementation for CPESS
 * Uses file system for secure storage
 */

import { SecureStorageOptions } from "../types/options";
import { PlatformModules } from "../core/platform";
 
/**
 * Node.js storage implementation using file system
 */
export class NodeStorage {
    private storagePath: string;

    constructor(storagePath: string) {
        this.storagePath = storagePath;
        this.initializeStorage();
    }

    /**
     * Initialize Node.js file system storage
     */
    private async initializeStorage(): Promise<void> {
        if (PlatformModules.fs && PlatformModules.path) {
            try {
                await PlatformModules.fs.mkdir(this.storagePath, { recursive: true });
            } catch (error) {
                console.warn("Could not create Node.js storage directory:", error);
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

        const filePath = PlatformModules.path.join(this.storagePath, `${key}.enc`);
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

        try {
            const filePath = PlatformModules.path.join(this.storagePath, `${key}.enc`);
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
            const filePath = PlatformModules.path.join(this.storagePath, `${key}.enc`);
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
            const encFiles = files.filter((file: string) => file.endsWith(".enc"));

            await Promise.all(
                encFiles.map((file: string) =>
                    PlatformModules.fs.unlink(PlatformModules.path.join(this.storagePath, file))
                )
            );
            return true;
        } catch (error) {
            return false;
        }
    }
}
