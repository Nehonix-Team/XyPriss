// Legacy function exports for backward compatibility
// These will be deprecated in favor of the class-based API

import { Logger } from "../shared/logger";
import { FileUploadAPI } from "./file-upload";

// Global instance for backward compatibility
let globalFileUploadAPI: FileUploadAPI | null = null;

/**
 * Initialize the global file upload manager (legacy)
 * This is called automatically when the server starts with file upload enabled
 */
export function initializeFileUpload(options: any, logger: Logger): void {
    if (!globalFileUploadAPI) {
        globalFileUploadAPI = new FileUploadAPI(logger);
    }
    globalFileUploadAPI.initialize(options);
}

/**
 * Create a middleware for uploading a single file (legacy)
 */
export function uploadSingle(fieldname: string) {
    return (req: any, res: any, next: any) => {
        if (!globalFileUploadAPI) {
            return res.status(500).json({
                success: false,
                error: "Configuration Error",
                message:
                    "File upload not initialized. Make sure fileUpload.enabled is true in server options.",
            });
        }
        return globalFileUploadAPI.single(fieldname)(req, res, next);
    };
}

/**
 * Create a middleware for uploading multiple files with the same field name (legacy)
 */
export function uploadArray(fieldname: string, maxCount?: number) {
    return (req: any, res: any, next: any) => {
        if (!globalFileUploadAPI) {
            return res.status(500).json({
                success: false,
                error: "Configuration Error",
                message:
                    "File upload not initialized. Make sure fileUpload.enabled is true in server options.",
            });
        }
        return globalFileUploadAPI.array(fieldname, maxCount)(req, res, next);
    };
}

/**
 * Create a middleware for uploading multiple files with different field names (legacy)
 */
export function uploadFields(
    fields: Array<{ name: string; maxCount?: number }>
) {
    return (req: any, res: any, next: any) => {
        if (!globalFileUploadAPI) {
            return res.status(500).json({
                success: false,
                error: "Configuration Error",
                message:
                    "File upload not initialized. Make sure fileUpload.enabled is true in server options.",
            });
        }
        return globalFileUploadAPI.fields(fields)(req, res, next);
    };
}

/**
 * Create a middleware for uploading any files (legacy)
 */
export function uploadAny() {
    return (req: any, res: any, next: any) => {
        if (!globalFileUploadAPI) {
            return res.status(500).json({
                success: false,
                error: "Configuration Error",
                message:
                    "File upload not initialized. Make sure fileUpload.enabled is true in server options.",
            });
        }
        return globalFileUploadAPI.any()(req, res, next);
    };
}

// Export types for TypeScript users
// Types are available through the main types export

export type { FileUploadConfig as FiUpConfig } from "./types/FiUp.type";

