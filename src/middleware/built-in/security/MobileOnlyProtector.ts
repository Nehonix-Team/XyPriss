/**
 * Mobile-Only Access Protector
 * Blocks browser requests and allows only mobile app access.
 * Multi-layered detection with strict validation to avoid false positives.
 *
 * @example Enable with defaults:
 * ```typescript
 * mobileOnly: true
 * ```
 *
 * @example Custom configuration:
 * ```typescript
 * mobileOnly: {
 *   blockBrowserIndicators: true,
 *   allowedPlatforms: ['ios', 'android'],
 *   requireMobileHeaders: true,
 *   customUserAgentPatterns: [/MyApp/i],
 *   errorMessage: "Mobile app access required"
 * }
 * ```
 */

import { Logger } from "../../../../shared/logger";

export interface MobileOnlyConfig {
    /** Enable/disable mobile-only protection */
    enable?: boolean;

    /** Block requests with browser indicators */
    blockBrowserIndicators?: boolean;

    /** Allowed mobile platforms */
    allowedPlatforms?: (
        | "ios"
        | "android"
        | "react-native"
        | "expo"
        | "flutter"
    )[];

    /** Require mobile-specific headers */
    requireMobileHeaders?: boolean;

    /** Custom User-Agent patterns to allow */
    customUserAgentPatterns?: RegExp[];

    /** Debug logging */
    debug?: boolean;

    /** Custom error message */
    errorMessage?: string;

    /** HTTP status code for blocked requests */
    statusCode?: number;

    /** Case-sensitive User-Agent matching */
    caseSensitive?: boolean;

    /** Trim whitespace from User-Agent */
    trimUserAgent?: boolean;
}

export class MobileOnlyProtector {
    private config: Required<MobileOnlyConfig>;
    private logger: Logger;

    // Mobile platform indicators
    private readonly mobilePatterns = [
        /\bAndroid\b/i,
        /\biPhone\b/i,
        /\biPad\b/i,
        /\biPod\b/i,
        /\bBlackBerry\b/i,
        /\bWindows Phone\b/i,
        /\bReactNative\b/i,
        /\bExpo\b/i,
        /\bDalvik\b/i, // Android runtime
    ];

    // Android HTTP clients
    private readonly androidHttpClients = [
        /\bokhttp\b/i, // OkHttp
        /\bretrofit\b/i, // Retrofit
        /\bktor-client\b/i, // Ktor Client
        /\bktor\b/i, // Ktor (short form)
        /\bvolley\b/i, // Volley
        /\bHttpUrlConnection\b/i, // HttpUrlConnection
        /\bAndroidHttpClient\b/i, // Generic Android HTTP
    ];

    // iOS HTTP clients
    private readonly iosHttpClients = [
        /\bAlamofire\b/i, // Alamofire
        /\bAFNetworking\b/i, // AFNetworking
        /\bCFNetwork\b/i, // CFNetwork (iOS networking framework)
        /\bURLSession\b/i, // URLSession
        /\bNSURLSession\b/i, // NSURLSession (Objective-C)
        /\bMoya\b/i, // Moya
        /\bSiesta\b/i, // Siesta
    ];

    // Cross-platform mobile frameworks
    private readonly mobileFameworks = [
        /\bFlutter\b/i,
        /\bDart\b/i, // Dart (Flutter's language)
        /\bReact Native\b/i,
        /\bReactNative\b/i,
        /\bExpo\b/i,
        /\bCapacitor\b/i, // Ionic Capacitor
        /\bCordova\b/i, // Apache Cordova
        /\bIonic\b/i, // Ionic Framework
        /\bXamarin\b/i, // Xamarin
    ];

    // Comprehensive browser indicators (aggressive detection)
    private readonly browserIndicators = [
        /\bMozilla\b/i,
        /\bChrome\b/i,
        /\bChromium\b/i,
        /\bSafari\b/i,
        /\bFirefox\b/i,
        /\bEdge\b/i,
        /\bEdg\b/i,
        /\bOpera\b/i,
        /\bOPR\b/i,
        /\bBrave\b/i,
        /\bVivaldi\b/i,
        /\bSeaMonkey\b/i,
        /\bIceweasel\b/i,
        /\bEpiphany\b/i,
        /\bMidori\b/i,
        /\bKonqueror\b/i,
        /\bWebKit\b/i,
        /\bGecko\b/i,
        /\bTrident\b/i,
        /\bPresto\b/i,
        /\bEdgeHTML\b/i,
        /\bNetscape\b/i,
        /\bIE\b/i,
        /\bMSIE\b/i,
        /\brv:11/i, // IE11
        /\bElectron\b/i, // Desktop apps
        /\bPhantomJS\b/i, // Headless browser
        /\bHeadlessChrome\b/i,
    ];

