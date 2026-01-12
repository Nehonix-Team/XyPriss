import { XyPrissRunner } from "./XyPrissRunner";
import { SysApi } from "./SysApi";

/**
 * **XyPriss System API (Aggregator)**
 *
 * This class serves as the **Logic Aggregator** for the entire XyPriss system interface.
 * It sits at the top of the inheritance chain:
 * `XyPrissFS` -> `SysApi` -> `FSApi` -> `PathApi` -> `BaseApi`
 *
 * **Architecture:**
 * Instead of delegating to properties (e.g., `.fs`, `.sys`), this class **inherits**
 * all methods directly. This creates a "Flat API" structure where all capabilities
 * are available on the single instance.
 *
 * **Usage:**
 * This class is typically not instantiated directly by the user but is the base
 * for the global `XyPrissSys` singleton (`__sys__`).
 *
 * @class XyPrissFS
 * @extends SysApi
 */
export class XyPrissFS extends SysApi {
    /**
     * **Initialize System API**
     *
     * Sets up the runner bridge with the specified project root.
     *
     * @param {Object} context - Initialization context.
     * @param {string} context.__root__ - Absolute path to the project root directory.
     */
    constructor(context: { __root__: string }) {
        super(new XyPrissRunner(context.__root__));
    }
}

