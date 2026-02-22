/***************************************************************************
 * ConsoleInterceptor.ts - Console Interception System for FastXyPrissServer
 * This file contains the ConsoleInterceptor class, which intercepts and manages all console output through the unified logging system
 * @author Nehonix
 * @license NehoPSLA - PROPRIETARY SOFTWARE
 * @version 1.0
 * @copyright Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * PROPRIETARY AND CONFIDENTIAL
 *
 * This software is the proprietary information of NEHONIX and is protected
 * by copyright law and international treaties. Unauthorized reproduction,
 * distribution, modification, or use of this software is strictly prohibited
 * and may result in severe civil and criminal penalties.
 *
 * Licensed under the NEHO Proprietary Software License Agreement (NehoPSLA).
 * See LICENSE.md for full terms and conditions.
 * Official License: http://dll.nehonix.com/NehoPSLA/license
 *
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

import { Logger } from "../../../../../shared/logger/Logger";
import { ServerOptions } from "../../../../types/types";
import {
    ConsoleInterceptionConfig,
    ConsoleInterceptionStats,
    InterceptedConsoleCall,
    DEFAULT_CONSOLE_CONFIG,
    PreserveOption,
    PRESERVE_PRESETS,
} from "./types";
import { ConsoleEncryption } from "./encryption/ConsoleEncryption";
import { func, Hash } from "../../../../../mods/security/src";
import { SecureRandom } from "xypriss-security";
import {
    LogComponent,
    LogLevel,
} from "../../../../../shared/types/logger.type";

/**
 * Console Interception System (CSIS) for FastXyPrissServer
 * Intercepts and manages all console output through the unified logging system
 */
export class ConsoleInterceptor {
    private logger: Logger;
    private config: ConsoleInterceptionConfig;
    private originalConsole: Record<string, Function> = {};
    private isIntercepting = false;
    private stats: ConsoleInterceptionStats;
    private errorCount = 0;
    private lastSecondInterceptions = 0;
    private lastSecondTimestamp = 0;
    private performanceBuffer: number[] = [];

    // Rate limiting
    private rateLimitCounter = 0;
    private rateLimitWindow = Date.now();

    // Recursion prevention
    private isProcessing = false;
    private processingDepth = 0;
    private maxProcessingDepth = 3;

    // Encryption handler
    private encryptionHandler: ConsoleEncryption | null = null;

    // Preserve option configuration
    private preserveOption: PreserveOption;

    // Tracing
    private traceBuffer: InterceptedConsoleCall[] = [];
    private traceHooks: ((log: InterceptedConsoleCall) => void)[] = [];
    private pluginEngine: any = null;

    constructor(logger: Logger, config?: ServerOptions["logging"]) {
        this.logger = logger;

        // Merge with user configuration
        const userConfig = config?.consoleInterception || {};
        this.config = {
            ...DEFAULT_CONSOLE_CONFIG,
            ...userConfig,
            filters: {
                ...DEFAULT_CONSOLE_CONFIG.filters,
                ...userConfig.filters,
            },
            fallback: {
                ...DEFAULT_CONSOLE_CONFIG.fallback,
                ...userConfig.fallback,
            },
            tracing: {
                ...DEFAULT_CONSOLE_CONFIG.tracing,
                ...userConfig.tracing,
            },
        } as ConsoleInterceptionConfig;

        this.stats = {
            totalInterceptions: 0,
            interceptionsPerSecond: 0,
            errorCount: 0,
            lastInterceptionTime: 0,
            methodCounts: {},
            averageOverhead: 0,
            isActive: false,
        };

        // Initialize method counts
        this.config.interceptMethods.forEach((method) => {
            this.stats.methodCounts[method] = 0;
        });

        // Parse preserve option configuration
        this.preserveOption = this.parsePreserveOption(
            this.config.preserveOriginal
        );

        // Initialize encryption handler if encryption is enabled
        this.initializeEncryptionHandler();
    }

