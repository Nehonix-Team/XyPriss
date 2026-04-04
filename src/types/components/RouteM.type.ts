import {  XyPrissApp } from "../types";
import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { XyPrissMiddleware } from "../../middleware/XyPrissMiddlewareAPI";

export interface RouteManagerDependencies {
    app: XyPrissApp; 
    cacheManager: CacheManager;
    middlewareManager: XyPrissMiddleware;
}

