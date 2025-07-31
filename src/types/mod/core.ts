/**
 * @fileoverview Core type definitions for XyPrissJS Express integration
 *
 * This module contains fundamental types and utilities used throughout
 * the Express integration system.
 *
 * @version 4.5.11
 * @author XyPrissJS Team
 * @since 2025-01-06
 */

import { Request, Response, NextFunction } from "express";

/**
 * Deep partial utility type that makes all properties optional recursively.
 *
 * This utility type is used throughout the configuration system to allow
 * partial configuration objects while maintaining type safety.
 *
 * @template T - The type to make deeply partial
 *
 * @example
 * ```typescript
 * interface Config {
 *   server: {
 *     port: number;
 *     host: string;
 *   };
 * }
 *
 * type PartialConfig = DeepPartial<Config>;
 * // Result: { server?: { port?: number; host?: string; } }
 * ```
 */
export type DeepPartial<T> = {
    [K in keyof T]?: T[K] extends infer U
        ? U extends object
            ? U extends readonly any[]
                ? U extends readonly (infer V)[]
                    ? readonly DeepPartial<V>[]
                    : U
                : U extends Function
                ? U
                : DeepPartial<U>
            : U
        : never;
};

/**
 * Validation result interface for request validation operations.
 *
 * Used by validation middleware and request handlers to provide
 * structured validation feedback.
 *
 * @interface ValidationResult
 *
 * @example
 * ```typescript
 * const result: ValidationResult = {
 *   valid: false,
 *   errors: ['Email is required', 'Password too short'],
 *   data: { email: '', password: '123' }
 * };
 * ```
 */
export interface ValidationResult {
    /** Whether the validation passed */
    valid: boolean;

    /** Array of validation error messages */
    errors: string[];

    /** The validated/sanitized data */
    data: any;
}

/**
 * User context information for authenticated requests.
 *
 * Contains user identity, permissions, and metadata for
 * authorization and audit purposes.
 *
 * @interface UserContext
 *
 * @example
 * ```typescript
 * const user: UserContext = {
 *   id: 'user-123',
 *   roles: ['admin', 'user'],
 *   permissions: ['read:users', 'write:posts'],
 *   metadata: { department: 'engineering', level: 'senior' }
 * };
 * ```
 */
export interface UserContext {
    /** Unique user identifier */
    id: string;

    /** Array of user roles */
    roles: string[];

    /** Array of specific permissions */
    permissions: string[];

    /** Additional user metadata */
    metadata: Record<string, any>;
}

/**
 * Session data structure for user sessions.
 *
 * Contains session information including expiration and
 * custom session data.
 *
 * @interface SessionData
 *
 * @example
 * ```typescript
 * const session: SessionData = {
 *   id: 'session-abc123',
 *   userId: 'user-123',
 *   data: { theme: 'dark', language: 'en' },
 *   expires: new Date(Date.now() + 3600000) // 1 hour
 * };
 * ```
 */
export interface SessionData {
    /** Unique session identifier */
    id: string;

    /** Associated user ID (optional) */
    userId?: string;

    /** Custom session data */
    data: Record<string, any>;

    /** Session expiration date */
    expires: Date;
}

/**
 * Pagination information for paginated responses.
 *
 * Used by API endpoints that return paginated data to provide
 * navigation information to clients.
 *
 * @interface PaginationInfo
 *
 * @example
 * ```typescript
 * const pagination: PaginationInfo = {
 *   page: 2,
 *   limit: 20,
 *   total: 150,
 *   pages: 8
 * };
 * ```
 */
export interface PaginationInfo {
    /** Current page number (1-based) */
    page: number;

    /** Number of items per page */
    limit: number;

    /** Total number of items */
    total: number;

    /** Total number of pages */
    pages: number;
}

/**
 * Alert configuration for monitoring and notifications.
 *
 * Defines conditions and actions for system alerts based on
 * performance metrics and thresholds.
 *
 * @interface AlertConfig
 *
 * @example
 * ```typescript
 * const alert: AlertConfig = {
 *   metric: 'memory_usage',
 *   threshold: 0.85,
 *   action: 'webhook',
 *   target: 'https://alerts.example.com/webhook',
 *   cooldown: 300000 // 5 minutes
 * };
 * ```
 */
export interface AlertConfig {
    /** The metric to monitor */
    metric: string;

    /** Threshold value that triggers the alert */
    threshold: number;

    /** Action to take when alert is triggered */
    action: "log" | "email" | "webhook" | "custom";

    /** Target for the action (email, webhook URL, etc.) */
    target?: string;

    /** Cooldown period in milliseconds before alert can trigger again */
    cooldown?: number;
}

