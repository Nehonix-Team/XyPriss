/**
 * XyPriss Middleware API
 * Clean, simple implementation for middleware management with built-in security middleware
 */

import {
    XyPrissMiddlewareAPI,
    MiddlewarePriority,
    SecurityMiddlewareConfig,
} from "../types/middleware-api.types";

// Built-in security middleware using actual libraries
import { BuiltInMiddleware } from "./built-in/BuiltInMiddleware";
import { Logger } from "../../shared/logger/Logger";

interface RegisteredMiddleware {
    id: string;
    name: string;
    middleware: Function;
    enabled: boolean;
    priority: MiddlewarePriority;
    type: "custom" | "builtin";
    routes?: string[];
}

export class XyPrissMiddleware implements XyPrissMiddlewareAPI {
    private app: any;
    private registeredMiddleware: RegisteredMiddleware[] = [];
    private middlewareCounter = 0;
    private logger: Logger;
    private securityConfig:
        | import("../types/mod/security").SecurityConfig
        | null = null;

    constructor(
        app: any,
        securityConfig?: import("../types/mod/security").SecurityConfig,
    ) {
        this.app = app;
        this.securityConfig = securityConfig || null;
        this.logger = new Logger({
            components: {
                middleware: true,
            },
        });

        // DO NOT apply default middleware here - wait for explicit initialization
        // This allows proper config merging before applying middleware
    }

    /**
     * Initialize default middleware with security configuration
     */
    public initializeWithConfig(
        securityConfig?: import("../types/mod/security").SecurityConfig,
    ): void {
        if (securityConfig) {
            this.securityConfig = securityConfig;
        }

        // Enable default security middleware by default
        this.enableDefaultMiddleware();
    }

    /**
     * Enable default built-in middleware based on security configuration
     */
    private enableDefaultMiddleware(): void {
        this.logger.debug(
            "middleware",
            "🔧 Enabling default security middleware...",
        );

        // Apply middleware based on security configuration
        const config = this.securityConfig;

        // Helmet (always enabled by default unless explicitly disabled)
        if (config?.helmet !== false) {
            this.helmet({ hidePoweredBy: true });
        }

        // CORS (conditionally enabled based on config)
        if (config?.cors !== false) {
            const corsConfig =
                config?.cors === true || !config?.cors
                    ? { origin: true }
                    : config.cors;
            this.cors(corsConfig);
        }

        // Compression (conditionally enabled)
        if (config?.compression !== false) {
            this.compression({ threshold: 1024 });
        }

        // HTTP Parameter Pollution protection (conditionally enabled)
        if (config?.hpp !== false) {
            this.hpp({ whitelist: ["tags", "categories"] });
        }

        // MongoDB sanitization (conditionally enabled)
        if (config?.mongoSanitize !== false) {
            this.mongoSanitize({ replaceWith: "_" });
        }

        // XSS protection (conditionally enabled)
        if (config?.xss !== false) {
            this.xss({ whiteList: { a: ["href", "title"] } });
        }

        // Morgan logging (conditionally enabled)
        if (config?.morgan !== false) {
            this.morgan({
                skip: (_req: any, res: any) => res.statusCode < 400,
            });
        }

        // Rate limiting (conditionally enabled)
        if (config?.rateLimit !== false) {
            const rateLimitConfig =
                typeof config?.rateLimit === "object"
                    ? config.rateLimit
                    : {
                          windowMs: 15 * 60 * 1000,
                          max: 100,
                          message: "Too many requests, please try again later.",
                          standardHeaders: true,
                      };
            this.rateLimit(rateLimitConfig);
        }

        // Slow down middleware (conditionally enabled)
        if (config?.slowDown !== false) {
            this.slowDown({
                windowMs: 15 * 60 * 1000,
                delayAfter: 100,
                delayMs: (used, req) => {
                    const delayAfter = req.slowDown.limit;
                    return (used - delayAfter) * 500;
                },
            });
        }
        if (config?.bruteForce !== false) {
            this.brute();
        }

        this.logger.debug(
            "middleware",
            "✅ Default security middleware enabled based on configuration",
        );
    }

    register(
        middleware: any, // Accept any type for compatibility
        options: {
            name?: string;
            priority?: MiddlewarePriority;
            routes?: string[];
        } = {},
    ): XyPrissMiddlewareAPI {
        const id = `middleware_${++this.middlewareCounter}`;
        const name =
            options.name || `custom_middleware_${this.middlewareCounter}`;

        const registered: RegisteredMiddleware = {
            id,
            name,
            middleware,
            enabled: true,
            priority: options.priority || "normal",
            type: "custom",
            routes: options.routes,
        };

        this.registeredMiddleware.push(registered);
        this.applyMiddleware(registered);

        this.logger.debug(
            "middleware",
            `✅ Registered middleware: ${name} (priority: ${registered.priority})`,
        );
        return this;
    }

