/**
 * Console Encryption Module
 * Handles encryption and decryption of console logs using XyPrissJS crypto utilities
 */

import { EncryptionService } from "../../../../../encryption/EncryptionService";
import { SecureRandom } from "../../../../../../mods/toolkit/src/core";
import { ConsoleEncryptionConfig, InterceptedConsoleCall } from "../types";
import { NehoID } from "nehoid";

export interface EncryptedLogEntry {
    id: string;
    timestamp: number;
    encrypted: string;
    iv: string;
    authTag: string;
    salt: string;
    metadata?: {
        algorithm: string;
        keyDerivation: string;
        iterations: number;
    };
}

export interface LogBuffer {
    entries: EncryptedLogEntry[];
    maxSize: number;
    currentSize: number;
}

/**
 * Console Encryption Handler
 * Uses XyPrissJS encryption utilities for production-grade console log encryption
 */
export class ConsoleEncryption {
    private config: ConsoleEncryptionConfig;
    private logBuffer: LogBuffer;
    private derivedKey: Buffer | null = null;
    private keyVersion: number = 1;

    constructor(config: ConsoleEncryptionConfig) {
        this.config = config;
        this.logBuffer = {
            entries: [],
            maxSize: 1000, // Maximum number of encrypted logs to keep in memory
            currentSize: 0,
        };
    }

