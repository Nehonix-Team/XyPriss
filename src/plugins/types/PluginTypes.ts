/**
 * Plugin System Types
 */

import type {
    Request,
    Response,
    NextFunction,
    UltraFastApp,
} from "../../types/types";

import type { InterceptedConsoleCall } from "../../server/components/fastapi/console/types";

export interface XyPrissServer {
    app: UltraFastApp;
    [key: string]: any; // Allow plugins to extend server
}

export interface PluginStats {
    name: string;
    version: string;
    description?: string;
    enabled: boolean;
    permissions: {
        allowedHooks: string[] | "*";
        deniedHooks: string[];
        policy: "allow" | "deny";
    };
    dependencies: string[];
}

export interface PluginManagement {
    getStats: () => PluginStats[];
    setPermission: (
        pluginName: string,
        hookId: string,
        allowed: boolean,
        by?: string,
    ) => void;
    toggle: (pluginName: string, enabled: boolean) => void;
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
        config?: ServerOptions | undefined,
    ): void | Promise<void>;
    onServerStart?(server: XyPrissServer): void | Promise<void>;
    onServerReady?(server: XyPrissServer): void | Promise<void>;
    onServerStop?(server: XyPrissServer): void | Promise<void>;

    // Request/Response hooks (optional)
    onRequest?(
        req: Request,
        res: Response,
        next: NextFunction,
    ): void | Promise<void>;
    onResponse?(req: Request, res: Response): void | Promise<void>;

    onError?(
        error: Error,
        req: Request,
        res: Response,
        next?: NextFunction,
    ): void | Promise<void>;

    /**
     * Hook triggered when a security attack or problem is detected
     */
    onSecurityAttack?(
        attackData: any,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    /**
     * Hook triggered to report the response time of a request
     */
    onResponseTime?(
        responseTime: number,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    /**
     * Hook triggered when a route generates a 500 error
     */
    onRouteError?(
        error: Error,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    /**
     * Hook triggered when a rate limit is reached
     */
    onRateLimit?(
        limitData: any,
        req: Request,
        res: Response,
    ): void | Promise<void>;

    /**
     * Hook triggered when a console log is intercepted by the system.
     *
     * This hook allows plugins to monitor, analyze, or redirect all console output
     * (log, info, warn, error, debug, etc.) across the entire application.
     *
     * @param log - The intercepted console call data including method, arguments, and metadata.
     * @permission PLG.LOGGING.CONSOLE_INTERCEPT - Required to receive log data.
     * @performance This hook is executed synchronously; preserve performance by avoiding heavy tasks.
     * @security Sensitive data may be present in logs; handle with extreme care.
     * @default Disabled by default for security.
     */
    onConsoleIntercept?(log: InterceptedConsoleCall): void | Promise<void>;

    // Route registration (optional)
    registerRoutes?(app: UltraFastApp): void;

    // Middleware (optional)
    middleware?: any | any[];
    middlewarePriority?: "first" | "normal" | "last";

    /**
     * Hook for plugin management
     * Only called if the plugin has MANAGE_PLUGINS permission
     */
    managePlugins?(manager: PluginManagement): void | Promise<void>;
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

    /** Route optimization plugin configuration */
    routeOptimization?: {
        enabled?: boolean;
        analysisInterval?: number;
        optimizationThreshold?: number;
        popularityWindow?: number;
        maxTrackedRoutes?: number;
        autoOptimization?: boolean;
        customRules?: Array<{
            pattern: string;
            minHits: number;
            maxResponseTime: number;
            cacheStrategy: "aggressive" | "moderate" | "conservative";
            preloadEnabled?: boolean;
        }>;
        onOptimization?: (route: string, optimization: string) => void;
        onAnalysis?: (stats: any[]) => void;
    };

    /** Server maintenance plugin configuration */
    serverMaintenance?: {
        enabled?: boolean;
        checkInterval?: number;
        errorThreshold?: number;
        memoryThreshold?: number;
        responseTimeThreshold?: number;
        logRetentionDays?: number;
        maxLogFileSize?: number;
        autoCleanup?: boolean;
        autoRestart?: boolean;
        onIssueDetected?: (issue: any) => void;
        onMaintenanceComplete?: (actions: string[]) => void;
    };
}

