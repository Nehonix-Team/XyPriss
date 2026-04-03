import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { PluginEngine } from "../../plugins/modules";

export interface RequestProcessorDependencies {
    pluginEngine: PluginEngine;
    cacheManager: CacheManager;
}

