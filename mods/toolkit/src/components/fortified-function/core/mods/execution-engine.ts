/**
 * Execution Engine for Fortified Function Core
 * Handles function execution with timeout, retries, and security
 */

import { EventEmitter } from "events";
import {
    FortifiedFunctionOptions,
    SecureExecutionContext,
} from "../../types/types";
import { SecurityManager } from "./security-manager";
import { FortifiedUtils } from "../../utils/utils";

export class ExecutionEngine extends EventEmitter {
    private readonly options: Required<FortifiedFunctionOptions>;
    private readonly securityManager: SecurityManager;

    constructor(
        options: Required<FortifiedFunctionOptions>,
        securityManager: SecurityManager
    ) {
        super();
        this.options = options;
        this.securityManager = securityManager;
    }

    /**
     * Execute function with security monitoring and error handling
     */
    async executeWithSecurity<T extends any[], R>(
        originalFunction: (...args: T) => R | Promise<R>,
        context: SecureExecutionContext,
        args: T
    ): Promise<R> {
        const { executionId } = context;

        // Set up timeout
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(
                    new Error(
                        `Function execution timeout after ${this.options.timeout}ms`
                    )
                );
            }, this.options.timeout);
        });

        // Execute with retry logic
        let lastError: Error | null = null;
        for (let attempt = 0; attempt <= this.options.retries; attempt++) {
            try {
                const executionPromise =
                    this.securityManager.executeWithStackProtection(
                        originalFunction,
                        args
                    );
                const result = await Promise.race([
                    executionPromise,
                    timeoutPromise,
                ]);

                this.emit("execution_success", { executionId, attempt });
                return result;
            } catch (error) {
                lastError = error as Error;
                this.emit("execution_error", { executionId, attempt, error });

                if (attempt < this.options.retries) {
                    const delay = FortifiedUtils.calculateRetryDelay(
                        attempt,
                        this.options.maxRetryDelay
                    );
                    await FortifiedUtils.sleep(delay);
                    this.emit("execution_retry", {
                        executionId,
                        attempt: attempt + 1,
                        delay,
                    });
                }
            }
        }

        throw lastError;
    }

    /**
     * Execute function with full monitoring and validation
     */
    async executeWithMonitoring<T extends any[], R>(
        originalFunction: (...args: T) => R | Promise<R>,
        context: SecureExecutionContext,
        args: T,
        preExecutionHook?: () => Promise<void>,
        postExecutionHook?: (result: R) => Promise<void>
    ): Promise<R> {
        // Pre-execution validation and hooks
        if (preExecutionHook) {
            await preExecutionHook();
        }

        this.emit("execution_started", {
            executionId: context.executionId,
            timestamp: new Date(),
        });

        try {
            // Execute with security and monitoring
            const result = await this.executeWithSecurity(
                originalFunction,
                context,
                args
            );

            // Post-execution hooks
            if (postExecutionHook) {
                await postExecutionHook(result);
            }

            this.emit("execution_completed", {
                executionId: context.executionId,
                duration: performance.now() - context.startTime,
            });

            return result;
        } catch (error) {
            this.emit("execution_failed", {
                executionId: context.executionId,
                error: error as Error,
                duration: performance.now() - context.startTime,
            });
            throw error;
        }
    }

    /**
     * Validate execution prerequisites
     */
    validateExecution<T extends any[]>(args: T): void {
        // Check if arguments are valid
        if (!Array.isArray(args)) {
            throw new Error("Invalid arguments provided to fortified function");
        }

        // Additional validation can be added here
        this.emit("execution_validated", { argsLength: args.length });
    }

    /**
     * Create timeout promise for execution
     */
    private createTimeoutPromise(timeoutMs: number): Promise<never> {
        return new Promise<never>((_, reject) => {
            setTimeout(() => {
                reject(
                    new Error(`Function execution timeout after ${timeoutMs}ms`)
                );
            }, timeoutMs);
        });
    }

    /**
     * Execute single attempt with timeout
     */
    private async executeSingleAttempt<T extends any[], R>(
        originalFunction: (...args: T) => R | Promise<R>,
        args: T,
        timeoutMs: number
    ): Promise<R> {
        const timeoutPromise = this.createTimeoutPromise(timeoutMs);
        const executionPromise =
            this.securityManager.executeWithStackProtection(
                originalFunction,
                args
            );

        return await Promise.race([executionPromise, timeoutPromise]);
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.removeAllListeners();
    }
}

