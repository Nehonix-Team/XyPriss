/**
 * Path Traversal Detection Module
 * 
 * Detects and prevents directory traversal attacks with intelligent
 * false positive avoidance for legitimate file paths
 */

import { SecurityDetectionResult, SecurityModuleConfig, ContextInfo } from './types';

interface PathTraversalConfig extends SecurityModuleConfig {
    allowedPaths?: string[];
    allowedExtensions?: string[];
    maxDepth?: number;
}

class PathTraversalDetector {
    private config: Required<PathTraversalConfig>;

    // High-risk path traversal patterns
    private readonly highRiskPatterns = [
        // Classic traversal with multiple levels
        /(\.\.[\/\\]){2,}/g,
        
        // URL encoded traversal
        /(%2e%2e[\/\\]|%2e%2e%2f|%2e%2e%5c)/gi,
        
        // Double URL encoded
        /(%252e%252e[\/\\]|%252e%252e%252f)/gi,
        
        // Unicode/UTF-8 encoded
        /(\.\.%c0%af|\.\.%c1%9c)/gi,
        
        // Null byte injection
        /\.\.[\/\\].*%00/g,
        
        // Absolute paths (Unix/Windows)
        /^(\/|\\\\|[a-zA-Z]:\\)/,
        
        // System directories
        /(\/etc\/|\/proc\/|\/sys\/|\/dev\/|C:\\Windows\\|C:\\Program Files\\)/gi,
        
        // Traversal with encoded slashes
        /\.\.(%2f|%5c)/gi,
    ];

    // Medium-risk patterns (context-dependent)
    private readonly mediumRiskPatterns = [
        // Single parent directory reference
        /\.\.[\/\\]/g,
        
        // Hidden files (Unix)
        /\/\.[^\/]+/g,
        
        // Backup files
        /\.(bak|backup|old|tmp|swp)$/gi,
        
        // Config files
        /\.(conf|config|ini|env)$/gi,
    ];

    constructor(config: PathTraversalConfig = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            strictMode: config.strictMode ?? false,
            logAttempts: config.logAttempts ?? true,
            blockOnDetection: config.blockOnDetection ?? true,
            falsePositiveThreshold: config.falsePositiveThreshold ?? 0.6,
            customPatterns: config.customPatterns ?? [],
            allowedPaths: config.allowedPaths ?? [],
            allowedExtensions: config.allowedExtensions ?? ['.jpg', '.png', '.pdf', '.txt'],
            maxDepth: config.maxDepth ?? 3,
        };
    }

    /**
     * Detect path traversal attempts
     */
    detect(path: string | null | undefined, context?: ContextInfo): SecurityDetectionResult {
        if (!path || typeof path !== 'string') {
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
            sanitizedInput: path,
            riskLevel: 'LOW',
        };

        // Check if path is in allowed paths
        if (this.isAllowedPath(path)) {
            return result;
        }

        // High-risk pattern detection
        let highRiskScore = 0;
        this.highRiskPatterns.forEach((pattern, index) => {
            const matches = path.match(pattern);
            if (matches) {
                const patternName = this.getHighRiskPatternName(index);
                result.detectedPatterns.push(`${patternName}: ${matches.join(', ')}`);
                highRiskScore += 0.8;
            }
        });

        // Medium-risk pattern detection
        let mediumRiskScore = 0;
        this.mediumRiskPatterns.forEach((pattern) => {
            const matches = path.match(pattern);
            if (matches) {
                mediumRiskScore += 0.2 * matches.length;
            }
        });

        // Calculate depth
        const depth = this.calculatePathDepth(path);
        if (depth > this.config.maxDepth) {
            result.detectedPatterns.push(`Excessive depth: ${depth}`);
            mediumRiskScore += 0.3;
        }

        // Legitimacy checks
        const legitimacyScore = this.calculateLegitimacyScore(path);

        // Calculate final confidence
        result.confidence = Math.max(0, highRiskScore + mediumRiskScore * 0.4 - legitimacyScore);
        result.confidence = Math.min(result.confidence, 1.0);

        // Determine risk level
        if (result.confidence >= 0.8) {
            result.riskLevel = 'CRITICAL';
            result.isMalicious = true;
        } else if (result.confidence >= this.config.falsePositiveThreshold) {
            result.riskLevel = 'HIGH';
            result.isMalicious = true;
        } else if (result.confidence >= 0.3) {
            result.riskLevel = 'MEDIUM';
            result.isMalicious = false;
        }

        // Sanitize path
        if (result.confidence >= 0.3) {
            result.sanitizedInput = this.sanitizePath(path);
        }

        // Log attempts
        if (this.config.logAttempts && result.confidence >= 0.7) {
            this.logAttempt(path, result);
        }

        return result;
    }

    /**
     * Sanitize path by removing traversal sequences
     */
    private sanitizePath(path: string): string {
        let sanitized = path;

        // Remove all traversal sequences
        sanitized = sanitized.replace(/\.\.[\/\\]/g, '');
        
        // Remove URL encoded traversal
        sanitized = sanitized.replace(/%2e%2e[\/\\%]/gi, '');
        
        // Remove null bytes
        sanitized = sanitized.replace(/%00/g, '');
        
        // Normalize slashes
        sanitized = sanitized.replace(/[\\]/g, '/');
        
        // Remove duplicate slashes
        sanitized = sanitized.replace(/\/+/g, '/');
        
        // Remove leading slash if present
        sanitized = sanitized.replace(/^\//, '');

        return sanitized;
    }

    /**
     * Check if path is in allowed paths
     */
    private isAllowedPath(path: string): boolean {
        return this.config.allowedPaths.some(allowed => 
            path.startsWith(allowed)
        );
    }

    /**
     * Calculate path depth
     */
    private calculatePathDepth(path: string): number {
        const normalized = path.replace(/[\\]/g, '/');
        const parts = normalized.split('/').filter(p => p && p !== '.');
        return parts.length;
    }

    /**
     * Calculate legitimacy score
     */
    private calculateLegitimacyScore(path: string): number {
        let score = 0;

        // Check for allowed extensions
        const hasAllowedExt = this.config.allowedExtensions.some(ext => 
            path.toLowerCase().endsWith(ext)
        );
        if (hasAllowedExt) {
            score += 0.3;
        }

        // Simple filename pattern (no traversal)
        if (/^[a-zA-Z0-9_\-\.]+$/.test(path)) {
            score += 0.3;
        }

        // Reasonable path depth
        const depth = this.calculatePathDepth(path);
        if (depth <= 2) {
            score += 0.2;
        }

        return Math.min(score, 0.5);
    }

    private getHighRiskPatternName(index: number): string {
        const names = [
            'Multiple traversal sequences',
            'URL encoded traversal',
            'Double URL encoded traversal',
            'Unicode encoded traversal',
            'Null byte injection',
            'Absolute path',
            'System directory access',
            'Encoded slash traversal',
        ];
        return names[index] || `High-risk pattern ${index}`;
    }

    private logAttempt(path: string, result: SecurityDetectionResult): void {
        console.warn('[PathTraversal] Attack detected:', {
            timestamp: new Date().toISOString(),
            path: path.substring(0, 100),
            confidence: result.confidence,
            patterns: result.detectedPatterns,
        });
    }

    updateConfig(newConfig: Partial<PathTraversalConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig(): Required<PathTraversalConfig> {
        return { ...this.config };
    }
}

export default PathTraversalDetector;
