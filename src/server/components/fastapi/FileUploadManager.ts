/**
 * File Upload Manager for XyPriss Server
 * Handles multer configuration and file upload middleware setup
 */

import * as path from "path";
import { Logger } from "../../../../shared/logger/Logger";
import { UltraFastApp } from "../../../types/types";

export interface FileUploadConfig {
    /** Enable file upload handling */
    enabled?: boolean;

    /** Maximum file size in bytes */
    maxFileSize?: number;

    /** Maximum number of files per request */
    maxFiles?: number; 

    /** Allowed MIME types */
    allowedMimeTypes?: string[];

    /** Allowed file extensions */
    allowedExtensions?: string[];

    /** Upload destination directory */
    destination?: string;

    /** Custom filename function */
    filename?: (req: any, file: any, callback: (error: Error | null, filename: string) => void) => void;

    /** Detailed limits configuration */
    limits?: {
        /** Max field name size in bytes */
        fieldNameSize?: number;

        /** Max field value size in bytes */
        fieldSize?: number;

        /** Max number of non-file fields */
        fields?: number;

        /** Max file size in bytes */
        fileSize?: number;

        /** Max number of file fields */
        files?: number;

        /** Max number of header key=>value pairs */
        headerPairs?: number;
    };

    /** Preserve full paths instead of just filenames */
    preservePath?: boolean;