    // Known desktop OS indicators
    private readonly desktopIndicators = [
        /\bWindows NT\b/i,
        /\bMac OS X\b/i,
        /\bMacintosh\b/i,
        /\bLinux x86_64\b/i,
        /\bLinux i686\b/i,
        /\bX11\b/i,
        /\bWin64\b/i,
        /\bWOW64\b/i,
        /\bUbuntu\b/i,
        /\bFedora\b/i,
        /\bDebian\b/i,
    ];

    // Suspicious patterns often used in spoofing (excluding legitimate mobile clients)
    private readonly suspiciousPatterns = [
        /\bcurl\b/i,
        /\bwget\b/i,
        /\bPython\b/i,
        /\bJava(?!Script)\b/i, // Java but not JavaScript
        /\bperl\b/i,
        /\bruby\b/i,
        /\bPostman\b/i,
        /\bInsomnia\b/i,
        /\bHTTPie\b/i,
        /\baxios\b/i,
        /\bnode-fetch\b/i,
        /\bgot\b/i,
        /\bsuperagent\b/i,
        /\brequest\b/i,
        /\bbot\b/i,
        /\bcrawler\b/i,
        /\bspider\b/i,
        /\bscraper\b/i,
    ];

    // Mobile-specific headers that indicate app requests
    private readonly mobileHeaders = [
        "x-requested-with",
        "x-mobile-app",
        "x-app-platform",
        "x-app-version",
        "expo-version",
        "react-native-version",
        "x-flutter-version",
        "x-ios-bundle-identifier",
        "x-android-package",
    ];

    constructor(config: MobileOnlyConfig = {}, logger?: Logger) {
        this.config = {
            enable: config.enable ?? true,
            blockBrowserIndicators: config.blockBrowserIndicators ?? true,
            allowedPlatforms: config.allowedPlatforms ?? [
                "ios",
                "android",
                "react-native",
                "expo",
            ],
            requireMobileHeaders: config.requireMobileHeaders ?? false,
            customUserAgentPatterns: config.customUserAgentPatterns ?? [],
            debug: config.debug ?? false,
            errorMessage:
                config.errorMessage ??
                "Mobile app access required. Browser requests are not allowed.",
            statusCode: config.statusCode ?? 403,
            caseSensitive: config.caseSensitive ?? false,
            trimUserAgent: config.trimUserAgent ?? true,
        };

        this.logger =
            logger ||
            new Logger({
                components: { security: true },
                types: { debug: true },
            });
    }

    /**
     * Normalize User-Agent string
     */
    private normalizeUserAgent(userAgent: string): string {
        if (!userAgent) return "";

        let normalized = userAgent;

        if (this.config.trimUserAgent) {
            normalized = normalized.trim();
        }

        // Remove excessive whitespace
        normalized = normalized.replace(/\s+/g, " ");

        return normalized;
    }

    /**
     * Check for Android HTTP client indicators
     */
    private hasAndroidHttpClient(userAgent: string): boolean {
        const flags = this.config.caseSensitive ? "g" : "gi";

        return this.androidHttpClients.some((pattern) => {
            const regex = new RegExp(pattern.source, flags);
            return regex.test(userAgent);
        });
    }

    /**
     * Check for iOS HTTP client indicators
     */
    private hasIosHttpClient(userAgent: string): boolean {
        const flags = this.config.caseSensitive ? "g" : "gi";

        return this.iosHttpClients.some((pattern) => {
            const regex = new RegExp(pattern.source, flags);
            return regex.test(userAgent);
        });
    }

    /**
     * Check for mobile framework indicators
     */
    private hasMobileFramework(userAgent: string): boolean {
        const flags = this.config.caseSensitive ? "g" : "gi";

        return this.mobileFameworks.some((pattern) => {
            const regex = new RegExp(pattern.source, flags);
            return regex.test(userAgent);
        });
    }

    /**
     * Check for browser indicators in User-Agent
     */
    private hasBrowserIndicators(userAgent: string): boolean {
        if (!this.config.blockBrowserIndicators) {
            return false;
        }

        const flags = this.config.caseSensitive ? "g" : "gi";

        return this.browserIndicators.some((pattern) => {
            const regex = new RegExp(pattern.source, flags);
            return regex.test(userAgent);
        });
    }

    /**
     * Check for desktop OS indicators
     */
    private hasDesktopIndicators(userAgent: string): boolean {
        const flags = this.config.caseSensitive ? "g" : "gi";

        return this.desktopIndicators.some((pattern) => {
            const regex = new RegExp(pattern.source, flags);
            return regex.test(userAgent);
        });
    }

