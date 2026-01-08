import { UltraFastApp } from "../types";
import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { ClusterManager } from "../../cluster";

export interface PluginManagerDependencies {
    app: UltraFastApp;
    cacheManager: CacheManager;
    cluster?: ClusterManager;
    options: ServerOptions; // Using any to avoid circular dependency, should be ServerOptions
}