    /**
     * Parse preserve option configuration
     * Supports both boolean (backward compatibility) and object configuration
     */
    private parsePreserveOption(
        preserveOriginal: boolean | PreserveOption
    ): PreserveOption {
        // If it's already a PreserveOption object, use it
        if (typeof preserveOriginal === "object" && preserveOriginal !== null) {
            return {
                ...preserveOriginal, // Use user settings
                enabled: preserveOriginal.enabled ?? true,
                mode: preserveOriginal.mode ?? "original",
                showPrefix: preserveOriginal.showPrefix ?? false,
                allowDuplication: preserveOriginal.allowDuplication ?? false,
                separateStreams: preserveOriginal.separateStreams ?? false,
                onlyUserApp: preserveOriginal.onlyUserApp ?? true,
                colorize: preserveOriginal.colorize ?? true,
            };
        }

        // Backward compatibility: convert boolean to PreserveOption
        if (preserveOriginal === true) {
            // preserveOriginal: true = show original console output only
            return PRESERVE_PRESETS.development;
        } else {
            // preserveOriginal: false = route through logging system
            return PRESERVE_PRESETS.production;
        }
    }

    /**
     * Initialize encryption handler
     */
    private initializeEncryptionHandler(): void {
        if (this.config.encryption?.enabled && this.config.encryption.key) {
            try {
                this.encryptionHandler = new ConsoleEncryption(
                    this.config.encryption
                );
                this.logger.info(
                    "console",
                    "Console encryption handler initialized"
                );
            } catch (error) {
                this.logger.error(
                    "console",
                    "Failed to initialize encryption handler",
                    error
                );
                this.encryptionHandler = null;
            }
        } else {
            this.encryptionHandler = null;
        }
    }

    /**
     * Start console interception
     */
    public start(): void {
        if (!this.config.enabled || this.isIntercepting) {
            return;
        }

        try {
            this.logger.info("console", "Starting console interception system");
            this.backupOriginalConsole();
            this.interceptConsoleMethods();
            this.isIntercepting = true;
            this.stats.isActive = true;

            this.logger.info(
                "console",
                "Console interception system started successfully"
            );
        } catch (error) {
            this.handleError("Failed to start console interception", error);
        }
    }

    /**
     * Stop console interception and restore original console
     */
    public stop(): void {
        if (!this.isIntercepting) {
            return;
        }

        try {
            this.logger.info("console", "Stopping console interception system");
            this.restoreOriginalConsole();
            this.isIntercepting = false;
            this.stats.isActive = false;

            this.logger.info("console", "Console interception system stopped");
        } catch (error) {
            this.handleError("Failed to stop console interception", error);
        }
    }

    /**
     * Get current interception statistics
     */
    public getStats(): ConsoleInterceptionStats {
        return { ...this.stats };
    }

    /**
     * Update configuration at runtime
     */
    public updateConfig(newConfig: Partial<ConsoleInterceptionConfig>): void {
        // Merge configurations properly
        this.config = {
            ...this.config,
            ...newConfig,
            filters: {
                ...this.config.filters,
                ...(newConfig.filters || {}),
            },
            fallback: {
                ...this.config.fallback,
                ...(newConfig.fallback || {}),
            },
        };

        if (this.isIntercepting) {
            this.stop();
            this.start();
        }
    }

    /**
     * Backup original console methods
     */
    private backupOriginalConsole(): void {
        this.config.interceptMethods.forEach((method) => {
            const consoleMethod = (console as any)[method];
            if (typeof consoleMethod === "function") {
                this.originalConsole[method] = consoleMethod.bind(console);
            }
        });
    }

    /**
     * Restore original console methods
     */
    private restoreOriginalConsole(): void {
        Object.keys(this.originalConsole).forEach((method) => {
            (console as any)[method] = this.originalConsole[method];
        });
    }

