/**
 * JWT Authentication Plugin
 *
 * High-performance JWT authentication plugin leveraging XyPrissJS security utilities
 * with <2ms execution time for token validation and user authentication.
 */

import { SecurityPlugin } from "../core/SecurityPlugin";
import {
    PluginPriority,
    PluginExecutionContext,
    PluginInitializationContext,
} from "../types/PluginTypes";

/**
 * JWT Authentication Plugin for ultra-fast token validation
 */
export class JWTAuthPlugin extends SecurityPlugin {
    public readonly id = "XyPriss.auth.jwt";
    public readonly name = "JWT Authentication Plugin";
    public readonly version = "1.0.0";
    public readonly priority = PluginPriority.HIGH; // Authentication is high priority

    // JWT configuration
    private jwtSecret?: string;
    private jwtAlgorithm = "HS256";
    private tokenExpiry = 3600; // 1 hour
    private issuer = "XyPrissjs";
    private audience = "XyPrissjs-app";

    // Performance optimization: Token cache for validated tokens
    private tokenCache: Map<
        string,
        {
            userId: string;
            roles: string[];
            permissions: string[];
            expiry: number;
        }
    > = new Map();

    // Rate limiting for authentication attempts
    private authAttempts: Map<
        string,
        {
            count: number;
            lastAttempt: number;
            blocked: boolean;
        }
    > = new Map();

    /**
     * Initialize JWT authentication plugin
     */
    protected async initializeSecurityPlugin(
        context: PluginInitializationContext
    ): Promise<void> {
        // Get JWT secret from environment or configuration
        this.jwtSecret =
            process.env.JWT_SECRET || context.config.customSettings.jwtSecret;

        if (!this.jwtSecret) {
            throw new Error(
                "JWT secret is required for JWT authentication plugin"
            );
        }
 
        // Configure JWT settings from context
        if (context.config.customSettings.jwtAlgorithm) {
            this.jwtAlgorithm = context.config.customSettings.jwtAlgorithm;
        }

        if (context.config.customSettings.tokenExpiry) {
            this.tokenExpiry = context.config.customSettings.tokenExpiry;
        }

        if (context.config.customSettings.issuer) {
            this.issuer = context.config.customSettings.issuer;
        }

        if (context.config.customSettings.audience) {
            this.audience = context.config.customSettings.audience;
        }

        // Setup token cache cleanup
        this.setupTokenCacheCleanup();

        // Setup rate limiting cleanup
        this.setupRateLimitingCleanup();

        context.logger.info(
            `JWT Authentication Plugin initialized with algorithm: ${this.jwtAlgorithm}`
        );
    }

    /**
     * Execute JWT authentication logic
     */
    protected async executeSecurityLogic(
        context: PluginExecutionContext
    ): Promise<any> {
        const { req } = context;

        // Check if authentication is required for this route
        if (!this.requiresAuthentication(req.path)) {
            return { authenticated: false, required: false };
        }

        // Check rate limiting
        const clientIp = req.ip || req.connection?.remoteAddress || "unknown";
        if (this.isRateLimited(clientIp)) {
            throw new Error(
                "Too many authentication attempts. Please try again later."
            );
        }

        // Extract JWT token
        const token = this.extractJWTToken(req);
        if (!token) {
            this.recordAuthAttempt(clientIp, false);
            throw new Error("Authentication token is required");
        }

        // Check token cache first for performance
        const cachedAuth = this.getCachedAuthentication(token);
        if (cachedAuth) {
            // Update security context with cached data
            context.security.isAuthenticated = true;
            context.security.userId = cachedAuth.userId;
            context.security.roles = cachedAuth.roles;
            context.security.permissions = cachedAuth.permissions;

            return {
                authenticated: true,
                userId: cachedAuth.userId,
                roles: cachedAuth.roles,
                permissions: cachedAuth.permissions,
                source: "cache",
            };
        }

        // Validate JWT token
        const authResult = await this.validateJWTToken(token);
        if (!authResult.valid) {
            this.recordAuthAttempt(clientIp, false);
            throw new Error(authResult.error || "Invalid authentication token");
        }

        // Cache the authentication result
        this.cacheAuthentication(token, authResult.payload);

        // Update security context
        context.security.isAuthenticated = true;
        context.security.userId = authResult.payload.userId;
        context.security.roles = authResult.payload.roles || [];
        context.security.permissions = authResult.payload.permissions || [];

        // Record successful authentication
        this.recordAuthAttempt(clientIp, true);

        return {
            authenticated: true,
            userId: authResult.payload.userId,
            roles: authResult.payload.roles || [],
            permissions: authResult.payload.permissions || [],
            source: "token",
        };
    }

