import { FSSearch } from "./FSSearch";

/**
 * **Filesystem Archive & Compression**
 */
export class FSArchive extends FSSearch {
    /**
     * **File Compression (Gzip)**
     *
     * Performs lossless compression on a file using the Gzip algorithm.
     *
     * @param {string} src - Source file path.
     * @param {string} dest - Destination path for the compressed file (e.g., 'data.gz').
     *
     * @example
     * __sys__.fs.compress("backup.sql", "backup.sql.gz");
     */
    public compress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "compress", [], { src, dest });
    };

    /**
     * **File Decompression**
     *
     * Extracts a compressed file back to its original state.
     *
     * @param {string} src - Path to the compressed file.
     * @param {string} dest - Destination path for the extracted file.
     *
     * @example
     * __sys__.fs.decompress("data.gz", "data.json");
     */
    public decompress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "decompress", [], { src, dest });
    };

    /**
     * **Tarball Creation**
     *
     * Bundles a directory or file into a single TAR archive.
     *
     * @param {string} dir - Directory to archive.
     * @param {string} output - Destination path for the .tar file.
     *
     * @example
     * __sys__.fs.tar("./src", "project_source.tar");
     */
    public tar = (dir: string, output: string): void => {
        this.runner.runSync("archive", "tar", [], { dir, output });
    };

    /**
     * **Tarball Extraction**
     *
     * Extracts the contents of a TAR archive into a specified directory.
     *
     * @param {string} archive - Path to the .tar file.
     * @param {string} dest - Destination directory for extraction.
     *
     * @example
     * __sys__.fs.untar("dist.tar", "./production");
     */
    public untar = (archive: string, dest: string): void => {
        this.runner.runSync("archive", "untar", [], { archive, dest });
    };
}

