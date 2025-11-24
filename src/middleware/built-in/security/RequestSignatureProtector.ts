/**
 * XyRS - XyPriss Request Signature Protector
 * Validates request signatures for API authentication
 * Uses a predefined header name with developer-configured secret value
 * Enhanced with robust validation and security measures
 */

import { Logger } from "../../../../shared/logger/Logger";
import * as crypto from "crypto";
import { FailedAttempt, RequestSignatureConfig } from "./types";

export class RequestSignatureProtector {
    private config: RequestSignatureConfig;
    private readonly HEADER_NAME = "XP-Request-Sig";
    private logger: Logger;
    private failedAttempts: Map<string, FailedAttempt> = new Map();
    private readonly SECRET_HASH: string;
    private readonly CLEANUP_INTERVAL = 60000; // 1 minute
    private cleanupTimer?: NodeJS.Timeout;

    constructor(options: RequestSignatureConfig, logger?: Logger) {
        // Strict validation of required secret
        this.validateSecret(options.secret, options.minSecretLength);

        this.config = {
            errorMessage: "Invalid or missing request signature",
            statusCode: 401,
            debug: false,
            caseSensitive: true,
            trimValue: true,
            maxHeaderLength: 512,
            maxFailedAttempts: 5,
            blockDuration: 15 * 60 * 1000, // 15 minutes
            minSecretLength: 32,
            timingSafeComparison: true,
            rejectSuspiciousPatterns: true,
            ...options,
        };

        // Store hashed version of secret for additional security
        this.SECRET_HASH = this.hashSecret(this.config.secret);

        // Initialize logger
        this.logger =
            logger ||
            new Logger({
                enabled: true,
                level: "debug",
                components: { security: true },
                types: { debug: true },
            });

        // Start cleanup timer for failed attempts tracking
        this.startCleanupTimer();

        this.logSecurityEvent(
            "info",
            "XyRS initialized with strict validation"
        );
    }

    /**
     * Get the request signature middleware function
     */
    public getMiddleware() {
        return (req: any, res: any, next: any) => {
            this.handleRequest(req, res, next);
        };
    }

    /**
     * Handle incoming request and validate signature
     */
    private handleRequest(req: any, res: any, next: any): void {
        const clientId = this.extractClientIdentifier(req);

        // Check if client is currently blocked
        if (this.isClientBlocked(clientId)) {
            return this.blockRequest(
                res,
                "RATE_LIMITED",
                "Too many failed authentication attempts. Temporarily blocked.",
                clientId
            );
        }

        if (this.config.debug) {
            this.logger.debug("security", "XyRS validating request signature");
        }

        // Strict header extraction
        const signature = this.extractSignatureHeader(req);

        if (signature === null) {
            this.recordFailedAttempt(clientId);
            return this.blockRequest(
                res,
                "MISSING_SIGNATURE",
                `Required header '${this.HEADER_NAME}' is missing or malformed`,
                clientId
            );
        }

        // Length validation to prevent DoS
        if (!this.validateHeaderLength(signature)) {
            this.recordFailedAttempt(clientId);
            return this.blockRequest(
                res,
                "INVALID_HEADER_LENGTH",
                `Header value exceeds maximum allowed length`,
                clientId
            );
        }

        // Suspicious pattern detection
        if (
            this.config.rejectSuspiciousPatterns &&
            this.containsSuspiciousPatterns(signature)
        ) {
            this.recordFailedAttempt(clientId);
            return this.blockRequest(
                res,
                "SUSPICIOUS_PATTERN",
                `Header contains suspicious or malicious patterns`,
                clientId
            );
        }

        // Process signature value
        const processedSignature = this.processSignatureValue(signature);
        const expectedSignature = this.processSignatureValue(
            this.config.secret
        );

        // Validate signature with timing-safe comparison
        const isValid = this.compareSignatures(
            processedSignature,
            expectedSignature
        );

        if (!isValid) {
            this.recordFailedAttempt(clientId);
            this.logSecurityEvent("warning", "Invalid signature attempt", {
                clientId,
                signatureLength: signature.length,
            });
            return this.blockRequest(
                res,
                "INVALID_SIGNATURE",
                `Header '${this.HEADER_NAME}' value does not match expected signature`,
                clientId
            );
        }

        // Signature is valid - clear any failed attempts
        this.clearFailedAttempts(clientId);

        if (this.config.debug) {
            this.logger.debug("security", "XyRS signature validation passed");
        }

        next();
    }

