import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { ServerOptions, XyPrissApp } from "../types";

export interface MonitoringManagerOptions {
    monitoring?: ServerOptions["monitoring"];
}

export interface MonitoringManagerDependencies {
    app: XyPrissApp;
    cacheManager: CacheManager;
}

