import { ServerOptions, UltraFastApp } from "../types";

export interface FileWatcherManagerOptions {
    fileWatcher?: ServerOptions["fileWatcher"];
}

export interface FileWatcherManagerDependencies {
    app: UltraFastApp;
}

