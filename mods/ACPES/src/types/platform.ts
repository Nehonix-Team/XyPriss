/**
 * Platform-related type definitions
 */
 
/**
 * Supported platform types
 */
export type PlatformType = "web" | "node" | "mobile" | "unknown";
 
/**
 * Platform information interface
 */
export interface PlatformInfo {
    /** Current platform type */
    platform: PlatformType;
    /** Whether running on web */
    isWeb: boolean;
    /** Whether running on mobile */
    isMobile: boolean;
    /** Whether running on Node.js */
    isNode: boolean;
    /** Whether keychain is available */
    hasKeychain: boolean;
    /** Whether IndexedDB is available */
    hasIndexedDB: boolean;
    /** Whether file system is available */
    hasFileSystem: boolean;
}
