/**
 * Command Injection Detection Module
 * 
 * Detects and prevents OS command injection attacks with
 * intelligent context-aware false positive reduction
 */

import { SecurityDetectionResult, SecurityModuleConfig, ContextInfo } from './types';

interface CommandInjectionConfig extends SecurityModuleConfig {
    allowedCommands?: string[];
    contextualAnalysis?: boolean;
}

class CommandInjectionDetector {
    private config: Required<CommandInjectionConfig>;

    // High-risk command injection patterns
    private readonly highRiskPatterns = [
        // Command chaining
        /[;&|`]\s*(ls|cat|wget|curl|nc|netcat|bash|sh|cmd|powershell|eval|exec)/gi,
        
        // Command substitution
        /\$\(.*?\)/g,
        /`.*?`/g,
        
        // Pipe to dangerous commands
        /\|\s*(bash|sh|cmd|powershell|python|perl|ruby|node)/gi,
        
        // Redirection with dangerous commands
        /[<>]\s*(\/etc\/|\/bin\/|C:\\)/gi,
        
        // Encoded command injection
        /%0a|%0d|%09/gi, // newline, carriage return, tab
        
        // Dangerous system commands
        /(rm\s+-rf|del\s+\/|format\s+|mkfs|dd\s+if=)/gi,
        
        // Network commands
        /(wget|curl|nc|netcat|telnet|ssh|ftp)\s+/gi,
        
        // Eval/exec patterns
        /(eval|exec|system|passthru|shell_exec|popen)\s*\(/gi,
    ];

    // Medium-risk patterns
    private readonly mediumRiskPatterns = [
        // Shell metacharacters
        /[;&|`$()]/g,
        
        // Redirection operators
        /[<>]/g,
        
        // Common command names (could be legitimate text)
        /\b(ls|cat|echo|pwd|cd|mkdir|touch|grep|find|chmod|chown)\b/gi,
    ];

