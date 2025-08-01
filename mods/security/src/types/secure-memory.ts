
// Memory protection levels
export enum MemoryProtectionLevel {
    BASIC = "basic",
    ENHANCED = "enhanced",
    MILITARY = "military",
    QUANTUM_SAFE = "quantum_safe",
}

// Buffer state tracking
export enum BufferState {
    UNINITIALIZED = "uninitialized",
    ACTIVE = "active",
    LOCKED = "locked",
    DESTROYED = "destroyed",
    CORRUPTED = "corrupted",
}

export interface SecureBufferOptions {
    protectionLevel?: MemoryProtectionLevel;
    enableEncryption?: boolean;
    enableFragmentation?: boolean;
    enableCanaries?: boolean;
    enableObfuscation?: boolean;
    autoLock?: boolean;
    lockTimeout?: number;
    quantumSafe?: boolean;
}
