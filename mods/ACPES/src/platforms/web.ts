/**
 * Web platform storage implementation for CPESS
 */

import { SecureStorageOptions } from "../types/options";
import { isLocalStorageAvailable, hasStorageSpace } from "../utils/validation";
import { generateStorageKey } from "../utils/helpers";
 
/**
 * Web storage implementation using localStorage and IndexedDB
 */
export class WebStorage {
    private dbPromise: Promise<IDBDatabase> | null = null;

    constructor() {
        this.initializeIndexedDB();
    }

    /**
     * Initialize IndexedDB for web storage
     */
    private initializeIndexedDB(): void {
        if (typeof window !== "undefined" && "indexedDB" in window) {
            this.dbPromise = new Promise((resolve, reject) => {
                const request = indexedDB.open("SecureStorage", 1);

                request.onerror = () => reject(request.error);
                request.onsuccess = () => resolve(request.result);

                request.onupgradeneeded = (event) => {
                    const db = (event.target as IDBOpenDBRequest).result;
                    if (!db.objectStoreNames.contains("secureData")) {
                        db.createObjectStore("secureData");
                    }
                };
            });
        }
    }

    /**
     * Store data in web storage
     */
    async setItem(
        key: string,
        data: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        const storageKey = generateStorageKey(key);

        if (isLocalStorageAvailable() && !options.useIndexedDB) {
            if (!hasStorageSpace(data.length)) {
                throw new Error("Insufficient storage space");
            }
            localStorage.setItem(storageKey, data);
            return true;
        } else if (this.dbPromise) {
            const db = await this.dbPromise;
            const transaction = db.transaction(["secureData"], "readwrite");
            const store = transaction.objectStore("secureData");

            await new Promise((resolve, reject) => {
                const request = store.put(data, storageKey);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
            return true;
        }
        return false;
    }

    /**
     * Retrieve data from web storage
     */
    async getItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<string | null> {
        const storageKey = generateStorageKey(key);

        if (isLocalStorageAvailable() && !options.useIndexedDB) {
            return localStorage.getItem(storageKey);
        } else if (this.dbPromise) {
            const db = await this.dbPromise;
            const transaction = db.transaction(["secureData"], "readonly");
            const store = transaction.objectStore("secureData");

            return await new Promise((resolve, reject) => {
                const request = store.get(storageKey);
                request.onsuccess = () => resolve(request.result || null);
                request.onerror = () => reject(request.error);
            });
        }
        return null;
    }

    /**
     * Remove data from web storage
     */
    async removeItem(
        key: string,
        options: SecureStorageOptions = {}
    ): Promise<boolean> {
        const storageKey = generateStorageKey(key);

        if (isLocalStorageAvailable()) {
            localStorage.removeItem(storageKey);
        }

        if (this.dbPromise) {
            const db = await this.dbPromise;
            const transaction = db.transaction(["secureData"], "readwrite");
            const store = transaction.objectStore("secureData");

            await new Promise((resolve, reject) => {
                const request = store.delete(storageKey);
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return true;
    }

    /**
     * Clear all data from web storage
     */
    async clear(): Promise<boolean> {
        if (isLocalStorageAvailable()) {
            const keys = Object.keys(localStorage).filter((key) =>
                key.startsWith("secure_")
            );
            keys.forEach((key) => localStorage.removeItem(key));
        }

        if (this.dbPromise) {
            const db = await this.dbPromise;
            const transaction = db.transaction(["secureData"], "readwrite");
            const store = transaction.objectStore("secureData");

            await new Promise((resolve, reject) => {
                const request = store.clear();
                request.onsuccess = () => resolve(request.result);
                request.onerror = () => reject(request.error);
            });
        }
        return true;
    }
}