    /**
     * Extract client identifier for rate limiting (IP-based)
     */
    private extractClientIdentifier(req: any): string {
        // Try multiple methods to get real IP
        const ip =
            req.ip ||
            req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
            req.headers["x-real-ip"] ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            "unknown";

        return this.sanitizeClientId(ip);
    }

    /**
     * Sanitize client identifier
     */
    private sanitizeClientId(clientId: string): string {
        // Remove IPv6 prefix if present
        let sanitized = clientId.replace(/^::ffff:/, "");
        // Keep only alphanumeric, dots, colons, and hyphens
        sanitized = sanitized.replace(/[^a-zA-Z0-9.:_-]/g, "");
        return sanitized || "unknown";
    }

    /**
     * Strictly extract signature header with no fallbacks
     */
    private extractSignatureHeader(req: any): string | null {
        if (!req.headers || typeof req.headers !== "object") {
            return null;
        }

        // Only check lowercase version (standard HTTP header convention)
        const headerKey = this.HEADER_NAME.toLowerCase();
        const signature = req.headers[headerKey];

        // Strict type checking
        if (typeof signature !== "string") {
            return null;
        }

        // Reject empty or whitespace-only headers
        if (signature.length === 0 || /^\s*$/.test(signature)) {
            return null;
        }

        return signature;
    }

    /**
     * Validate header length to prevent DoS attacks
     */
    private validateHeaderLength(signature: string): boolean {
        return (
            signature.length > 0 &&
            signature.length <= (this.config.maxHeaderLength || 512)
        );
    }

