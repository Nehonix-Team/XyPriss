/**
 * ServerLifecycle - Type definitions for server lifecycle management
 */

import { XyprissApp } from "../../core/XyprissApp";
import { RedirectManager } from "../fastapi/RedirectManager";
import { CacheManager } from "../fastapi/CacheManager";
import { PerformanceManager } from "../fastapi/PerformanceManager";
import { PluginManager } from "../../../plugins/PluginManager";
import { FileWatcherManager } from "../fastapi/FileWatcherManager";
import { WorkerPoolComponent } from "../fastapi/WorkerPoolComponent";
import { FileUploadManager } from "../fastapi/FileUploadManager";
import { RequestProcessor } from "../fastapi/RequestProcessor";
import { RouteManager } from "../fastapi/RouteManager";
import { MonitoringManager } from "../fastapi/MonitoringManager";
import { ConsoleInterceptor } from "../fastapi/console/ConsoleInterceptor";
import { Logger } from "../../../../shared/logger";

export interface ServerLifecycleState {
    ready: boolean;
    currentPort: number;
    initPromise: Promise<void>;
    xhscBridge?: any;
    httpServer?: any;
}

export interface ServerLifecycleDependencies {
    app: XyprissApp;
    options: any;
    logger: Logger;
    redirectManager: RedirectManager;
    cacheManager?: CacheManager;
    performanceManager?: PerformanceManager;
    pluginManager?: PluginManager;
    fileWatcherManager?: FileWatcherManager;
    workerPoolComponent?: WorkerPoolComponent;
    fileUploadManager?: FileUploadManager;
    middlewareManager?: any;
    requestProcessor?: RequestProcessor;
    routeManager?: RouteManager;
    monitoringManager?: MonitoringManager;
    consoleInterceptor?: ConsoleInterceptor;
    notFoundHandler?: any;
}