    /**
     * Intercept console methods
     */
    private interceptConsoleMethods(): void {
        this.config.interceptMethods.forEach((method) => {
            const originalMethod = this.originalConsole[method];
            if (!originalMethod) return;

            (console as any)[method] = (...args: any[]) => {
                this.handleInterceptedCall(method, args, originalMethod);
            };
        });
    }

    /**
     * Handle intercepted console call
     */
    private handleInterceptedCall(
        method: string,
        args: any[],
        originalMethod: Function
    ): void {
        // Prevent recursion - if we're already processing, just call original
        if (
            this.isProcessing ||
            this.processingDepth >= this.maxProcessingDepth
        ) {
            originalMethod(...args);
            return;
        }

        // Set recursion guards
        this.isProcessing = true;
        this.processingDepth++;

        const startTime = this.config.performanceMode ? performance.now() : 0;

        try {
            // Rate limiting check
            if (!this.checkRateLimit()) {
                this.handlePreserveDisplay(originalMethod, args);
                return;
            }

            // 🔧 CRITICAL FIX: Prevent recursion by ignoring logs that already have our prefixes
            // If it's already a formatted system log, output it directly and exit
            const message = args.join(" ");
            if (
                message.includes("[USERAPP]") ||
                message.includes("[SYSTEM]") ||
                message.includes("[SERVER]")
            ) {
                originalMethod(...args);
                return;
            }

            // Create intercepted call object
            const interceptedCall: InterceptedConsoleCall = {
                method,
                args,
                timestamp: Date.now(),
                level: this.mapMethodToLogLevel(method),
            };

            // Classify the call
            this.classifyCall(interceptedCall);

            // Add source mapping if enabled
            if (this.config.sourceMapping || this.config.stackTrace) {
                this.addSourceInformation(interceptedCall);
            }

            // Filter the call
            if (!this.shouldInterceptCall(interceptedCall)) {
                this.handlePreserveDisplay(originalMethod, args);
                return;
            }

            // Process the intercepted call (async but don't wait to avoid blocking)
            this.processInterceptedCall(interceptedCall).catch((error) => {
                this.handleError("Error in async processing", error);
            });

            // Handle preserve display based on new preserve option
            this.handlePreserveDisplay(originalMethod, args);

            // 🔍 Handle tracing if enabled
            if (this.config.tracing?.enabled) {
                this.addToTraceBuffer(interceptedCall);
                this.triggerTraceHooks(interceptedCall);
            }

            // Update statistics
            this.updateStats(method, startTime);
        } catch (error) {
            this.handleError(
                `Error processing intercepted ${method} call`,
                error
            );

            // Fallback to original method
            this.handlePreserveDisplay(originalMethod, args);
        } finally {
            // Always reset recursion guards
            this.processingDepth--;
            if (this.processingDepth <= 0) {
                this.isProcessing = false;
                this.processingDepth = 0;
            }
        }
    }

    /**
     * Handle preserve display based on preserve option configuration
     */
    private handlePreserveDisplay(originalMethod: Function, args: any[]): void {
        if (!this.preserveOption.enabled) {
            return;
        }

        const mode = this.preserveOption.mode;

        switch (mode) {
            case "original":
                // Show original console output only
                originalMethod(...args);
                break;
            case "intercepted":
                // Will be handled by processInterceptedCall routing to logger
                break;
            case "both":
                // Show both original and intercepted (for debugging)
                // Always show original when mode is "both"
                originalMethod(...args);
                break;
            case "none":
                // No console output at all
                break;
            default:
                // Fallback to original
                originalMethod(...args);
                break;
        }
    }

    /**
     * Determine if logs should be routed to logger system
     */
    private shouldRouteToLogger(): boolean {
        if (!this.preserveOption.enabled) {
            return false;
        }

        const mode = this.preserveOption.mode;
        return mode === "intercepted" || mode === "both";
    }

