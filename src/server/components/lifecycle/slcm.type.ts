/**
 * ServerLifecycle - Type definitions for server lifecycle management
 */

import { XyprissApp } from "../../core/XyprissApp";
import { RedirectManager } from "../fastapi/RedirectManager";
import { CacheManager } from "../fastapi/CacheManager";
import { XyPluginManager as PluginManager } from "../../../plugins/core/XPluginManager";
import { FileWatcherManager } from "../fastapi/FileWatcherManager";
import { WorkerPoolComponent } from "../fastapi/WorkerPoolComponent";
import { FileUploadManager } from "../fastapi/upload/FileUploadManager";
import { RequestProcessor } from "../fastapi/RequestProcessor";
import { RouteManager } from "../fastapi/RouteManager";
import { MonitoringManager } from "../fastapi/MonitoringManager";
import { ConsoleInterceptor } from "../fastapi/console/ConsoleInterceptor";
import { Logger } from "../../../shared/logger";

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

