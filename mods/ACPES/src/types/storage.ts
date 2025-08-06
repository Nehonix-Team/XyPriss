/**
 * Storage-related type definitions
 */
 
/** 
 * Structure of data stored in secure storage
 */
export interface StoredData {
    /** The actual stored value */
    value: string;
    /** Timestamp when the data was stored */
    timestamp: number;
    /** Optional expiration timestamp */
    expiresAt?: number;
    /** Integrity checksum for the data */
    checksum: string;
    /** Version of the storage format */
    version: string;
    /** Number of access attempts */
    attempts?: number;
    /** Last access timestamp */
    lastAccess?: number;
}
