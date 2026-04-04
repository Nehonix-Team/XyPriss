import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { XyPluginManager } from "../../plugins/core/XPluginManager";

export interface RequestProcessorDependencies {
    pluginManager: XyPluginManager;
    cacheManager: CacheManager;
}

