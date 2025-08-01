/**
 * XyPrissSecurity - Fortified Function Configuration Management
 * Centralized configuration system for optimal performance settings
 */

import { FortifiedFunctionOptions } from "../types/fortified-types";
import { fortifiedLogger } from "./fortified-logger";

/**
 * Performance profile configurations
 */
export const PERFORMANCE_PROFILES = {
    minimal: {
        ultraFast: "minimal" as const,
        autoEncrypt: false,
        parameterValidation: false,
        stackTraceProtection: false,
        smartSecurity: false,
        threatDetection: false,
        memoize: true,
        smartCaching: false,
        predictiveAnalytics: false,
        anomalyDetection: false,
        auditLog: false,
        performanceTracking: false,
        debugMode: false,
        detailedMetrics: false,
        enableJIT: false,
        enableSIMD: false,
        enableWebAssembly: false,
        memoryOptimization: "none" as const,
    },

    standard: {
        ultraFast: "standard" as const,
        autoEncrypt: false,
        parameterValidation: false,
        stackTraceProtection: false,
        smartSecurity: false,
        threatDetection: false,
        memoize: true,
        smartCaching: true,
        predictiveAnalytics: false,
        anomalyDetection: false,
        auditLog: false,
        performanceTracking: true,
        debugMode: false,
        detailedMetrics: false,
        enableJIT: true,
        enableSIMD: true,
        enableWebAssembly: false,
        memoryOptimization: "standard" as const,
    },

    maximum: {
        ultraFast: "maximum" as const,
        autoEncrypt: false,
        parameterValidation: false,
        stackTraceProtection: false,
        smartSecurity: false,
        threatDetection: false,
        memoize: true,
        smartCaching: true,
        predictiveAnalytics: true,
        anomalyDetection: false,
        auditLog: false,
        performanceTracking: true,
        debugMode: false,
        detailedMetrics: false,
        enableJIT: true,
        enableSIMD: true,
        enableWebAssembly: true,
        memoryOptimization: "aggressive" as const,
        enableVectorization: true,
        enableParallelExecution: true,
        enableZeroCopy: true,
        enableNativeOptimizations: true,
    },

    secure: {
        ultraFast: false,
        autoEncrypt: true,
        parameterValidation: true,
        stackTraceProtection: true,
        smartSecurity: true,
        threatDetection: true,
        memoize: true,
        smartCaching: true,
        predictiveAnalytics: false,
        anomalyDetection: true,
        auditLog: true,
        performanceTracking: true,
        debugMode: false,
        detailedMetrics: true,
        enableJIT: false,
        enableSIMD: false,
        enableWebAssembly: false,
        memoryOptimization: "standard" as const,
    },

    development: {
        ultraFast: false,
        autoEncrypt: false,
        parameterValidation: true,
        stackTraceProtection: false,
        smartSecurity: false,
        threatDetection: false,
        memoize: true,
        smartCaching: true,
        predictiveAnalytics: true,
        anomalyDetection: true,
        auditLog: true,
        performanceTracking: true,
        debugMode: true,
        detailedMetrics: true,
        enableJIT: false,
        enableSIMD: false,
        enableWebAssembly: false,
        memoryOptimization: "none" as const,
    },
} as const;

export type PerformanceProfile = keyof typeof PERFORMANCE_PROFILES;

/**
 * Default configuration values
 */
export const DEFAULT_CONFIG: Required<FortifiedFunctionOptions> = {
    // Performance mode
    ultraFast: "maximum",

    // Security options
    autoEncrypt: false,
    secureParameters: [],
    parameterValidation: false,
    memoryWipeDelay: 0,
    stackTraceProtection: false,
    smartSecurity: false,
    threatDetection: false,

    // Performance options
    memoize: true,
    timeout: 5000,
    retries: 1,
    maxRetryDelay: 1000,
    smartCaching: true,
    cacheStrategy: "adaptive",
    cacheTTL: 600000,
    maxCacheSize: 10000,
    errorHandling: "graceful",
    precompile: true,
    optimizeExecution: true,

    // Extreme performance options
    enableJIT: true,
    enableSIMD: true,
    enableWebAssembly: true,
    memoryOptimization: "aggressive",
    enableVectorization: true,
    enableParallelExecution: true,
    enableZeroCopy: true,
    enableNativeOptimizations: true,
    jitThreshold: 5,
    simdThreshold: 4,

    // Smart actions
    autoTuning: true,
    predictiveAnalytics: true,
    adaptiveTimeout: true,
    intelligentRetry: true,
    anomalyDetection: false,
    performanceRegression: false,

    // Monitoring options
    auditLog: false,
    performanceTracking: true,
    debugMode: false,
    detailedMetrics: false,

    // Memory management
    memoryPool: true,
    maxMemoryUsage: 500 * 1024 * 1024,
    autoCleanup: true,
    smartMemoryManagement: true,
    memoryPressureHandling: true,
};

/**
 * Configuration manager for fortified functions
 */
export class FortifiedConfig {
    private static instance: FortifiedConfig;
    private globalConfig: Required<FortifiedFunctionOptions>;
    private profileOverrides: Map<string, Partial<FortifiedFunctionOptions>> =
        new Map();

    private constructor() {
        this.globalConfig = { ...DEFAULT_CONFIG };
    }

    public static getInstance(): FortifiedConfig {
        if (!FortifiedConfig.instance) {
            FortifiedConfig.instance = new FortifiedConfig();
        }
        return FortifiedConfig.instance;
    }

