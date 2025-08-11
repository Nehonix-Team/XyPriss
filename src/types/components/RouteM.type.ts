import {  UltraFastApp } from "../types";
import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { UltraFastExpressOptimizer } from "../../server/optimization/UltraFastOptimizer";
import { XyPrissMiddleware } from "../../middleware/XyPrissMiddlewareAPI";

export interface RouteManagerDependencies {
    app: UltraFastApp; 
    cacheManager: CacheManager;
    middlewareManager: XyPrissMiddleware;
    ultraFastOptimizer?: UltraFastExpressOptimizer;
}

