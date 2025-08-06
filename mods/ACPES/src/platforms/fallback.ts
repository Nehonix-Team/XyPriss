/**
 * Fallback storage implementation for ACPES
 * Uses memory storage or localStorage as fallback
 */

import { SecureStorageOptions } from "../types/options";
import { isLocalStorageAvailable } from "../utils/validation";
import { generateStorageKey } from "../utils/helpers";
 
/**
 * Fallback storage implementation using memory or localStorage
 */
export class FallbackStorage {
    private memoryStorage: Map<string, string> = new Map();

    /**
     * Store data in fallback storage
     */
    async setItem(
        key: string,
        data: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        if (isLocalStorageAvailable()) {
            const storageKey = generateStorageKey(key);
            localStorage.setItem(storageKey, data);
            return true;
        } else {
            this.memoryStorage.set(key, data);
            return true;
        }
    }

    /**
     * Retrieve data from fallback storage
     */
    async getItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<string | null> {
        if (isLocalStorageAvailable()) {
            const storageKey = generateStorageKey(key);
            return localStorage.getItem(storageKey);
        } else {
            return this.memoryStorage.get(key) || null;
        }
    }

    /**
     * Remove data from fallback storage
     */
    async removeItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        if (isLocalStorageAvailable()) {
            const storageKey = generateStorageKey(key);
            localStorage.removeItem(storageKey);
        } else {
            this.memoryStorage.delete(key);
        }
        return true;
    }

    /**
     * Clear all data from fallback storage
     */
    async clear(): Promise<boolean> {
        if (isLocalStorageAvailable()) {
            const keys = Object.keys(localStorage).filter((key) =>
                key.startsWith("secure_")
            );
            keys.forEach((key) => localStorage.removeItem(key));
        } else {
            this.memoryStorage.clear();
        }
        return true;
    }
}

