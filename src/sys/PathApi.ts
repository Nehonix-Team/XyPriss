import { XyPrissRunner } from "./XyPrissRunner";

/**
 * Professional Path Manipulation API bridging to the xsys Rust binary.
 * Provides platform-independent (or root-aware) path operations.
 */
export class PathApi {
    constructor(private runner: XyPrissRunner) {}

    /**
     * Resolves paths relative to the project root.
     */
    public resolve(...paths: string[]): string {
        return this.runner.runSync("path", "resolve", paths);
    }

    /**
     * Joins path segments.
     */
    public join(...paths: string[]): string {
        return this.runner.runSync("path", "join", paths);
    }

    /**
     * Returns the directory name of a path.
     */
    public dirname(p: string): string {
        return this.runner.runSync("path", "dirname", [p]);
    }

    /**
     * Returns the base name of a path.
     */
    public basename(p: string, suffix?: string): string {
        return this.runner.runSync("path", "basename", [p], { suffix });
    }

    /**
     * Returns the file extension.
     */
    public extname(p: string): string {
        return this.runner.runSync("path", "extname", [p]);
    }

    /**
     * Calculates the relative path between two points.
     */
    public relative(from: string, to: string): string {
        return this.runner.runSync("path", "relative", [from, to]);
    }

    /**
     * Normalizes a path string.
     */
    public normalize(p: string): string {
        return this.runner.runSync("path", "normalize", [p]);
    }
}

