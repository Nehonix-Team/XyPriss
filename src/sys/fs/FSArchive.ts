import { FSSearch } from "./FSSearch";

/**
 * **Filesystem Archive & Compression**
 */
export class FSArchive extends FSSearch {
    /**
     * **Compress File**
     */
    public compress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "compress", [], { src, dest });
    };

    /**
     * **Decompress File**
     */
    public decompress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "decompress", [], { src, dest });
    };

    /**
     * **Create Tar Archive**
     */
    public tar = (dir: string, output: string): void => {
        this.runner.runSync("archive", "tar", [], { dir, output });
    };

    /**
     * **Extract Tar Archive**
     */
    public untar = (archive: string, dest: string): void => {
        this.runner.runSync("archive", "untar", [], { archive, dest });
    };
}