    /**
     * Perform authentication logic
     */
    protected async performAuthentication(
        authData: any,
        context: PluginExecutionContext
    ): Promise<boolean> {
        try {
            const result = await this.executeSecurityLogic(context);
            return result.authenticated;
        } catch (error) {
            return false;
        }
    }

    /**
     * Perform authorization logic
     */
    protected async performAuthorization(
        context: PluginExecutionContext,
        resource: string
    ): Promise<boolean> {
        if (!context.security.isAuthenticated) {
            return false;
        }

        // Check if user has required permissions for the resource
        return await this.checkResourcePermissions(context, resource);
    }

    // ===== JWT-SPECIFIC METHODS =====

    /**
     * Extract JWT token from request
     */
    private extractJWTToken(req: any): string | null {
        // Check Authorization header
        const authHeader = req.headers.authorization;
        if (authHeader && authHeader.startsWith("Bearer ")) {
            return authHeader.substring(7);
        }

        // Check cookies
        if (req.cookies && req.cookies.token) {
            return req.cookies.token;
        }

        // Check query parameter (less secure, but sometimes needed)
        if (req.query && req.query.token) {
            return req.query.token;
        }

        return null;
    }

    /**
     * Validate JWT token using XyPrissJS Hash utilities
     */
    private async validateJWTToken(token: string): Promise<{
        valid: boolean;
        payload?: any;
        error?: string;
    }> {
        try {
            // Split token into parts
            const parts = token.split(".");
            if (parts.length !== 3) {
                return { valid: false, error: "Invalid token format" };
            }

            const [headerB64, payloadB64, signatureB64] = parts;

            // Decode header and payload
            const header = JSON.parse(this.base64UrlDecode(headerB64));
            const payload = JSON.parse(this.base64UrlDecode(payloadB64));

            // Verify algorithm
            if (header.alg !== this.jwtAlgorithm) {
                return { valid: false, error: "Invalid algorithm" };
            }

            // Verify signature using XyPrissJS Hash
            const signatureData = `${headerB64}.${payloadB64}`;
            const expectedSignature = this.hashUtil!.create(
                signatureData + this.jwtSecret,
                {
                    algorithm: "sha256",
                    outputFormat: "base64",
                }
            ) as string;

            const expectedSignatureB64 =
                this.base64UrlEncode(expectedSignature);
            if (signatureB64 !== expectedSignatureB64) {
                return { valid: false, error: "Invalid signature" };
            }

            // Verify expiration
            if (payload.exp && Date.now() / 1000 > payload.exp) {
                return { valid: false, error: "Token expired" };
            }

            // Verify issuer
            if (payload.iss && payload.iss !== this.issuer) {
                return { valid: false, error: "Invalid issuer" };
            }

            // Verify audience
            if (payload.aud && payload.aud !== this.audience) {
                return { valid: false, error: "Invalid audience" };
            }

            return { valid: true, payload };
        } catch (error: any) {
            return { valid: false, error: error.message };
        }
    }

    /**
     * Check if route requires authentication
     */
    private requiresAuthentication(path: string): boolean {
        // Public routes that don't require authentication
        const publicRoutes = [
            "/",
            "/health",
            "/login",
            "/register",
            "/public",
            "/XyPriss/health",
        ];

        // Check if path starts with any public route
        return !publicRoutes.some((route) => path.startsWith(route));
    }

    /**
     * Check resource permissions (override from SecurityPlugin)
     */
    protected async checkResourcePermissions(
        context: PluginExecutionContext,
        resource: string
    ): Promise<boolean> {
        // Simple permission checking - can be enhanced based on requirements
        const userPermissions = context.security.permissions;
        const requiredPermissions = this.getRequiredPermissions(resource);

        return requiredPermissions.every(
            (permission) =>
                userPermissions.includes(permission) ||
                userPermissions.includes("admin")
        );
    }

    /**
     * Get required permissions for resource
     */
    private getRequiredPermissions(resource: string): string[] {
        // Map resources to required permissions
        const permissionMap: Record<string, string[]> = {
            "/api/users": ["user.read"],
            "/api/users/create": ["user.write"],
            "/api/users/delete": ["user.delete"],
            "/api/admin": ["admin"],
            "/api/reports": ["report.read"],
        };

        return permissionMap[resource] || ["authenticated"];
    }

    // ===== CACHING METHODS =====

