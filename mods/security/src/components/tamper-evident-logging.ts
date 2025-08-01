/* ---------------------------------------------------------------------------------------------
 *  Copyright (c) NEHONIX INC. All rights reserved.
 *  Licensed under the MIT License. See LICENSE in the project root for license information.
 * -------------------------------------------------------------------------------------------
 */

/**
 * @author NEHONIX INC.
 * @version 1.0.0
 * @license MIT
 * @description Tamper-Evident Logging Module
 *
 * This module provides secure logging functionality with tamper detection.
 * It creates a cryptographically linked chain of log entries that can detect
 * if any entries have been modified, deleted, or inserted.
 *
 * This is useful for security-critical applications where log integrity
 * is important, such as audit logs, security events, or financial transactions.
 */

import { Hash } from "../core/hash";
import { SecureRandom } from "../core/random";
import { bufferToHex } from "../utils/encoding";

/**
 * Log level
 */
export enum LogLevel {
    DEBUG = "DEBUG",
    INFO = "INFO",
    WARNING = "WARNING",
    ERROR = "ERROR",
    CRITICAL = "CRITICAL",
}

/**
 * Log entry
 */
export interface LogEntry {
    /**
     * Unique identifier for the log entry
     */
    id: string;

    /**
     * Timestamp when the log entry was created
     */
    timestamp: number;

    /**
     * Log level
     */
    level: LogLevel;

    /**
     * Log message
     */
    message: string;

    /**
     * Additional data
     */
    data?: any;

    /**
     * Hash of the previous log entry
     */
    previousHash: string;

    /**
     * Hash of this log entry
     */
    hash: string;

    /**
     * Sequence number
     */
    sequence: number;
}

/**
 * Log verification result
 */
export interface LogVerificationResult {
    /**
     * Whether the log chain is valid
     */
    valid: boolean;

    /**
     * List of invalid entries
     */
    invalidEntries: number[];

    /**
     * List of missing entries
     */
    missingEntries: number[];

    /**
     * List of tampered entries
     */
    tamperedEntries: number[];
}

/**
 * Tamper-evident logger
 */
export class TamperEvidentLogger {
    private entries: LogEntry[] = [];
    private lastHash: string = "";
    private sequence: number = 0;
    private key: string;
    private storageKey?: string;

    /**
     * Creates a new tamper-evident logger
     *
     * @param key - Secret key for hashing
     * @param storageKey - Key for storing logs in localStorage (if available)
     */
    constructor(key?: string, storageKey?: string) {
        this.key = key || bufferToHex(SecureRandom.getRandomBytes(32));
        this.storageKey = storageKey;

        // Initialize with a genesis entry if storage is empty
        if (this.entries.length === 0) {
            this.addGenesisEntry();
        }

        // Load from storage if available
        this.loadFromStorage();
    }

    /**
     * Adds a genesis entry to the log
     */
    private addGenesisEntry(): void {
        const timestamp = Date.now();
        const id = this.generateId();

        const genesisEntry: LogEntry = {
            id,
            timestamp,
            level: LogLevel.INFO,
            message: "Genesis entry",
            previousHash:
                "0000000000000000000000000000000000000000000000000000000000000000",
            hash: "",
            sequence: 0,
        };

        // Calculate the hash
        genesisEntry.hash = this.calculateHash(genesisEntry);

        // Add to entries
        this.entries.push(genesisEntry);
        this.lastHash = genesisEntry.hash;
        this.sequence = 1;

        // Save to storage
        this.saveToStorage();
    }

    /**
     * Generates a unique ID for a log entry
     *
     * @returns Unique ID
     */
    private generateId(): string {
        return bufferToHex(SecureRandom.getRandomBytes(16));
    }

    /**
     * Calculates the hash of a log entry
     *
     * @param entry - Log entry to hash
     * @returns Hash of the log entry
     */
    private calculateHash(entry: LogEntry): string {
        // Create a string representation of the entry without the hash
        const entryString = JSON.stringify({
            id: entry.id,
            timestamp: entry.timestamp,
            level: entry.level,
            message: entry.message,
            data: entry.data,
            previousHash: entry.previousHash,
            sequence: entry.sequence,
        });

        // Calculate the hash
        return Hash.create(entryString, {
            salt: this.key,
            algorithm: "sha256",
            iterations: 1,
            outputFormat: "hex",
        }) as string;
    }

    /**
     * Loads logs from storage
     */
    private loadFromStorage(): void {
        if (!this.storageKey || typeof localStorage === "undefined") {
            return;
        }

        try {
            const storedData = localStorage.getItem(this.storageKey);

            if (storedData) {
                const parsed = JSON.parse(storedData);

                if (Array.isArray(parsed)) {
                    this.entries = parsed;

                    if (this.entries.length > 0) {
                        const lastEntry = this.entries[this.entries.length - 1];
                        this.lastHash = lastEntry.hash;
                        this.sequence = lastEntry.sequence + 1;
                    } else {
                        this.addGenesisEntry();
                    }
                }
            }
        } catch (e) {
            console.error("Failed to load logs from storage:", e);
            this.addGenesisEntry();
        }
    }

    /**
     * Saves logs to storage
     */
    private saveToStorage(): void {
        if (!this.storageKey || typeof localStorage === "undefined") {
            return;
        }

        try {
            localStorage.setItem(this.storageKey, JSON.stringify(this.entries));
        } catch (e) {
            console.error("Failed to save logs to storage:", e);
        }
    }

