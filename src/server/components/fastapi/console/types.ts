/**
 * Type definitions for Console Interception System
 */

import { LogLevel } from "../../../../shared/types/logger.type";

export interface ConsoleInterceptionConfig {
    enabled: boolean;
    /** Use XHSC (Go) native interception system (default: true) */
    useNative?: boolean;
    /** Methods to intercept */
    interceptMethods: readonly (
        | "log"
        | "error"
        | "warn"
        | "info"
        | "debug"
        | "trace"
    )[];
    /** Limit for interceptions per second */
    maxInterceptionsPerSecond?: number;
    /** Encryption settings (delegated to Go) */
    encryption?: {
        enabled: boolean;
        key?: string;
        algorithm?: "aes-128-gcm" | "aes-192-gcm" | "aes-256-gcm";
        displayMode?: "readable" | "encrypted" | "both";
    };
    /** Filter settings (delegated to Go) */
    filters?: {
        minLevel?: "debug" | "info" | "warn" | "error";
        maxLength?: number;
        includePatterns?: string[];
        excludePatterns?: string[];
        userAppPatterns?: string[];
        systemPatterns?: string[];
    };
}

export interface ConsoleInterceptionStats {
    totalInterceptions: number;
    interceptionsPerSecond: number;
    errorCount: number;
    lastInterceptionTime: number;
    methodCounts: Record<string, number>;
    averageOverhead: number;
    isActive: boolean;
}

/**
 * Complete default configuration for console interception
 * Delegated to XHSC (Go) for heavy lifting
 */
export const DEFAULT_CONSOLE_CONFIG: ConsoleInterceptionConfig = {
    enabled: false,
    useNative: true,
    interceptMethods: ["log", "error", "warn", "info", "debug"],
    maxInterceptionsPerSecond: 100,
    encryption: {
        enabled: false,
    },
    filters: {
        minLevel: "debug",
        maxLength: 1000,
        includePatterns: [],
        excludePatterns: ["node_modules", "internal"],
        userAppPatterns: [],
        systemPatterns: [],
    },
};

