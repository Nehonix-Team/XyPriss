/**
 * ID Generator Utility
 * Generates unique IDs for SecureObject instances
 */

import { NehoID } from "nehoid";

/**
 * Generates unique IDs for SecureObject instances
 */
export class IdGenerator {
    /**
     * Generates a unique ID for a SecureObject instance
     */
    static generate(): string {
        return NehoID.generate({ prefix: "sobj", size: 16 });
    }

    /**
     * Generates a unique ID with custom prefix
     */
    static generateWithPrefix(prefix: string): string {
        return NehoID.generate({ prefix, size: 16 });
    }

    /**
     * Generates a unique ID with custom size
     */
    static generateWithSize(size: number): string {
        return NehoID.generate({ prefix: "sobj", size });
    }

    /**
     * Generates a unique ID with custom prefix and size
     */
    static generateCustom(prefix: string, size: number): string {
        return NehoID.generate({ prefix, size });
    }

    /**
     * Validates if a string looks like a valid SecureObject ID
     */
    static isValidId(id: string): boolean {
        // Basic validation - starts with sobj_ and has reasonable length
        return typeof id === "string" && 
               id.startsWith("sobj_") && 
               id.length > 10 && 
               id.length < 50;
    }

    /**
     * Extracts the prefix from an ID
     */
    static extractPrefix(id: string): string | null {
        const underscoreIndex = id.indexOf("_");
        return underscoreIndex > 0 ? id.substring(0, underscoreIndex) : null;
    }

    /**
     * Extracts the unique part from an ID (without prefix)
     */
    static extractUniquePart(id: string): string | null {
        const underscoreIndex = id.indexOf("_");
        return underscoreIndex > 0 ? id.substring(underscoreIndex + 1) : null;
    }
}
