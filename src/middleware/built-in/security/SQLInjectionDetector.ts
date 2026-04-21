interface SQLInjectionConfig {
    strictMode?: boolean;
    allowedChars?: RegExp;
    maxLength?: number;
    logAttempts?: boolean;
    contextualAnalysis?: boolean;
    falsePositiveThreshold?: number;
    proximityThreshold?: number; // New: Similarity threshold (0-1)
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
        /waitfor\s+delay\s+/i,

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

        // Stacked queries
        /;\s*(drop|delete|insert|update|create|alter|select)\b/i,
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

    private readonly referencePayloads = [
        "1' OR '1'='1",
        "admin'--",
        "' UNION SELECT NULL,NULL,NULL--",
        "'; WAITFOR DELAY '0:0:5'--",
        "1 OR 1=1;--",
        "') OR ('1'='1",
        "1/0",
        "CHAR(113)+CHAR(118)+CHAR(112)+CHAR(113)",
        "SELECT * FROM users",
        "DROP TABLE customers",
    ];

    // Characters that are suspicious in certain contexts
    private readonly contextSensitiveChars = /[';\"\\%_]/g;

    constructor(config: Partial<SQLInjectionConfig> = {}) {
        this.config = {
            strictMode: config.strictMode ?? false,
            allowedChars: config.allowedChars ?? /^[a-zA-Z0-9\s\-@.!?,()]+$/,
            maxLength: config.maxLength ?? 1000,
            logAttempts: config.logAttempts ?? true,
            contextualAnalysis: config.contextualAnalysis ?? true,
            falsePositiveThreshold: config.falsePositiveThreshold ?? 0.6,
            proximityThreshold: config.proximityThreshold ?? 0.85,
        };
    }

    /**
     * Main detection method with improved false positive handling
     */
    detect(
        input: string | null | undefined,
        context?: string,
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
                result.detectedPatterns.push(
                    `Pattern Match: ${matches.join(", ")}`,
                );
                highRiskScore += 0.3;
            }
        });

        // 1. Medium risk patterns (accumulative)
        let mediumMatches = 0;
        this.mediumRiskPatterns.forEach((pattern) => {
            const matches = input.match(pattern);
            if (matches) {
                mediumMatches += matches.length;
            }
        });

        // Cap medium match contribution to prevent false positives in large structured data
        const maxMediumMatches = 20;
        const cappedMediumMatches = Math.min(mediumMatches, maxMediumMatches);
        let mediumRiskScore = cappedMediumMatches * 0.1;

        // 2. Proximity analysis (Levenshtein) - Complementary to regex
        const proximityScore = this.calculateMaxProximity(input);
        if (proximityScore > 0.4) {
            highRiskScore += proximityScore * 0.5;
            result.detectedPatterns.push(
                `Proximity Match (${Math.round(proximityScore * 100)}%)`,
            );
        }

        // Contextual analysis for legitimate use cases
        const legitimacyScore = this.calculateLegitimacyScore(input);

        // 3. Final confidence calculation
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
            context.toLowerCase().includes(ctx),
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

        // JSON check - Structured data often triggers false positives due to quotes/braces
        if (
            (input.startsWith("{") && input.endsWith("}")) ||
            (input.startsWith("[") && input.endsWith("]"))
        ) {
            try {
                // Quick check for JSON validity
                JSON.parse(input);
                legitimacyScore += 0.8; // Significant boost for valid JSON
            } catch (e) {
                // Not valid JSON, but maybe partial JSON
                if (input.includes('":') || input.includes('",')) {
                    legitimacyScore += 0.3;
                }
            }
        }

        // Natural language indicators
        const naturalWords = input.match(/\b[a-zA-Z]{3,}\b/g);
        if (naturalWords && naturalWords.length > 5) {
            legitimacyScore += 0.4; // More weight for clearly natural text
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
                legitimacyScore += 0.2;
            }
        });

        // Check for balanced quotes (legitimate text often has balanced quotes)
        const singleQuotes = (input.match(/'/g) || []).length;
        const doubleQuotes = (input.match(/"/g) || []).length;
        if (
            singleQuotes > 0 &&
            singleQuotes % 2 === 0 &&
            doubleQuotes % 2 === 0
        ) {
            legitimacyScore += 0.15;
        }

        return Math.min(legitimacyScore, 1.2); // Cap increased to allow full offset of medium risk
    }

    private calculateMaxProximity(input: string): number {
        const normalizedInput = input.toLowerCase().replace(/\s+/g, " ");
        let maxProximity = 0;

        // Optimized proximity check: only check near suspicious characters to save CPU
        const suspiciousIndices: number[] = [];
        for (let i = 0; i < input.length; i++) {
            if (
                ["'", '"', ";", "-", "#", "u", "s", "d"].includes(
                    input[i].toLowerCase(),
                )
            ) {
                suspiciousIndices.push(i);
            }
        }

        // Limit the number of checks for very large strings
        const maxChecks = 50;
        const stride = Math.ceil(suspiciousIndices.length / maxChecks);

        this.referencePayloads.forEach((payload) => {
            const normalizedPayload = payload.toLowerCase();
            const pLen = normalizedPayload.length;

            for (let i = 0; i < suspiciousIndices.length; i += stride) {
                const start = Math.max(0, suspiciousIndices[i] - 5);
                const end = Math.min(normalizedInput.length, start + pLen + 10);
                const chunk = normalizedInput.substring(start, end);

                if (chunk.length < pLen / 2) continue;

                const distance = this.levenshteinDistance(
                    normalizedPayload,
                    chunk,
                );
                const similarity = 1 - distance / Math.max(pLen, chunk.length);

                if (similarity > maxProximity) {
                    maxProximity = similarity;
                }
            }
        });

        return maxProximity;
    }

    private levenshteinDistance(a: string, b: string): number {
        const matrix: number[][] = [];

        for (let i = 0; i <= b.length; i++) {
            matrix[i] = [i];
        }

        for (let j = 0; j <= a.length; j++) {
            matrix[0][j] = j;
        }

        for (let i = 1; i <= b.length; i++) {
            for (let j = 1; j <= a.length; j++) {
                if (b.charAt(i - 1) === a.charAt(j - 1)) {
                    matrix[i][j] = matrix[i - 1][j - 1];
                } else {
                    matrix[i][j] = Math.min(
                        matrix[i - 1][j - 1] + 1, // substitution
                        matrix[i][j - 1] + 1, // insertion
                        matrix[i - 1][j] + 1, // deletion
                    );
                }
            }
        }

        return matrix[b.length][a.length];
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
            " $2",
        );

        return sanitized.trim();
    }

    /**
     * Validate and sanitize input, throwing error if malicious
     */
    validateAndSanitize(
        input: string,
        throwOnDetection: boolean = false,
    ): string {
        const result = this.detect(input);

        if (result.isMalicious && throwOnDetection) {
            throw new Error(
                `SQL injection attempt detected. Confidence: ${(
                    result.confidence * 100
                ).toFixed(1)}%. `,
                // +
                //     `Patterns: ${result.detectedPatterns.join(", ")}`
            );
        }

        return result.sanitizedInput || "";
    }

    /**
     * Create parameterized query helper
     */
    createParameterizedQuery(
        query: string,
        params: any[],
    ): { query: string; params: any[] } {
        // Simple parameterization helper
        let parameterizedQuery = query;
        const safeParams: any[] = [];

        params.forEach((param, index) => {
            if (typeof param === "string") {
                const result = this.detect(param);
                if (result.isMalicious) {
                    throw new Error(
                        `Parameter ${index} contains potential SQL injection`,
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

