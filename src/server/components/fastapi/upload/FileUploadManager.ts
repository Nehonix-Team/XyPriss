/**
 * File Upload Manager for XyPriss Server
 * Handles multer configuration and file upload middleware setup
 */

import * as path from "path";
import { Logger } from "../../../../shared/logger/Logger";
import { FileUploadConfig } from "../../../../types/FiUp.type";
import { Configs } from "../../../../config";

// Re-export FileUploadConfig for external use
export type { FileUploadConfig };

export class FileUploadManager {
    private logger: Logger;
    private config: FileUploadConfig;
    private upload: any = null;

    constructor(logger: Logger, config?: FileUploadConfig) {
        this.config = config || Configs.get("fileUpload") || {};
        this.logger = logger;
    }

    /**
     * Initialize the file upload manager
     */
    public async initialize(): Promise<void> {
        if (!this.config.enabled) {
            this.logger.debug(
                "server",
                "File upload configuration disabled or not configured",
            );
            return;
        }

        this.logger.debug("server", "Go-Native File Upload initialized");
        this.upload = true; // Mark as initialized
    }

    /**
     * Create default file filter based on configuration
     */
    private createDefaultFileFilter(): (
        req: any,
        file: any,
        callback: (error: Error | null, acceptFile: boolean) => void,
    ) => void {
        return (req: any, file: any, cb: any) => {
            this.logger.debug(
                "server",
                `Filtering file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`,
            );

            // Check file size if specified in config
            if (
                this.config?.maxFileSize &&
                file.size > this.config.maxFileSize
            ) {
                const maxSizeMB = (
                    this.config.maxFileSize /
                    (1024 * 1024)
                ).toFixed(2);
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                this.logger.debug(
                    "server",
                    `File too large: ${fileSizeMB}MB > ${maxSizeMB}MB limit`,
                );
                return cb(
                    new Error(
                        `File too large. Maximum size: ${maxSizeMB}MB, file size: ${fileSizeMB}MB`,
                    ),
                    false,
                );
            }

            // Default file filter - check allowed types if specified
            if (this.config?.allowedMimeTypes) {
                this.logger.debug(
                    "server",
                    `Checking MIME types: ${this.config.allowedMimeTypes.join(
                        ", ",
                    )}`,
                );
                if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
                    this.logger.debug(
                        "server",
                        `MIME type ${file.mimetype} not allowed`,
                    );
                    return cb(
                        new Error(
                            `File type '${
                                file.mimetype
                            }' not allowed. Allowed types: ${this.config.allowedMimeTypes.join(
                                ", ",
                            )}`,
                        ),
                        false,
                    );
                }
            }

            if (this.config?.allowedExtensions) {
                const ext = path.extname(file.originalname).toLowerCase();
                this.logger.debug(
                    "server",
                    `Checking extensions: ${this.config.allowedExtensions.join(
                        ", ",
                    )}, file ext: ${ext}`,
                );
                if (!this.config.allowedExtensions.includes(ext)) {
                    this.logger.debug(
                        "server",
                        `File extension ${ext} not allowed`,
                    );
                    return cb(
                        new Error(
                            `File extension '${ext}' not allowed. Allowed extensions: ${this.config.allowedExtensions.join(
                                ", ",
                            )}`,
                        ),
                        false,
                    );
                }
            }

            this.logger.debug("server", "File passed filter");
            cb(null, true);
        };
    }

    /**
     * Get the multer upload instance
     */
    public getUpload(): any {
        return this.upload;
    }

    /**
     * Get single file upload middleware
     */
    public single(fieldname: string): any {
        return (req: any, res: any, next: any) => {
            // Check for errors propagated from the binary
            if (req.uploadErrors && Array.isArray(req.uploadErrors)) {
                const fieldErrors = req.uploadErrors.filter(
                    (err: any) => err.fieldname === fieldname,
                );
                if (fieldErrors.length > 0) {
                    return next(
                        new Error(
                            fieldErrors[0].message ||
                                `File upload rejected for field ${fieldname}`,
                        ),
                    );
                }
            }

            const files = (req.files || []).filter(
                (f: any) => f.fieldname === fieldname,
            );
            if (files.length > 1)
                return next(
                    new Error(
                        `Unexpected multiple files for field ${fieldname}`,
                    ),
                );

            const file = files[0];
            if (!file) return next(); // Multer optional behavior

            this.createDefaultFileFilter()(req, file, (err, accept) => {
                if (err) return next(err);
                if (!accept) return next(new Error("File rejected"));
                req.file = file;
                next();
            });
        };
    }

    public array(fieldname: string, maxCount?: number): any {
        return (req: any, res: any, next: any) => {
            if (req.uploadErrors && Array.isArray(req.uploadErrors)) {
                const fieldErrors = req.uploadErrors.filter(
                    (err: any) => err.fieldname === fieldname,
                );
                if (fieldErrors.length > 0) {
                    return next(
                        new Error(
                            fieldErrors[0].message ||
                                `File upload rejected for field ${fieldname}`,
                        ),
                    );
                }
            }

            const files = (req.files || []).filter(
                (f: any) => f.fieldname === fieldname,
            );
            if (maxCount && files.length > maxCount) {
                return next(
                    new Error(
                        `Too many files in field ${fieldname}. Max: ${maxCount}`,
                    ),
                );
            }

            let completed = 0;
            let errorOccurred = false;

            if (files.length === 0) return next();

            files.forEach((file: any) => {
                this.createDefaultFileFilter()(req, file, (err, accept) => {
                    if (errorOccurred) return;
                    if (err) {
                        errorOccurred = true;
                        return next(err);
                    }
                    if (!accept) {
                        errorOccurred = true;
                        return next(new Error("File rejected"));
                    }
                    completed++;
                    if (completed === files.length) next();
                });
            });
        };
    }

    public fields(fields: Array<{ name: string; maxCount?: number }>): any {
        return (req: any, res: any, next: any) => {
            const allFiles = req.files || [];
            let errorOccurred = false;
            let totalToValidate = 0;
            let validatedCount = 0;

            // First pass: count files and check maxCount
            for (const field of fields) {
                const files = allFiles.filter(
                    (f: any) => f.fieldname === field.name,
                );
                if (field.maxCount && files.length > field.maxCount) {
                    return next(
                        new Error(
                            `Too many files in field ${field.name}. Max: ${field.maxCount}`,
                        ),
                    );
                }
                totalToValidate += files.length;
            }

            if (totalToValidate === 0) return next();

            // Second pass: validate each file
            for (const field of fields) {
                const files = allFiles.filter(
                    (f: any) => f.fieldname === field.name,
                );
                for (const file of files) {
                    this.createDefaultFileFilter()(req, file, (err, accept) => {
                        if (errorOccurred) return;
                        if (err) {
                            errorOccurred = true;
                            return next(err);
                        }
                        if (!accept) {
                            errorOccurred = true;
                            return next(new Error("File rejected"));
                        }
                        validatedCount++;
                        if (validatedCount === totalToValidate) next();
                    });
                }
            }
        };
    }

    public any(): any {
        return (req: any, res: any, next: any) => {
            if (
                req.uploadErrors &&
                Array.isArray(req.uploadErrors) &&
                req.uploadErrors.length > 0
            ) {
                return next(
                    new Error(
                        req.uploadErrors[0].message || "File upload rejected",
                    ),
                );
            }

            const files = req.files || [];
            if (files.length === 0) return next();

            let completed = 0;
            let errorOccurred = false;

            files.forEach((file: any) => {
                this.createDefaultFileFilter()(req, file, (err, accept) => {
                    if (errorOccurred) return;
                    if (err) {
                        errorOccurred = true;
                        return next(err);
                    }
                    if (!accept) {
                        errorOccurred = true;
                        return next(new Error("File rejected"));
                    }
                    completed++;
                    if (completed === files.length) next();
                });
            });
        };
    }

    public none(): any {
        return (req: any, res: any, next: any) => {
            if (req.files && req.files.length > 0) {
                return next(new Error("Unexpected files in form-data"));
            }
            next();
        };
    }

    /**
     * Check if file upload is enabled
     */
    public isEnabled(): boolean {
        return this.config.enabled === true && this.upload !== null;
    }

    /**
     * Get current configuration
     */
    public getConfig(): FileUploadConfig {
        return this.config;
    }
}

