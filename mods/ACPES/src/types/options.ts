/**
 * Configuration options for ACPES
 */
 
/**
 * Configuration options for secure storage operations
 */
export interface SecureStorageOptions {
    /** Service identifier for keychain operations */
    service?: string;
    /** Access group for iOS keychain */
    accessGroup?: string;
    /** Enable Touch ID/Face ID authentication */
    touchID?: boolean;
    /** Show authentication modal */
    showModal?: boolean;
    /** Require authentication for access */
    requireAuth?: boolean;
    /** Enable compression for large data */
    compressionEnabled?: boolean;
    /** Use IndexedDB instead of localStorage on web */
    useIndexedDB?: boolean;
    /** Custom file path for Node.js storage */
    filePath?: string;
}

/**
 * Constructor options for CrossPlatformSecureStorage
 */
export interface StorageConstructorOptions {
    /** Custom storage path for Node.js */
    nodeStoragePath?: string;
}

