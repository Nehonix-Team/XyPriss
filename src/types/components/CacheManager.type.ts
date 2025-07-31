import { ServerOptions } from "../types";

export interface CacheManagerOptions {
    cache?: ServerOptions["cache"];
    performance?: ServerOptions["performance"];
    server?: ServerOptions["server"];
    env?: ServerOptions["env"];
}