    /**
     * Adds a log entry
     *
     * @param level - Log level
     * @param message - Log message
     * @param data - Additional data
     * @returns The created log entry
     */
    public log(level: LogLevel, message: string, data?: any): LogEntry {
        const timestamp = Date.now();
        const id = this.generateId();

        const entry: LogEntry = {
            id,
            timestamp,
            level,
            message,
            data,
            previousHash: this.lastHash,
            hash: "",
            sequence: this.sequence,
        };

        // Calculate the hash
        entry.hash = this.calculateHash(entry);

        // Add to entries
        this.entries.push(entry);
        this.lastHash = entry.hash;
        this.sequence++;

        // Save to storage
        this.saveToStorage();

        return entry;
    }

    /**
     * Logs a debug message
     *
     * @param message - Log message
     * @param data - Additional data
     * @returns The created log entry
     */
    public debug(message: string, data?: any): LogEntry {
        return this.log(LogLevel.DEBUG, message, data);
    }

    /**
     * Logs an info message
     *
     * @param message - Log message
     * @param data - Additional data
     * @returns The created log entry
     */
    public info(message: string, data?: any): LogEntry {
        return this.log(LogLevel.INFO, message, data);
    }

    /**
     * Logs a warning message
     *
     * @param message - Log message
     * @param data - Additional data
     * @returns The created log entry
     */
    public warning(message: string, data?: any): LogEntry {
        return this.log(LogLevel.WARNING, message, data);
    }

    /**
     * Logs an error message
     *
     * @param message - Log message
     * @param data - Additional data
     * @returns The created log entry
     */
    public error(message: string, data?: any): LogEntry {
        return this.log(LogLevel.ERROR, message, data);
    }

    /**
     * Logs a critical message
     *
     * @param message - Log message
     * @param data - Additional data
     * @returns The created log entry
     */
    public critical(message: string, data?: any): LogEntry {
        return this.log(LogLevel.CRITICAL, message, data);
    }

    /**
     * Gets all log entries
     *
     * @returns All log entries
     */
    public getEntries(): LogEntry[] {
        return [...this.entries];
    }

    /**
     * Gets log entries by level
     *
     * @param level - Log level
     * @returns Log entries with the specified level
     */
    public getEntriesByLevel(level: LogLevel): LogEntry[] {
        return this.entries.filter((entry) => entry.level === level);
    }

    /**
     * Gets log entries by time range
     *
     * @param startTime - Start time
     * @param endTime - End time
     * @returns Log entries within the specified time range
     */
    public getEntriesByTimeRange(
        startTime: number,
        endTime: number
    ): LogEntry[] {
        return this.entries.filter(
            (entry) =>
                entry.timestamp >= startTime && entry.timestamp <= endTime
        );
    }

    /**
     * Verifies the integrity of the log chain
     *
     * @returns Verification result
     */
    public verify(): LogVerificationResult {
        const result: LogVerificationResult = {
            valid: true,
            invalidEntries: [],
            missingEntries: [],
            tamperedEntries: [],
        };

        if (this.entries.length === 0) {
            return result;
        }

        // Check the genesis entry
        const genesisEntry = this.entries[0];

        if (
            genesisEntry.previousHash !==
            "0000000000000000000000000000000000000000000000000000000000000000"
        ) {
            result.valid = false;
            result.tamperedEntries.push(0);
        }

        // Verify each entry
        for (let i = 0; i < this.entries.length; i++) {
            const entry = this.entries[i];

            // Verify the hash
            const calculatedHash = this.calculateHash(entry);

            if (calculatedHash !== entry.hash) {
                result.valid = false;
                result.tamperedEntries.push(i);
            }

            // Verify the previous hash (except for genesis)
            if (i > 0) {
                const previousEntry = this.entries[i - 1];

                if (entry.previousHash !== previousEntry.hash) {
                    result.valid = false;
                    result.tamperedEntries.push(i);
                }
            }

            // Verify the sequence
            if (entry.sequence !== i) {
                result.valid = false;
                result.invalidEntries.push(i);
            }
        }

        // Check for missing entries
        for (let i = 1; i < this.entries.length; i++) {
            const entry = this.entries[i];
            const previousEntry = this.entries[i - 1];

            if (entry.sequence - previousEntry.sequence > 1) {
                result.valid = false;

                for (
                    let j = previousEntry.sequence + 1;
                    j < entry.sequence;
                    j++
                ) {
                    result.missingEntries.push(j);
                }
            }
        }

        return result;
    }

    /**
     * Exports the logs to a string
     *
     * @returns Exported logs
     */
    public export(): string {
        return JSON.stringify(this.entries);
    }

    /**
     * Imports logs from a string
     *
     * @param data - Exported logs
     * @param verify - Whether to verify the logs after importing
     * @returns Verification result if verify is true
     */
    public import(
        data: string,
        verify: boolean = true
    ): LogVerificationResult | undefined {
        try {
            const parsed = JSON.parse(data);

            if (!Array.isArray(parsed)) {
                throw new Error("Invalid log data");
            }

            this.entries = parsed;

            if (this.entries.length > 0) {
                const lastEntry = this.entries[this.entries.length - 1];
                this.lastHash = lastEntry.hash;
                this.sequence = lastEntry.sequence + 1;
            } else {
                this.addGenesisEntry();
            }

            // Save to storage
            this.saveToStorage();

            // Verify if requested
            if (verify) {
                return this.verify();
            }
        } catch (e) {
            console.error("Failed to import logs:", e);
            this.addGenesisEntry();
        }

        return undefined;
    }

    /**
     * Clears all logs
     */
    public clear(): void {
        this.entries = [];
        this.lastHash = "";
        this.sequence = 0;

        // Add genesis entry
        this.addGenesisEntry();
    }
}