/**
 * Enhanced Express request interface with additional utilities.
 *
 * Extends the standard Express Request with caching, security,
 * performance, and validation utilities.
 *
 * @interface EnhancedRequest
 * @extends Request
 *
 * @example
 * ```typescript
 * app.get('/api/users', async (req: EnhancedRequest, res: EnhancedResponse) => {
 *   // Use enhanced features
 *   const cached = await req.cache.get('users');
 *   const encrypted = await req.security.encrypt(sensitiveData);
 *   req.performance.start();
 *
 *   // Validation
 *   const validation = req.validate.query(userQuerySchema);
 *   if (!validation.valid) {
 *     return res.error('Invalid query parameters');
 *   }
 * });
 * ```
 */
export interface EnhancedRequest extends Request {
    /** Cache utilities for request-level caching */
    cache: {
        /** Get cached value by key */
        get: (key: string) => Promise<any>;

        /** Set cached value with optional TTL */
        set: (key: string, value: any, ttl?: number) => Promise<void>;

        /** Delete cached value */
        del: (key: string) => Promise<void>;

        /** Tag cache entries for bulk invalidation */
        tags: (tags: string[]) => Promise<void>;
    };

    /** Security utilities for encryption and authentication */
    security: {
        /** Encrypt data using configured algorithm */
        encrypt: (data: any) => Promise<string>;

        /** Decrypt data using configured algorithm */
        decrypt: (data: string) => Promise<any>;

        /** Hash data using secure algorithm */
        hash: (data: string) => string;

        /** Verify data against hash */
        verify: (data: string, hash: string) => boolean;

        /** Generate secure token */
        generateToken: () => string;

        /** Session encryption key */
        sessionKey: string;
    };

    /** Performance monitoring utilities */
    performance: {
        /** Start performance timer */
        start: () => void;

        /** End performance timer and return duration */
        end: () => number;

        /** Mark a performance point */
        mark: (name: string) => void;

        /** Measure time between marks */
        measure: (name: string, start: string, end: string) => number;
    };

    /** Request validation utilities */
    validate: {
        /** Validate request body against schema */
        body: (schema: any) => ValidationResult;

        /** Validate query parameters against schema */
        query: (schema: any) => ValidationResult;

        /** Validate route parameters against schema */
        params: (schema: any) => ValidationResult;
    };

    /** User context (available after authentication) */
    user?: UserContext;

    /** Session data (available when sessions are enabled) */
    session?: SessionData;
}

/**
 * Enhanced Express response interface with additional utilities.
 *
 * Extends the standard Express Response with caching, security,
 * performance, and convenience methods.
 *
 * @interface EnhancedResponse
 * @extends Response
 *
 * @example
 * ```typescript
 * app.get('/api/users', async (req: EnhancedRequest, res: EnhancedResponse) => {
 *   const users = await getUsersFromDB();
 *
 *   // Use enhanced response methods
 *   res.cache.set(3600, ['users']); // Cache for 1 hour with 'users' tag
 *   res.performance.timing('db_query', 150);
 *   res.success(users, 'Users retrieved successfully');
 * });
 * ```
 */
export interface EnhancedResponse extends Response {
    /** Cache utilities for response caching */
    cache: {
        /** Set cache headers and TTL for response */
        set: (ttl?: number, tags?: string[]) => void;

        /** Invalidate cache entries by tags */
        invalidate: (tags: string[]) => Promise<void>;
    };

    /** Security utilities for response encryption */
    security: {
        /** Encrypt response data */
        encrypt: (data: any) => EnhancedResponse;

        /** Sign response data */
        sign: (data: any) => EnhancedResponse;
    };

    /** Performance utilities for response metrics */
    performance: {
        /** Record timing metric */
        timing: (name: string, value: number) => void;

        /** Record custom metric */
        metric: (name: string, value: number) => void;
    };

    /** Send successful response with optional message */
    success: (data?: any, message?: string) => void;

    /** Send error response with message and status code */
    error: (error: string | Error, code?: number) => void;

    /** Send paginated response with pagination info */
    paginated: (data: any[], pagination: PaginationInfo) => void;
}

/**
 * Route handler function type with enhanced request/response.
 *
 * @template T - Return type of the handler
 *
 * @example
 * ```typescript
 * const getUserHandler: RouteHandler = async (req, res, next) => {
 *   try {
 *     const user = await getUserById(req.params.id);
 *     res.success(user);
 *   } catch (error) {
 *     next(error);
 *   }
 * };
 * ```
 */
export type RouteHandler = (
    req: EnhancedRequest,
    res: EnhancedResponse,
    next: NextFunction
) => Promise<any> | any;

/**
 * Middleware function type with enhanced request/response.
 *
 * @example
 * ```typescript
 * const authMiddleware: MiddlewareFunction = async (req, res, next) => {
 *   const token = req.headers.authorization;
 *   if (!token) {
 *     return res.error('Authorization required', 401);
 *   }
 *
 *   try {
 *     req.user = await verifyToken(token);
 *     next();
 *   } catch (error) {
 *     res.error('Invalid token', 401);
 *   }
 * };
 * ```
 */
export type MiddlewareFunction = (
    req: EnhancedRequest,
    res: EnhancedResponse,
    next: NextFunction
) => Promise<void> | void;

