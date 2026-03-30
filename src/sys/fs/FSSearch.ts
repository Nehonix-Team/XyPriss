import { SearchMatch, BatchRenameChange } from "../types";
import { FSHelpers } from "./FSHelpers";

/**
 * **Filesystem Search & Pattern Matching**
 */
export class FSSearch extends FSHelpers {
    /**
     * **Search In Files**
     */
    public searchInFiles = (dir: string, pattern: string): SearchMatch[] => {
        return this.runner.runSync("search", "grep", [dir, pattern]);
    };

    /**
     * **Find by Pattern**
     */
    public findByPattern = (dir: string, pattern: string): string[] => {
        return this.runner.runSync("search", "find", [dir], { pattern });
    };

    /**
     * **Find by Extension**
     */
    public findByExt = (dir: string, ext: string): string[] => {
        const cleanExt = ext.startsWith(".") ? ext : "." + ext;
        const pattern = ".*\\" + cleanExt + "$";
        return this.findByPattern(dir, pattern);
    };

    /**
     * **Batch Rename**
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
     */
    public findModifiedSince = (dir: string, hours: number): string[] => {
        return this.runner.runSync("search", "modified", [dir], { hours });
    };
}

