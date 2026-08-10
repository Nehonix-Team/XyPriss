/**
 * XyPriss File Upload API
 *
 * This module provides file upload middleware functions that can be used
 * independently of the app instance initialization timing.
 *
 * Usage:
 * ```typescript
 * import { FileUploadAPI } from 'xypriss';
 *
 * const fileUpload = new FileUploadAPI();
 * router.post('/upload', fileUpload.single('file'), (req, res) => {
 *   console.log(req.file);
 *   res.json({ success: true });
 * });
 * ```
 */

import { FileUploadManager, FileUploadConfig } from "./FileUploadManager";
import { initializeLogger, Logger } from "../../../../shared/logger/Logger";
import {
    Configs,
} from "../../../../ConfigurationManager";

/**
 * File Upload API Class
 * Provides a clean, class-based interface for file upload middleware
 */
export class FileUploadAPI {
    private manager: FileUploadManager | null = null;
    private logger: Logger;
    private initialized: boolean = false;
    // private configOverride?: FileUploadConfig;

    constructor(config?: FileUploadConfig) {
        Configs.merge(
            { fileUpload: config },
        );
        // Use a default logger if none provided
        this.logger = initializeLogger({
            enabled: true,
            level: "info",
            components: { security: true },
            types: { debug: true },
        });
    }

    /**
     * Ensure CORS headers are attached on error responses if not already present.
     */
    private ensureCorsHeaders(req: any, res: any): void {
        if (res && !res.headersSent) {
            const origin = req?.headers?.origin || "*";
            if (!res.getHeader("Access-Control-Allow-Origin")) {
                res.setHeader("Access-Control-Allow-Origin", origin);
                res.setHeader("Access-Control-Allow-Credentials", "true");
                res.setHeader("Vary", "Origin");
            }
        }
    }

    /**
     * Resolve the FileUploadManager for a specific request.
     * Looks up fileUploadManager from req.app or initializes one from per-server configs if available.
     */
    private async resolveManagerForRequest(req: any): Promise<FileUploadManager | null> {
        // 1. Check if req.app already has a pre-initialized fileUploadManager
        const appManager = (req?.app as any)?.fileUploadManager || (req?.app as any)?.appInstance?.fileUploadManager;
        if (appManager && appManager.isEnabled()) {
            return appManager;
        }

        // 2. Check if req.app has per-server fileUpload config
        const appFileUpload =
            req?.app?.options?.fileUpload ||
            req?.app?.configs?.fileUpload ||
            (req?.app as any)?.appInstance?.options?.fileUpload ||
            (req?.app as any)?.appInstance?.configs?.fileUpload;

        const globalFileUpload = Configs.get("fileUpload");
        const effectiveConfig = appFileUpload || globalFileUpload;

        if (effectiveConfig && effectiveConfig.enabled !== false && (effectiveConfig.enabled === true || effectiveConfig.destination)) {
            const logger = req?.app?.logger || this.logger;
            const manager = new FileUploadManager(logger, effectiveConfig);
            await manager.initialize();
            if (manager.isEnabled()) {
                if (req?.app) {
                    (req.app as any).fileUploadManager = manager;
                }
                return manager;
            }
        }

        // 3. Fallback to global instance manager
        await this.autoInitialize();
        return this.manager && this.manager.isEnabled() ? this.manager : null;
    }

    /**
     * Internal auto-initialization method.
     * Called lazily by middleware methods if not already initialized.
     */
    private async autoInitialize(): Promise<void> {
        if (this.initialized) return;

        // Try to get config from override or global Configs
        const config = Configs.get("fileUpload");

        if (!config || config.enabled === false) {
            // If explicitly disabled or no config found, we can't initialize
            return;
        }

        try {
            this.logger.debug("server", "Auto-initializing FileUploadAPI...");
            this.manager = new FileUploadManager(this.logger);
            await this.manager.initialize();
            this.initialized = true;
            this.logger.debug(
                "server",
                "FileUploadAPI auto-initialized successfully",
            );
        } catch (error: any) {
            this.logger.error(
                "server",
                "Failed to auto-initialize FileUploadAPI:",
                error.message,
            );
        }
    }

    /**
     * Manually initialize the file upload API (legacy support)
     */
    async initialize(configManager?: any): Promise<void> {
        await this.autoInitialize();
    }

    /**
     * Check if the file upload API is enabled
     */
    isEnabled(): boolean {
        return this.manager?.isEnabled() === true;
    }

