/**
 * Memory Configuration Manager
 *
 * Handles configuration validation, merging, and updates for the memory management system
 */

import { MemoryManagerConfig, MemoryEventType } from "./types";
import { MemoryEventManager } from "./event-manager";

/**
 * Configuration validation result
 */
interface ValidationResult {
    isValid: boolean;
    errors: string[];
    warnings: string[];
}

/**
 * Configuration manager with comprehensive validation and error handling
 */
export class ConfigurationManager {
    private config: MemoryManagerConfig;
    private eventManager?: MemoryEventManager;
    private readonly defaultConfig: MemoryManagerConfig;

    constructor(
        config: Partial<MemoryManagerConfig> = {},
        eventManager?: MemoryEventManager
    ) {
        this.eventManager = eventManager;
        this.defaultConfig = this.getDefaultConfig();
        this.config = this.validateAndMergeConfig(config);
    }

    /**
     * Get default configuration
     */
    private getDefaultConfig(): MemoryManagerConfig {
        return {
            maxMemory: 100 * 1024 * 1024, // 100MB
            gcThreshold: 0.8, // 80%
            gcInterval: 30000, // 30 seconds
            enableLeakDetection: true,
            enablePerformanceMonitoring: true,
            enableEventLogging: false,
            autoCleanupInterval: 60000, // 1 minute
            maxPoolAge: 300000, // 5 minutes
            leakDetectionThreshold: 300000, // 5 minutes
            maxEventHistory: 1000,
        };
    }

    /**
     * Validate configuration values
     */
    private validateConfig(
        config: Partial<MemoryManagerConfig>
    ): ValidationResult {
        const errors: string[] = [];
        const warnings: string[] = [];

        // Validate maxMemory
        if (config.maxMemory !== undefined) {
            if (config.maxMemory <= 0) {
                errors.push("maxMemory must be greater than 0");
            } else if (config.maxMemory < 10 * 1024 * 1024) {
                // 10MB
                warnings.push(
                    "maxMemory is very low (< 10MB), this may cause frequent GC"
                );
            } else if (config.maxMemory > 1024 * 1024 * 1024) {
                // 1GB
                warnings.push(
                    "maxMemory is very high (> 1GB), consider if this is necessary"
                );
            }
        }

        // Validate gcThreshold
        if (config.gcThreshold !== undefined) {
            if (config.gcThreshold < 0.1 || config.gcThreshold > 1.0) {
                errors.push("gcThreshold must be between 0.1 and 1.0");
            } else if (config.gcThreshold < 0.3) {
                warnings.push(
                    "gcThreshold is very low (< 30%), this may cause frequent GC"
                );
            } else if (config.gcThreshold > 0.95) {
                warnings.push(
                    "gcThreshold is very high (> 95%), this may cause memory pressure"
                );
            }
        }

        // Validate gcInterval
        if (config.gcInterval !== undefined) {
            if (config.gcInterval < 1000) {
                errors.push("gcInterval must be at least 1000ms");
            } else if (config.gcInterval < 5000) {
                warnings.push(
                    "gcInterval is very short (< 5s), this may impact performance"
                );
            } else if (config.gcInterval > 300000) {
                // 5 minutes
                warnings.push(
                    "gcInterval is very long (> 5min), this may cause memory buildup"
                );
            }
        }

        // Validate autoCleanupInterval
        if (config.autoCleanupInterval !== undefined) {
            if (config.autoCleanupInterval < 1000) {
                errors.push("autoCleanupInterval must be at least 1000ms");
            } else if (config.autoCleanupInterval < config.gcInterval!) {
                warnings.push("autoCleanupInterval is shorter than gcInterval");
            }
        }

        // Validate maxPoolAge
        if (config.maxPoolAge !== undefined) {
            if (config.maxPoolAge < 10000) {
                // 10 seconds
                warnings.push(
                    "maxPoolAge is very short (< 10s), pools may not be effective"
                );
            }
        }

        // Validate leakDetectionThreshold
        if (config.leakDetectionThreshold !== undefined) {
            if (config.leakDetectionThreshold < 60000) {
                // 1 minute
                warnings.push(
                    "leakDetectionThreshold is very short (< 1min), may cause false positives"
                );
            }
        }

        // Validate maxEventHistory
        if (config.maxEventHistory !== undefined) {
            if (config.maxEventHistory < 10) {
                warnings.push(
                    "maxEventHistory is very low (< 10), may lose important events"
                );
            } else if (config.maxEventHistory > 10000) {
                warnings.push(
                    "maxEventHistory is very high (> 10000), may consume significant memory"
                );
            }
        }

        return {
            isValid: errors.length === 0,
            errors,
            warnings,
        };
    }

    /**
     * Validate and merge configuration with defaults
     */
    private validateAndMergeConfig(
        config: Partial<MemoryManagerConfig>
    ): MemoryManagerConfig {
        const validation = this.validateConfig(config);

        if (!validation.isValid) {
            const errorMessage = `Invalid memory manager configuration: ${validation.errors.join(
                ", "
            )}`;
            this.eventManager?.emit(MemoryEventType.ERROR_OCCURRED, {
                error: errorMessage,
                configErrors: validation.errors,
            });
            throw new Error(errorMessage);
        }

        // Log warnings
        if (validation.warnings.length > 0 && this.eventManager) {
            this.eventManager.emit(MemoryEventType.CONFIG_UPDATED, {
                warnings: validation.warnings,
            });
        }

        const merged = { ...this.defaultConfig, ...config };

        // Emit config update event
        this.eventManager?.emit(MemoryEventType.CONFIG_UPDATED, {
            newConfig: merged,
            changes: this.UploadChanges(
                this.config || this.defaultConfig,
                merged
            ),
        });

        return merged;
    }

