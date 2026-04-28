import { FSArchive } from "./FSArchive";

/**
 * **Filesystem Watching & Streaming**
 */
export class FSWatch extends FSArchive {
    /**
     * **Real-time Path Monitoring**
     *
     * Monitors one or more paths for changes (file creation, modification,
     * or deletion). Runs in interactive mode by default.
     *
     * @param {string | string[]} p - Path(s) to watch.
     * @param {Object} [options] - Monitoring options.
     * @param {number} [options.duration=60] - How long to watch in seconds.
     *
     * @example
     * __sys__.fs.watch("./src", { duration: 120 });
     */
    public watch = (
        p: string | string[],
        options: { duration?: number } = {},
    ): void => {
        const duration = options.duration || 60;
        const paths = Array.isArray(p) ? p : [p];
        this.runner.runSync("fs", "watch", paths, {
            duration,
            interactive: true,
        });
    };

    /**
     * **Optimized File Streaming**
     *
     * Reads a file in chunks and returns a streaming representation.
     *
     * @param {string} p - Path to the file.
     * @param {Object} [options] - Stream options.
     * @param {number} [options.chunkSize] - Size of each chunk in bytes.
     * @param {boolean} [options.hex=false] - If true, returns chunks as hex strings.
     * @returns {string} Streamed content.
     *
     * @example
     * const data = __sys__.fs.stream("large-asset.dat", { chunkSize: 4096 });
     */
    public stream = (
        p: string,
        options: { chunkSize?: number; hex?: boolean } = {},
    ): string => {
        const flags: any = {};
        if (options.chunkSize) flags.chunkSize = options.chunkSize;
        if (options.hex) flags.hex = true;
        return this.runner.runSync("fs", "stream", [p], flags);
    };

    /**
     * **Reactive File Watching**
     *
     * Monitors a path for changes and executes a callback function whenever
     * a modification is detected.
     *
     * @param {string} p - Path to watch.
     * @param {Function} callback - Function to run on changes.
     * @param {Object} [options] - Monitoring options.
     * @param {number} [options.duration=60] - How long to watch in seconds.
     *
     * @example
     * __sys__.fs.watchAndProcess("./src", () => {
     *   console.log("Re-building project...");
     * });
     */
    public watchAndProcess = (
        p: string,
        callback: () => void,
        options: { duration?: number } = {},
    ): void => {
        const duration = options.duration || 60;
        const green = "\x1b[32m";
        const cyan = "\x1b[36m";
        const yellow = "\x1b[33m";
        const reset = "\x1b[0m";

        console.log(
            `${green}[SYSTEM]${reset} ${cyan}Starting high-performance watcher on:${reset} ${yellow}${p}${reset} ${cyan}(${duration}s)${reset}`,
        );

        this.watch(p, { duration });
        callback();
    };

    /**
     * **Content Diff Monitoring**
     *
     * Monitors file content changes and optionally displays or returns
     * the diff between versions.
     *
     * @param {string | string[]} p - Path(s) to monitor.
     * @param {Object} [options] - Options.
     * @param {number} [options.duration=60] - Monitoring duration.
     * @param {boolean} [options.diff=true] - If true, performs a deep content diff.
     *
     * @example
     * __sys__.fs.watchContent("config.json", { diff: true });
     */
    public watchContent = (
        p: string | string[],
        options: { duration?: number; diff?: boolean } = {
            diff: true,
        },
    ): void => {
        const duration = options.duration || 60;
        const paths = Array.isArray(p) ? p : [p];
        this.runner.runSync("fs", "watch-content", paths, {
            duration,
            diff: options.diff,
            interactive: true,
        });
    };

    /**
     * **Watch Parallel**
     */
    public watchParallel = this.watch;

    /**
     * **Watch Content Parallel**
     */
    public watchContentParallel = this.watchContent;

    /**
     * Alias for $watchAndProcess
     */
    public wap(...args: Parameters<typeof this.watchAndProcess>) {
        return this.watchAndProcess(...args);
    }

    /**
     * Alias for $watchContent
     */
    public wc(...args: Parameters<typeof this.watchContent>) {
        return this.watchContent(...args);
    }

    /**
     * Alias for $watchParallel
     */
    public wp(...args: Parameters<typeof this.watchParallel>) {
        return this.watchParallel(...args);
    }

    /**
     * Alias for $watchContentParallel
     */
    public wcp(...args: Parameters<typeof this.watchContentParallel>) {
        return this.watchContentParallel(...args);
    }
}

