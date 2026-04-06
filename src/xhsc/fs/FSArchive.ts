import { FSSearch } from "./FSSearch";

/**
 * **Filesystem Archive & Compression**
 */
export class FSArchive extends FSSearch {
    /**
     * **Compress File**
     * Performs lossless compression on a file.
     *
     * @example
     * ```typescript
     * __sys__.fs.compress("data.json", "data.json.gz");
     * ```
     */
    public compress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "compress", [], { src, dest });
    };

    /**
     * **Decompress File**
     *
     * @example
     * ```typescript
     * __sys__.fs.decompress("data.json.gz", "data.json");
     * ```
     */
    public decompress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "decompress", [], { src, dest });
    };

    /**
     * **Create Tar Archive**
     *
     * @example
     * ```typescript
     * __sys__.fs.tar("./src", "src_backup.tar");
     * ```
     */
    public tar = (dir: string, output: string): void => {
        this.runner.runSync("archive", "tar", [], { dir, output });
    };

    /**
     * **Extract Tar Archive**
     *
     * @example
     * ```typescript
     * __sys__.fs.untar("archive.tar", "./output");
     * ```
     */
    public untar = (archive: string, dest: string): void => {
        this.runner.runSync("archive", "untar", [], { archive, dest });
    };
}