    /**
     * Check rate limiting
     */
    private checkRateLimit(): boolean {
        const now = Date.now();
        const windowSize = 1000; // 1 second

        // Reset counter if we're in a new window
        if (now - this.rateLimitWindow >= windowSize) {
            this.rateLimitCounter = 0;
            this.rateLimitWindow = now;
        }

        this.rateLimitCounter++;
        return this.rateLimitCounter <= this.config.maxInterceptionsPerSecond;
    }

    /**
     * Map console method to log level
     */
    private mapMethodToLogLevel(method: string): LogLevel {
        switch (method) {
            case "error":
                return "error";
            case "warn":
                return "warn";
            case "info":
                return "info";
            case "debug":
                return "debug";
            case "log":
            default:
                return "info";
        }
    }

    /**
     * Add source information to intercepted call
     */
    private addSourceInformation(call: InterceptedConsoleCall): void {
        if (!this.config.sourceMapping && !this.config.stackTrace) return;

        try {
            const stack = new Error().stack;
            if (stack) {
                const lines = stack.split("\n");
                // Skip the first few lines (Error, this method, handleInterceptedCall)
                const relevantLine = lines.find(
                    (line, index) =>
                        index > 3 &&
                        !line.includes("ConsoleInterceptor") &&
                        !line.includes("node_modules")
                );

                if (this.config.sourceMapping && relevantLine) {
                    call.source = relevantLine.trim();
                }

                if (this.config.stackTrace) {
                    call.stackTrace = lines.slice(4).join("\n");
                }
            }
        } catch (error) {
            // Silently ignore source mapping errors
        }
    }

    /**
     * Check if a message matches exclude patterns (supports regex and strings)
     */
    private matchesExcludePattern(message: string, source: string): boolean {
        const filters = this.config.filters;
        if (!filters?.excludePatterns?.length) return false;

        for (const pattern of filters.excludePatterns) {
            // Check if pattern is a regex (starts and ends with /)
            if (
                typeof pattern === "string" &&
                pattern.startsWith("/") &&
                pattern.endsWith("/")
            ) {
                try {
                    const regexPattern = pattern.slice(1, -1);
                    const regex = new RegExp(regexPattern);
                    if (regex.test(message) || regex.test(source)) {
                        return true;
                    }
                } catch (error) {
                    // Invalid regex, treat as string
                    if (source.includes(pattern) || message.includes(pattern)) {
                        return true;
                    }
                }
            } else {
                // String pattern - simple includes check
                if (source.includes(pattern) || message.includes(pattern)) {
                    return true;
                }
            }
        }
        return false;
    }

    /**
     * Check if call should be intercepted based on filters
     */
    private shouldInterceptCall(call: InterceptedConsoleCall): boolean {
        const filters = this.config.filters;
        if (!filters) return true;

        // Check minimum level
        if (filters.minLevel) {
            const levelOrder = { debug: 0, info: 1, warn: 2, error: 3 };
            const callLevel =
                levelOrder[call.level as keyof typeof levelOrder] ?? 1;
            const minLevel = levelOrder[filters.minLevel] ?? 0;
            if (callLevel < minLevel) return false;
        }

        // Check message length
        const message = call.args.join(" ");
        if (filters.maxLength && message.length > filters.maxLength) {
            return false;
        }

        // Check exclude patterns - if matched, mark for original display
        const source = call.source || call.stackTrace || "";
        if (this.matchesExcludePattern(message, source)) {
            // Mark this call to be displayed in original format
            (call as any).excludedByPattern = true;
            return false; // Don't intercept, will be shown in original format
        }

        // Check include patterns (if specified, at least one must match)
        if (filters.includePatterns?.length) {
            const hasMatch = filters.includePatterns.some(
                (pattern) =>
                    source.includes(pattern) || message.includes(pattern)
            );
            if (!hasMatch) return false;
        }

        return true;
    }

