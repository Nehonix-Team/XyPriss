/**
 * Execution Context Manager for Fortified Function Core
 * Manages secure execution contexts and their lifecycle
 */

import { EventEmitter } from "events";
import {
    SecureExecutionContext,
    FortifiedFunctionOptions,
} from "../../types/types";
import { SecurityManager } from "./security-manager";
import { FortifiedUtils } from "../../utils/utils";

export class ExecutionContextManager extends EventEmitter {
    private readonly activeExecutions = new Map<
        string,
        SecureExecutionContext
    >();
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
     * Create secure execution context with encrypted parameters
     */
    async createSecureExecutionContext<T extends any[]>(
        executionId: string,
        args: T
    ): Promise<SecureExecutionContext> {
        const startTime = performance.now();
        const memorySnapshot = FortifiedUtils.getCurrentMemoryUsage();

        const context: SecureExecutionContext = {
            executionId,
            encryptedParameters: new Map(),
            secureBuffers: new Map(),
            startTime,
            memorySnapshot,
            auditEntry: {
                timestamp: new Date(),
                executionId,
                parametersHash: await this.securityManager.hashParameters(args),
                executionTime: 0,
                memoryUsage: memorySnapshot,
                success: false,
                securityFlags: [],
            },
        };

        // Encrypt sensitive parameters
        if (this.options.autoEncrypt) {
            await this.securityManager.encryptParameters(context, args);
        }

        this.activeExecutions.set(executionId, context);
        this.emit("context_created", { executionId });

        return context;
    }

    /**
     * Get execution context by ID
     */
    getExecutionContext(
        executionId: string
    ): SecureExecutionContext | undefined {
        return this.activeExecutions.get(executionId);
    }

    /**
     * Get all active execution contexts
     */
    getActiveExecutions(): Map<string, SecureExecutionContext> {
        return new Map(this.activeExecutions);
    }

    /**
     * Schedule secure cleanup of execution context
     */
    scheduleCleanup(context: SecureExecutionContext): void {
        const cleanup = () => {
            // Destroy secure buffers
            for (const buffer of context.secureBuffers.values()) {
                buffer.destroy();
            }

            // Clear encrypted parameters
            context.encryptedParameters.clear();

            // Remove from active executions
            this.activeExecutions.delete(context.executionId);

            this.emit("context_cleaned", { executionId: context.executionId });
        };

        if (this.options.memoryWipeDelay > 0) {
            setTimeout(cleanup, this.options.memoryWipeDelay);
        } else {
            cleanup();
        }
    }

    /**
     * Clean up all active executions
     */
    cleanupAllExecutions(): void {
        for (const context of this.activeExecutions.values()) {
            this.scheduleCleanup(context);
        }
    }

    /**
     * Get execution count
     */
    getActiveExecutionCount(): number {
        return this.activeExecutions.size;
    }

    /**
     * Clean up resources
     */
    destroy(): void {
        this.cleanupAllExecutions();
        this.removeAllListeners();
    }
}

