/**
 * XyPriss Middleware API Types
 * Comprehensive types for the fluent middleware management API
 */

export type MiddlewarePriority = "critical" | "high" | "normal" | "low";

export interface MiddlewareConfiguration {
    enabled?: boolean;
    priority?: MiddlewarePriority;
    order?: number;
}

export interface SecurityMiddlewareConfig {
    helmet?:
        | boolean
        | {
              contentSecurityPolicy?: boolean | object;
              crossOriginEmbedderPolicy?: boolean;
              crossOriginOpenerPolicy?: boolean;
              crossOriginResourcePolicy?: boolean;
              dnsPrefetchControl?: boolean;
              frameguard?: boolean | object;
              hidePoweredBy?: boolean;
              hsts?: boolean | object;
              ieNoOpen?: boolean;
              noSniff?: boolean;
              originAgentCluster?: boolean;
              permittedCrossDomainPolicies?: boolean;
              referrerPolicy?: boolean | object;
              xssFilter?: boolean;
          };
    cors?:
        | boolean
        | {
              origin?: string | RegExp | (string | RegExp)[] | boolean;
              methods?: string | string[];
              allowedHeaders?: string | string[];
              exposedHeaders?: string | string[];
              credentials?: boolean;
              maxAge?: number;
              preflightContinue?: boolean;
              optionsSuccessStatus?: number;
          };
    rateLimit?:
        | boolean
        | {
              windowMs?: number;
              max?: number;
              message?: string | {
                  error?: string;
                  message?: string;
                  retryAfter?: number;
                  [key: string]: any;
              };
              standardHeaders?: boolean;
              legacyHeaders?: boolean;
              store?: any;
              keyGenerator?: (req: any) => string;
              handler?: (req: any, res: any, next: any) => void;
              onLimitReached?: (req: any, res: any, options: any) => void;
          };
    csrf?:
        | boolean
        | {
              secret?: string;
              cookie?: boolean | object;
              value?: (req: any) => string;
              ignoreMethods?: string[];
          };
    compression?:
        | boolean
        | {
              level?: number;
              threshold?: number;
              filter?: (req: any, res: any) => boolean;
              chunkSize?: number;
              windowBits?: number;
              memLevel?: number;
              strategy?: number;
          };
}

export interface BuiltInMiddleware {
    security: SecurityMiddlewareConfig;
    logging?:
        | boolean
        | {
              format?: string;
              skip?: (req: any, res: any) => boolean;
              stream?: any;
          };
    bodyParser?:
        | boolean
        | {
              json?: boolean | object;
              urlencoded?: boolean | object;
              raw?: boolean | object;
              text?: boolean | object;
          };
    static?:
        | boolean
        | {
              root: string;
              options?: object;
          };
    session?:
        | boolean
        | {
              secret: string;
              resave?: boolean;
              saveUninitialized?: boolean;
              cookie?: object;
              store?: any;
          };
}

/**
 * XyPriss Middleware API Interface
 * Simple, practical interface for middleware management
 * Extends the base MiddlewareAPIInterface for compatibility
 */
export interface XyPrissMiddlewareAPI {
    /**
     * Register a custom middleware function
     */
    register(
        middleware: Function,
        options?: {
            name?: string;
            priority?: MiddlewarePriority;
            routes?: string[];
        }
    ): XyPrissMiddlewareAPI;

    /**
     * Initialize default middleware with security configuration
     */
    initializeWithConfig(securityConfig?: import("../types/mod/security").SecurityConfig): void;

    /**
     * Configure security middleware bundle
     */
    security(config?: SecurityMiddlewareConfig): XyPrissMiddlewareAPI;

    /**
     * Configure CORS middleware
     */
    cors(config?: SecurityMiddlewareConfig["cors"]): XyPrissMiddlewareAPI;

    /**
     * Configure rate limiting middleware
     */
    rateLimit(
        config?: SecurityMiddlewareConfig["rateLimit"]
    ): XyPrissMiddlewareAPI;

    /**
     * Configure helmet security headers
     */
    helmet(config?: SecurityMiddlewareConfig["helmet"]): XyPrissMiddlewareAPI;

    /**
     * Configure CSRF protection
     */
    csrf(config?: SecurityMiddlewareConfig["csrf"]): XyPrissMiddlewareAPI;

    /**
     * Configure compression middleware
     */
    compression(
        config?: SecurityMiddlewareConfig["compression"]
    ): XyPrissMiddlewareAPI;

    /**
     * Get middleware statistics
     */
    stats(): {
        total: number;
        enabled: number;
        disabled: number;
        byType: { custom: number; builtin: number };
        byPriority: {
            critical: number;
            high: number;
            normal: number;
            low: number;
        };
    };

    /**
     * List all registered middleware
     */
    list(): Array<{
        id: string;
        name: string;
        enabled: boolean;
        priority: MiddlewarePriority;
        type: "custom" | "builtin";
    }>;

    /**
     * Clear all middleware
     */
    clear(): XyPrissMiddlewareAPI;

    /**
     * Optimize middleware order by priority
     */
    optimize(): XyPrissMiddlewareAPI;

    // Compatibility methods for MiddlewareAPIInterface
    unregister(id: string): XyPrissMiddlewareAPI;
    enable(id: string): XyPrissMiddlewareAPI;
    disable(id: string): XyPrissMiddlewareAPI;
    getInfo(id?: string): any;
    getStats(): any;
    getConfig(): any;
}