    /**
     * Check for suspicious patterns (bots, tools, spoofing attempts)
     */
    private hasSuspiciousPatterns(userAgent: string): boolean {
        const flags = this.config.caseSensitive ? "g" : "gi";

        return this.suspiciousPatterns.some((pattern) => {
            const regex = new RegExp(pattern.source, flags);
            return regex.test(userAgent);
        });
    }

    /**
     * Check if User-Agent matches custom patterns
     */
    private matchesCustomPatterns(userAgent: string): boolean {
        if (this.config.customUserAgentPatterns.length === 0) {
            return false;
        }

        const flags = this.config.caseSensitive ? "g" : "gi";

        for (const pattern of this.config.customUserAgentPatterns) {
            try {
                const regex = new RegExp(pattern.source, flags);
                if (regex.test(userAgent)) {
                    if (this.config.debug) {
                        this.logger.debug(
                            "security",
                            `Custom pattern matched: ${pattern}`
                        );
                    }
                    return true;
                }
            } catch (error) {
                this.logger.warn(
                    "security",
                    `Invalid custom pattern: ${pattern}`
                );
            }
        }

        return false;
    }

    /**
     * Check if User-Agent indicates allowed mobile platform
     */
    private hasAllowedPlatform(userAgent: string): boolean {
        return this.config.allowedPlatforms.some((platform) => {
            switch (platform) {
                case "ios":
                    // iOS detection: iOS devices OR iOS HTTP clients (without desktop indicators)
                    return (
                        (/\b(iPhone|iPad|iPod)\b/i.test(userAgent) ||
                            this.hasIosHttpClient(userAgent)) &&
                        !/\b(Macintosh|Mac OS X)\b/i.test(userAgent)
                    );

                case "android":
                    // Android detection: Android OS OR Android HTTP clients (without desktop emulator)
                    return (
                        (/\bAndroid\b/i.test(userAgent) ||
                            /\bDalvik\b/i.test(userAgent) ||
                            this.hasAndroidHttpClient(userAgent)) &&
                        !/\b(X11|Linux x86_64)\b/i.test(userAgent)
                    );

                case "react-native":
                    return /\b(ReactNative|React Native)\b/i.test(userAgent);

                case "expo":
                    return /\bExpo\b/i.test(userAgent);

                case "flutter":
                    return /\b(Flutter|Dart)\b/i.test(userAgent);

                default:
                    return false;
            }
        });
    }

    /**
     * Check for mobile-specific patterns
     */
    private hasMobilePatterns(userAgent: string): boolean {
        const flags = this.config.caseSensitive ? "g" : "gi";

        return this.mobilePatterns.some((pattern) => {
            const regex = new RegExp(pattern.source, flags);
            return regex.test(userAgent);
        });
    }

    /**
     * Check for mobile-specific headers
     */
    private hasMobileHeaders(req: any): boolean {
        if (!req.headers) {
            return false;
        }

        return this.mobileHeaders.some((header) => {
            const lowerHeader = header.toLowerCase();
            // Check both original case and lowercase
            return req.headers[header] || req.headers[lowerHeader];
        });
    }

    /**
     * Validate User-Agent is not empty or suspicious
     */
    private isValidUserAgent(userAgent: string): boolean {
        if (!userAgent || userAgent.length === 0) {
            if (this.config.debug) {
                this.logger.debug("security", "Empty User-Agent detected");
            }
            return false;
        }

        // Allow shorter User-Agents for mobile HTTP clients (like okhttp/4.12.0)
        if (userAgent.length < 5) {
            if (this.config.debug) {
                this.logger.debug(
                    "security",
                    `Suspicious short User-Agent: ${userAgent}`
                );
            }
            return false;
        }

        // User-Agent with only generic "Mobile" is suspicious
        if (userAgent === "Mobile" || userAgent.toLowerCase() === "mobile") {
            if (this.config.debug) {
                this.logger.debug(
                    "security",
                    "Generic 'Mobile' User-Agent detected"
                );
            }
            return false;
        }

        return true;
    }

