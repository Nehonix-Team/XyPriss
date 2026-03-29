import { FSSearch } from "./FSSearch";

/**
 * **Filesystem Archive & Compression**
 */
export class FSArchive extends FSSearch {
    /**
     * **Compress File ($compress)**
     */
    public $compress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "compress", [], { src, dest });
    };

    /**
     * **Decompress File ($decompress)**
     */
    public $decompress = (src: string, dest: string): void => {
        this.runner.runSync("archive", "decompress", [], { src, dest });
    };

    /**
     * **Create Tar Archive ($tar)**
     */
    public $tar = (dir: string, output: string): void => {
        this.runner.runSync("archive", "tar", [], { dir, output });
    };

    /**
     * **Extract Tar Archive ($untar)**
     */
    public $untar = (archive: string, dest: string): void => {
        this.runner.runSync("archive", "untar", [], { archive, dest });
    };
}

