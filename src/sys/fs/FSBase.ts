import { Logger } from "../../shared/logger";
import { PathApi } from "../PathApi";
import { XyPrissRunner } from "../XyPrissRunner";

/**
 * **Base Filesystem API**
 *
 * Provides the foundation for all filesystem operations, including
 * logger initialization and runner access.
 */
export class FSBase extends PathApi {
    protected logger: Logger;

    constructor(runner: XyPrissRunner) {
        super(runner);
        this.logger = new Logger();
    }
}

