/**
 * Validation utilities for ACPES
 */

import { DEFAULT_CONFIG } from "./constants";
 
/**
 * Validates if localStorage is available and functional
 */
export function isLocalStorageAvailable(): boolean {
    try {
        if (typeof localStorage === "undefined") return false;
        const test = "__test__";
        localStorage.setItem(test, test);
        localStorage.removeItem(test);
        return true;
    } catch {
        return false;
    }
}

/**
 * Checks if there's enough storage space for the given data size
 */
export function hasStorageSpace(dataSize: number): boolean {
    if (!isLocalStorageAvailable()) return true;
    try {
        let totalSize = 0;
        for (let key in localStorage) {
            if (localStorage.hasOwnProperty(key)) {
                totalSize += localStorage[key].length;
            }
        }
        return totalSize + dataSize < DEFAULT_CONFIG.MAX_STORAGE_SIZE;
    } catch {
        return true;
    }
}

/**
 * Validates version compatibility
 */
export function isVersionCompatible(
    version: string,
    currentVersion: string = DEFAULT_CONFIG.VERSION
): boolean {
    const currentMajor = parseInt(currentVersion.split(".")[0]);
    const dataMajor = parseInt(version?.split(".")[0] || "0");
    return dataMajor >= currentMajor - 1;
}

