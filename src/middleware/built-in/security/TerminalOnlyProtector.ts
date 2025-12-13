/**
 * Terminal-Only Protector - Enhanced Version
 * Aggressively blocks browser requests while allowing terminal/API tools
 * Perfect for API-only endpoints or development tools
 */

import { Logger } from "../../../../shared/logger/Logger";

export interface TerminalOnlyConfig {
    /** Block requests with Sec-Fetch headers (browsers) */
    blockSecFetch?: boolean;
    /** Allow specific automation tools (whitelist approach) */
    allowedTools?: string[];
    /** Block requests with complex browser headers */
    blockBrowserIndicators?: boolean;
    /** Require simple Accept header */
    requireSimpleAccept?: boolean;
    /** Custom error message */
    errorMessage?: string;
    /** HTTP status code for blocked requests */
    statusCode?: number;
    /** Custom validation function */
    customValidator?: (req: any) => boolean;
    /** Enable debug logging */
    debug?: boolean;
    /** Strictness level: 'normal' | 'high' | 'paranoid' */
    strictness?: "normal" | "high" | "paranoid";
    /** Enable fingerprint-based detection */
    enableFingerprinting?: boolean;
    /** Minimum confidence score (0-100) to allow request */
    minConfidenceScore?: number;
}

interface DetectionResult {
    isBrowser: boolean;
    confidence: number;
    reasons: string[];
    indicators: string[];
}

export class TerminalOnlyProtector {
    private config: TerminalOnlyConfig;
    private logger: Logger;

    // Known legitimate API tools and their patterns
    private readonly KNOWN_API_TOOLS = [
        "curl",
        "wget",
        "httpie",
        "postman",
        "insomnia",
        "axios",
        "fetch",
        "node-fetch",
        "got",
        "superagent",
        "python-requests",
        "python-urllib",
        "java/",
        "okhttp",
        "rest-client",
        "paw",
        "thunder client",
        "advanced rest client",
        "go-http-client",
        "ruby",
        "perl",
        "php",
        "dart",
        "kotlin",
        "swift",
        "apache-httpclient",
        "jetty",
        "k6/",
        "jmeter",
        "gatling",
        "artillery",
    ];

    // Browser engine signatures (highly specific to avoid false positives)
    private readonly BROWSER_ENGINES = [
        "gecko/",
        "applewebkit/",
        "webkit/",
        "blink/",
        "trident/",
        "edgehtml/",
    ];

    // Known browser names (specific versions to avoid false positives)
    private readonly BROWSER_NAMES = [
        "firefox/",
        "chrome/",
        "safari/",
        "edge/",
        "opera/",
        "chromium/",
        "brave/",
        "vivaldi/",
        "seamonkey/",
        "palemoon/",
    ];

    constructor(options: TerminalOnlyConfig = {}, logger?: Logger) {
        console.log("options: ", options)
        this.config = {
            blockSecFetch: true,
            allowedTools: [],
            blockBrowserIndicators: true,
            requireSimpleAccept: false,
            errorMessage:
                "Terminal/API access required. Browser access blocked.",
            statusCode: 403,
            debug: false,
            strictness: "normal",
            enableFingerprinting: true,
            minConfidenceScore: 70,
            ...options,
        };

        if (options.customValidator !== undefined) {
            this.config.customValidator = options.customValidator;
        }

        this.logger =
            logger ||
            new Logger({
                enabled: true,
                level: "debug",
                components: { security: true },
                types: { debug: true },
            });
    }

    /**
     * Get the terminal-only middleware function
     */
    public getMiddleware() {
        return (req: any, res: any, next: any) => {
            this.handleRequest(req, res, next);
        };
    }

