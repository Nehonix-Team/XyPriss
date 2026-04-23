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
        includePatterns?: (string | RegExp)[];
        excludePatterns?: (string | RegExp)[];
        userAppPatterns?: (string | RegExp)[];
        systemPatterns?: (string | RegExp)[];
    };
    /** Custom callback hook to receive intercepted logs synchronously */
    onLog?: (log: {
        level: string;
        method: string;
        message: string;
        args: any[];
    }) => void;
    /** Performance-optimized mode */
    performanceMode?: boolean;
    /** Whether to include source mapping (file/line) */
    sourceMapping?: boolean;
    /** Whether to preserve original console output and in what mode */
    preserveOriginal?:
        | boolean
        | {
              enabled: boolean;
              mode?: "original" | "intercepted" | "both" | "none";
              showPrefix?: boolean;
              customPrefix?: string;
              colorize?: boolean;
              allowDuplication?: boolean;
              separateStreams?: boolean;
              onlyUserApp?: boolean;
          };
}

export interface ConsoleInterceptionStats {
    totalInterceptions: number;
    interceptionsPerSecond: number;
    errorCount: number;
    lastInterceptionTime: number;
    methodCounts: Record<string, number>;
    averageOverhead: number;
    droppedMessages?: number;
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
    preserveOriginal: {
        enabled: true,
        mode: "intercepted",
        showPrefix: true,
        colorize: true,
    },
};
export interface InterceptedConsoleCall {
    method: "log" | "error" | "warn" | "info" | "debug" | "trace";
    args: any[];
    message?: string;
    timestamp: Date;
    category: "userApp" | "system" | "unknown";
    level: "info" | "warn" | "error" | "debug";
    source?: {
        file?: string;
        line?: number;
        column?: number;
    };
    component?: string;
}

