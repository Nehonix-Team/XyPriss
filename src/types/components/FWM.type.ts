import { ClusterManagerComponent } from "../../server/components/fastapi/ClusterManagerComponent";
import { ServerOptions, UltraFastApp } from "../types";

export interface FileWatcherManagerOptions {
    fileWatcher?: ServerOptions["fileWatcher"];
}

export interface FileWatcherManagerDependencies {
    app: UltraFastApp;
    clusterManager?: ClusterManagerComponent;
}
