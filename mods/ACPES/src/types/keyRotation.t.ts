/**
 * Key rotation configuration interface
 */
export interface KeyRotationConfig {
    rotationInterval: number; // in milliseconds
    maxKeyAge: number; // in milliseconds
    enableAutoRotation: boolean;
    backupOldKeys: boolean;
}

/**
 * Key metadata interface
 */
export interface KeyMetadata {
    keyId: string;
    createdAt: number;
    lastUsed: number;
    rotationCount: number;
    isActive: boolean;
}
