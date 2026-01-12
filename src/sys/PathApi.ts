import { XyPrissRunner } from "./XyPrissRunner";

/**
 * Base class for all domain-specific APIs.
 */
export class BaseApi {
    constructor(protected runner: XyPrissRunner) {}
}

/**
 * Professional Path Manipulation API bridging to the xsys Rust binary.
 * All public methods are prefixed with '$'.
 */
export class PathApi extends BaseApi {
    /** Resolves paths relative to the project root. */
    public $resolve = (...paths: string[]): string =>
        this.runner.runSync("path", "resolve", paths);

    /** Joins path segments using platform-specific separators. */
    public $join = (...paths: string[]): string =>
        this.runner.runSync("path", "join", paths);

    /** Returns the directory name of a path. */
    public $dirname = (p: string): string =>
        this.runner.runSync("path", "dirname", [p]);

    /** Returns the base name of a path. */
    public $basename = (p: string, suffix?: string): string =>
        this.runner.runSync("path", "basename", [p], { suffix });

    /** Returns the file extension. */
    public $extname = (p: string): string =>
        this.runner.runSync("path", "extname", [p]);

    /** Calculates the relative path between two points. */
    public $relative = (from: string, to: string): string =>
        this.runner.runSync("path", "relative", [from, to]);

    /** Normalizes a path string. */
    public $normalize = (p: string): string =>
        this.runner.runSync("path", "normalize", [p]);
}

