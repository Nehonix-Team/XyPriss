/**
 * Browser-Only Protector - Enhanced Edition
 * Aggressively blocks non-browser requests while avoiding false positives
 * Uses multi-layered validation with scoring system
 */

import { Logger } from "../../../../shared/logger/Logger";

export interface BrowserOnlyConfig {
    /** Block requests without Sec-Fetch headers */
    requireSecFetch?: boolean;
    /** Block requests with curl/wget user agents */
    blockAutomationTools?: boolean;
    /** Require complex Accept header */
    requireComplexAccept?: boolean;
    /** Allow requests with Origin header (CORS) */
    allowOriginRequests?: boolean;
    /** Custom error message */
    errorMessage?: string;
    /** HTTP status code for blocked requests */
    statusCode?: number;
    /** Custom validation function */
    customValidator?: (req: any) => boolean;
    /** Enable debug logging */
    debug?: boolean;
}

export class BrowserOnlyProtector {
    private config: BrowserOnlyConfig;
    private readonly BROWSER_SCORE_THRESHOLD = 3; // Minimum score to pass as browser
    private logger: Logger;

    constructor(options: BrowserOnlyConfig = {}, logger?: Logger) {
        this.config = {
            requireSecFetch: true,
            blockAutomationTools: true,
            requireComplexAccept: false,
            allowOriginRequests: true,
            errorMessage: "Browser access required. Direct API access blocked.",
            statusCode: 403,
            debug: false,
            ...options,
        };

        // Only set customValidator if explicitly provided
        if (options.customValidator !== undefined) {
            this.config.customValidator = options.customValidator;
        }

        // Initialize logger
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
     * Get the browser-only middleware function
     */
    public getMiddleware() {
        return (req: any, res: any, next: any) => {
            this.handleRequest(req, res, next);
        };
    }

    /**
     * Handle incoming request and determine if it's from a browser
     */
    private handleRequest(req: any, res: any, next: any): void {
        if (this.config.debug) {
            this.logger.debug("security", "BrowOn called for request");
        }
        if (this.config.debug) {
            this.logger.debug("security", "BrowOn analyzing request", {
                secFetchDest: req.headers["sec-fetch-dest"],
                secFetchMode: req.headers["sec-fetch-mode"],
                secFetchSite: req.headers["sec-fetch-site"],
            });
        }

        // Custom validator takes precedence (if provided)
        if (
            this.config.customValidator &&
            typeof this.config.customValidator === "function"
        ) {
            if (!this.config.customValidator(req)) {
                return this.blockRequest(
                    res,
                    "BROWSER_ONLY",
                    "Custom validator failed"
                );
            }
            return next();
        }

        // CRITICAL: Block if automation tool is detected (highest priority)
        if (
            this.config.blockAutomationTools &&
            this.isDefinitelyAutomationTool(req)
        ) {
            return this.blockRequest(
                res,
                "AUTOMATION_TOOL_DETECTED",
                "Request from known automation tool"
            );
        }

        // Check for Sec-Fetch headers (modern browsers only)
        if (this.config.requireSecFetch) {
            const hasSecFetch = this.hasSecFetchHeaders(req);

            if (hasSecFetch) {
                // Validate Sec-Fetch headers are legitimate (not spoofed)
                if (this.validateSecFetchHeaders(req)) {
                    if (this.config.debug) {
                        this.logger.debug(
                            "security",
                            "BrowOn valid Sec-Fetch headers - allowing request"
                        );
                    }
                    return next();
                } else {
                    // Sec-Fetch headers present but invalid - suspicious
                    if (this.config.debug) {
                        this.logger.debug(
                            "security",
                            "BrowOn invalid Sec-Fetch headers detected - potential spoofing"
                        );
                    }
                    return this.blockRequest(
                        res,
                        "INVALID_SEC_FETCH",
                        "Sec-Fetch headers present but invalid"
                    );
                }
            }

            // No Sec-Fetch headers - use scoring system to determine if browser
            const browserScore = this.calculateBrowserScore(req);

            if (this.config.debug) {
                this.logger.debug(
                    "security",
                    `BrowOn browser score: ${browserScore.total}/${this.BROWSER_SCORE_THRESHOLD} (need ${this.BROWSER_SCORE_THRESHOLD} to pass)`
                );
                this.logger.debug(
                    "security",
                    "BrowOn score breakdown",
                    browserScore.breakdown
                );
            }

            if (browserScore.total >= this.BROWSER_SCORE_THRESHOLD) {
                if (this.config.debug) {
                    this.logger.debug(
                        "security",
                        "BrowOn browser score passed - allowing request"
                    );
                }
                return next();
            }

            // Failed browser score check
            return this.blockRequest(
                res,
                "INSUFFICIENT_BROWSER_INDICATORS",
                `Browser score ${browserScore.total}/${this.BROWSER_SCORE_THRESHOLD} - not enough browser characteristics`
            );
        }

        // Sec-Fetch check disabled, allow all requests
        next();
    }

    /**
     * Check if request has Sec-Fetch headers
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
     * Validate Sec-Fetch headers are consistent and legitimate
     */
    private validateSecFetchHeaders(req: any): boolean {
        const dest = req.headers["sec-fetch-dest"];
        const mode = req.headers["sec-fetch-mode"];
        const site = req.headers["sec-fetch-site"];
        const user = req.headers["sec-fetch-user"];

        // Must have at least dest and mode
        if (!dest || !mode) {
            return false;
        }

        // Validate dest values (common legitimate values)
        const validDest = [
            "document",
            "empty",
            "iframe",
            "image",
            "script",
            "style",
            "font",
            "audio",
            "video",
            "manifest",
            "object",
            "embed",
            "worker",
            "sharedworker",
            "serviceworker",
        ];
        if (!validDest.includes(dest)) {
            return false;
        }

        // Validate mode values
        const validMode = [
            "navigate",
            "cors",
            "no-cors",
            "same-origin",
            "websocket",
        ];
        if (!validMode.includes(mode)) {
            return false;
        }

        // Validate site values
        if (
            site &&
            !["same-origin", "same-site", "cross-site", "none"].includes(site)
        ) {
            return false;
        }

        // Validate user values (should be ?1 if present)
        if (user !== undefined && user !== "?1") {
            return false;
        }

        // Cross-validate consistency
        if (mode === "navigate" && dest !== "document" && dest !== "iframe") {
            return false; // Navigate mode should only be for documents/iframes
        }

        if (user === "?1" && mode !== "navigate") {
            return false; // User activation only makes sense for navigation
        }

        return true;
    }

    /**
     * Definitively identify automation tools (aggressive blocking)
     */
    private isDefinitelyAutomationTool(req: any): boolean {
        const userAgent = (req.headers["user-agent"] || "").toLowerCase();
        const accept = req.headers["accept"] || "";

        if (this.config.debug) {
            this.logger.debug(
                "security",
                "BrowOn checking automation tool detection",
                {
                    userAgent,
                    accept,
                }
            );
        }

        // Known automation tool patterns (comprehensive list)
        const automationPatterns = [
            /\bcurl\/\d+/i,
            /\bwget\/\d+/i,
            /\bpostman/i,
            /\binsomnia/i,
            /\bhttpie/i,
            /\bpython-requests/i,
            /\baxios/i,
            /\bnode-fetch/i,
            /\bundici/i,
            /\bsuperagent/i,
            /\bneedle/i,
            /\bhyperquest/i,
            /\bwreck/i,
            /\brestify/i,
            /\bgot\//i,
            /^python[\/-]/i,
            /^java[\/-]/i,
            /^go-http-client/i,
            /^ruby/i,
            /^php/i,
            /\bpycurl/i,
            /\blibwww-perl/i,
            /\blibcurl/i,
            /\bhttp\.rb/i,
            /\bhttpclient/i,
            /\bapache-httpclient/i,
            /\bokhttp/i,
            /\bretrofit/i,
            /\bunirest/i,
            /\brest-client/i,
            /\bhttparty/i,
            /\bfetch\//i,
            /\bscraper/i,
            /\bbot\b/i,
            /\bcrawler/i,
            /\bspider/i,
            /\bpuppeteer/i,
            /\bplaywright/i,
            /\bselenium/i,
            /\bphantomjs/i,
            /\bheadless/i,
        ];

        // Check user agent
        for (const pattern of automationPatterns) {
            if (pattern.test(userAgent)) {
                if (this.config.debug) {
                    this.logger.debug(
                        "security",
                        "BrowOn automation tool detected",
                        {
                            pattern: pattern.toString(),
                            userAgent,
                        }
                    );
                }
                return true;
            }
        }

        // Suspicious: Empty user agent
        if (!userAgent || userAgent.trim() === "") {
            return true;
        }

        // Suspicious: Too short user agent (< 20 chars usually means custom/scripted)
        if (userAgent.length < 20 && !this.isKnownShortBrowserUA(userAgent)) {
            return true;
        }

        // Suspicious: Accept */* with empty or simple user agent
        if (accept === "*/*" && userAgent.length < 50) {
            return true;
        }

        // Suspicious: User agent contains only version numbers and basic text
        if (/^[a-z0-9\.\-\/\s]+$/i.test(userAgent) && userAgent.length < 30) {
            return true;
        }

        return false;
    }

    /**
     * Check if user agent is a known short legitimate browser UA
     */
    private isKnownShortBrowserUA(userAgent: string): boolean {
        // Some mobile browsers or minimal browsers have shorter UAs
        const knownShort = [/^opera/i, /^lynx/i];
        return knownShort.some((pattern) => pattern.test(userAgent));
    }

    /**
     * Calculate browser legitimacy score using multiple indicators
     */
    private calculateBrowserScore(req: any): {
        total: number;
        breakdown: Record<string, number>;
    } {
        const breakdown: Record<string, number> = {};
        let total = 0;

        // 1. User Agent Analysis (0-2 points)
        const uaScore = this.scoreUserAgent(req);
        breakdown["userAgent"] = uaScore;
        total += uaScore;

        // 2. Accept Header Analysis (0-1 points)
        const acceptScore = this.scoreAcceptHeader(req);
        breakdown["accept"] = acceptScore;
        total += acceptScore;

        // 3. Accept-Language (0-1 points)
        const langScore = this.scoreAcceptLanguage(req);
        breakdown["acceptLanguage"] = langScore;
        total += langScore;

        // 4. Accept-Encoding (0-1 points)
        const encodingScore = this.scoreAcceptEncoding(req);
        breakdown["acceptEncoding"] = encodingScore;
        total += encodingScore;

        // 5. Origin/Referer (0-1 points)
        const originScore = this.scoreOriginReferer(req);
        breakdown["originReferer"] = originScore;
        total += originScore;

        // 6. Connection headers (0-1 points)
        const connectionScore = this.scoreConnectionHeaders(req);
        breakdown["connection"] = connectionScore;
        total += connectionScore;

        // 7. Cache-Control (0-1 points)
        const cacheScore = this.scoreCacheControl(req);
        breakdown["cache"] = cacheScore;
        total += cacheScore;

        // 8. DNT/Upgrade-Insecure-Requests (0-1 points)
        const privacyScore = this.scorePrivacyHeaders(req);
        breakdown["privacy"] = privacyScore;
        total += privacyScore;

        return { total, breakdown };
    }

    /**
     * Score User-Agent header (0-2 points)
     */
    private scoreUserAgent(req: any): number {
        const ua = req.headers["user-agent"] || "";
        let score = 0;

        // Must contain browser indicators
        if (
            /\b(Mozilla|Chrome|Safari|Firefox|Edge|Opera|Trident)\b/i.test(ua)
        ) {
            score += 1;
        }

        // Must be long and complex (typical browser UAs are 100+ chars)
        if (ua.length > 80) {
            score += 1;
        }

        // Contains platform info (Windows, Macintosh, Linux, Android, iOS)
        if (/\b(Windows|Macintosh|Linux|Android|iPhone|iPad)\b/i.test(ua)) {
            score += 0.5;
        }

        // Contains rendering engine (AppleWebKit, Gecko, Blink)
        if (/\b(AppleWebKit|Gecko|Blink|rv:)\b/i.test(ua)) {
            score += 0.5;
        }

        return Math.min(score, 2);
    }

    /**
     * Score Accept header (0-1 points)
     */
    private scoreAcceptHeader(req: any): number {
        const accept = req.headers["accept"] || "";

        // Browsers send complex Accept headers
        if (
            accept.includes("text/html") &&
            accept.includes("application/xhtml+xml")
        ) {
            return 1;
        }

        // At least multiple MIME types
        if (accept.split(",").length >= 3) {
            return 0.5;
        }

        return 0;
    }

    /**
     * Score Accept-Language header (0-1 points)
     */
    private scoreAcceptLanguage(req: any): number {
        const lang = req.headers["accept-language"];

        if (!lang) {
            return 0;
        }

        // Browsers send detailed language preferences with quality values
        if (lang.includes("q=") || lang.split(",").length >= 2) {
            return 1;
        }

        // At least has a language code
        if (lang.length >= 2) {
            return 0.5;
        }

        return 0;
    }

    /**
     * Score Accept-Encoding header (0-1 points)
     */
    private scoreAcceptEncoding(req: any): number {
        const encoding = req.headers["accept-encoding"];

        if (!encoding) {
            return 0;
        }

        // Browsers support multiple compression formats
        const hasGzip = encoding.includes("gzip");
        const hasDeflate = encoding.includes("deflate");
        const hasBr = encoding.includes("br");

        if ((hasGzip && hasDeflate) || hasBr) {
            return 1;
        }

        if (hasGzip || hasDeflate) {
            return 0.5;
        }

        return 0;
    }

    /**
     * Score Origin/Referer headers (0-1 points)
     */
    private scoreOriginReferer(req: any): number {
        const origin = req.headers["origin"];
        const referer = req.headers["referer"];

        // Origin header (CORS request from browser)
        if (origin && this.config.allowOriginRequests) {
            // Validate it's a proper URL
            if (this.isValidUrl(origin)) {
                return 1;
            }
        }

        // Referer header (navigation from another page)
        if (referer && this.isValidUrl(referer)) {
            return 1;
        }

        return 0;
    }

    /**
     * Score Connection headers (0-1 points)
     */
    private scoreConnectionHeaders(req: any): number {
        const connection = req.headers["connection"];
        const upgrade = req.headers["upgrade-insecure-requests"];

        // Browsers typically send keep-alive
        if (connection && connection.toLowerCase().includes("keep-alive")) {
            return 0.5;
        }

        // Upgrade-Insecure-Requests is browser-specific
        if (upgrade === "1") {
            return 1;
        }

        return 0;
    }

    /**
     * Score Cache-Control header (0-1 points)
     */
    private scoreCacheControl(req: any): number {
        const cache = req.headers["cache-control"];

        if (!cache) {
            return 0;
        }

        // Browsers send various cache directives
        if (
            cache.includes("max-age") ||
            cache.includes("no-cache") ||
            cache.includes("no-store")
        ) {
            return 1;
        }

        return 0;
    }

    /**
     * Score privacy-related headers (0-1 points)
     */
    private scorePrivacyHeaders(req: any): number {
        const dnt = req.headers["dnt"];
        const gpc = req.headers["sec-gpc"];
        const upgradeInsecure = req.headers["upgrade-insecure-requests"];

        // DNT (Do Not Track)
        if (dnt === "1") {
            return 1;
        }

        // GPC (Global Privacy Control)
        if (gpc === "1") {
            return 1;
        }

        // Upgrade-Insecure-Requests
        if (upgradeInsecure === "1") {
            return 1;
        }

        return 0;
    }

    /**
     * Validate if string is a proper URL
     */
    private isValidUrl(url: string): boolean {
        try {
            const parsed = new URL(url);
            return parsed.protocol === "http:" || parsed.protocol === "https:";
        } catch {
            return false;
        }
    }

    /**
     * Check if request shows browser-like characteristics (legacy method - kept for compatibility)
     */
    private isLikelyBrowserRequest(req: any): boolean {
        const score = this.calculateBrowserScore(req);
        return score.total >= this.BROWSER_SCORE_THRESHOLD;
    }

    /**
     * Check if User-Agent indicates an automation tool (legacy method - kept for compatibility)
     */
    private isAutomationTool(userAgent: string): boolean {
        return this.isDefinitelyAutomationTool({
            headers: { "user-agent": userAgent },
        });
    }

    /**
     * Check if Accept header is complex enough for a browser (legacy method)
     */
    private hasComplexAcceptHeader(accept: string): boolean {
        if (!accept || accept === "*/*") {
            return false;
        }

        const acceptParts = accept.split(",").map((s) => s.trim());
        return acceptParts.length >= 3 && accept.includes("text/html");
    }

    /**
     * Check for other browser indicators (legacy method)
     */
    private hasBrowserIndicators(req: any): boolean {
        const score = this.calculateBrowserScore(req);
        return score.total >= this.BROWSER_SCORE_THRESHOLD;
    }

    /**
     * Block the request with appropriate error response
     */
    private blockRequest(res: any, code: string, details?: string): void {
        // Generic error message for security (don't reveal implementation details)
        const isDevelopment = this.config.debug;

        const response: any = {
            error: isDevelopment ? this.config.errorMessage : "Access denied",
            timestamp: new Date().toISOString(),
            code: "NEHONIXYPBROw01",
        };

        // Add XyPriss-specific info for developers in development/debug mode
        if (isDevelopment) {
            response.xypriss = {
                module: "BrowserOnly",
                code,
                details,
                userAgent: res.req?.headers["user-agent"]?.substring(0, 100),
            };
        }

        if (this.config.debug) {
            this.logger.debug("security", "BrowOn blocking request", {
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
    public updateConfig(newConfig: Partial<BrowserOnlyConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    public getConfig(): BrowserOnlyConfig {
        return { ...this.config };
    }
}

