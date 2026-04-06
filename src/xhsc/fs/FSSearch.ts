import { SearchMatch, BatchRenameChange } from "../types";
import { FSHelpers } from "./FSHelpers";

/**
 * **Filesystem Search & Pattern Matching**
 */
export class FSSearch extends FSHelpers {
    /**
     * **Search In Files**
     *
     * @example
     * ```typescript
     * const matches = __sys__.fs.searchInFiles("./src", "TODO");
     * ```
     */
    public searchInFiles = (dir: string, pattern: string): SearchMatch[] => {
        return this.runner.runSync("search", "grep", [dir, pattern]);
    };

    /**
     * **Find by Pattern**
     *
     * @example
     * ```typescript
     * const files = __sys__.fs.findByPattern("./src", "*.ts");
     * ```
     */
    public findByPattern = (dir: string, pattern: string): string[] => {
        return this.runner.runSync("search", "find", [dir], { pattern });
    };

    /**
     * **Find by Extension**
     *
     * @example
     * ```typescript
     * const images = __sys__.fs.findByExt("./assets", "png");
     * ```
     */
    public findByExt = (dir: string, ext: string): string[] => {
        const cleanExt = ext.startsWith(".") ? ext : "." + ext;
        const pattern = ".*\\" + cleanExt + "$";
        return this.findByPattern(dir, pattern);
    };

    /**
     * **Batch Rename**
     *
     * @example
     * ```typescript
     * __sys__.fs.batchRename("./src", "old", "new");
     * ```
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
     * **Find Modified Files**
     *
     * @example
     * ```typescript
     * const files = __sys__.fs.findModifiedSince("./src", 24);
     * ```
     */
    public findModifiedSince = (dir: string, hours: number): string[] => {
        return this.runner.runSync("search", "modified", [dir], { hours });
    };
}

