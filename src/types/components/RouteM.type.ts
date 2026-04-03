import {  XyPrissApp } from "../types";
import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { HighPerformanceExpressOptimizer } from "../../server/optimization/HighPerformanceOptimizer";
import { XyPrissMiddleware } from "../../middleware/XyPrissMiddlewareAPI";

export interface RouteManagerDependencies {
    app: XyPrissApp; 
    cacheManager: CacheManager;
    middlewareManager: XyPrissMiddleware;
    optimizedOptimizer?: HighPerformanceExpressOptimizer;
}