    /**
     * Classify intercepted call into a category
     */
    private classifyCall(call: InterceptedConsoleCall): void {
        const message = call.args.join(" ");
        const filters = this.config.filters;

        // Check user application patterns
        if (filters?.userAppPatterns?.length) {
            for (const pattern of filters.userAppPatterns) {
                if (message.includes(pattern)) {
                    call.category = "userApp";
                    return;
                }
            }
        }

        // Check system patterns
        if (filters?.systemPatterns?.length) {
            for (const pattern of filters.systemPatterns) {
                if (message.includes(pattern)) {
                    call.category = "system";
                    return;
                }
            }
        }

        call.category = "unknown";
    }

    /**
     * Process intercepted console call through logging system
     */
    private async processInterceptedCall(
        call: InterceptedConsoleCall
    ): Promise<void> {
        // Temporarily disable processing to prevent recursion
        const wasProcessing = this.isProcessing;
        this.isProcessing = true;

        try {
            // ALWAYS handle encryption if enabled (background processing)
            if (this.encryptionHandler && this.config.encryption?.enabled) {
                try {
                    await this.encryptionHandler.encryptLogEntry(call);
                } catch (error) {
                    this.logger.warn(
                        "console",
                        "Failed to encrypt log entry",
                        error
                    );
                }
            }

            // 🔧 CRITICAL: Respect new preserve option setting
            if (!this.shouldRouteToLogger()) {
                // Don't route through logger based on preserve option mode
                return;
            }

            // Route through our logger system with appropriate prefix
            //  DISPLAY: Based on preserve option configuration
            let displayMessage = call.args.join(" ");

            // Determine display format only if we're actually displaying
            const displayMode =
                this.config.encryption?.displayMode || "readable";
            const showEncryptionStatus =
                this.config.encryption?.showEncryptionStatus || false;

            // Apply display mode transformations if encryption is enabled
            if (
                this.encryptionHandler &&
                this.config.encryption?.enabled &&
                displayMode !== "readable"
            ) {
                // Get the last encrypted entry for display
                const encryptedLogs =
                    this.encryptionHandler.getEncryptedLogsAsStrings();
                if (encryptedLogs.length > 0) {
                    const latestEncrypted =
                        encryptedLogs[encryptedLogs.length - 1];
                    const encryptedHash = await this.extractEncryptedHash(
                        latestEncrypted
                    );

                    switch (displayMode) {
                        case "encrypted":
                            // Show only the encrypted hash
                            displayMessage = encryptedHash;
                            break;
                        case "both":
                            // Show both readable and encrypted hash
                            displayMessage = `${call.args.join(
                                " "
                            )} [${encryptedHash.substring(0, 32)}...]`;
                            break;
                    }
                }
            }

            // Add encryption status indicator if enabled
            if (showEncryptionStatus && this.config.encryption?.enabled) {
                displayMessage = `${displayMessage}`;
            }

            const component: LogComponent =
                call.category === "system" ? "server" : "userApp";

            // Add metadata if available
            const metadata: any[] = [];
            if (call.source) {
                metadata.push(`[${call.source}]`);
            }

            // Route through our logging system (only if preserveOriginal is true)
            switch (call.level) {
                case "error":
                    this.logger.error(component, displayMessage, ...metadata);
                    break;
                case "warn":
                    this.logger.warn(component, displayMessage, ...metadata);
                    break;
                case "debug":
                    this.logger.debug(component, displayMessage, ...metadata);
                    break;
                default:
                    this.logger.info(component, displayMessage, ...metadata);
                    break;
            }
        } catch (error) {
            // If logging fails and preserveOriginal is true, use original console
            if (this.config.preserveOriginal) {
                const originalMethod =
                    this.originalConsole[call.method] ||
                    this.originalConsole.log;
                if (originalMethod) {
                    originalMethod(`[USERAPP] ${call.args.join(" ")}`);
                }
            }
        } finally {
            // Restore processing state
            this.isProcessing = wasProcessing;
        }
    }

