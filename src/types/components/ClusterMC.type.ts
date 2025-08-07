import { ServerOptions, UltraFastApp } from "../types";

export interface ClusterManagerComponentOptions {
    cluster?: ServerOptions["cluster"];
}

export interface ClusterManagerComponentDependencies {
    app: UltraFastApp;
    serverOptions?: ServerOptions;
}

