/***************************************************************************
 * XyPriss - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 ****************************************************************************/

import { MIME_MAP } from "../server/const/MIME_MAP";
import { __cfg__ } from "../config";

/**
 * Resolves a single MIME type from a file extension.
 *
 * @param ext - The file extension (e.g., '.png' or 'jpg').
 * @returns The corresponding MIME type or 'application/octet-stream' if unknown.
 */
export const getMime = (ext: string): string => {
    if (!ext) return "application/octet-stream";
    const normalized = ext.startsWith(".")
        ? ext.toLowerCase()
        : `.${ext.toLowerCase()}`;
    return MIME_MAP[normalized] || "application/octet-stream";
};

/**
 * Advanced utility to resolve multiple MIME types from file extensions.
 *
 * This helper is designed to simplify server configurations, particularly for
 * 'fileUpload' and security policies, by allowing developers to specify
 * human-readable extensions instead of complex MIME strings.
 *
 * FEATURES:
 * - Supports single extensions or arrays.
 * - Automatically normalizes extensions (handles missing dots).
 * - Deduplicates results to ensure a clean MIME array.
 * - Can fall back to global 'fileUpload.allowedExtensions' if no argument is provided.
 *
 * @param extensions - A single extension (e.g., '.png') or an array (e.g., ['.jpg', '.pdf']).
 *                     If omitted, the function attempts to read from global configuration.
 * @returns A unique array of resolved MIME types.
 *
 * @example
 * // 1. Map an array of extensions for file upload configuration
 * const uploadConfig = {
 *   allowedMimeTypes: getMimes(['.png', '.jpg', '.jpeg', '.webp'])
 * };
 * // Result: ['image/png', 'image/jpeg', 'image/webp']
 *
 * @example
 * // 2. Map a single extension
 * const mimes = getMimes('.pdf');
 * // Result: ['application/pdf']
 *
 * @example
 * // 3. Automatic detection from xypriss.config.json
 * // If config has: { "fileUpload": { "allowedExtensions": [".zip", ".rar"] } }
 * const mimes = getMimes();
 * // Result: ['application/zip', 'application/vnd.rar']
 */
export const getMimes = (extensions?: string | string[]): string[] => {
    let targetExts: string[] = [];

    if (extensions) {
        targetExts = Array.isArray(extensions) ? extensions : [extensions];
    } else {
        // Fallback to global framework configuration if available
        try {
            const uMimeConfig = __cfg__.get("fileUpload")?.allowedExtensions;
            if (Array.isArray(uMimeConfig)) {
                targetExts = uMimeConfig;
            }
        } catch (e) {
            // Config might not be initialized yet in early-loading contexts
            return [];
        }
    }

    if (targetExts.length === 0) return [];

    const mimeSet = new Set<string>();
    for (const ext of targetExts) {
        if (!ext) continue;
        const mime = getMime(ext);
        if (mime) mimeSet.add(mime);
    }

    return Array.from(mimeSet);
};