    /**
     * Handle incoming request and determine if it's from a terminal/API tool
     */
    private handleRequest(req: any, res: any, next: any): void {
        this.logger.debug("security", "TermOn middleware called for request");

        if (this.config.debug) {
            this.logRequestDetails(req);
        }

        // Custom validator takes precedence
        if (
            this.config.customValidator &&
            typeof this.config.customValidator === "function"
        ) {
            if (!this.config.customValidator(req)) {
                return this.blockRequest(
                    res,
                    "TERMINAL_ONLY",
                    "Custom validator failed"
                );
            }
            return next();
        }

        // Check whitelist first if configured
        if (this.config.allowedTools && this.config.allowedTools.length > 0) {
            if (!this.isAllowedTool(req)) {
                return this.blockRequest(
                    res,
                    "TOOL_NOT_ALLOWED",
                    `Tool not in allowed list. Allowed tools: ${this.config.allowedTools.join(
                        ", "
                    )}`
                );
            }
        }

        // Run comprehensive detection
        const detection = this.detectRequestType(req);

        if (this.config.debug) {
            this.logger.debug("security", "Detection result", {
                isBrowser: detection.isBrowser,
                confidence: detection.confidence,
                reasons: detection.reasons,
                indicators: detection.indicators,
            });
        }

        // Block if detected as browser with sufficient confidence
        if (
            detection.isBrowser &&
            detection.confidence >= this.config.minConfidenceScore!
        ) {
            return this.blockRequest(
                res,
                "BROWSER_DETECTED",
                `Browser detected with ${
                    detection.confidence
                }% confidence: ${detection.reasons.join(", ")}`
            );
        }

        // If we get here, it's likely a terminal/API request - allow it
        next();
    }

    /**
     * Comprehensive browser detection with confidence scoring
     */
    private detectRequestType(req: any): DetectionResult {
        const result: DetectionResult = {
            isBrowser: false,
            confidence: 0,
            reasons: [],
            indicators: [],
        };

        let score = 0;
        const maxScore = this.calculateMaxScore();

        // 1. Sec-Fetch headers (browsers only, very reliable - 30 points)
        if (this.config.blockSecFetch && this.hasSecFetchHeaders(req)) {
            score += 30;
            result.reasons.push("Sec-Fetch headers present");
            result.indicators.push("sec-fetch");
        }

        // 2. Browser engine detection (very reliable - 25 points)
        const engineDetection = this.detectBrowserEngine(req);
        if (engineDetection.detected) {
            score += 25;
            result.reasons.push(`Browser engine: ${engineDetection.engine}`);
            result.indicators.push("browser-engine");
        }

        // 3. Browser name detection (reliable - 20 points)
        const browserDetection = this.detectBrowserName(req);
        if (browserDetection.detected) {
            score += 20;
            result.reasons.push(`Browser: ${browserDetection.name}`);
            result.indicators.push("browser-name");
        }

        // 4. Complex Accept header (moderately reliable - 15 points)
        if (this.hasComplexAcceptHeader(req)) {
            score += 15;
            result.reasons.push("Complex Accept header");
            result.indicators.push("complex-accept");
        }

        // 5. Origin/Referer headers (reliable - 20 points)
        if (this.hasNavigationHeaders(req)) {
            score += 20;
            result.reasons.push("Navigation headers present");
            result.indicators.push("navigation-headers");
        }

        // 6. Accept-Language patterns (moderately reliable - 15 points)
        if (this.hasBrowserLanguagePattern(req)) {
            score += 15;
            result.reasons.push("Browser-style language preferences");
            result.indicators.push("accept-language");
        }

        // 7. Cache control patterns (moderately reliable - 10 points)
        if (this.hasBrowserCachePattern(req)) {
            score += 10;
            result.reasons.push("Browser cache patterns");
            result.indicators.push("cache-control");
        }

        // 8. Connection header patterns (less reliable - 10 points)
        if (this.hasBrowserConnectionPattern(req)) {
            score += 10;
            result.reasons.push("Browser connection patterns");
            result.indicators.push("connection");
        }

        // 9. DNT (Do Not Track) header (browsers only - 10 points)
        if (this.hasDNTHeader(req)) {
            score += 10;
            result.reasons.push("DNT header present");
            result.indicators.push("dnt");
        }

        // 10. Upgrade-Insecure-Requests (browsers only - 10 points)
        if (this.hasUpgradeInsecureRequests(req)) {
            score += 10;
            result.reasons.push("Upgrade-Insecure-Requests header");
            result.indicators.push("upgrade-insecure");
        }

        // 11. Accept-Encoding patterns (less reliable - 5 points)
        if (this.hasBrowserEncodingPattern(req)) {
            score += 5;
            result.reasons.push("Browser encoding patterns");
            result.indicators.push("accept-encoding");
        }

        // 12. Check for known API tools (negative scoring - reduces confidence)
        if (this.isKnownAPITool(req)) {
            score = Math.max(0, score - 40); // Reduce score significantly
            result.reasons.push("Known API tool detected");
            result.indicators.push("api-tool");
        }

        // 13. Allowed tools whitelist check
        if (this.config.allowedTools && this.config.allowedTools.length > 0) {
            if (!this.isAllowedTool(req)) {
                score += 10;
                result.reasons.push("Tool not in whitelist");
                result.indicators.push("not-whitelisted");
            } else {
                score = Math.max(0, score - 30);
                result.reasons.push("Tool in whitelist");
                result.indicators.push("whitelisted");
            }
        }

        // Calculate confidence percentage
        result.confidence = Math.round((score / maxScore) * 100);
        result.isBrowser = result.confidence >= this.config.minConfidenceScore!;

        // Apply strictness modifiers
        if (this.config.strictness === "high" && result.confidence >= 50) {
            result.isBrowser = true;
        } else if (
            this.config.strictness === "paranoid" &&
            result.confidence >= 30
        ) {
            result.isBrowser = true;
        }

        return result;
    }

