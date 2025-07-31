import { CacheManager } from "../../server/components/fastapi/CacheManager";
import { ExecutionPredictor } from "../../server/optimization/ExecutionPredictor";
import { PerformanceProfiler } from "../../server/optimization/PerformanceProfiler";
import { RequestPreCompiler } from "../../server/optimization/RequestPreCompiler";
import { PluginEngine } from "../../server/plugins";

export interface RequestProcessorDependencies {
    performanceProfiler: PerformanceProfiler;
    executionPredictor: ExecutionPredictor;
    requestPreCompiler: RequestPreCompiler;
    pluginEngine: PluginEngine;
    cacheManager: CacheManager;
}