    /**
     * Handle upload errors and convert them to proper HTTP responses
     */
    private handleUploadError(err: any, req: any, res: any): void {
        this.ensureCorsHeaders(req, res);

        if (err.code === "LIMIT_FILE_SIZE") {
            const maxSize =
                this.manager?.getConfig()?.maxFileSize || 1024 * 1024;
            const maxSizeMB = (maxSize / (1024 * 1024)).toFixed(2);
            res.status(400).json({
                success: false,
                error: "File too large",
                message: `File size exceeds the maximum limit of ${maxSizeMB}MB`,
                details: {
                    maxSize,
                    maxSizeMB,
                    fileSize: req.file ? req.file.size : "unknown",
                },
            });
            return;
        }

        if (err.code === "LIMIT_UNEXPECTED_FIELD") {
            res.status(400).json({
                success: false,
                error: "Unexpected field",
                message: "Unexpected file field name",
            });
            return;
        }

        if (err.code === "LIMIT_FILE_COUNT") {
            res.status(400).json({
                success: false,
                error: "Too many files",
                message: "Too many files uploaded",
            });
            return;
        }

        // Handle custom file filter errors
        if (err.message) {
            if (
                err.message.includes("File too large") ||
                err.message.includes("exceeds limit")
            ) {
                res.status(400).json({
                    success: false,
                    error: "File too large",
                    message: err.message,
                });
                return;
            }

            if (err.message.includes("not allowed")) {
                res.status(400).json({
                    success: false,
                    error: "File type not allowed",
                    message: err.message,
                });
                return;
            }
        }

        // Generic upload error
        res.status(400).json({
            success: false,
            error: "Upload error",
            message: err.message || "An error occurred during file upload",
        });
    }

    /**
     * Create a middleware for uploading a single file
     *
     * @param fieldname - The name of the form field containing the file
     * @returns Middleware function
     */
    single(fieldname: string) {
        return async (req: any, res: any, next: any) => {
            const manager = await this.resolveManagerForRequest(req);

            if (!manager || !manager.isEnabled()) {
                this.ensureCorsHeaders(req, res);
                return res.status(500).json({
                    success: false,
                    error: "Configuration Error",
                    message:
                        "File upload not enabled. Set fileUpload.enabled to true in server options.",
                });
            }

            // Use upload middleware with built-in error handling
            manager.single(fieldname)(req, res, (err: any) => {
                if (err) {
                    this.handleUploadError(err, req, res);
                } else {
                    next();
                }
            });
        };
    }

    /**
     * Create a middleware for uploading multiple files with the same field name
     *
     * @param fieldname - The name of the form field containing the files
     * @param maxCount - Maximum number of files to accept (optional)
     * @returns Middleware function
     */
    array(fieldname: string, maxCount?: number) {
        return async (req: any, res: any, next: any) => {
            const manager = await this.resolveManagerForRequest(req);

            if (!manager || !manager.isEnabled()) {
                this.ensureCorsHeaders(req, res);
                return res.status(500).json({
                    success: false,
                    error: "Configuration Error",
                    message:
                        "File upload not enabled. Set fileUpload.enabled to true in server options.",
                });
            }

            manager.array(fieldname, maxCount)(req, res, (err: any) => {
                if (err) {
                    this.handleUploadError(err, req, res);
                } else {
                    next();
                }
            });
        };
    }

    /**
     * Create a middleware for uploading multiple files with different field names
     *
     * @param fields - Array of field configurations
     * @returns Middleware function
     */
    fields(fields: Array<{ name: string; maxCount?: number }>) {
        return async (req: any, res: any, next: any) => {
            const manager = await this.resolveManagerForRequest(req);

            if (!manager || !manager.isEnabled()) {
                this.ensureCorsHeaders(req, res);
                return res.status(500).json({
                    success: false,
                    error: "Configuration Error",
                    message:
                        "File upload not enabled. Set fileUpload.enabled to true in server options.",
                });
            }

            manager.fields(fields)(req, res, (err: any) => {
                if (err) {
                    this.handleUploadError(err, req, res);
                } else {
                    next();
                }
            });
        };
    }

    /**
     * Create a middleware for uploading any files (accepts all files)
     *
     * @returns Middleware function
     */
    any() {
        return async (req: any, res: any, next: any) => {
            const manager = await this.resolveManagerForRequest(req);

            if (!manager || !manager.isEnabled()) {
                this.ensureCorsHeaders(req, res);
                return res.status(500).json({
                    success: false,
                    error: "Configuration Error",
                    message:
                        "File upload not enabled. Set fileUpload.enabled to true in server options.",
                });
            }

            manager.any()(req, res, (err: any) => {
                if (err) {
                    this.handleUploadError(err, req, res);
                } else {
                    next();
                }
            });
        };
    }
}

export * from "../../../../FiUp";
// alias
export const Upload = new FileUploadAPI();

// Export FileUploadConfig for type safety
export type { FileUploadConfig };