    /**
     * Calculate maximum possible score based on configuration
     */
    private calculateMaxScore(): number {
        return 180; // Sum of all positive scoring checks
    }

    /**
     * Check for Sec-Fetch headers (browsers only)
     */
    private hasSecFetchHeaders(req: any): boolean {
        return !!(
            req.headers["sec-fetch-dest"] ||
            req.headers["sec-fetch-mode"] ||
            req.headers["sec-fetch-site"] ||
            req.headers["sec-fetch-user"]
        );
    }

    /**
     * Detect browser engine with high specificity
     */
    private detectBrowserEngine(req: any): {
        detected: boolean;
        engine: string;
    } {
        const userAgent = (req.headers["user-agent"] || "").toLowerCase();

        for (const engine of this.BROWSER_ENGINES) {
            if (userAgent.includes(engine)) {
                return { detected: true, engine };
            }
        }

        return { detected: false, engine: "" };
    }

    /**
     * Detect browser name with version specificity
     */
    private detectBrowserName(req: any): { detected: boolean; name: string } {
        const userAgent = (req.headers["user-agent"] || "").toLowerCase();

        for (const browser of this.BROWSER_NAMES) {
            if (userAgent.includes(browser)) {
                return { detected: true, name: browser };
            }
        }

        return { detected: false, name: "" };
    }

    /**
     * Check for complex Accept header (browsers send detailed MIME types)
     */
    private hasComplexAcceptHeader(req: any): boolean {
        const accept = req.headers["accept"] || "";

        // Browsers typically send text/html with high priority
        if (accept.includes("text/html") && accept.includes("q=")) {
            return true;
        }

        // Multiple MIME types with quality values
        const parts = accept.split(",");
        if (parts.length >= 4) {
            return true;
        }

        // Check for browser-specific MIME type combinations
        if (
            accept.includes("application/xhtml+xml") ||
            accept.includes("application/xml;q=") ||
            accept.includes("image/webp") ||
            accept.includes("image/apng")
        ) {
            return true;
        }

        return false;
    }

    /**
     * Check for navigation headers (Origin/Referer)
     */
    private hasNavigationHeaders(req: any): boolean {
        return !!(req.headers["origin"] || req.headers["referer"]);
    }

    /**
     * Check for browser-style language patterns
     */
    private hasBrowserLanguagePattern(req: any): boolean {
        const acceptLanguage = req.headers["accept-language"];

        if (!acceptLanguage) {
            return false;
        }

        // Browsers send multiple languages with quality values
        if (
            acceptLanguage.includes("q=") &&
            acceptLanguage.split(",").length >= 2
        ) {
            return true;
        }

        // Check for region-specific language codes (e.g., en-US, fr-FR)
        if (/[a-z]{2}-[A-Z]{2}/.test(acceptLanguage)) {
            return true;
        }

        return false;
    }