    /**
     * Perform comprehensive mobile request validation
     */
    private validateMobileRequest(
        req: any,
        userAgent: string
    ): {
        isValid: boolean;
        reason: string;
        score: number; // Confidence score 0-100
    } {
        let score = 0;
        let reason = "";
        const reasons: string[] = [];

        // Phase 1: Validation checks (disqualifiers)
        if (!this.isValidUserAgent(userAgent)) {
            return { isValid: false, reason: "Invalid User-Agent", score: 0 };
        }

        if (this.hasSuspiciousPatterns(userAgent)) {
            return {
                isValid: false,
                reason: "Suspicious patterns detected",
                score: 0,
            };
        }

        if (this.hasDesktopIndicators(userAgent)) {
            return {
                isValid: false,
                reason: "Desktop OS indicators detected",
                score: 0,
            };
        }

        // Check browser indicators AFTER mobile patterns to avoid false positives
        const hasBrowser = this.hasBrowserIndicators(userAgent);
        const hasMobilePattern = this.hasMobilePatterns(userAgent);
        const hasAndroidClient = this.hasAndroidHttpClient(userAgent);
        const hasIosClient = this.hasIosHttpClient(userAgent);
        const hasMobileFramework = this.hasMobileFramework(userAgent);

        // If blockBrowserIndicators is disabled, browsers are allowed
        if (!this.config.blockBrowserIndicators && hasBrowser) {
            score += 50; // Give browsers a decent score when allowed
            reasons.push("Browser allowed (blockBrowserIndicators disabled)");
        }
        // If it has browser indicators but NO mobile indicators, block it (only when blocking browsers)
        else if (
            hasBrowser &&
            !hasMobilePattern &&
            !hasAndroidClient &&
            !hasIosClient &&
            !hasMobileFramework
        ) {
            return {
                isValid: false,
                reason: "Browser indicators without mobile patterns",
                score: 0,
            };
        }

        // Phase 2: Positive indicators (qualifiers)

        // Custom patterns have highest priority
        if (this.matchesCustomPatterns(userAgent)) {
            score = 100;
            reason = "Custom pattern match";
            return { isValid: true, reason, score };
        }

        // Mobile HTTP clients (high confidence for legitimate mobile apps)
        if (hasAndroidClient) {
            score += 80;
            reasons.push("Android HTTP client");
        }

        if (hasIosClient) {
            score += 80;
            reasons.push("iOS HTTP client");
        }

        // Mobile frameworks (high confidence)
        if (hasMobileFramework) {
            score += 70;
            reasons.push("Mobile framework");
        }

        // Platform-specific detection (medium-high confidence)
        if (this.hasAllowedPlatform(userAgent)) {
            score += 60;
            reasons.push("Allowed platform");
        }

        // General mobile patterns (medium confidence)
        if (hasMobilePattern) {
            score += 40;
            reasons.push("Mobile patterns");
        }

        // Mobile headers boost confidence
        if (this.hasMobileHeaders(req)) {
            score += 30;
            reasons.push("Mobile headers");
        }

        // Require minimum score threshold
        const threshold = this.config.requireMobileHeaders ? 80 : 50;

        reason =
            reasons.length > 0 ? reasons.join(" + ") : "No mobile indicators";

        return {
            isValid: score >= threshold,
            reason:
                score >= threshold
                    ? reason
                    : `Insufficient mobile indicators (score: ${score}/${threshold})`,
            score,
        };
    }

    /**
     * Check if request is from a mobile app
     */
    public isMobileRequest(req: any): boolean {
        const rawUserAgent =
            req.headers["user-agent"] || req.headers["User-Agent"] || "";
        const userAgent = this.normalizeUserAgent(rawUserAgent);

        const validation = this.validateMobileRequest(req, userAgent);

        if (this.config.debug) {
            this.logger.debug(
                "security",
                `Validation result: ${validation.isValid ? "PASS" : "FAIL"} ` +
                    `(Score: ${validation.score}) - ${
                        validation.reason
                    } - UA: ${userAgent.substring(0, 100)}`
            );
        }

        return validation.isValid;
    }

    /**
     * Middleware function
     */
    public middleware() {
        return (req: any, res: any, next: any) => {
            const userAgent =
                req.headers["user-agent"] ||
                req.headers["User-Agent"] ||
                "none";

            if (this.config.debug) {
                this.logger.debug(
                    "security",
                    `MobileOnly check for ${req.ip} - UA: ${userAgent.substring(
                        0,
                        100
                    )}`
                );
            }

            if (this.isMobileRequest(req)) {
                if (this.config.debug) {
                    this.logger.debug(
                        "security",
                        `✅ ALLOWED mobile request from: ${req.ip}`
                    );
                }
                return next();
            }

            this.logger.warn(
                "security",
                `❌ BLOCKED non-mobile request from ${
                    req.ip
                }. User-Agent: ${userAgent.substring(0, 150)}`
            );

            // Check if headers already sent to prevent error
            if (res.headersSent) {
                this.logger.error(
                    "security",
                    `Cannot send response for blocked request from ${req.ip} - headers already sent`
                );
                return;
            }

            return res.status(this.config.statusCode).json({
                error: "Access Denied",
                message: this.config.errorMessage,
                code: "MOBILE_ONLY",
                timestamp: new Date().toISOString(),
                userAgent: userAgent,
                ip: req.ip,
            });
        };
    }

    /**
     * Get current configuration
     */
    public getConfig(): MobileOnlyConfig {
        return { ...this.config };
    }
}

