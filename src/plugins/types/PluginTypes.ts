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

    // Route registration (optional)
    registerRoutes?(app: UltraFastApp): void;

    // Middleware (optional)
    middleware?: any | any[];
    middlewarePriority?: "first" | "normal" | "last";

    // ========== NEW HOOKS (XyPriss v5.x++)==========

    /**
     * Hook called when a security threat is detected
     * @param threat - Information about the detected threat
     * @param req - HTTP request
     * @param res - HTTP response
     */
    onSecurityThreat?(
        threat: SecurityThreat,
        req: Request,
        res: Response
    ): void | Promise<void>;

    /**
     * Hook called to measure request response time
     * @param timing - Request timing information
     * @param req - HTTP request
     * @param res - HTTP response
     */
    onRequestTiming?(
        timing: RequestTiming,
        req: Request,
        res: Response
    ): void | Promise<void>;

    /**
     * Hook called when a route generates a 500 error
     * @param errorInfo - Error information
     * @param req - HTTP request
     * @param res - HTTP response
     */
    onRouteError?(
        errorInfo: RouteErrorInfo,
        req: Request,
        res: Response
    ): void | Promise<void>;

    /**
     * Hook called periodically to collect performance metrics
     * @param metrics - Server performance metrics
     * @param server - Server instance
     */
    onPerformanceMetrics?(
        metrics: PerformanceMetrics,
        server: XyPrissServer
    ): void | Promise<void>;
}

// ========== TYPES FOR NEW HOOKS ==========

export interface SecurityThreat {
    type:
        | "sql_injection"
        | "xss"
        | "path_traversal"
        | "command_injection"
        | "xxe"
        | "ldap_injection"
        | "rate_limit"
        | "csrf"
        | "brute_force"
        | "other";
    severity: "low" | "medium" | "high" | "critical";
    description: string;
    ip: string;
    userAgent?: string;
    path: string;
    method: string;
    timestamp: Date;
    blocked: boolean;
    payload?: any;
}

export interface RequestTiming {
    path: string;
    method: string;
    startTime: number;
    endTime: number;
    duration: number; // in milliseconds
    statusCode: number;
    ip: string;
    userAgent?: string;
    timestamp: Date;
    // Detailed timing breakdown
    breakdown?: {
        middleware?: number;
        handler?: number;
        database?: number;
        external?: number;
    };
}

export interface RouteErrorInfo {
    path: string;
    method: string;
    statusCode: number;
    error: Error;
    stack?: string;
    ip: string;
    userAgent?: string;
    timestamp: Date;
    requestBody?: any;
    requestQuery?: any;
    requestParams?: any;
}

export interface PerformanceMetrics {
    timestamp: Date;
    uptime: number; // in seconds
    memory: {
        used: number;
        total: number;
        percentage: number;
        heapUsed: number;
        heapTotal: number;
    };
    cpu: {
        usage: number; // percentage
        loadAverage: number[];
    };
    requests: {
        total: number;
        perSecond: number;
        averageResponseTime: number;
        slowestRoutes: Array<{
            path: string;
            method: string;
            averageTime: number;
            count: number;
        }>;
    };
    errors: {
        total: number;
        rate: number; // errors per second
        topRoutes: Array<{
            path: string;
            method: string;
            count: number;
            lastError?: string;
        }>;
    };
    connections: {
        active: number;
        total: number;
    };
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


