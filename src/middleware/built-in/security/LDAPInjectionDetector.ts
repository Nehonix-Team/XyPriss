/**
 * LDAP Injection Detection Module
 * 
 * Detects and prevents LDAP injection attacks
 */

import { SecurityDetectionResult, SecurityModuleConfig } from './types';

class LDAPInjectionDetector {
    private config: Required<SecurityModuleConfig>;

    // LDAP injection patterns
    private readonly injectionPatterns = [
        // LDAP filter metacharacters
        /[*()\\|&]/g,
        
        // Null byte
        /\x00/g,
        
        // LDAP filter injection attempts
        /\)\s*\(\s*\|/gi, // )( | pattern
        /\)\s*\(\s*&/gi, // )( & pattern
        
        // Wildcard abuse
        /\*{2,}/g,
        
        // DN injection
        /,\s*(cn|ou|dc|o)=/gi,
    ];

    constructor(config: SecurityModuleConfig = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            strictMode: config.strictMode ?? false,
            logAttempts: config.logAttempts ?? true,
            blockOnDetection: config.blockOnDetection ?? true,
            falsePositiveThreshold: config.falsePositiveThreshold ?? 0.6,
            customPatterns: config.customPatterns ?? [],
        };
    }

    detect(input: string | null | undefined): SecurityDetectionResult {
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

        let riskScore = 0;
        this.injectionPatterns.forEach((pattern, index) => {
            const matches = input.match(pattern);
            if (matches) {
                result.detectedPatterns.push(`LDAP metacharacter: ${matches.join(', ')}`);
                riskScore += 0.3 * matches.length;
            }
        });

        result.confidence = Math.min(riskScore, 1.0);

        if (result.confidence >= 0.7) {
            result.riskLevel = 'HIGH';
            result.isMalicious = true;
        } else if (result.confidence >= this.config.falsePositiveThreshold) {
            result.riskLevel = 'MEDIUM';
            result.isMalicious = this.config.strictMode;
        }

        if (result.confidence >= 0.3) {
            result.sanitizedInput = this.sanitize(input);
        }

        if (this.config.logAttempts && result.confidence >= 0.6) {
            console.warn('[LDAP] Injection attempt detected:', {
                timestamp: new Date().toISOString(),
                input: input.substring(0, 100),
                confidence: result.confidence,
            });
        }

        return result;
    }

    private sanitize(input: string): string {
        // Escape LDAP special characters
        return input
            .replace(/\\/g, '\\5c')
            .replace(/\*/g, '\\2a')
            .replace(/\(/g, '\\28')
            .replace(/\)/g, '\\29')
            .replace(/\x00/g, '\\00');
    }

    updateConfig(newConfig: Partial<SecurityModuleConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig(): Required<SecurityModuleConfig> {
        return { ...this.config };
    }
}

export default LDAPInjectionDetector;