    /**
     * Detect suspicious patterns in header value
     */
    private containsSuspiciousPatterns(signature: string): boolean {
        // Check for common attack patterns
        const suspiciousPatterns = [
            /[<>\"'`]/g, // HTML/Script injection characters
            /\.\./g, // Path traversal
            /[\x00-\x08\x0B\x0C\x0E-\x1F]/g, // Control characters
            /\${.*}/g, // Template injection
            /\|\||&&/g, // Command injection
            /(\r\n|\n|\r)/g, // CRLF injection
        ];

        return suspiciousPatterns.some((pattern) => pattern.test(signature));
    }

    /**
     * Process signature value based on configuration
     */
    private processSignatureValue(value: string): string {
        return this.config.trimValue ? value.trim() : value;
    }

    /**
     * Compare signatures with optional timing-safe comparison
     */
    private compareSignatures(received: string, expected: string): boolean {
        // Always check lengths first (fast rejection)
        if (received.length !== expected.length) {
            return false;
        }

        if (this.config.timingSafeComparison) {
            return this.timingSafeEqual(received, expected);
        }

        // Standard comparison
        return this.config.caseSensitive
            ? received === expected
            : received.toLowerCase() === expected.toLowerCase();
    }

    /**
     * Timing-safe string comparison to prevent timing attacks
     */
    private timingSafeEqual(a: string, b: string): boolean {
        // Convert to buffers for timing-safe comparison
        const bufA = Buffer.from(
            this.config.caseSensitive ? a : a.toLowerCase()
        );
        const bufB = Buffer.from(
            this.config.caseSensitive ? b : b.toLowerCase()
        );

        if (bufA.length !== bufB.length) {
            return false;
        }

        try {
            return crypto.timingSafeEqual(bufA, bufB);
        } catch {
            return false;
        }
    }

    /**
     * Check if client is currently blocked due to failed attempts
     */
    private isClientBlocked(clientId: string): boolean {
        const attempt = this.failedAttempts.get(clientId);
        if (!attempt || !attempt.blockedUntil) {
            return false;
        }

        const now = Date.now();
        if (now >= attempt.blockedUntil) {
            // Block period expired
            this.failedAttempts.delete(clientId);
            return false;
        }

        return true;
    }

    /**
     * Record failed authentication attempt
     */
    private recordFailedAttempt(clientId: string): void {
        const now = Date.now();
        const attempt = this.failedAttempts.get(clientId) || {
            count: 0,
            blockedUntil: null,
            lastAttempt: now,
        };

        attempt.count += 1;
        attempt.lastAttempt = now;

        // Block if threshold exceeded
        if (attempt.count >= (this.config.maxFailedAttempts || 5)) {
            attempt.blockedUntil = now + (this.config.blockDuration || 900000);
            this.logSecurityEvent(
                "warning",
                "Client blocked due to failed attempts",
                {
                    clientId,
                    attempts: attempt.count,
                    blockedUntil: new Date(attempt.blockedUntil).toISOString(),
                }
            );
        }

        this.failedAttempts.set(clientId, attempt);
    }

    /**
     * Clear failed attempts for a client
     */
    private clearFailedAttempts(clientId: string): void {
        this.failedAttempts.delete(clientId);
    }

    /**
     * Validate secret meets security requirements
     */
    private validateSecret(secret: any, minLength?: number): void {
        const minLen = minLength || 32;

        if (!secret || typeof secret !== "string") {
            throw new Error(
                "RequestSignatureProtector: secret is required and must be a string"
            );
        }

        const trimmedSecret = secret.trim();

        if (trimmedSecret.length === 0) {
            throw new Error(
                "RequestSignatureProtector: secret cannot be empty or whitespace-only"
            );
        }

        if (trimmedSecret.length < minLen) {
            throw new Error(
                `RequestSignatureProtector: secret must be at least ${minLen} characters long (current: ${trimmedSecret.length})`
            );
        }

        // Check for weak secrets
        if (this.isWeakSecret(trimmedSecret)) {
            throw new Error(
                "RequestSignatureProtector: secret appears to be weak. Use a cryptographically strong random value."
            );
        }
    }

    /**
     * Detect weak/predictable secrets
     */
    private isWeakSecret(secret: string): boolean {
        const weakPatterns = [
            /^[0-9]+$/, // Only numbers
            /^[a-zA-Z]+$/, // Only letters
            /^(.)\1+$/, // Repeated character
            /^(123|abc|password|secret|key|test|demo|admin)/i, // Common words
            /^[a-f0-9]{32}$/i, // Looks like MD5 (weak)
        ];

        return weakPatterns.some((pattern) => pattern.test(secret));
    }

    /**
     * Hash secret for internal verification
     */
    private hashSecret(secret: string): string {
        return crypto.createHash("sha256").update(secret).digest("hex");
    }

    /**
     * Start cleanup timer for failed attempts
     */
    private startCleanupTimer(): void {
        this.cleanupTimer = setInterval(() => {
            this.cleanupExpiredAttempts();
        }, this.CLEANUP_INTERVAL);

        // Don't keep process alive for cleanup
        if (this.cleanupTimer.unref) {
            this.cleanupTimer.unref();
        }
    }

    /**
     * Clean up expired failed attempt records
     */
    private cleanupExpiredAttempts(): void {
        const now = Date.now();
        const expiredClients: string[] = [];

        for (const [clientId, attempt] of this.failedAttempts.entries()) {
            // Remove if block expired and no recent attempts
            if (
                attempt.blockedUntil &&
                now >= attempt.blockedUntil &&
                now - attempt.lastAttempt > this.CLEANUP_INTERVAL
            ) {
                expiredClients.push(clientId);
            }
        }

        expiredClients.forEach((clientId) =>
            this.failedAttempts.delete(clientId)
        );
    }

    /**
     * Block the request with appropriate error response
     */
    private blockRequest(
        res: any,
        code: string,
        details?: string,
        clientId?: string
    ): void {
        const isDevelopment = this.config.debug;

        const response: any = {
            error: isDevelopment
                ? this.config.errorMessage
                : "Authentication required",
            timestamp: new Date().toISOString(),
            code: "NEHONIX_XYRS_001",
        };

        // Add detailed info only in debug mode
        if (isDevelopment) {
            response.xyrs = {
                module: "RequestSignature",
                code,
                details,
                requiredHeader: this.HEADER_NAME,
                hint: "Include the X-XyRS header with your configured secret value",
            };
        }

        if (this.config.debug && clientId) {
            this.logger.debug("security", "XyRS blocking request", {
                code,
                details,
                clientId,
                requiredHeader: this.HEADER_NAME,
            });
        }

        res.status(this.config.statusCode).json(response);
    }

    /**
     * Log security events
     */
    private logSecurityEvent(
        level: "info" | "warning" | "error",
        message: string,
        metadata?: any
    ): void {
        if (this.config.debug) {
            const logMethod =
                level === "error"
                    ? "error"
                    : level === "warning"
                    ? "warn"
                    : "debug";
            (this.logger as any)[logMethod]("security", message, metadata);
        }
    }

    /**
     * Update configuration with strict validation
     */
    public updateConfig(newConfig: Partial<RequestSignatureConfig>): void {
        if (newConfig.secret !== undefined) {
            this.validateSecret(newConfig.secret, newConfig.minSecretLength);
        }

        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration (without exposing the secret)
     */
    public getConfig(): Omit<RequestSignatureConfig, "secret"> & {
        hasSecret: boolean;
    } {
        return {
            errorMessage: this.config.errorMessage,
            statusCode: this.config.statusCode,
            debug: this.config.debug,
            caseSensitive: this.config.caseSensitive,
            trimValue: this.config.trimValue,
            hasSecret: !!this.config.secret,
            maxHeaderLength: this.config.maxHeaderLength,
            maxFailedAttempts: this.config.maxFailedAttempts,
            blockDuration: this.config.blockDuration,
            minSecretLength: this.config.minSecretLength,
            timingSafeComparison: this.config.timingSafeComparison,
            rejectSuspiciousPatterns: this.config.rejectSuspiciousPatterns,
        };
    }

    /**
     * Get the header name used for signatures
     */
    public getHeaderName(): string {
        return this.HEADER_NAME;
    }

    /**
     * Validate if a signature would be accepted (for testing)
     */
    public validateSignature(signature: string): boolean {
        if (!signature || typeof signature !== "string") {
            return false;
        }

        if (!this.validateHeaderLength(signature)) {
            return false;
        }

        if (
            this.config.rejectSuspiciousPatterns &&
            this.containsSuspiciousPatterns(signature)
        ) {
            return false;
        }

        const processedSignature = this.processSignatureValue(signature);
        const expectedSignature = this.processSignatureValue(
            this.config.secret
        );

        return this.compareSignatures(processedSignature, expectedSignature);
    }

    /**
     * Get statistics about failed attempts (for monitoring)
     */
    public getSecurityStats(): {
        trackedClients: number;
        blockedClients: number;
    } {
        const now = Date.now();
        let blockedCount = 0;

        for (const attempt of this.failedAttempts.values()) {
            if (attempt.blockedUntil && now < attempt.blockedUntil) {
                blockedCount++;
            }
        }

        return {
            trackedClients: this.failedAttempts.size,
            blockedClients: blockedCount,
        };
    }

    /**
     * Cleanup resources
     */
    public destroy(): void {
        if (this.cleanupTimer) {
            clearInterval(this.cleanupTimer);
        }
        this.failedAttempts.clear();
    }
}

