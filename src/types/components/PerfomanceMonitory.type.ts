import { ServerOptions, UltraFastApp } from "../types";
import { CacheManager } from "../../server/components/fastapi/CacheManager";

export interface PerformanceManagerOptions {
    performance?: ServerOptions["performance"];
    server?: ServerOptions["server"];
    env?: ServerOptions["env"];
}

export interface PerformanceManagerDependencies {
    app: UltraFastApp;
    cacheManager: CacheManager;
}
