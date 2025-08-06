/**
 * Security-related type definitions
 */
  
/**
 * Security metrics for monitoring access attempts and lockouts
 */
export interface SecurityMetrics {
    /** Total number of access attempts */
    totalAttempts: number;
    /** Number of failed attempts */
    failedAttempts: number;
    /** Timestamp of last failed attempt */
    lastFailedAttempt?: number;
    /** Whether the service is currently locked */
    isLocked: boolean;
    /** Timestamp when the lock will be released */
    lockUntil?: number;
}

/**
 * Device fingerprint information for key derivation
 */
export interface DeviceFingerprint {
    /** Platform identifier */
    platform: string;
    /** User agent string (web only) */
    userAgent?: string;
    /** Screen resolution (web only) */
    screen?: string;
    /** System timezone */
    timezone: string;
    /** System language */
    language: string;
    /** Hostname (Node.js only) */
    hostname?: string;
    /** System architecture (Node.js only) */
    arch?: string;
}
