/**
 * Common types for security modules
 */

export interface SecurityDetectionResult {
    isMalicious: boolean;
    confidence: number;
    detectedPatterns: string[];
    sanitizedInput?: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
    metadata?: Record<string, any>;
}

export interface SecurityModuleConfig {
    enabled?: boolean;
    strictMode?: boolean;
    logAttempts?: boolean;
    blockOnDetection?: boolean;
    falsePositiveThreshold?: number;
    customPatterns?: RegExp[];
}

export interface ContextInfo {
    fieldName?: string;
    fieldType?: string;
    userRole?: string;
    ipAddress?: string;
    userAgent?: string;
    requestPath?: string;
}