    /**
     * Check for browser cache control patterns
     */
    private hasBrowserCachePattern(req: any): boolean {
        const cacheControl = req.headers["cache-control"];
        const pragma = req.headers["pragma"];

        // Browsers often send max-age=0 or no-cache
        if (
            cacheControl &&
            (cacheControl.includes("max-age=0") || cacheControl === "no-cache")
        ) {
            return true;
        }

        // Pragma: no-cache is browser behavior
        if (pragma === "no-cache") {
            return true;
        }

        return false;
    }

    /**
     * Check for browser connection patterns
     */
    private hasBrowserConnectionPattern(req: any): boolean {
        const connection = (req.headers["connection"] || "").toLowerCase();

        // Browsers typically use keep-alive
        return connection === "keep-alive";
    }

    /**
     * Check for DNT (Do Not Track) header
     */
    private hasDNTHeader(req: any): boolean {
        return !!req.headers["dnt"];
    }

    /**
     * Check for Upgrade-Insecure-Requests header
     */
    private hasUpgradeInsecureRequests(req: any): boolean {
        return req.headers["upgrade-insecure-requests"] === "1";
    }

    /**
     * Check for browser encoding patterns
     */
    private hasBrowserEncodingPattern(req: any): boolean {
        const encoding = req.headers["accept-encoding"] || "";

        // Browsers typically support multiple encodings including br (Brotli)
        if (encoding.includes("br") || encoding.split(",").length >= 3) {
            return true;
        }

        return false;
    }

    /**
     * Check if request is from a known API tool
     */
    private isKnownAPITool(req: any): boolean {
        const userAgent = (req.headers["user-agent"] || "").toLowerCase();

        return this.KNOWN_API_TOOLS.some((tool) => userAgent.includes(tool));
    }

    /**
     * Check if request has browser indicators (legacy method, now uses comprehensive detection)
     */
    private hasBrowserIndicators(req: any): boolean {
        const detection = this.detectRequestType(req);
        return detection.isBrowser;
    }

    /**
     * Check if the tool is in the allowed list
     */
    private isAllowedTool(req: any): boolean {
        const userAgent = (req.headers["user-agent"] || "").toLowerCase();

        return this.config.allowedTools!.some((allowedTool) => {
            const pattern = new RegExp(
                allowedTool.toLowerCase().replace(/\*/g, ".*"),
                "i"
            );
            return pattern.test(userAgent);
        });
    }

    /**
     * Check if Accept header is simple (typical of API tools)
     */
    private hasSimpleAccept(req: any): boolean {
        const accept = req.headers["accept"] || "";

        return (
            accept === "*/*" ||
            accept === "application/json" ||
            accept === "text/plain" ||
            accept.split(",").length <= 2
        );
    }

    /**
     * Log detailed request information for debugging
     */
    private logRequestDetails(req: any): void {
        this.logger.debug("security", "TermOn analyzing request", {
            secFetchDest: req.headers["sec-fetch-dest"],
            secFetchMode: req.headers["sec-fetch-mode"],
            accept: req.headers["accept"]?.substring(0, 150),
            acceptLanguage: req.headers["accept-language"],
            acceptEncoding: req.headers["accept-encoding"],
            origin: req.headers["origin"],
        });
    }

    /**
     * Block the request with appropriate error response
     */
    private blockRequest(res: any, code: string, details?: string): void {
        const isDevelopment = this.config.debug;

        const response: any = {
            error: isDevelopment ? this.config.errorMessage : "Access denied",
            timestamp: new Date().toISOString(),
            code: "NEHONIXYPTERM01",
        };

        if (isDevelopment) {
            response.xypriss = {
                module: "TerminalOnly",
                code,
                details,
                userAgent: res.req?.headers["user-agent"]?.substring(0, 100),
            };
        }

        if (this.config.debug) {
            this.logger.debug("security", "TermOn blocking request", {
                code,
                details,
                userAgent: res.req?.headers["user-agent"]?.substring(0, 100),
            });
        }

        res.status(this.config.statusCode).json(response);
    }

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<TerminalOnlyConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    public getConfig(): TerminalOnlyConfig {
        return { ...this.config };
    }
}

