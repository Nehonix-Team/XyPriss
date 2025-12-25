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
    onRegister?(
        server: XyPrissServer,
        config?: ServerOptions | undefined
    ): void | Promise<void>;
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

    onError?(
        error: Error,
        req: Request,
        res: Response,
        next?: NextFunction
    ): void | Promise<void>;

    /**
     * Hook triggered when a security attack or problem is detected
     */
    onSecurityAttack?(
        attackData: any,
        req: Request,
        res: Response
    ): void | Promise<void>;

    /**
     * Hook triggered to report the response time of a request
     */
    onResponseTime?(
        responseTime: number,
        req: Request,
        res: Response
    ): void | Promise<void>;

    /**
     * Hook triggered when a route generates a 500 error
     */
    onRouteError?(
        error: Error,
        req: Request,
        res: Response
    ): void | Promise<void>;

    /**
     * Hook triggered when a rate limit is reached
     */
    onRateLimit?(
        limitData: any,
        req: Request,
        res: Response
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

