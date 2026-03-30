import { FSArchive } from "./FSArchive";

/**
 * **Filesystem Watching & Streaming**
 */
export class FSWatch extends FSArchive {
    /**
     * **Watch Path for Changes**
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
     * **Stream File Content**
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
     * **Watch and Process**
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
     * **Watch File Content**
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

