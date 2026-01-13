import { Logger } from "../../../../shared/logger/Logger";
import { ServerOptions, UltraFastApp } from "../../../types/types";

// Component imports
import { CacheManager } from "../fastapi/CacheManager";
import { RequestProcessor } from "../fastapi/RequestProcessor";
import { RouteManager } from "../fastapi/RouteManager";
import { PerformanceManager } from "../fastapi/PerformanceManager";
import { MonitoringManager } from "../fastapi/MonitoringManager";
import { PluginManager } from "../fastapi/PluginManager";
import { ClusterManagerComponent } from "../fastapi/ClusterManagerComponent";
import { FileWatcherManager } from "../fastapi/FileWatcherManager";
import { RedirectManager } from "../fastapi/RedirectManager";
import { ConsoleInterceptor } from "../fastapi/console/ConsoleInterceptor";
import { WorkerPoolComponent } from "../fastapi/WorkerPoolComponent";
import { FileUploadManager } from "../fastapi/FileUploadManager";
import { XHSCBridge } from "../../core/XHSCBridge";

/**
 * Dependencies required by the ServerLifecycleManager
 */
export interface ServerLifecycleDependencies {
    app: UltraFastApp;
    options: ServerOptions;
    logger: Logger;

    // Component managers (will be initialized by this manager)
    cacheManager?: CacheManager;
    requestProcessor?: RequestProcessor;
    routeManager?: RouteManager;
    performanceManager?: PerformanceManager;
    monitoringManager?: MonitoringManager;
    pluginManager?: PluginManager;
    clusterManager?: ClusterManagerComponent;
    fileWatcherManager?: FileWatcherManager;
    redirectManager?: RedirectManager;
    consoleInterceptor?: ConsoleInterceptor;
    workerPoolComponent?: WorkerPoolComponent;
    fileUploadManager?: FileUploadManager;
    middlewareManager?: any; // Add middlewareManager property
    notFoundHandler?: any;
    xhscBridge?: XHSCBridge;
}

/**
 * Server lifecycle state interface
 */
export interface ServerLifecycleState {
    ready: boolean;
    currentPort: number;
    httpServer?: any;
    initPromise: Promise<void>;
    xhscBridge?: XHSCBridge;
}

