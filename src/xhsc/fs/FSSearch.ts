import { SearchMatch, BatchRenameChange } from "../types";
import { FSHelpers } from "./FSHelpers";

/**
 * **Filesystem Search & Pattern Matching**
 */
export class FSSearch extends FSHelpers {
    /**
     * **Content Search (Grep)**
     *
     * Scans all files within a directory for a specific text pattern.
     * Extremely fast, leveraging the native engine's parallel search.
     *
     * @param {string} dir - Directory to search in.
     * @param {string} pattern - Text or regex pattern to look for.
     * @returns {SearchMatch[]} List of matches with line numbers and snippets.
     *
     * @example
     * const matches = __sys__.fs.searchInFiles("./src", "TODO");
     */
    public searchInFiles = (dir: string, pattern: string): SearchMatch[] => {
        return this.runner.runSync("search", "grep", [dir, pattern]);
    };

    /**
     * **Filenames Search (Find)**
     *
     * Searches for files by name pattern within a directory.
     *
     * @param {string} dir - Directory to search in.
     * @param {string} pattern - Glob or regex pattern for filenames.
     * @returns {string[]} List of matching file paths.
     *
     * @example
     * const tsFiles = __sys__.fs.findByPattern("./src", "*.ts");
     */
    public findByPattern = (dir: string, pattern: string): string[] => {
        return this.runner.runSync("search", "find", [dir], { pattern });
    };

    /**
     * **Filter by File Extension**
     *
     * Retrieves all files within a directory that match the specified extension.
     *
     * @param {string} dir - Directory to search in.
     * @param {string} ext - File extension (e.g., 'png', '.jpg').
     * @returns {string[]} List of matching file paths.
     *
     * @example
     * const images = __sys__.fs.findByExt("./assets", "png");
     */
    public findByExt = (dir: string, ext: string): string[] => {
        const cleanExt = ext.startsWith(".") ? ext : "." + ext;
        const pattern = ".*\\" + cleanExt + "$";
        return this.findByPattern(dir, pattern);
    };

    /**
     * **Pattern-Based Batch Renaming**
     *
     * Renames multiple files at once by replacing occurrences of a pattern
     * in their filenames.
     *
     * @param {string} path - Directory to operate on.
     * @param {string} pattern - Pattern to match in filenames.
     * @param {string} replacement - String to replace the pattern with.
     * @param {boolean} [dryRun=false] - If true, returns the planned changes without applying them.
     * @returns {number | BatchRenameChange[]} Number of files renamed, or change list if dryRun is true.
     *
     * @example
     * __sys__.fs.batchRename("./logs", "log-", "archive-");
     */
    public batchRename = (
        path: string,
        pattern: string,
        replacement: string,
        dryRun = false,
    ): number | BatchRenameChange[] => {
        return this.runner.runSync("search", "rename", [path], {
            pattern,
            replacement,
            dryRun,
        });
    };

    /**
     * **Recent Modification Discovery**
     *
     * Finds files that have been modified within a specific number of hours.
     *
     * @param {string} dir - Directory to search in.
     * @param {number} hours - Time window in hours.
     * @returns {string[]} List of recently modified file paths.
     *
     * @example
     * const changedInLastDay = __sys__.fs.findModifiedSince("./src", 24);
     */
    public findModifiedSince = (dir: string, hours: number): string[] => {
        return this.runner.runSync("search", "modified", [dir], { hours });
    };
}