    /** Custom file filter function */
    fileFilter?: (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => void;

    /** Storage type */
    storage?: 'disk' | 'memory' | 'custom';

    /** Create parent directories if they don't exist */
    createParentPath?: boolean;

    /** Abort request on limit reached */
    abortOnLimit?: boolean;

    /** Response message when limit is reached */
    responseOnLimit?: string;

    /** Use temporary files for large uploads */
    useTempFiles?: boolean;

    /** Temporary file directory */
    tempFileDir?: string;

    /** Parse nested objects in multipart data */
    parseNested?: boolean;

    /** Enable debug logging */
    debug?: boolean;

    /** Custom multer options */
    multerOptions?: {
        dest?: string;
        storage?: any;
        limits?: {
            fieldNameSize?: number;
            fieldSize?: number;
            fields?: number;
            fileSize?: number;
            files?: number;
            headerPairs?: number;
        };
        preservePath?: boolean;
        fileFilter?: (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => void;
        [key: string]: any;
    };
}

export class FileUploadManager {
    private logger: Logger;
    private config: FileUploadConfig;
    private multer: any = null;
    private upload: any = null;

    constructor(config: FileUploadConfig, logger: Logger) {
        this.config = config;
        this.logger = logger;
    }

    /**
     * Initialize the file upload manager
     */
    public async initialize(): Promise<void> {
        if (!this.config.enabled) {
            this.logger.debug("server", "File upload configuration disabled or not configured");
            return;
        }

        try {
            // Dynamic import of multer to avoid issues if not installed
            this.multer = await import("multer");

            // Build multer configuration from options
            const multerConfig: any = {
                storage: this.config.storage === 'memory'
                    ? this.multer.memoryStorage()
                    : this.multer.diskStorage({
                        destination: this.config.destination || './uploads',
                        filename: this.config.filename || ((req: any, file: any, cb: any) => {
                            const uniqueSuffix = Date.now() + '-' + Math.round(Math.random() * 1E9);
                            cb(null, file.fieldname + '-' + uniqueSuffix + path.extname(file.originalname));
                        })
                    }),
                limits: {
                    fileSize: this.config.maxFileSize || 1024 * 1024, // 1MB default
                    files: this.config.maxFiles || 1,
                    ...this.config.limits
                },
                fileFilter: this.config.fileFilter || this.createDefaultFileFilter(),
                preservePath: this.config.preservePath || false
            };

            // Apply custom multer options if provided
            if (this.config.multerOptions) {
                Object.assign(multerConfig, this.config.multerOptions);
            }

            // Debug log the configuration
            this.logger.debug("server", `Multer config:`, {
                storage: multerConfig.storage ? 'custom' : 'default',
                limits: multerConfig.limits,
                hasFileFilter: !!multerConfig.fileFilter,
                maxFileSize: this.config.maxFileSize,
                maxFileSizeMB: this.config.maxFileSize ? (this.config.maxFileSize / (1024 * 1024)).toFixed(2) + 'MB' : '1MB'
            });

            // Create multer instance with configuration
            this.upload = (this.multer as any).default(multerConfig);

            // Create destination directory if using disk storage and createParentPath is enabled
            if (this.config.storage !== 'memory' &&
                this.config.createParentPath !== false &&
                this.config.destination) {
                const fs = await import("fs");
                const destPath = path.resolve(this.config.destination);
                if (!fs.existsSync(destPath)) {
                    fs.mkdirSync(destPath, { recursive: true });
                    this.logger.debug("server", `Created upload directory: ${destPath}`);
                }
            }

            this.logger.debug("server", "File upload configuration initialized successfully");
            this.logger.debug("server", `Upload storage: ${this.config.storage || 'disk'}`);
            this.logger.debug("server", `Max file size: ${multerConfig.limits.fileSize} bytes`);
            this.logger.debug("server", `Max files: ${multerConfig.limits.files}`);

        } catch (error: any) {
            this.logger.error("server", "Failed to initialize file upload configuration:", error.message);
            throw error;
        }
    }

    /**
     * Create default file filter based on configuration
     */
    private createDefaultFileFilter(): (req: any, file: any, callback: (error: Error | null, acceptFile: boolean) => void) => void {
        return (req: any, file: any, cb: any) => {
            this.logger.debug("server", `Filtering file: ${file.originalname}, type: ${file.mimetype}, size: ${file.size}`);

            // Check file size if specified in config
            if (this.config?.maxFileSize && file.size > this.config.maxFileSize) {
                const maxSizeMB = (this.config.maxFileSize / (1024 * 1024)).toFixed(2);
                const fileSizeMB = (file.size / (1024 * 1024)).toFixed(2);
                this.logger.debug("server", `File too large: ${fileSizeMB}MB > ${maxSizeMB}MB limit`);
                return cb(new Error(`File too large. Maximum size: ${maxSizeMB}MB, file size: ${fileSizeMB}MB`), false);
            }

            // Default file filter - check allowed types if specified
            if (this.config?.allowedMimeTypes) {
                this.logger.debug("server", `Checking MIME types: ${this.config.allowedMimeTypes.join(', ')}`);
                if (!this.config.allowedMimeTypes.includes(file.mimetype)) {
                    this.logger.debug("server", `MIME type ${file.mimetype} not allowed`);
                    return cb(new Error(`File type '${file.mimetype}' not allowed. Allowed types: ${this.config.allowedMimeTypes.join(', ')}`), false);
                }
            }

            if (this.config?.allowedExtensions) {
                const ext = path.extname(file.originalname).toLowerCase();
                this.logger.debug("server", `Checking extensions: ${this.config.allowedExtensions.join(', ')}, file ext: ${ext}`);
                if (!this.config.allowedExtensions.includes(ext)) {
                    this.logger.debug("server", `File extension ${ext} not allowed`);
                    return cb(new Error(`File extension '${ext}' not allowed. Allowed extensions: ${this.config.allowedExtensions.join(', ')}`), false);
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
        return this.upload?.single(fieldname);
    }

    /**
     * Get array file upload middleware
     */
    public array(fieldname: string, maxCount?: number): any {
        return this.upload?.array(fieldname, maxCount);
    }

    /**
     * Get fields file upload middleware
     */
    public fields(fields: any[]): any {
        return this.upload?.fields(fields);
    }

    /**
     * Get any file upload middleware
     */
    public any(): any {
        return this.upload?.any();
    }

    /**
     * Get none file upload middleware (for form data without files)
     */
    public none(): any {
        return this.upload?.none();
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
