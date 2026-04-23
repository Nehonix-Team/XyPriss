import { Logger } from "../../../../../shared/logger/Logger";
import { ConsoleInterceptionConfig } from "../types";

/**
 * ConsoleEncryption - Helper for console log encryption
 * Note: Actual encryption now happens in the native XHSC engine.
 * This class provides utility methods for the TS side if needed.
 */
export class ConsoleEncryption {
    constructor(
        private logger: Logger,
        private config: ConsoleInterceptionConfig,
    ) {}

    /**
     * In the new native-first architecture, encryption is handled by Go.
     * This is kept for compatibility with existing TS components that might query status.
     */
    public isEnabled(): boolean {
        return !!this.config.encryption?.enabled;
    }

    public getAlgorithm(): string {
        return this.config.encryption?.algorithm || "aes-256-gcm";
    }
}

