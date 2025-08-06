/**
 * Constants and default values for ACPES
 */
 
/**
 * Predefined storage keys for common use cases
 */
export const STORAGE_KEYS = {
    SESSION_TOKEN: "session_token",
    REFRESH_TOKEN: "refresh_token",
    ACCESS_TOKEN: "access_token",
    USER_DATA: "user_data",
    USER_PREFERENCES: "user_preferences",
    SESSION_ID: "session_id",
    DEVICE_ID: "device_id",
    DEVICE_FINGERPRINT: "device_fingerprint",
    LAST_ACTIVITY: "last_activity",
    LOGIN_ATTEMPTS: "login_attempts",
    BIOMETRIC_ENABLED: "biometric_enabled",
    SECURITY_QUESTIONS: "security_questions",
    ENCRYPTED_CACHE: "encrypted_cache",
    OFFLINE_DATA: "offline_data",
} as const;

/**
 * Storage key type
 */
export type StorageKey = (typeof STORAGE_KEYS)[keyof typeof STORAGE_KEYS];

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG = {
    /** Default service name for keychain operations */
    DEFAULT_SERVICE: "CrossPlatformSecureStorage",
    /** Current version of the storage format */
    VERSION: "1.0.0",
    /** Maximum failed attempts before lockout */
    MAX_FAILED_ATTEMPTS: 5,
    /** Lockout duration in milliseconds (15 minutes) */
    LOCKOUT_DURATION: 15 * 60 * 1000,
    /** Maximum localStorage size (5MB) */
    MAX_STORAGE_SIZE: 5 * 1024 * 1024,
} as const;

