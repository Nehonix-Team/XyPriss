import { MiddlewareManager, UltraFastApp } from "../types";
import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { UltraFastExpressOptimizer } from "../../server/optimization/UltraFastOptimizer";

export interface RouteManagerDependencies {
    app: UltraFastApp;
    cacheManager: CacheManager;
    middlewareManager: MiddlewareManager;
    ultraFastOptimizer?: UltraFastExpressOptimizer;
}
