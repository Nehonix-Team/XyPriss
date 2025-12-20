/**
 * Plugin System Types
 */

import type {
    Request,
    Response,
    NextFunction,
    UltraFastApp,
} from "../../types/types";

export interface XyPrissServer {
    app: UltraFastApp;
    [key: string]: any; // Allow plugins to extend server
}

export interface XyPrissPlugin {
    // Required metadata
    name: string;
    version: string;
    description?: string;

    // Optional dependencies
    dependencies?: string[];

    // Lifecycle hooks (all optional)
    onRegister?(server: XyPrissServer, config?: any): void | Promise<void>;
    onServerStart?(server: XyPrissServer): void | Promise<void>;
    onServerReady?(server: XyPrissServer): void | Promise<void>;
    onServerStop?(server: XyPrissServer): void | Promise<void>;

    // Request/Response hooks (optional)
    onRequest?(
        req: Request,
        res: Response,
        next: NextFunction
    ): void | Promise<void>;
    onResponse?(req: Request, res: Response): void | Promise<void>;

    // Advanced Hooks
    onSecurityViolation?(
        violation: any,
        req: Request,
        res: Response
    ): void | Promise<void>;
    onRouteError?(
        error: Error,
        route: any,
        req: Request,
        res: Response
    ): void | Promise<void>;
    onSlowRequest?(
        duration: number,
        req: Request,
        res: Response,
        route: any
    ): void | Promise<void>;

    onError?(
        error: Error,
        req: Request,
        res: Response,
        next?: NextFunction
    ): void | Promise<void>;

    // Route registration (optional)
    registerRoutes?(app: UltraFastApp): void;

    // Middleware (optional)
    middleware?: any | any[];
    middlewarePriority?: "first" | "normal" | "last";
}

export type PluginCreator = (config?: any) => XyPrissPlugin;

export interface PluginConfig {
    // Built-in plugins
    compression?: any;
    rateLimit?: any;
    proxy?: any;
    connection?: any;

    // Custom plugins registration
    register?: Array<XyPrissPlugin | PluginCreator>;
}

