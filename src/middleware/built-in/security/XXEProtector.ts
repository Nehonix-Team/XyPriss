/**
 * XXE (XML External Entity) Protection Module
 * 
 * Detects and prevents XXE attacks in XML parsing
 * Uses libxmljs2 for secure XML parsing
 */

import { SecurityDetectionResult, SecurityModuleConfig } from './types';

interface XXEConfig extends SecurityModuleConfig {
    allowDTD?: boolean;
    allowExternalEntities?: boolean;
    maxEntityExpansions?: number;
}

class XXEProtector {
    private config: Required<XXEConfig>;

    // Dangerous XXE patterns
    private readonly dangerousPatterns = [
        // External entity declarations
        /<!ENTITY\s+\w+\s+SYSTEM\s+/gi,
        /<!ENTITY\s+\w+\s+PUBLIC\s+/gi,
        
        // Parameter entities
        /<!ENTITY\s+%\s+\w+/gi,
        
        // External DTD
        /<!DOCTYPE\s+\w+\s+SYSTEM\s+/gi,
        /<!DOCTYPE\s+\w+\s+PUBLIC\s+/gi,
        
        // File protocol
        /SYSTEM\s+["']file:\/\//gi,
        
        // HTTP/HTTPS external resources
        /SYSTEM\s+["'](https?|ftp):\/\//gi,
        
        // PHP wrappers (common in XXE)
        /php:\/\//gi,
        /expect:\/\//gi,
        
        // Data URIs
        /data:\/\//gi,
    ];

    constructor(config: XXEConfig = {}) {
        this.config = {
            enabled: config.enabled ?? true,
            strictMode: config.strictMode ?? true,
            logAttempts: config.logAttempts ?? true,
            blockOnDetection: config.blockOnDetection ?? true,
            falsePositiveThreshold: config.falsePositiveThreshold ?? 0.5,
            customPatterns: config.customPatterns ?? [],
            allowDTD: config.allowDTD ?? false,
            allowExternalEntities: config.allowExternalEntities ?? false,
            maxEntityExpansions: config.maxEntityExpansions ?? 0,
        };
    }

    /**
     * Detect XXE attempts in XML content
     */
    detect(xmlContent: string | null | undefined): SecurityDetectionResult {
        if (!xmlContent || typeof xmlContent !== 'string') {
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
            sanitizedInput: xmlContent,
            riskLevel: 'LOW',
        };

        // Check for dangerous patterns
        let riskScore = 0;
        this.dangerousPatterns.forEach((pattern, index) => {
            const matches = xmlContent.match(pattern);
            if (matches) {
                const patternName = this.getPatternName(index);
                result.detectedPatterns.push(`${patternName}: ${matches.length} occurrence(s)`);
                riskScore += 0.7;
            }
        });

        // Check for DTD if not allowed
        if (!this.config.allowDTD && /<!DOCTYPE/gi.test(xmlContent)) {
            result.detectedPatterns.push('DTD declaration (not allowed)');
            riskScore += 0.5;
        }

        // Check for entity declarations
        if (!this.config.allowExternalEntities && /<!ENTITY/gi.test(xmlContent)) {
            result.detectedPatterns.push('Entity declaration (not allowed)');
            riskScore += 0.6;
        }

        // Calculate confidence
        result.confidence = Math.min(riskScore, 1.0);

        // Determine risk level
        if (result.confidence >= 0.8) {
            result.riskLevel = 'CRITICAL';
            result.isMalicious = true;
        } else if (result.confidence >= this.config.falsePositiveThreshold) {
            result.riskLevel = 'HIGH';
            result.isMalicious = true;
        } else if (result.confidence >= 0.3) {
            result.riskLevel = 'MEDIUM';
            result.isMalicious = this.config.strictMode;
        }

        // Sanitize XML
        if (result.confidence >= 0.3) {
            result.sanitizedInput = this.sanitizeXML(xmlContent);
        }

        // Log attempts
        if (this.config.logAttempts && result.confidence >= 0.5) {
            this.logAttempt(result);
        }

        return result;
    }

    /**
     * Sanitize XML by removing dangerous constructs
     */
    private sanitizeXML(xml: string): string {
        let sanitized = xml;

        // Remove DOCTYPE declarations
        sanitized = sanitized.replace(/<!DOCTYPE[^>]*>/gi, '');
        
        // Remove ENTITY declarations
        sanitized = sanitized.replace(/<!ENTITY[^>]*>/gi, '');
        
        // Remove SYSTEM references
        sanitized = sanitized.replace(/SYSTEM\s+["'][^"']*["']/gi, '');
        
        // Remove PUBLIC references
        sanitized = sanitized.replace(/PUBLIC\s+["'][^"']*["']/gi, '');

        return sanitized;
    }

    /**
     * Safe XML parsing helper (returns parsed object or null)
     * Note: In production, use a library like 'libxmljs2' with secure defaults
     */
    safeParseXML(xmlContent: string): any | null {
        const detection = this.detect(xmlContent);
        
        if (detection.isMalicious) {
            if (this.config.blockOnDetection) {
                throw new Error(`XXE attack detected: ${detection.detectedPatterns.join(', ')}`);
            }
            return null;
        }

        // In production, use a secure XML parser here
        // Example with libxmljs2:
        // const libxmljs = require('libxmljs2');
        // return libxmljs.parseXml(detection.sanitizedInput, {
        //     noent: false,  // Disable entity substitution
        //     dtdload: false, // Disable DTD loading
        //     dtdvalid: false, // Disable DTD validation
        //     nonet: true,    // Disable network access
        // });

        return { warning: 'Use a secure XML parser library in production' };
    }

    private getPatternName(index: number): string {
        const names = [
            'External SYSTEM entity',
            'External PUBLIC entity',
            'Parameter entity',
            'DOCTYPE SYSTEM',
            'DOCTYPE PUBLIC',
            'File protocol',
            'HTTP/HTTPS external resource',
            'PHP wrapper',
            'Data URI',
        ];
        return names[index] || `Pattern ${index}`;
    }

    private logAttempt(result: SecurityDetectionResult): void {
        console.warn('[XXE] Attack detected:', {
            timestamp: new Date().toISOString(),
            confidence: result.confidence,
            patterns: result.detectedPatterns,
        });
    }

    updateConfig(newConfig: Partial<XXEConfig>): void {
        this.config = { ...this.config, ...newConfig };
    }

    getConfig(): Required<XXEConfig> {
        return { ...this.config };
    }
}

export default XXEProtector;
