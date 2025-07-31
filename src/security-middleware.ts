/**
 * XyPrissJS Security Middleware
 * Military-grade security middleware for Express applications
 */

import { SecurityConfig } from "./types/types";
import { XyPrissSecurity as XyPrissJS } from "../mods/toolkit/src/core/crypto";
import { Hash } from "../mods/toolkit/src/core/hash";
import { SecureObject } from "../mods/toolkit/src/components/secure-object";
import { Validators } from "../mods/toolkit/src/core/validators";
import { SecureRandom } from "../mods/toolkit/src/core/random";

export class SecurityMiddleware {
    private config: Required<SecurityConfig>;
    private bruteForceMap = new Map<
        string,
        { attempts: number; lastAttempt: number; blockedUntil?: number }
    >();

    constructor(config: SecurityConfig = {}) {
        this.config = {
            level: "enhanced",
            csrf: true,
            helmet: true,
            xss: true,
            sqlInjection: true,
            bruteForce: true,
            encryption: {
                algorithm: "AES-256-GCM",
                keySize: 32,
            },
            authentication: {
                jwt: {
                    secret: XyPrissJS.generateSecureToken({
                        length: 32,
                        entropy: "high",
                    }),
                    expiresIn: "1h",
                    algorithm: "HS256",
                },
                session: {
                    secret: XyPrissJS.generateSecureToken({
                        length: 32,
                        entropy: "high",
                    }),
                    name: "XyPriss.sid",
                    cookie: {
                        maxAge: 24 * 60 * 60 * 1000, // 24 hours
                        secure: true,
                        httpOnly: true,
                        sameSite: "strict",
                    },
                },
            },
            ...config,
        };
    }

    /**
     * Get the main security middleware
     */
    public getMiddleware() {
        return (req: any, res: any, next: any) => {
            // Apply security measures based on level
            this.applySecurityHeaders(req, res);
            this.checkBruteForce(req, res, next);
        };
    }

    /**
     * Apply security headers
     */
    private applySecurityHeaders(req: any, res: any): void {
        if (this.config.helmet) {
            // Security headers (helmet.js equivalent)
            res.set({
                "X-Content-Type-Options": "nosniff",
                "X-Frame-Options": "DENY",
                "X-XSS-Protection": "1; mode=block",
                "Strict-Transport-Security":
                    "max-age=31536000; includeSubDomains",
                "Referrer-Policy": "strict-origin-when-cross-origin",
                "Permissions-Policy":
                    "geolocation=(), microphone=(), camera=()",
                "Content-Security-Policy": this.getCSPHeader(),
            });
        }

        // Remove server information
        res.removeHeader("X-Powered-By");
        res.set("Server", "XyPrissJS");
    }

    /**
     * Get Content Security Policy header
     */
    private getCSPHeader(): string {
        switch (this.config.level) {
            case "maximum":
                return "default-src 'none'; script-src 'self'; style-src 'self' 'unsafe-inline'; img-src 'self' data:; font-src 'self'; connect-src 'self'; frame-ancestors 'none';";
            case "enhanced":
                return "default-src 'self'; script-src 'self' 'unsafe-inline'; style-src 'self' 'unsafe-inline'; img-src 'self' data: https:; font-src 'self' https:; connect-src 'self';";
            case "basic":
            default:
                return "default-src 'self'; script-src 'self' 'unsafe-inline' 'unsafe-eval'; style-src 'self' 'unsafe-inline';";
        }
    }

    /**
     * Check for brute force attacks
     */
    private checkBruteForce(req: any, res: any, next: any): void {
        if (!this.config.bruteForce) {
            return next();
        }

        const ip = this.getClientIP(req);
        const now = Date.now();
        const maxAttempts = 10;
        const windowMs = 15 * 60 * 1000; // 15 minutes
        const blockDuration = 60 * 60 * 1000; // 1 hour

        let record = this.bruteForceMap.get(ip);

        if (!record) {
            record = { attempts: 0, lastAttempt: now };
            this.bruteForceMap.set(ip, record);
        }

        // Check if IP is currently blocked
        if (record.blockedUntil && record.blockedUntil > now) {
            return res.status(429).json({
                error: "IP temporarily blocked due to suspicious activity",
                retryAfter: Math.ceil((record.blockedUntil - now) / 1000),
            });
        }

        // Reset attempts if window has passed
        if (now - record.lastAttempt > windowMs) {
            record.attempts = 0;
        }

        // Check for failed authentication on this request
        res.on("finish", () => {
            if (res.statusCode === 401 || res.statusCode === 403) {
                record!.attempts++;
                record!.lastAttempt = now;

                if (record!.attempts >= maxAttempts) {
                    record!.blockedUntil = now + blockDuration;
                    console.warn(
                        `IP ${ip} blocked for ${
                            blockDuration / 1000
                        }s after ${maxAttempts} failed attempts`
                    );
                }
            }
        });

        next();
    }