    constructor(config: CommandInjectionConfig = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            strictMode: config.strictMode ?? false,
            logAttempts: config.logAttempts ?? true,
            blockOnDetection: config.blockOnDetection ?? true,
            falsePositiveThreshold: config.falsePositiveThreshold ?? 0.7,
            customPatterns: config.customPatterns ?? [],
            allowedCommands: config.allowedCommands ?? [],
            contextualAnalysis: config.contextualAnalysis ?? true,
        };
    }

    /**
     * Detect command injection attempts
     */
    detect(input: string | null | undefined, context?: ContextInfo): SecurityDetectionResult {
        if (!input || typeof input !== 'string') {
            return {
                isMalicious: false,
                confidence: 0,
                detectedPatterns: [],
                riskLevel: 'LOW',
            };
        }

        const result: SecurityDetectionResult = {
            isMalicious: false,
            confidence: 0,
            detectedPatterns: [],
            sanitizedInput: input,
            riskLevel: 'LOW',
        };

        // High-risk pattern detection
        let highRiskScore = 0;
        this.highRiskPatterns.forEach((pattern, index) => {
            const matches = input.match(pattern);
            if (matches) {
                const patternName = this.getHighRiskPatternName(index);
                result.detectedPatterns.push(`${patternName}: ${matches.join(', ')}`);
                highRiskScore += this.getHighRiskWeight(index);
            }
        });

        // Medium-risk pattern detection with context
        let mediumRiskScore = 0;
        if (this.config.contextualAnalysis && context) {
            mediumRiskScore = this.analyzeContext(input, context);
        } else {
            this.mediumRiskPatterns.forEach((pattern) => {
                const matches = input.match(pattern);
                if (matches) {
                    mediumRiskScore += 0.1 * matches.length;
                }
            });
        }

        // Legitimacy checks
        const legitimacyScore = this.calculateLegitimacyScore(input);

        // Calculate final confidence
        result.confidence = Math.max(0, highRiskScore + mediumRiskScore * 0.3 - legitimacyScore);
        result.confidence = Math.min(result.confidence, 1.0);

        // Determine risk level
        if (result.confidence >= 0.9) {
            result.riskLevel = 'CRITICAL';
            result.isMalicious = true;
        } else if (result.confidence >= this.config.falsePositiveThreshold) {
            result.riskLevel = 'HIGH';
            result.isMalicious = true;
        } else if (result.confidence >= 0.4) {
            result.riskLevel = 'MEDIUM';
            result.isMalicious = false;
        }

        // Sanitize input
        if (result.confidence >= 0.4) {
            result.sanitizedInput = this.sanitizeInput(input);
        }

        // Log attempts
        if (this.config.logAttempts && result.confidence >= 0.7) {
            this.logAttempt(input, result);
        }

        return result;
    }

    /**
     * Sanitize input by removing command injection sequences
     */
    private sanitizeInput(input: string): string {
        let sanitized = input;

        // Remove command chaining characters
        sanitized = sanitized.replace(/[;&|`]/g, '');
        
        // Remove command substitution
        sanitized = sanitized.replace(/\$\(.*?\)/g, '');
        
        // Remove backticks
        sanitized = sanitized.replace(/`/g, '');
        
        // Remove redirection operators
        sanitized = sanitized.replace(/[<>]/g, '');
        
        // Remove encoded newlines/tabs
        sanitized = sanitized.replace(/%0a|%0d|%09/gi, '');

        return sanitized.trim();
    }

    /**
     * Analyze context to reduce false positives
     */
    private analyzeContext(input: string, context: ContextInfo): number {
        let score = 0;

        // Check if this is a code/technical field where commands might be legitimate
        const technicalContexts = ['code', 'script', 'command', 'terminal', 'shell'];
        const isTechnicalContext = technicalContexts.some(ctx =>
            context.fieldName?.toLowerCase().includes(ctx) ||
            context.fieldType?.toLowerCase().includes(ctx)
        );

        this.mediumRiskPatterns.forEach((pattern, index) => {
            const matches = input.match(pattern);
            if (matches) {
                let patternScore = 0.1 * matches.length;

                // Reduce score for technical contexts
                if (isTechnicalContext && index > 1) {
                    patternScore *= 0.2; // Reduce by 80% for command names in technical fields
                }

                score += patternScore;
            }
        });

        return score;
    }

    /**
     * Calculate legitimacy score
     */
    private calculateLegitimacyScore(input: string): number {
        let score = 0;

        // Natural language indicators
        const words = input.split(/\s+/);
        if (words.length > 3 && words.every(w => /^[a-zA-Z]+$/.test(w))) {
            score += 0.3; // Looks like natural text
        }

        // No shell metacharacters
        if (!/[;&|`$()<>]/.test(input)) {
            score += 0.2;
        }

        // Reasonable length for user input
        if (input.length > 10 && input.length < 200) {
            score += 0.1;
        }

        return Math.min(score, 0.5);
    }

    private getHighRiskPatternName(index: number): string {
        const names = [
            'Command chaining',
            'Command substitution ($())',
            'Backtick substitution',
            'Pipe to shell',
            'Redirection to system paths',
            'Encoded injection',
            'Dangerous system commands',
            'Network commands',
            'Eval/exec functions',
        ];
        return names[index] || `High-risk pattern ${index}`;
    }

    private getHighRiskWeight(index: number): number {
        const weights = [0.9, 0.9, 0.9, 0.8, 0.7, 0.6, 0.9, 0.7, 0.9];
        return weights[index] || 0.7;
    }

    private logAttempt(input: string, result: SecurityDetectionResult): void {
        console.warn('[CommandInjection] Attack detected:', {
            timestamp: new Date().toISOString(),
            input: input.substring(0, 100),
            confidence: result.confidence,
            patterns: result.detectedPatterns,
        });
    }

    updateConfig(newConfig: Partial<CommandInjectionConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig(): Required<CommandInjectionConfig> {
        return { ...this.config };
    }
}

export default CommandInjectionDetector;