    /**
     * Apply a performance profile
     */
    public applyProfile(profile: PerformanceProfile): void {
        const profileConfig = PERFORMANCE_PROFILES[profile];
        this.globalConfig = { ...this.globalConfig, ...profileConfig };

        fortifiedLogger.info(
            "CONFIG",
            `Applied performance profile: ${profile}`,
            {
                profile,
                appliedSettings: Object.keys(profileConfig),
            }
        );
    }

    /**
     * Update global configuration
     */
    public updateGlobalConfig(
        options: Partial<FortifiedFunctionOptions>
    ): void {
        const previousConfig = { ...this.globalConfig };
        this.globalConfig = { ...this.globalConfig, ...options };

        fortifiedLogger.info("CONFIG", "Global configuration updated", {
            changedKeys: Object.keys(options),
            previousConfig: this.getChangedValues(previousConfig, options),
            newConfig: this.getChangedValues(this.globalConfig, options),
        });
    }

    /**
     * Get current global configuration
     */
    public getGlobalConfig(): Required<FortifiedFunctionOptions> {
        return { ...this.globalConfig };
    }

    /**
     * Create configuration for a specific function
     */
    public createFunctionConfig(
        functionId: string,
        options: Partial<FortifiedFunctionOptions> = {}
    ): Required<FortifiedFunctionOptions> {
        const profileOverride = this.profileOverrides.get(functionId) || {};
        const finalConfig = {
            ...this.globalConfig,
            ...profileOverride,
            ...options,
        };

        fortifiedLogger.debug(
            "CONFIG",
            `Configuration created for function: ${functionId}`,
            {
                functionId,
                hasProfileOverride: this.profileOverrides.has(functionId),
                hasCustomOptions: Object.keys(options).length > 0,
            }
        );

        return finalConfig;
    }

    /**
     * Set profile override for a specific function
     */
    public setFunctionProfile(
        functionId: string,
        profile: PerformanceProfile
    ): void {
        const profileConfig = PERFORMANCE_PROFILES[profile];
        this.profileOverrides.set(functionId, profileConfig);

        fortifiedLogger.info(
            "CONFIG",
            `Profile override set for function: ${functionId}`,
            {
                functionId,
                profile,
                overrideKeys: Object.keys(profileConfig),
            }
        );
    }

    /**
     * Remove profile override for a specific function
     */
    public removeFunctionProfile(functionId: string): void {
        const removed = this.profileOverrides.delete(functionId);

        if (removed) {
            fortifiedLogger.info(
                "CONFIG",
                `Profile override removed for function: ${functionId}`,
                {
                    functionId,
                }
            );
        }
    }

    /**
     * Get recommended configuration based on environment
     */
    public getRecommendedConfig(): {
        profile: PerformanceProfile;
        config: Required<FortifiedFunctionOptions>;
        reasoning: string;
    } {
        // Detect environment
        const isProduction = process.env.NODE_ENV === "production";
        const isDevelopment = process.env.NODE_ENV === "development";
        const isTest = process.env.NODE_ENV === "test";

        let profile: PerformanceProfile;
        let reasoning: string;

        if (isProduction) {
            profile = "maximum";
            reasoning =
                "Production environment detected - using maximum performance profile";
        } else if (isDevelopment) {
            profile = "development";
            reasoning =
                "Development environment detected - using development profile with debugging";
        } else if (isTest) {
            profile = "minimal";
            reasoning =
                "Test environment detected - using minimal profile for fast tests";
        } else {
            profile = "standard";
            reasoning = "Unknown environment - using standard profile";
        }

        const config = {
            ...this.globalConfig,
            ...PERFORMANCE_PROFILES[profile],
        };

        return { profile, config, reasoning };
    }

    /**
     * Validate configuration
     */
    public validateConfig(config: Partial<FortifiedFunctionOptions>): {
        valid: boolean;
        errors: string[];
        warnings: string[];
    } {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate timeout
        if (config.timeout !== undefined && config.timeout < 1000) {
            warnings.push(
                "Timeout less than 1 second may cause premature timeouts"
            );
        }

        // Validate cache size
        if (config.maxCacheSize !== undefined && config.maxCacheSize > 50000) {
            warnings.push("Large cache size may impact memory usage");
        }

        // Validate memory usage
        if (
            config.maxMemoryUsage !== undefined &&
            config.maxMemoryUsage > 1024 * 1024 * 1024
        ) {
            warnings.push(
                "Memory limit over 1GB may impact system performance"
            );
        }

        // Validate JIT threshold
        if (config.jitThreshold !== undefined && config.jitThreshold < 2) {
            warnings.push(
                "Very low JIT threshold may cause compilation overhead"
            );
        }

        // Check for conflicting options
        if (config.ultraFast === "minimal" && config.detailedMetrics === true) {
            warnings.push(
                "Detailed metrics may reduce performance in minimal mode"
            );
        }

        if (config.autoEncrypt === true && config.ultraFast === "maximum") {
            warnings.push(
                "Encryption may reduce performance in maximum speed mode"
            );
        }

        return {
            valid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Get changed values between two configurations
     */
    private getChangedValues(
        config: Record<string, any>,
        changes: Record<string, any>
    ): Record<string, any> {
        const result: Record<string, any> = {};
        for (const key of Object.keys(changes)) {
            if (config[key] !== undefined) {
                result[key] = config[key];
            }
        }
        return result;
    }

    /**
     * Reset to default configuration
     */
    public reset(): void {
        this.globalConfig = { ...DEFAULT_CONFIG };
        this.profileOverrides.clear();

        fortifiedLogger.info("CONFIG", "Configuration reset to defaults");
    }
}

// Export singleton instance
export const fortifiedConfig = FortifiedConfig.getInstance();

