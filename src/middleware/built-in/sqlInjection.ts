interface SQLInjectionConfig {
    strictMode?: boolean;
    allowedChars?: RegExp;
    maxLength?: number;
    logAttempts?: boolean;
    contextualAnalysis?: boolean;
    falsePositiveThreshold?: number;
}

interface DetectionResult {
    isMalicious: boolean;
    confidence: number;
    detectedPatterns: string[];
    sanitizedInput?: string;
    riskLevel: "LOW" | "MEDIUM" | "HIGH" | "CRITICAL";
}

class SQLInjectionDetector {
    private config: Required<SQLInjectionConfig>;

    // High-confidence SQL injection patterns (more specific to reduce false positives)
    private readonly highRiskPatterns = [
        // Union attacks with SELECT
        /(\s|^)(union|UNION)(\s)+(all\s+)?(select|SELECT)/gi,

        // SQL comments at end of input or before SQL keywords
        /(--|#|\/\*).*?(select|union|drop|delete|insert|update|create|alter)/gi,
        /;(\s)*--.*/gi,

        // Enhanced boolean injections (more comprehensive)
        /(\s|^)(or|OR)(\s)+('?\d+'?\s*=\s*'?\d+'?|'[^']*'\s*=\s*'[^']*'|true|false)/gi,
        /(\s|^)(and|AND)(\s)+('?\d+'?\s*=\s*'?\d+'?|'[^']*'\s*=\s*'[^']*'|true|false)/gi,

        // Quote-based boolean injections
        /'(\s)+(or|OR|and|AND)(\s)+'/gi,

        // Comment-obfuscated patterns
        /\/\*.*?\*\/(or|OR|and|AND)\/\*.*?\*\//gi,

        // Time-based with specific syntax (enhanced)
        /(sleep|SLEEP|waitfor|WAITFOR|delay|DELAY)\s*\(.*?\)/gi,
        /(waitfor|WAITFOR)\s+(delay|DELAY)\s+'/gi,

        // System stored procedures
        /(exec|EXEC|execute|EXECUTE)\s+(sp_|xp_)\w+/gi,

        // Information schema with specific queries
        /(information_schema|INFORMATION_SCHEMA)\.(tables|columns|schemata)/gi,

        // Dangerous DDL operations with semicolons
        /;(\s)*(drop|DROP|delete|DELETE|truncate|TRUNCATE)\s+(table|database)/gi,

        // Hex encoding of common injection strings
        /0x(27|22|5C|2D|2D)/gi, // ', ", \, --

        // Multiple quotes for quote breaking
        /('{3,}|"{3,})/g,

        // Stacked queries with dangerous operations
        /;(\s)*(drop|delete|insert|update|create|alter)(\s)+/gi,
    ];

    // Medium risk patterns (require context analysis)
    private readonly mediumRiskPatterns = [
        // Single SQL keywords (common in legitimate text)
        /\b(select|union|drop|delete|insert|update|create|alter)\b/gi,

        // Simple OR/AND conditions
        /\b(or|and)\s+\w+\s*=\s*\w+/gi,

        // Single quotes or double quotes
        /'/g,
        /"/g,

        // Basic SQL comments
        /(--|#)/g,

        // Wildcards
        /[%_]/g,
    ];

    // Characters that are suspicious in certain contexts
    private readonly contextSensitiveChars = /[';\"\\%_]/g;

    constructor(config: SQLInjectionConfig = {}) {
        this.config = {
            strictMode: config.strictMode ?? false,
            allowedChars: config.allowedChars ?? /^[a-zA-Z0-9\s\-@.!?,()]+$/,
            maxLength: config.maxLength ?? 1000,
            logAttempts: config.logAttempts ?? true,
            contextualAnalysis: config.contextualAnalysis ?? true,
            falsePositiveThreshold: config.falsePositiveThreshold ?? 0.6,
        };
    }

    /**
     * Main detection method with improved false positive handling
     */
    detect(
        input: string | null | undefined,
        context?: string
    ): DetectionResult {
        if (!input || typeof input !== "string") {
            return {
                isMalicious: false,
                confidence: 0,
                detectedPatterns: [],
                riskLevel: "LOW",
            };
        }

        const result: DetectionResult = {
            isMalicious: false,
            confidence: 0,
            detectedPatterns: [],
            sanitizedInput: input,
            riskLevel: "LOW",
        };

        // Check input length (very long inputs are suspicious)
        if (input.length > this.config.maxLength) {
            result.confidence += 0.2; // Reduced penalty for length
            result.detectedPatterns.push("Excessive length");
        }

        // High-risk pattern analysis (strong indicators)
        let highRiskScore = 0;
        this.highRiskPatterns.forEach((pattern, index) => {
            const matches = input.match(pattern);
            if (matches) {
                const patternName = this.getHighRiskPatternName(index);
                result.detectedPatterns.push(
                    `${patternName}: ${matches.join(", ")}`
                );
                highRiskScore += this.getHighRiskPatternWeight(index);
            }
        });

        // Medium-risk pattern analysis (context-dependent)
        let mediumRiskScore = 0;
        if (this.config.contextualAnalysis) {
            mediumRiskScore = this.analyzeContext(input, context || "");
        } else {
            // Basic medium risk analysis without context
            this.mediumRiskPatterns.forEach((pattern, index) => {
                const matches = input.match(pattern);
                if (matches) {
                    mediumRiskScore += 0.1 * matches.length; // Lower weight for medium risk
                }
            });
        }

        // Contextual analysis for legitimate use cases
        const legitimacyScore = this.calculateLegitimacyScore(input);

        // Calculate confidence with false positive mitigation
        const rawScore = highRiskScore + mediumRiskScore * 0.3;
        result.confidence = Math.max(0, rawScore - legitimacyScore);
        result.confidence = Math.min(result.confidence, 1.0);

        // Determine risk level and malicious status
        if (result.confidence >= 0.8) {
            result.riskLevel = "CRITICAL";
            result.isMalicious = true;
        } else if (result.confidence >= this.config.falsePositiveThreshold) {
            result.riskLevel = "HIGH";
            result.isMalicious = true;
        } else if (result.confidence >= 0.3) {
            result.riskLevel = "MEDIUM";
            result.isMalicious = false; // Don't block medium risk by default
        } else {
            result.riskLevel = "LOW";
            result.isMalicious = false;
        }

        // Log only high confidence attempts
        if (this.config.logAttempts && result.confidence >= 0.7) {
            this.logAttempt(input, result);
        }

        // Provide sanitized version only for high-risk inputs
        if (result.confidence >= 0.4) {
            result.sanitizedInput = this.smartSanitize(input);
        }

        return result;
    }

    /**
     * Analyze context to reduce false positives
     */
    private analyzeContext(input: string, context: string): number {
        let score = 0;

        // Check for legitimate business contexts
        const businessContexts = [
            "search",
            "filter",
            "name",
            "description",
            "comment",
            "review",
            "address",
            "title",
            "content",
            "message",
            "email",
        ];

        const isBusinessContext = businessContexts.some((ctx) =>
            context.toLowerCase().includes(ctx)
        );

        this.mediumRiskPatterns.forEach((pattern, index) => {
            const matches = input.match(pattern);
            if (matches) {
                let patternScore = 0.1 * matches.length;

                // Reduce score for legitimate contexts
                if (isBusinessContext) {
                    patternScore *= 0.3; // Reduce by 70%
                }

                // Special handling for common false positives
                if (index === 0 && isBusinessContext) {
                    // SQL keywords in business text
                    patternScore *= 0.1; // Very low weight for SQL keywords in business context
                }

                if (index === 2 || index === 3) {
                    // Single quotes in names, descriptions
                    if (
                        context.includes("name") ||
                        context.includes("description")
                    ) {
                        patternScore *= 0.2;
                    }
                }

                score += patternScore;
            }
        });

        return score;
    }

    /**
     * Calculate legitimacy score to offset false positives
     */
    private calculateLegitimacyScore(input: string): number {
        let legitimacyScore = 0;

        // Natural language indicators
        const naturalWords = input.match(/\b[a-zA-Z]{3,}\b/g);
        if (naturalWords && naturalWords.length > 2) {
            legitimacyScore += 0.2; // Looks like natural text
        }

        // Check for common legitimate patterns
        const legitimatePatterns = [
            /^[A-Z][a-z]+\s[A-Z][a-z]+$/, // First Last name
            /^[\w\.-]+@[\w\.-]+\.\w+$/, // Email
            /^\d{1,5}\s\w+(\s\w+)*$/, // Address format
            /^[A-Za-z0-9\s\-.,!?()]+$/, // Normal text with punctuation
        ];

        legitimatePatterns.forEach((pattern) => {
            if (pattern.test(input)) {
                legitimacyScore += 0.15;
            }
        });

        // Length-based legitimacy (very short or very specific lengths are more suspicious)
        if (input.length > 10 && input.length < 200) {
            legitimacyScore += 0.1;
        }

        // Check for balanced quotes (legitimate text often has balanced quotes)
        const singleQuotes = (input.match(/'/g) || []).length;
        const doubleQuotes = (input.match(/"/g) || []).length;
        if (singleQuotes % 2 === 0 && doubleQuotes % 2 === 0) {
            legitimacyScore += 0.1;
        }

        return Math.min(legitimacyScore, 0.5); // Cap legitimacy score
    }

    /**
     * Smart sanitization that preserves legitimate content
     */
    smartSanitize(input: string): string {
        if (!input) return input;

        let sanitized = input;

        // Only remove obvious SQL injection patterns, not all SQL keywords
        sanitized = sanitized.replace(/(--|#).*$/gm, ""); // Remove comment tails
        sanitized = sanitized.replace(/\/\*.*?\*\//g, ""); // Remove /* */ comments

        // Only escape quotes if they appear to be part of injection attempts
        const suspiciousQuotes = /'(\s*(or|and|union|select)\s|;|\s*--)/gi;
        sanitized = sanitized.replace(suspiciousQuotes, "''$1");

        // Remove only dangerous control characters
        sanitized = sanitized.replace(/[\x00\x1a]/g, "");

        // Only remove semicolons if followed by SQL keywords
        sanitized = sanitized.replace(
            /;(\s)*(drop|delete|insert|update|create|alter|union|select)/gi,
            " $2"
        );

        return sanitized.trim();
    }

    /**
     * Validate and sanitize input, throwing error if malicious
     */
    validateAndSanitize(
        input: string,
        throwOnDetection: boolean = false
    ): string {
        const result = this.detect(input);

        if (result.isMalicious && throwOnDetection) {
            throw new Error(
                `SQL injection attempt detected. Confidence: ${(
                    result.confidence * 100
                ).toFixed(1)}%. ` +
                    `Patterns: ${result.detectedPatterns.join(", ")}`
            );
        }

        return result.sanitizedInput || "";
    }

    /**
     * Create parameterized query helper
     */
    createParameterizedQuery(
        query: string,
        params: any[]
    ): { query: string; params: any[] } {
        // Simple parameterization helper
        let parameterizedQuery = query;
        const safeParams: any[] = [];

        params.forEach((param, index) => {
            if (typeof param === "string") {
                const result = this.detect(param);
                if (result.isMalicious) {
                    throw new Error(
                        `Parameter ${index} contains potential SQL injection`
                    );
                }
                safeParams.push(result.sanitizedInput);
            } else {
                safeParams.push(param);
            }
        });

        return { query: parameterizedQuery, params: safeParams };
    }

    private getHighRiskPatternName(index: number): string {
        const names = [
            "Union-Select attack",
            "Commented injection",
            "Comment with semicolon",
            "Enhanced boolean OR",
            "Enhanced boolean AND",
            "Quote-based boolean",
            "Comment-obfuscated injection",
            "Time-based delay",
            "WAITFOR delay attack",
            "System procedure call",
            "Information schema query",
            "DDL with semicolon",
            "Hex-encoded injection",
            "Quote sequence attack",
            "Stacked query attack",
        ];
        return names[index] || `High-risk pattern ${index}`;
    }

    private getHighRiskPatternWeight(index: number): number {
        // Higher weights for more definitive attack patterns
        const weights = [
            0.9, // Union-Select attack
            0.8, // Commented injection
            0.7, // Comment with semicolon
            0.8, // Enhanced boolean OR
            0.8, // Enhanced boolean AND
            0.7, // Quote-based boolean
            0.8, // Comment-obfuscated injection
            0.9, // Time-based delay
            0.8, // WAITFOR delay attack
            0.8, // System procedure call
            0.7, // Information schema query
            0.9, // DDL with semicolon
            0.6, // Hex-encoded injection
            0.5, // Quote sequence attack
            0.8, // Stacked query attack
        ];
        return weights[index] || 0.7;
    }

    private logAttempt(input: string, result: DetectionResult): void {
        console.warn(`SQL Injection Attempt Detected:`, {
            timestamp: new Date().toISOString(),
            input: input.substring(0, 100) + (input.length > 100 ? "..." : ""),
            confidence: result.confidence,
            patterns: result.detectedPatterns,
        });
    }

    /**
     * Update configuration
     */
    updateConfig(newConfig: Partial<SQLInjectionConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    /**
     * Get current configuration
     */
    getConfig(): Required<SQLInjectionConfig> {
        return { ...this.config };
    }
}

// Usage examples:
export default SQLInjectionDetector;