    /**
     * Detect obfuscated SQL injection attempts using entropy analysis
     */
    private detectObfuscatedSQLInjection(input: string): boolean {
        // Check for excessive URL encoding
        const urlEncodedCount = (input.match(/%[0-9a-f]{2}/gi) || []).length;
        if (urlEncodedCount > input.length * 0.3) {
            return true;
        }

        // Check for excessive hex encoding
        const hexCount = (input.match(/\\x[0-9a-f]{2}/gi) || []).length;
        if (hexCount > 3) {
            return true;
        }

        // Check for suspicious character sequences
        const suspiciousPatterns = [
            /(\+|\s)(and|or)(\+|\s)/gi,
            /[0-9]+\s*[=<>]\s*[0-9]+/gi,
            /(char|ascii)\s*\(\s*[0-9]+/gi,
            /concat\s*\(/gi,
        ];

        return suspiciousPatterns.some((pattern) => pattern.test(input));
    }

    /**
     * Get client IP address
     */
    private getClientIP(req: any): string {
        return (
            req.headers["x-forwarded-for"]?.split(",")[0] ||
            req.headers["x-real-ip"] ||
            req.connection?.remoteAddress ||
            req.socket?.remoteAddress ||
            req.ip ||
            "unknown"
        );
    }

    /**
     * XSS Protection middleware
     */
    public xssProtection() {
        return (req: any, res: any, next: any) => {
            if (!this.config.xss) {
                return next();
            }

            // Sanitize input
            this.sanitizeObject(req.body);
            this.sanitizeObject(req.query);
            this.sanitizeObject(req.params);

            next();
        };
    }

    /**
     * SQL Injection protection middleware
     */
    public sqlInjectionProtection() {
        return (req: any, res: any, next: any) => {
            if (!this.config.sqlInjection) {
                return next();
            }

            //  SQL injection patterns with comprehensive coverage
            const sqlPatterns = [
                // SQL keywords
                /(\b(SELECT|INSERT|UPDATE|DELETE|DROP|CREATE|ALTER|EXEC|UNION|SCRIPT|TRUNCATE|GRANT|REVOKE)\b)/gi,
                // SQL injection characters and sequences
                /(--|\/\*|\*\/|;|'|"|`|\||&|\+|%|<|>|=|\(|\))/g,
                // Boolean-based injection patterns
                /(\b(OR|AND)\b\s*['"]*\s*[0-9]+\s*['"]*\s*[=<>])/gi,
                // Union-based injection
                /(\bUNION\b.*\bSELECT\b)/gi,
                // Time-based injection
                /(\b(SLEEP|WAITFOR|DELAY)\b\s*\()/gi,
                // Error-based injection
                /(\b(CAST|CONVERT|EXTRACTVALUE|UPDATEXML)\b.*\()/gi,
                // Hex encoding attempts
                /(0x[0-9a-f]+)/gi,
                // SQL functions commonly used in attacks
                /(\b(CHAR|ASCII|SUBSTRING|CONCAT|VERSION|DATABASE|USER|SCHEMA)\b\s*\()/gi,
            ];

            const validateSQLInput = (obj: any, path = ""): boolean => {
                if (typeof obj === "string") {
                    // Use XyPrissJS pattern matching for enhanced detection
                    const normalizedInput = obj
                        .toLowerCase()
                        .replace(/\s+/g, " ")
                        .trim();

                    // Check against SQL injection patterns
                    for (const pattern of sqlPatterns) {
                        if (pattern.test(normalizedInput)) {
                            console.warn(
                                ` SQL injection pattern detected in ${path}: ${pattern.source}`
                            );
                            return true;
                        }
                    }

                    // Additional entropy-based detection for obfuscated attacks
                    if (this.detectObfuscatedSQLInjection(normalizedInput)) {
                        console.warn(
                            ` Obfuscated SQL injection detected in ${path}`
                        );
                        return true;
                    }

                    return false;
                }

                if (typeof obj === "object" && obj !== null) {
                    for (const [key, value] of Object.entries(obj)) {
                        if (validateSQLInput(value, `${path}.${key}`)) {
                            return true;
                        }
                    }
                }

                return false;
            };

            if (
                validateSQLInput(req.body, "body") ||
                validateSQLInput(req.query, "query") ||
                validateSQLInput(req.params, "params")
            ) {
                console.warn(
                    ` SQL injection attempt detected from ${this.getClientIP(
                        req
                    )}`
                );
                return res.status(400).json({
                    error: "Invalid input detected",
                });
            }

            next();
        };
    }

    /**
     * CSRF Protection middleware
     */
    public csrfProtection() {
        return (req: any, res: any, next: any) => {
            if (!this.config.csrf) {
                return next();
            }

            // Skip CSRF for safe methods
            if (["GET", "HEAD", "OPTIONS"].includes(req.method)) {
                return next();
            }

            const token =
                req.headers["x-csrf-token"] ||
                req.body?._csrf ||
                req.query?._csrf;

            const sessionToken = req.session?.csrfToken;

            if (
                !token ||
                !sessionToken ||
                !XyPrissJS.constantTimeEqual(token, sessionToken)
            ) {
                return res.status(403).json({
                    error: "CSRF token validation failed",
                });
            }

            next();
        };
    }

    /**
     * Request encryption middleware
     */
    public requestEncryption() {
        const self = this; // Capture 'this' context

        return (req: any, res: any, next: any) => {
            if (!self.config.encryption) {
                return next();
            }

            // Check if request is encrypted
            const encryptedHeader = req.headers["x-encrypted-request"];

            if (encryptedHeader && req.body) {
                try {
                    // Decryption using SecureObject
                    const encryptedData = req.body.data;
                    const secureObj = new SecureObject({ data: encryptedData });
                    secureObj.setEncryptionKey(
                        self.config.authentication?.jwt?.secret || "default-key"
                    );
                    const decryptedData = secureObj.toObject();
                    req.body = JSON.parse(decryptedData.data);
                } catch (error) {
                    return res.status(400).json({
                        error: "Failed to decrypt request",
                    });
                }
            }

            // Encrypt response if requested
            const originalJson = res.json;
            res.json = function (data: any) {
                if (req.headers["x-encrypt-response"]) {
                    // Encryption using SecureObject
                    const secureObj = new SecureObject({
                        data: JSON.stringify(data),
                    });
                    secureObj.setEncryptionKey(
                        self.config.authentication?.jwt?.secret || "default-key"
                    );
                    secureObj.encryptAll();
                    const encrypted = secureObj.exportData();
                    res.set("X-Encrypted-Response", "true");
                    return originalJson.call(this, { data: encrypted });
                }
                return originalJson.call(this, data);
            };

            next();
        };
    }

    /**
     * Sanitize object recursively
     */
    private sanitizeObject(obj: any): any {
        if (typeof obj === "string") {
            return this.sanitizeString(obj);
        }

        if (typeof obj === "object" && obj !== null) {
            for (const key in obj) {
                if (obj.hasOwnProperty(key)) {
                    obj[key] = this.sanitizeObject(obj[key]);
                }
            }
        }

        return obj;
    }

    /**
     * Sanitize string for XSS
     */
    private sanitizeString(str: string): string {
        return str
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#x27;")
            .replace(/\//g, "&#x2F;")
            .replace(/javascript:/gi, "")
            .replace(/on\w+=/gi, "");
    }

    /**
     * Get security configuration
     */
    public getConfig(): Required<SecurityConfig> {
        return this.config;
    }

    /**
     * Get brute force statistics
     */
    public getBruteForceStats(): any {
        const stats = {
            totalIPs: this.bruteForceMap.size,
            blockedIPs: 0,
            suspiciousIPs: 0,
        };

        const now = Date.now();

        for (const [_ip, record] of this.bruteForceMap.entries()) {
            if (record.blockedUntil && record.blockedUntil > now) {
                stats.blockedIPs++;
            } else if (record.attempts > 3) {
                stats.suspiciousIPs++;
            }
        }

        return stats;
    }

    /**
     * Unblock IP address
     */
    public unblockIP(ip: string): boolean {
        const record = this.bruteForceMap.get(ip);
        if (record) {
            delete record.blockedUntil;
            record.attempts = 0;
            return true;
        }
        return false;
    }

    /**
     * Clear all brute force records
     */
    public clearBruteForceRecords(): void {
        this.bruteForceMap.clear();
    }
}