    /**
     * Update statistics
     */
    private updateStats(method: string, startTime: number): void {
        this.stats.totalInterceptions++;
        this.stats.methodCounts[method] =
            (this.stats.methodCounts[method] || 0) + 1;
        this.stats.lastInterceptionTime = Date.now();

        // Calculate performance overhead
        if (this.config.performanceMode && startTime > 0) {
            const overhead = performance.now() - startTime;
            this.performanceBuffer.push(overhead);

            // Keep only last 100 measurements
            if (this.performanceBuffer.length > 100) {
                this.performanceBuffer.shift();
            }

            this.stats.averageOverhead =
                this.performanceBuffer.reduce((a, b) => a + b, 0) /
                this.performanceBuffer.length;
        }

        // Update interceptions per second
        const now = Date.now();
        if (now - this.lastSecondTimestamp >= 1000) {
            this.stats.interceptionsPerSecond = this.lastSecondInterceptions;
            this.lastSecondInterceptions = 0;
            this.lastSecondTimestamp = now;
        } else {
            this.lastSecondInterceptions++;
        }
    }

    /**
     * Handle errors in the interception system
     */
    private handleError(message: string, error: any): void {
        this.errorCount++;
        this.stats.errorCount = this.errorCount;

        const errorMessage =
            error instanceof Error ? error.message : String(error);

        switch (this.config.fallback.onError) {
            case "silent":
                // Do nothing
                break;
            case "throw":
                throw new Error(`${message}: ${errorMessage}`);
            case "console":
            default:
                // Use original console.error to avoid recursion
                if (this.originalConsole.error) {
                    this.originalConsole.error(
                        `[ConsoleInterceptor] ${message}:`,
                        errorMessage
                    );
                }
                break;
        }

        // Check for graceful degradation
        if (
            this.config.fallback.gracefulDegradation &&
            this.errorCount >= this.config.fallback.maxErrors
        ) {
            this.logger.warn(
                "console",
                "Too many errors in console interception, disabling system"
            );
            this.stop();
        }
    }

    /**
     * Check if interception is currently active
     */
    public isActive(): boolean {
        return this.isIntercepting && this.stats.isActive;
    }

    /**
     * Reset statistics
     */
    public resetStats(): void {
        this.stats = {
            totalInterceptions: 0,
            interceptionsPerSecond: 0,
            errorCount: 0,
            lastInterceptionTime: 0,
            methodCounts: {},
            averageOverhead: 0,
            isActive: this.isIntercepting,
        };

        this.config.interceptMethods.forEach((method) => {
            this.stats.methodCounts[method] = 0;
        });

        this.errorCount = 0;
        this.performanceBuffer = [];
    }

    // ENCRYPTION METHODS

    /**
     * Enable console encryption with a key
     * @param key - Encryption key (if not provided, will use environment variable)
     */
    public enableEncryption(key?: string): void {
        if (!this.config.encryption) {
            this.config.encryption = { ...DEFAULT_CONSOLE_CONFIG.encryption! };
        }

        // Preserve existing display mode settings when enabling encryption
        const existingDisplayMode = this.config.encryption.displayMode;
        const existingShowStatus = this.config.encryption.showEncryptionStatus;

        this.config.encryption.enabled = true;

        // Restore display mode settings if they were previously configured
        if (existingDisplayMode) {
            this.config.encryption.displayMode = existingDisplayMode;
        }
        if (existingShowStatus !== undefined) {
            this.config.encryption.showEncryptionStatus = existingShowStatus;
        }

        if (key) {
            this.config.encryption.key = key;
        } else {
            // Try to get key from environment
            this.config.encryption.key =
                process.env.XYPRISS_CONSOLE_ENCRYPTION_KEY ||
                process.env.ENC_SECRET_KEY ||
                this.generateTemporaryKey();
        }

        // Initialize or update encryption handler
        this.initializeEncryptionHandler();

        this.logger.info(
            "console",
            `Console encryption enabled (displayMode: ${this.config.encryption.displayMode})`
        );
    }