    /**
     * Get cached authentication result
     */
    private getCachedAuthentication(token: string): any {
        const cached = this.tokenCache.get(token);
        if (!cached) return null;

        // Check if cached token is expired
        if (Date.now() > cached.expiry) {
            this.tokenCache.delete(token);
            return null;
        }

        return cached;
    }

    /**
     * Cache authentication result
     */
    private cacheAuthentication(token: string, payload: any): void {
        const expiry = Date.now() + this.tokenExpiry * 1000;

        this.tokenCache.set(token, {
            userId: payload.userId || payload.sub,
            roles: payload.roles || [],
            permissions: payload.permissions || [],
            expiry,
        });
    }

    /**
     * Setup token cache cleanup
     */
    private setupTokenCacheCleanup(): void {
        // Clean up expired tokens every 5 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [token, cached] of this.tokenCache.entries()) {
                if (now > cached.expiry) {
                    this.tokenCache.delete(token);
                }
            }
        }, 300000); // 5 minutes
    }

    // ===== RATE LIMITING METHODS =====

    /**
     * Check if IP is rate limited
     */
    private isRateLimited(ip: string): boolean {
        const attempt = this.authAttempts.get(ip);
        if (!attempt) return false;

        // Reset after 15 minutes
        if (Date.now() - attempt.lastAttempt > 900000) {
            this.authAttempts.delete(ip);
            return false;
        }

        return attempt.blocked;
    }

    /**
     * Record authentication attempt
     */
    private recordAuthAttempt(ip: string, success: boolean): void {
        const now = Date.now();
        const attempt = this.authAttempts.get(ip) || {
            count: 0,
            lastAttempt: now,
            blocked: false,
        };

        if (success) {
            // Reset on successful authentication
            this.authAttempts.delete(ip);
        } else {
            attempt.count++;
            attempt.lastAttempt = now;

            // Block after 5 failed attempts
            if (attempt.count >= 5) {
                attempt.blocked = true;
            }

            this.authAttempts.set(ip, attempt);
        }
    }

    /**
     * Setup rate limiting cleanup
     */
    private setupRateLimitingCleanup(): void {
        // Clean up old rate limiting records every 10 minutes
        setInterval(() => {
            const now = Date.now();
            for (const [ip, attempt] of this.authAttempts.entries()) {
                if (now - attempt.lastAttempt > 900000) {
                    // 15 minutes
                    this.authAttempts.delete(ip);
                }
            }
        }, 600000); // 10 minutes
    }

    // ===== UTILITY METHODS =====

    /**
     * Base64 URL decode
     */
    private base64UrlDecode(str: string): string {
        // Add padding if needed
        str += "=".repeat((4 - (str.length % 4)) % 4);
        // Replace URL-safe characters
        str = str.replace(/-/g, "+").replace(/_/g, "/");
        return Buffer.from(str, "base64").toString("utf8");
    }

    /**
     * Base64 URL encode
     */
    private base64UrlEncode(str: string): string {
        return Buffer.from(str)
            .toString("base64")
            .replace(/\+/g, "-")
            .replace(/\//g, "_")
            .replace(/=/g, "");
    }

    // ===== SECURITY VALIDATION OVERRIDES =====

    /**
     * Validate request body for security threats
     */
    protected validateRequestBody(body: any): boolean {
        if (!body || typeof body !== "object") {
            return true; // No body to validate
        }

        try {
            // Check for suspicious patterns in body
            const bodyString = JSON.stringify(body);

            // Check for SQL injection patterns
            const sqlPatterns = [
                /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION)\b)/i,
                /(--|\/\*|\*\/|;)/,
                /(\b(OR|AND)\s+\d+\s*=\s*\d+)/i,
            ];

            for (const pattern of sqlPatterns) {
                if (pattern.test(bodyString)) {
                    console.warn(
                        `SQL injection pattern detected in request body: ${this.id}`
                    );
                    return false;
                }
            }

            // Check for XSS patterns
            const xssPatterns = [
                /<script[^>]*>.*?<\/script>/gi,
                /javascript:/gi,
                /on\w+\s*=/gi,
                /<iframe[^>]*>.*?<\/iframe>/gi,
            ];

            for (const pattern of xssPatterns) {
                if (pattern.test(bodyString)) {
                    console.warn(
                        `XSS pattern detected in request body: ${this.id}`
                    );
                    return false;
                }
            }

            return true;
        } catch (error) {
            console.error(`Error validating request body: ${error}`);
            return false;
        }
    }

    /**
     * Validate query parameters for security threats
     */
    protected validateQueryParameters(query: any): boolean {
        if (!query || typeof query !== "object") {
            return true; // No query params to validate
        }

        try {
            for (const [key, value] of Object.entries(query)) {
                if (typeof value === "string") {
                    // Check for path traversal
                    if (value.includes("../") || value.includes("..\\")) {
                        console.warn(
                            `Path traversal detected in query param ${key}: ${this.id}`
                        );
                        return false;
                    }

                    // Check for command injection
                    const cmdPatterns = [
                        /[;&|`$()]/,
                        /\b(cat|ls|pwd|whoami|id|uname|ps|netstat|ifconfig)\b/i,
                    ];

                    for (const pattern of cmdPatterns) {
                        if (pattern.test(value)) {
                            console.warn(
                                `Command injection pattern detected in query param ${key}: ${this.id}`
                            );
                            return false;
                        }
                    }
                }
            }

            return true;
        } catch (error) {
            console.error(`Error validating query parameters: ${error}`);
            return false;
        }
    }

    /**
     * Validate headers for security threats
     */
    protected validateHeaders(headers: any): boolean {
        if (!headers || typeof headers !== "object") {
            return true; // No headers to validate
        }

        try {
            // Check for suspicious user agents
            const userAgent = headers["user-agent"];
            if (userAgent) {
                const suspiciousPatterns = [
                    /sqlmap/i,
                    /nikto/i,
                    /nessus/i,
                    /burp/i,
                    /scanner/i,
                ];

                for (const pattern of suspiciousPatterns) {
                    if (pattern.test(userAgent)) {
                        console.warn(
                            `Suspicious user agent detected: ${this.id}`
                        );
                        return false;
                    }
                }
            }

            // Check for header injection
            for (const [key, value] of Object.entries(headers)) {
                if (typeof value === "string") {
                    if (value.includes("\r") || value.includes("\n")) {
                        console.warn(
                            `Header injection detected in ${key}: ${this.id}`
                        );
                        return false;
                    }
                }
            }

            return true;
        } catch (error) {
            console.error(`Error validating headers: ${error}`);
            return false;
        }
    }

    /**
     * Apply data sanitization rules
     */
    protected applySanitizationRules(data: any): any {
        if (!data || typeof data !== "object") {
            return data;
        }

        try {
            // Use fObject for secure data handling
            const secureData = this.secureObjectUtil!(data);

            // Get sanitized data
            const sanitized = secureData.getAll();

            // Additional sanitization for JWT-specific data
            if (sanitized.token) {
                // Remove any non-JWT token patterns
                sanitized.token = sanitized.token.replace(
                    /[^A-Za-z0-9._-]/g,
                    ""
                );
            }

            if (sanitized.userId) {
                // Sanitize user ID to alphanumeric only
                sanitized.userId = sanitized.userId
                    .toString()
                    .replace(/[^A-Za-z0-9-_]/g, "");
            }

            return sanitized;
        } catch (error) {
            console.error(`Error applying sanitization rules: ${error}`);
            return data; // Return original data if sanitization fails
        }
    }

    /**
     * Parse authorization header
     */
    protected parseAuthorizationHeader(header: string): any {
        try {
            if (header.startsWith("Bearer ")) {
                const token = header.substring(7);
                return {
                    type: "bearer",
                    token: token,
                    userId: null, // Will be extracted from token
                };
            }

            if (header.startsWith("Basic ")) {
                const credentials = Buffer.from(
                    header.substring(6),
                    "base64"
                ).toString("utf8");
                const [username, password] = credentials.split(":");
                return {
                    type: "basic",
                    username,
                    password,
                    userId: username,
                };
            }

            return null;
        } catch (error) {
            console.error(`Error parsing authorization header: ${error}`);
            return null;
        }
    }

    /**
     * Parse authentication cookies
     */
    protected parseAuthenticationCookies(cookies: any): any {
        try {
            if (cookies.token) {
                return {
                    type: "cookie",
                    token: cookies.token,
                    userId: null, // Will be extracted from token
                };
            }

            if (cookies.sessionId) {
                return {
                    type: "session",
                    sessionId: cookies.sessionId,
                    userId: null, // Will be extracted from session
                };
            }

            return null;
        } catch (error) {
            console.error(`Error parsing authentication cookies: ${error}`);
            return null;
        }
    }

    /**
     * Parse session data
     */
    protected parseSessionData(session: any): any {
        try {
            if (session.userId) {
                return {
                    type: "session",
                    userId: session.userId,
                    roles: session.roles || [],
                    permissions: session.permissions || [],
                };
            }

            return null;
        } catch (error) {
            console.error(`Error parsing session data: ${error}`);
            return null;
        }
    }
}

