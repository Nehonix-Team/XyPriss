import { ServerOptions, XyPrissApp } from "../types";

export interface FileWatcherManagerOptions {
    fileWatcher?: ServerOptions["fileWatcher"];
}

export interface FileWatcherManagerDependencies {
    app: XyPrissApp;
}