    /**
     * Encrypt a console log entry
     */
    public async encryptLogEntry(
        call: InterceptedConsoleCall
    ): Promise<EncryptedLogEntry> {
        if (!this.config.enabled || !this.config.key) {
            throw new Error("Encryption is not enabled or key is not set");
        }

        try {
            // Prepare log data
            const logData = {
                method: call.method,
                args: call.args,
                timestamp: call.timestamp,
                level: call.level,
                source: call.source,
                stackTrace: call.stackTrace,
            };

            // Map our algorithm to EncryptionService algorithm
            const algorithm =
                this.config.algorithm === "aes-256-gcm"
                    ? "aes-256-gcm"
                    : "chacha20-poly1305";

            // Use XyPrissJS EncryptionService for production-grade encryption
            const encryptedData = await EncryptionService.encrypt(
                logData,
                this.config.key,
                {
                    algorithm,
                    keyDerivationIterations: this.config.iterations,
                    quantumSafe: algorithm === "chacha20-poly1305", // Enable quantum-safe features
                }
            );

            // EncryptionService returns a JSON string with the encrypted package
            // We'll store it directly as our encrypted data
            const entry: EncryptedLogEntry = {
                id: this.generateEntryId(),
                timestamp: call.timestamp,
                encrypted: encryptedData, // Store the entire encrypted package
                iv: "", // Not needed since EncryptionService handles this
                authTag: "", // Not needed since EncryptionService handles this
                salt: "", // Not needed since EncryptionService handles this
                metadata: {
                    algorithm: this.config.algorithm || "aes-256-gcm",
                    keyDerivation: this.config.keyDerivation || "pbkdf2",
                    iterations: this.config.iterations || 100000,
                },
            };

            // Add to buffer
            this.addToBuffer(entry);

            return entry;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to encrypt log entry: ${errorMessage}`);
        }
    }

    /**
     * Decrypt a log entry
     */
    public async decryptLogEntry(
        entry: EncryptedLogEntry,
        key: string
    ): Promise<InterceptedConsoleCall> {
        try {
            // The encrypted data is already in the format expected by EncryptionService
            const decryptedData = await EncryptionService.decrypt(
                entry.encrypted,
                key
            );

            return decryptedData as InterceptedConsoleCall;
        } catch (error) {
            const errorMessage =
                error instanceof Error ? error.message : String(error);
            throw new Error(`Failed to decrypt log entry: ${errorMessage}`);
        }
    }

    /**
     * Get all encrypted logs from buffer
     */
    public getEncryptedLogs(): EncryptedLogEntry[] {
        return [...this.logBuffer.entries];
    }

    /**
     * Get encrypted logs as strings (for external transmission)
     */
    public getEncryptedLogsAsStrings(): string[] {
        return this.logBuffer.entries.map((entry) => JSON.stringify(entry));
    }

    /**
     * Restore logs from encrypted strings
     */
    public async restoreFromEncryptedStrings(
        encryptedStrings: string[],
        key: string
    ): Promise<InterceptedConsoleCall[]> {
        const results: InterceptedConsoleCall[] = [];

        for (const encryptedString of encryptedStrings) {
            try {
                const entry: EncryptedLogEntry = JSON.parse(encryptedString);
                const decrypted = await this.decryptLogEntry(entry, key);
                results.push(decrypted);
            } catch (error) {
                const errorMessage =
                    error instanceof Error ? error.message : String(error);
                console.warn(
                    `Failed to restore encrypted log entry: ${errorMessage}`
                );
            }
        }

        return results;
    }

    /**
     * Clear the log buffer
     */
    public clearBuffer(): void {
        // Securely wipe the buffer
        this.logBuffer.entries.forEach((entry) => {
            // Overwrite sensitive data
            entry.encrypted = "";
            entry.iv = "";
            entry.authTag = "";
            entry.salt = "";
        });

        this.logBuffer.entries = [];
        this.logBuffer.currentSize = 0;
    }

    /**
     * Update encryption configuration
     */
    public updateConfig(newConfig: Partial<ConsoleEncryptionConfig>): void {
        this.config = { ...this.config, ...newConfig };

        // If key changed, invalidate derived key
        if (newConfig.key) {
            this.derivedKey = null;
            this.keyVersion++;
        }
    }

    /**
     * Get buffer statistics
     */
    public getBufferStats(): {
        totalEntries: number;
        bufferSize: number;
        maxSize: number;
        memoryUsage: number;
    } {
        const memoryUsage = this.logBuffer.entries.reduce((total, entry) => {
            return total + JSON.stringify(entry).length;
        }, 0);

        return {
            totalEntries: this.logBuffer.entries.length,
            bufferSize: this.logBuffer.currentSize,
            maxSize: this.logBuffer.maxSize,
            memoryUsage,
        };
    }

    // Private helper methods

    private generateEntryId(): string {
        // Generate a unique ID for the log entry
        return NehoID.generate({ prefix: "op.nehonix.log", size: 16 });
    }

    private addToBuffer(entry: EncryptedLogEntry): void {
        // Add entry to buffer
        this.logBuffer.entries.push(entry);
        this.logBuffer.currentSize++;

        // Maintain buffer size limit
        if (this.logBuffer.currentSize > this.logBuffer.maxSize) {
            const removed = this.logBuffer.entries.shift();
            if (removed) {
                // Securely wipe removed entry
                removed.encrypted = "";
                removed.iv = "";
                removed.authTag = "";
                removed.salt = "";
                this.logBuffer.currentSize--;
            }
        }
    }

    /**
     * Export encrypted logs for external transmission
     */
    public async exportForExternalLogging(): Promise<{
        logs: string[];
        metadata: {
            totalLogs: number;
            exportTimestamp: number;
            keyVersion: number;
            algorithm: string;
        };
    }> {
        const logs = this.getEncryptedLogsAsStrings();

        return {
            logs,
            metadata: {
                totalLogs: logs.length,
                exportTimestamp: Date.now(),
                keyVersion: this.keyVersion,
                algorithm: this.config.algorithm || "aes-256-gcm",
            },
        };
    }

    /**
     * Batch encrypt multiple log entries for performance
     */
    public async batchEncryptLogEntries(
        calls: InterceptedConsoleCall[]
    ): Promise<EncryptedLogEntry[]> {
        const results: EncryptedLogEntry[] = [];

        for (const call of calls) {
            try {
                const encrypted = await this.encryptLogEntry(call);
                results.push(encrypted);
            } catch (error: any) {
                console.warn(`Failed to encrypt log entry: ${error.message}`);
            }
        }

        return results;
    }
}

