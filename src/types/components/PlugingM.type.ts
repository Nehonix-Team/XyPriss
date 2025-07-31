import { UltraFastApp } from "../types";
import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { ClusterManager } from "../../cluster";

export interface PluginManagerDependencies {
    app: UltraFastApp;
    cacheManager: CacheManager;
    cluster?: ClusterManager;
}