    /**
     * Disable console encryption
     */
    public disableEncryption(): void {
        if (this.config.encryption) {
            this.config.encryption.enabled = false;
            this.config.encryption.key = undefined;
        }
        this.logger.info("console", "Console encryption disabled");
    }

    /**
     * Set encryption key for console output
     * @param key - The encryption key to use
     */
    public setEncryptionKey(key: string): void {
        if (!this.config.encryption) {
            this.config.encryption = { ...DEFAULT_CONSOLE_CONFIG.encryption! };
        }
        this.config.encryption.key = key;
        this.logger.info("console", "Console encryption key updated");
    }

    /**
     * Simple encrypt method - enables encryption with key
     * Works independently from preserveOriginal setting
     * @param key - Encryption key
     */
    public encrypt(key: string): void {
        this.enableEncryption(key);
    }

    /**
     * Update encryption display mode
     * @param displayMode - How to display encrypted logs
     * @param showEncryptionStatus - Whether to show encryption indicators
     */
    public setEncryptionDisplayMode(
        displayMode: "readable" | "encrypted" | "both",
        showEncryptionStatus?: boolean
    ): void {
        if (!this.config.encryption) {
            this.config.encryption = { ...DEFAULT_CONSOLE_CONFIG.encryption! };
        }

        this.config.encryption.displayMode = displayMode;
        if (showEncryptionStatus !== undefined) {
            this.config.encryption.showEncryptionStatus = showEncryptionStatus;
        }

        this.logger.info(
            "console",
            `Console encryption display mode updated: ${displayMode}`
        );
    }

    /**
     * Get encrypted console logs (for external transmission)
     * @returns Array of encrypted log entries
     */
    public getEncryptedLogs(): string[] {
        if (!this.encryptionHandler) {
            throw new Error(
                "Encryption is not enabled or handler is not initialized"
            );
        }

        return this.encryptionHandler.getEncryptedLogsAsStrings();
    }

    /**
     * Restore console logs from encrypted data
     * @param encryptedData - Array of encrypted log entries
     * @param key - Decryption key
     * @returns Array of decrypted log entries
     */
    public async restoreFromEncrypted(
        encryptedData: string[],
        key: string
    ): Promise<string[]> {
        try {
            if (!this.encryptionHandler) {
                // Create a temporary encryption handler for decryption
                const tempConfig = {
                    ...DEFAULT_CONSOLE_CONFIG.encryption!,
                    enabled: true,
                    key,
                };
                this.encryptionHandler = new ConsoleEncryption(tempConfig);
            }

            const decryptedCalls =
                await this.encryptionHandler.restoreFromEncryptedStrings(
                    encryptedData,
                    key
                );
            const decryptedMessages = decryptedCalls.map((call) =>
                call.args.join(" ")
            );

            this.logger.info(
                "console",
                `Restored ${decryptedMessages.length} encrypted log entries`
            );
            return decryptedMessages;
        } catch (error) {
            this.logger.error(
                "console",
                "Failed to restore encrypted logs",
                error
            );
            throw error;
        }
    }

    /**
     * Generate a temporary encryption key (for development)
     */
    private generateTemporaryKey(): string {
        const key =
            Math.random().toString(36).substring(2, 15) +
            Math.random().toString(36).substring(2, 15);
        this.logger.warn(
            "console",
            "Using temporary encryption key. Set CONSOLE_ENCRYPTION_KEY for production."
        );
        return key;
    }

