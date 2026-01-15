import { UltraFastApp, ServerOptions } from "../types";
import { CacheManager } from "../../server/components/fastapi/CacheManager";

export interface PluginManagerDependencies {
    app: UltraFastApp;
    cacheManager: CacheManager;
    options: ServerOptions; // Using any to avoid circular dependency, should be ServerOptions
}