    security(config: SecurityMiddlewareConfig = {}): XyPrissMiddlewareAPI {
        this.logger.debug(
            "middleware",
            "🔒 Configuring security middleware bundle...",
        );

        // Apply security middleware
        if (config.helmet !== false) {
            this.helmet(config.helmet);
        }
        if (config.cors !== false) {
            this.cors(config.cors);
        }
        if (config.rateLimit !== false) {
            this.rateLimit(config.rateLimit);
        }
        if (config.csrf !== false) {
            this.csrf(config.csrf);
        }
        if (config.compression !== false) {
            this.compression(config.compression);
        }
        return this;
    }

    cors(config: SecurityMiddlewareConfig["cors"] = {}): XyPrissMiddlewareAPI {
        const corsConfig = typeof config === "object" ? config : {};
        const corsMiddleware = BuiltInMiddleware.cors(corsConfig);

        return this.registerBuiltIn("cors", corsMiddleware, "high");
    }

    rateLimit(
        config: SecurityMiddlewareConfig["rateLimit"] = {},
    ): XyPrissMiddlewareAPI {
        const rateLimitConfig = typeof config === "object" ? config : {};
        const rateLimitMiddleware =
            BuiltInMiddleware.rateLimit(rateLimitConfig);

        return this.registerBuiltIn("rateLimit", rateLimitMiddleware, "high");
    }

    helmet(
        config: SecurityMiddlewareConfig["helmet"] = {},
    ): XyPrissMiddlewareAPI {
        const helmetConfig = typeof config === "object" ? config : {};
        const helmetMiddleware = BuiltInMiddleware.helmet(helmetConfig);

        return this.registerBuiltIn("helmet", helmetMiddleware, "critical");
    }

    csrf(config: SecurityMiddlewareConfig["csrf"] = {}): XyPrissMiddlewareAPI {
        const csrfConfig = typeof config === "object" ? config : {};
        const csrfMiddleware = BuiltInMiddleware.csrf(csrfConfig as any);

        return this.registerBuiltIn("csrf", csrfMiddleware, "high");
    }

    compression(
        config: SecurityMiddlewareConfig["compression"] = {},
    ): XyPrissMiddlewareAPI {
        const compressionConfig = typeof config === "object" ? config : {};
        const compressionMiddleware =
            BuiltInMiddleware.compression(compressionConfig);

        return this.registerBuiltIn(
            "compression",
            compressionMiddleware,
            "low",
        );
    }

    /**
     * Add HPP (HTTP Parameter Pollution) protection
     */
    hpp(
        config: Parameters<typeof BuiltInMiddleware.hpp>[0] = {},
    ): XyPrissMiddlewareAPI {
        const hppConfig = typeof config === "object" ? config : {};
        const hppMiddleware = BuiltInMiddleware.hpp(hppConfig);

        return this.registerBuiltIn("hpp", hppMiddleware, "high");
    }

    /**
     * Add MongoDB injection protection
     */
    mongoSanitize(
        config: Parameters<typeof BuiltInMiddleware.mongoSanitize>[0] = {},
    ): XyPrissMiddlewareAPI {
        const mongoConfig = typeof config === "object" ? config : {};
        const mongoMiddleware = BuiltInMiddleware.mongoSanitize(mongoConfig);

        return this.registerBuiltIn("mongoSanitize", mongoMiddleware, "high");
    }

    /**
     * Add XSS protection
     */
    xss(
        config: Parameters<typeof BuiltInMiddleware.xss>[0] = {},
    ): XyPrissMiddlewareAPI {
        const xssConfig = typeof config === "object" ? config : {};
        const xssMiddleware = BuiltInMiddleware.xss(xssConfig);

        return this.registerBuiltIn("xss", xssMiddleware, "high");
    }

    /**
     * Add Morgan logging middleware
     */
    morgan(
        config: Parameters<typeof BuiltInMiddleware.morgan>[0] = {},
    ): XyPrissMiddlewareAPI {
        const morganConfig = typeof config === "object" ? config : {};
        const morganMiddleware = BuiltInMiddleware.morgan(morganConfig);

        return this.registerBuiltIn("morgan", morganMiddleware, "low");
    }

    /**
     * Add Slow Down middleware for progressive delays
     */
    slowDown(
        config: Parameters<typeof BuiltInMiddleware.slowDown>[0] = {},
    ): XyPrissMiddlewareAPI {
        const slowDownConfig = typeof config === "object" ? config : {};
        const slowDownMiddleware = BuiltInMiddleware.slowDown(slowDownConfig);

        return this.registerBuiltIn("slowDown", slowDownMiddleware, "high");
    }

    /**
     * Add Express Brute middleware for brute force protection
     */
    brute(
        config?: Parameters<typeof BuiltInMiddleware.brute>[0],
    ): XyPrissMiddlewareAPI {
        const bruteConfig = typeof config === "object" ? config : {};
        const bruteMiddleware = BuiltInMiddleware.brute(bruteConfig as any);

        return this.registerBuiltIn("brute", bruteMiddleware, "critical");
    }