    /**
     * Extract encrypted hash from the full encrypted JSON structure
     */
    private async extractEncryptedHash(encryptedData: string) {
        try {
            // Parse the encrypted JSON structure
            const encryptedObj = JSON.parse(encryptedData);

            // Get the encoding type from config
            const encoding = this.config.encryption?.encoding || "base64";

            // Extract just the encrypted data field and encode it properly
            const encrypt = func(async (out) => {
                const encr = await Hash.createSecureHash(
                    encryptedObj.data,
                    SecureRandom.generateSalt(),
                    {
                        outputFormat: out,
                    }
                );
                return encr;
            });
            if (encryptedObj.data) {
                switch (encoding) {
                    case "base64":
                        return await encrypt("base64");
                    case "hex":
                        return await encrypt("hex");
                    default:
                        return await encrypt("base64");
                }
            }

            // Fallback: create a hash of the entire encrypted structure
            const buffer = Buffer.from(encryptedData);
            return encoding === "base64"
                ? buffer.toString("base64")
                : buffer.toString("hex");
        } catch (error) {
            // If parsing fails, create a simple hash of the raw data
            const encoding = this.config.encryption?.encoding || "base64";
            const buffer = Buffer.from(encryptedData);
            return encoding === "base64"
                ? buffer.toString("base64")
                : buffer.toString("hex");
        }
    }

    /**
     * Check if encryption is currently enabled
     */
    public isEncryptionEnabled(): boolean {
        return (
            this.config.encryption?.enabled === true &&
            !!this.config.encryption.key
        );
    }

    /**
     * Get encryption status and configuration
     */
    public getEncryptionStatus(): {
        enabled: boolean;
        algorithm?: string;
        hasKey: boolean;
        externalLogging?: boolean;
    } {
        const encryption = this.config.encryption;
        return {
            enabled: encryption?.enabled === true,
            algorithm: encryption?.algorithm,
            hasKey: !!encryption?.key,
            externalLogging: encryption?.externalLogging?.enabled,
        };
    }

    /**
     * Add log to trace buffer
     */
    private addToTraceBuffer(log: InterceptedConsoleCall): void {
        const maxSize = this.config.tracing?.maxBufferSize || 1000;
        this.traceBuffer.push({ ...log });

        if (this.traceBuffer.length > maxSize) {
            this.traceBuffer.shift();
        }
    }

    /**
     * Set plugin engine for triggering hooks
     */
    public setPluginEngine(engine: any): void {
        this.pluginEngine = engine;
    }

    /**
     * Trigger all registered trace hooks
     */
    private triggerTraceHooks(log: InterceptedConsoleCall): void {
        const logCopy = { ...log };
        this.traceHooks.forEach((hook) => {
            try {
                hook(logCopy);
            } catch (error) {
                // Ignore hook errors to prevent affecting main flow
            }
        });

        // Trigger plugin engine hooks if available
        if (this.pluginEngine) {
            try {
                this.pluginEngine.triggerConsoleLogHook(logCopy);
            } catch (error) {
                // Silently ignore
            }
        }
    }

    /**
     * Register a new trace hook
     * Restricted: Only allowed if explicitly permitted or in development
     */
    public onTrace(hook: (log: InterceptedConsoleCall) => void): void {
        // Strict security: tracing must be enabled in config
        if (!this.config.tracing?.enabled) {
            this.logger.warn(
                "console",
                "Attempted to register trace hook but tracing is disabled in configuration"
            );
            return;
        }

        this.traceHooks.push(hook);
    }

    /**
     * Get tracked logs
     */
    public getTraceBuffer(): InterceptedConsoleCall[] {
        return [...this.traceBuffer];
    }

    /**
     * Clear trace buffer
     */
    public clearTraceBuffer(): void {
        this.traceBuffer = [];
    }

    /**
     * Enable tracing at runtime
     */
    public enableTracing(maxBufferSize?: number): void {
        if (!this.config.tracing) {
            this.config.tracing = {
                enabled: true,
                maxBufferSize: maxBufferSize || 1000,
                includeStack: false,
            };
        } else {
            this.config.tracing.enabled = true;
            if (maxBufferSize) {
                this.config.tracing.maxBufferSize = maxBufferSize;
            }
        }
        this.logger.info("console", "Console log tracing enabled");
    }

    /**
     * Disable tracing at runtime
     */
    public disableTracing(): void {
        if (this.config.tracing) {
            this.config.tracing.enabled = false;
        }
        this.logger.info("console", "Console log tracing disabled");
    }
}

