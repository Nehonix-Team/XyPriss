import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { PerformanceManager } from "../../server/components/fastapi/PerformanceManager";
import { ServerOptions, UltraFastApp } from "../types";

export interface MonitoringManagerOptions {
    monitoring?: ServerOptions["monitoring"];
}

export interface MonitoringManagerDependencies {
    app: UltraFastApp;
    cacheManager: CacheManager;
    performanceManager: PerformanceManager;
}