    /**
     * Add Multer middleware for file uploads
     */
    multer(
        config: Parameters<typeof BuiltInMiddleware.multer>[0] = {},
    ): XyPrissMiddlewareAPI {
        const multerConfig = typeof config === "object" ? config : {};
        const multerInstance = BuiltInMiddleware.multer(multerConfig);

        // Use multer.any() as the default middleware
        return this.registerBuiltIn("multer", multerInstance.any(), "normal");
    }

    stats() {
        const total = this.registeredMiddleware.length;
        const enabled = this.registeredMiddleware.filter(
            (m) => m.enabled,
        ).length;
        const disabled = total - enabled;
        const byType = {
            custom: this.registeredMiddleware.filter((m) => m.type === "custom")
                .length,
            builtin: this.registeredMiddleware.filter(
                (m) => m.type === "builtin",
            ).length,
        };

        return {
            total,
            enabled,
            disabled,
            byType,
            byPriority: {
                critical: this.registeredMiddleware.filter(
                    (m) => m.priority === "critical",
                ).length,
                high: this.registeredMiddleware.filter(
                    (m) => m.priority === "high",
                ).length,
                normal: this.registeredMiddleware.filter(
                    (m) => m.priority === "normal",
                ).length,
                low: this.registeredMiddleware.filter(
                    (m) => m.priority === "low",
                ).length,
            },
        };
    }

    list() {
        return this.registeredMiddleware.map((m) => ({
            id: m.id,
            name: m.name,
            enabled: m.enabled,
            priority: m.priority,
            type: m.type,
        }));
    }

    clear(): XyPrissMiddlewareAPI {
        this.registeredMiddleware = [];
        this.logger.debug("middleware", "🧹 All middleware cleared");
        return this;
    }

    optimize(): XyPrissMiddlewareAPI {
        const priorityOrder: Record<string, number> = {
            critical: 0,
            high: 10,
            normal: 100,
            low: 1000,
        };

        this.registeredMiddleware.sort((a, b) => {
            const priorityA =
                typeof a.priority === "number"
                    ? a.priority
                    : (priorityOrder[a.priority] ?? 100);
            const priorityB =
                typeof b.priority === "number"
                    ? b.priority
                    : (priorityOrder[b.priority] ?? 100);
            return priorityA - priorityB;
        });

        this.logger.debug(
            "middleware",
            "⚡ Middleware order optimized by priority",
        );
        return this;
    }

    // Compatibility methods for MiddlewareAPIInterface
    unregister(id: string): XyPrissMiddlewareAPI {
        const index = this.registeredMiddleware.findIndex((m) => m.id === id);
        if (index !== -1) {
            this.registeredMiddleware.splice(index, 1);
            this.logger.debug(
                "middleware",
                `🗑️ Unregistered middleware: ${id}`,
            );
        }
        return this;
    }

    enable(id: string): XyPrissMiddlewareAPI {
        const middleware = this.registeredMiddleware.find((m) => m.id === id);
        if (middleware) {
            middleware.enabled = true;
            this.applyMiddleware(middleware);
            this.logger.debug("middleware", `✅ Enabled middleware: ${id}`);
        }
        return this;
    }

    disable(id: string): XyPrissMiddlewareAPI {
        const middleware = this.registeredMiddleware.find((m) => m.id === id);
        if (middleware) {
            middleware.enabled = false;
            this.logger.debug("middleware", `❌ Disabled middleware: ${id}`);
        }
        return this;
    }

    getInfo(id?: string): any {
        if (id) {
            const middleware = this.registeredMiddleware.find(
                (m) => m.id === id,
            );
            return middleware
                ? {
                      id: middleware.id,
                      name: middleware.name,
                      enabled: middleware.enabled,
                      priority: middleware.priority,
                      type: middleware.type,
                      routes: middleware.routes,
                  }
                : null;
        }
        return this.list();
    }

    getStats(): any {
        return this.stats();
    }

    getConfig(): any {
        return {
            totalMiddleware: this.registeredMiddleware.length,
            enabledMiddleware: this.registeredMiddleware.filter(
                (m) => m.enabled,
            ).length,
        };
    }

    // Helper methods
    private registerBuiltIn(
        name: string,
        middleware: Function,
        priority: MiddlewarePriority,
    ): XyPrissMiddlewareAPI {
        const id = `builtin_${name}_${++this.middlewareCounter}`;

        const registered: RegisteredMiddleware = {
            id,
            name,
            middleware,
            enabled: true,
            priority,
            type: "builtin",
        };

        this.registeredMiddleware.push(registered);
        this.applyMiddleware(registered);

        this.logger.debug(
            "middleware",
            `🔧 Applied built-in middleware: ${name} (priority: ${priority})`,
        );
        return this;
    }

    private applyMiddleware(registered: RegisteredMiddleware): void {
        if (this.app && this.app.use && registered.enabled) {
            this.app.use(registered.middleware);
        }
    }
}

