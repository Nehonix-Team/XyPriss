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
}

