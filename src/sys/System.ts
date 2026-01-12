import { XyPrissRunner } from "./XyPrissRunner";
import { SysApi } from "./SysApi";

/**
 * XyPriss System API (Aggregator Class)
 *
 * This class inherits ALL methods from PathApi, FSApi, and SysApi
 * through the inheritance chain. Every public method is prefixed with '$'.
 */
export class XyPrissFS extends SysApi {
    constructor(context: { __root__: string }) {
        super(new XyPrissRunner(context.__root__));
    }

    /** Access to filesystem specialized logic (Reference to this). */
    public get fs() {
        return this;
    }

    /** Access to system specialized logic (Reference to this). */
    public get sys() {
        return this;
    }

    /** Access to path specialized logic (Reference to this). */
    public get path() {
        return this;
    }
}