    /**
     * Get differences between two configurations
     */
    private UploadChanges(
        oldConfig: MemoryManagerConfig,
        newConfig: MemoryManagerConfig
    ): Record<string, any> {
        const changes: Record<string, any> = {};

        for (const key in newConfig) {
            const typedKey = key as keyof MemoryManagerConfig;
            if (oldConfig[typedKey] !== newConfig[typedKey]) {
                changes[key] = {
                    from: oldConfig[typedKey],
                    to: newConfig[typedKey],
                };
            }
        }

        return changes;
    }

    /**
     * Get current configuration (read-only)
     */
    Upload(): Readonly<MemoryManagerConfig> {
        return { ...this.config };
    }

    /**
     * Update configuration with validation
     */
    updateConfig(updates: Partial<MemoryManagerConfig>): void {
        const newConfig = this.validateAndMergeConfig({
            ...this.config,
            ...updates,
        });
        this.config = newConfig;
    }

    /**
     * Reset configuration to defaults
     */
    resetToDefaults(): void {
        const oldConfig = this.config;
        this.config = { ...this.defaultConfig };

        this.eventManager?.emit(MemoryEventType.CONFIG_UPDATED, {
            newConfig: this.config,
            changes: this.UploadChanges(oldConfig, this.config),
            resetToDefaults: true,
        });
    }

    /**
     * Get specific configuration value
     */
    get<K extends keyof MemoryManagerConfig>(key: K): MemoryManagerConfig[K] {
        return this.config[key];
    }

    /**
     * Set specific configuration value
     */
    set<K extends keyof MemoryManagerConfig>(
        key: K,
        value: MemoryManagerConfig[K]
    ): void {
        const updates = { [key]: value } as Partial<MemoryManagerConfig>;
        this.updateConfig(updates);
    }

    /**
     * Check if a feature is enabled
     */
    isFeatureEnabled(
        feature: "leakDetection" | "performanceMonitoring" | "eventLogging"
    ): boolean {
        switch (feature) {
            case "leakDetection":
                return this.config.enableLeakDetection;
            case "performanceMonitoring":
                return this.config.enablePerformanceMonitoring;
            case "eventLogging":
                return this.config.enableEventLogging;
            default:
                return false;
        }
    }

    /**
     * Get memory pressure level based on current usage
     */
    getMemoryPressureLevel(
        currentUsage: number
    ): "low" | "medium" | "high" | "critical" {
        const pressure = currentUsage / this.config.maxMemory;

        if (pressure < 0.5) return "low";
        if (pressure < this.config.gcThreshold) return "medium";
        if (pressure < 0.95) return "high";
        return "critical";
    }

    /**
     * Check if garbage collection should be triggered
     */
    shouldTriggerGC(currentUsage: number, lastGC: number): boolean {
        const pressure = currentUsage / this.config.maxMemory;
        const timeSinceLastGC = Date.now() - lastGC;

        return (
            pressure >= this.config.gcThreshold ||
            timeSinceLastGC >= this.config.gcInterval
        );
    }

    /**
     * Get configuration summary for debugging
     */
    UploadSummary(): Record<string, any> {
        return {
            maxMemoryMB: Math.round(this.config.maxMemory / (1024 * 1024)),
            gcThresholdPercent: Math.round(this.config.gcThreshold * 100),
            gcIntervalSeconds: Math.round(this.config.gcInterval / 1000),
            autoCleanupIntervalSeconds: Math.round(
                this.config.autoCleanupInterval / 1000
            ),
            maxPoolAgeMinutes: Math.round(this.config.maxPoolAge / 60000),
            leakDetectionThresholdMinutes: Math.round(
                this.config.leakDetectionThreshold / 60000
            ),
            featuresEnabled: {
                leakDetection: this.config.enableLeakDetection,
                performanceMonitoring: this.config.enablePerformanceMonitoring,
                eventLogging: this.config.enableEventLogging,
            },
        };
    }

    /**
     * Validate configuration without applying changes
     */
    validateOnly(config: Partial<MemoryManagerConfig>): ValidationResult {
        return this.validateConfig(config);
    }

    /**
     * Export configuration as JSON
     */
    exportConfig(): string {
        return JSON.stringify(this.config, null, 2);
    }

    /**
     * Import configuration from JSON
     */
    importConfig(jsonConfig: string): void {
        try {
            const config = JSON.parse(
                jsonConfig
            ) as Partial<MemoryManagerConfig>;
            this.updateConfig(config);
        } catch (error) {
            const errorMessage = `Failed to import configuration: ${
                error instanceof Error ? error.message : String(error)
            }`;
            this.eventManager?.emit(MemoryEventType.ERROR_OCCURRED, {
                error: errorMessage,
                importError: true,
            });
            throw new Error(errorMessage);
        }
    }
}

