/**
 * Random security - Advanced security features and monitoring
 * Optimized for real-world applications
 */

import * as crypto from "crypto";
import { SecurityLevel } from "../../types";
import {
    EntropyQuality,
    SecurityMonitoringResult,
    RandomGenerationOptions,
} from "./random-types";
import { RandomEntropy } from "./random-entropy";
import { RandomSources } from "./random-sources";

export class RandomSecurity {
    private static securityAlerts: string[] = [];
    private static lastSecurityCheck: number = Date.now();
    private static threatLevel: "low" | "medium" | "high" | "critical" = "low";
    private static monitoringEnabled = false;
    private static monitoringInterval: NodeJS.Timeout | null = null;

    /**
     * Perform comprehensive security assessment
     * @param data - Data to assess (optional)
     * @returns Security monitoring result
     */
    public static performSecurityAssessment(
        data?: Buffer
    ): SecurityMonitoringResult {
        const timestamp = Date.now();
        const libraryStatus = RandomSources.getLibraryStatus();

        // Analyze entropy if data provided
        let entropyQuality = EntropyQuality.GOOD;
        if (data && data.length > 0) {
            entropyQuality = RandomEntropy.assessEntropyQuality(data);
        }

        // Assess threats
        const threats = this.assessThreats(libraryStatus, entropyQuality);

        // Generate recommendations
        const recommendations = this.generateRecommendations(
            threats,
            libraryStatus
        );

        // Determine security level
        const securityLevel = this.determineSecurityLevel(
            threats,
            entropyQuality
        );

        this.lastSecurityCheck = timestamp;

        return {
            entropyQuality,
            securityLevel,
            threats,
            recommendations,
            timestamp,
            bytesGenerated: 0,
            reseedCount: 0,
            libraryStatus,
        };
    }

    /**
     * Assess current threats based on real-world security concerns
     */
    private static assessThreats(
        libraryStatus: any,
        entropyQuality: EntropyQuality
    ): string[] {
        const threats: string[] = [];

        // Reset threat level for fresh assessment
        this.threatLevel = "low";

        // Critical entropy quality issues
        if (entropyQuality === EntropyQuality.POOR) {
            threats.push(
                "Critical entropy quality - immediate attention required"
            );
            this.threatLevel = "critical";
        } else if (entropyQuality === EntropyQuality.FAIR) {
            threats.push("Suboptimal entropy quality detected");
            this.updateThreatLevel("medium");
        }

        // Entropy source availability
        if (libraryStatus && typeof libraryStatus === "object") {
            const availableLibraries =
                Object.values(libraryStatus).filter(Boolean).length;
            if (availableLibraries === 0) {
                threats.push("No enhanced entropy sources available");
                this.threatLevel = "critical";
            } else if (availableLibraries === 1) {
                threats.push("Single point of failure in entropy sources");
                this.updateThreatLevel("medium");
            }
        }

        // Platform-specific entropy checks
        if (!this.isSecureRandomAvailable()) {
            threats.push("Secure random generation not available");
            this.threatLevel = "critical";
        }

        // Performance-based risk assessment
        if (this.detectHighFrequencyUsage()) {
            threats.push("High-frequency random generation detected");
            this.updateThreatLevel("medium");
        }

        return threats;
    }

    /**
     * Generate actionable security recommendations
     */
    private static generateRecommendations(
        threats: string[],
        libraryStatus: any
    ): string[] {
        const recommendations: string[] = [];

        // Entropy quality recommendations
        if (threats.some((t) => t.includes("entropy quality"))) {
            recommendations.push("Implement entropy pooling and mixing");
            recommendations.push("Consider hardware security modules");
        }

        // Source diversity recommendations
        if (
            threats.some(
                (t) =>
                    t.includes("entropy sources") || t.includes("Single point")
            )
        ) {
            recommendations.push("Diversify entropy sources");
            recommendations.push("Implement entropy source failover");
        }

        // Platform security recommendations
        if (threats.some((t) => t.includes("Secure random"))) {
            recommendations.push("Upgrade to secure random generation");
            recommendations.push("Verify cryptographic library versions");
        }

        // Performance recommendations
        if (threats.some((t) => t.includes("High-frequency"))) {
            recommendations.push("Implement entropy caching");
            recommendations.push("Use batch random generation");
        }

        // Default recommendation for secure systems
        if (threats.length === 0) {
            recommendations.push("Maintain current security practices");
            recommendations.push("Schedule regular security assessments");
        }

        return recommendations;
    }

    /**
     * Determine security level based on threat assessment
     */
    private static determineSecurityLevel(
        threats: string[],
        entropyQuality: EntropyQuality
    ): SecurityLevel {
        // Critical threats require immediate attention
        if (this.threatLevel === "critical") {
            return SecurityLevel.STANDARD; // Fallback to standard until issues resolved
        }

        // High-quality entropy deserves maximum security
        if (
            entropyQuality === EntropyQuality.MILITARY &&
            threats.length === 0
        ) {
            return SecurityLevel.MAXIMUM;
        }

        // Medium threats or fair entropy
        if (
            this.threatLevel === "medium" ||
            entropyQuality === EntropyQuality.FAIR
        ) {
            return SecurityLevel.HIGH;
        }

        // Default to high security for good entropy
        return SecurityLevel.HIGH;
    }

    /**
     * Check if secure random generation is available
     */
    private static isSecureRandomAvailable(): boolean {
        try {
            // Node.js crypto module
            if (typeof crypto !== "undefined" && crypto.randomBytes) {
                crypto.randomBytes(1); // Test generation
                return true;
            }

            // Browser Web Crypto API
            if (
                typeof window !== "undefined" &&
                window.crypto?.getRandomValues
            ) {
                const test = new Uint8Array(1);
                window.crypto.getRandomValues(test);
                return true;
            }

            return false;
        } catch (error) {
            return false;
        }
    }

    /**
     * Detect high-frequency usage patterns
     */
    private static detectHighFrequencyUsage(): boolean {
        const now = Date.now();
        const timeSinceLastCheck = now - this.lastSecurityCheck;

        // Consider high frequency if called more than once per 50ms
        return timeSinceLastCheck < 50;
    }

    /**
     * Update threat level (only escalate, never de-escalate)
     */
    private static updateThreatLevel(newLevel: "medium" | "high"): void {
        const levels = { low: 0, medium: 1, high: 2, critical: 3 };
        if (levels[newLevel] > levels[this.threatLevel]) {
            this.threatLevel = newLevel;
        }
    }

    /**
     * Monitor for side-channel attacks with real-world heuristics
     */
    public static monitorSideChannelAttacks(data: Buffer): {
        riskLevel: "low" | "medium" | "high";
        indicators: string[];
        recommendations: string[];
    } {
        const indicators: string[] = [];
        const recommendations: string[] = [];
        let riskLevel: "low" | "medium" | "high" = "low";

        if (!data || data.length === 0) {
            return { riskLevel, indicators, recommendations };
        }

        // Statistical analysis for bias detection
        const entropy = this.calculateShannonEntropy(data);
        if (entropy < 7.5) {
            // Good entropy should be close to 8 bits
            indicators.push("Low entropy detected in random data");
            riskLevel = "medium";
            recommendations.push("Investigate entropy source quality");
        }

        // Frequency analysis for bias
        const frequencies = new Uint32Array(256);
        for (const byte of data) {
            frequencies[byte]++;
        }

        const expectedFreq = data.length / 256;
        const maxDeviation = Math.max(...frequencies) / expectedFreq;

        if (maxDeviation > 2.0) {
            indicators.push("Statistical bias detected");
            riskLevel = "high";
            recommendations.push("Implement entropy whitening");
        }

        // Timing analysis
        const now = Date.now();
        if (now - this.lastSecurityCheck < 10) {
            indicators.push("Potential timing attack pattern");
            riskLevel = "high";
            recommendations.push("Implement timing attack countermeasures");
        }

        return { riskLevel, indicators, recommendations };
    }

    /**
     * Calculate Shannon entropy for data quality assessment
     */
    private static calculateShannonEntropy(data: Buffer): number {
        const frequencies = new Uint32Array(256);
        for (const byte of data) {
            frequencies[byte]++;
        }

        let entropy = 0;
        const length = data.length;

        for (let i = 0; i < 256; i++) {
            if (frequencies[i] > 0) {
                const probability = frequencies[i] / length;
                entropy -= probability * Math.log2(probability);
            }
        }

        return entropy;
    }

    /**
     * Validate entropy source integrity
     */
    public static validateEntropySourceIntegrity(sourceName: string): {
        valid: boolean;
        confidence: number;
        issues: string[];
    } {
        const issues: string[] = [];
        let confidence = 1.0;

        try {
            // Basic availability test
            const testResult =
                RandomSources.testEntropySource?.(sourceName) ?? false;

            if (!testResult) {
                issues.push(
                    `Entropy source '${sourceName}' unavailable or failed test`
                );
                confidence = 0.0;
            }

            // Additional validation could include:
            // - Statistical tests (NIST SP 800-22)
            // - Performance benchmarks
            // - Compliance verification
        } catch (error) {
            issues.push(
                `Entropy source validation error: ${
                    error instanceof Error ? error.message : String(error)
                }`
            );
            confidence = 0.0;
        }

        return {
            valid: issues.length === 0 && confidence > 0.5,
            confidence,
            issues,
        };
    }

    /**
     * Generate comprehensive security report
     */
    public static generateSecurityReport(includeDetails: boolean = false): {
        summary: string;
        threatLevel: string;
        recommendations: string[];
        details?: any;
    } {
        const assessment = this.performSecurityAssessment();

        const summary =
            assessment.threats.length === 0
                ? "Security posture is acceptable with no critical issues detected."
                : `Security assessment identified ${assessment.threats.length} issue(s) requiring attention.`;

        const report = {
            summary,
            threatLevel: this.threatLevel,
            recommendations: assessment.recommendations,
        };

        if (includeDetails) {
            (report as any).details = {
                entropyQuality: assessment.entropyQuality,
                securityLevel: assessment.securityLevel,
                threats: assessment.threats,
                libraryStatus: assessment.libraryStatus,
                timestamp: assessment.timestamp,
                lastSecurityCheck: this.lastSecurityCheck,
            };
        }

        return report;
    }

    /**
     * Enable security monitoring with configurable interval
     */
    public static enableSecurityMonitoring(intervalMs: number = 300000): void {
        // 5 minutes default
        if (this.monitoringEnabled) {
            return;
        }

        this.monitoringEnabled = true;
        this.monitoringInterval = setInterval(() => {
            try {
                const assessment = this.performSecurityAssessment();

                if (assessment.threats.length > 0) {
                    const criticalThreats = assessment.threats.filter(
                        (t) => t.includes("Critical") || t.includes("critical")
                    );

                    if (criticalThreats.length > 0) {
                        console.error(
                            "CRITICAL Security Alert:",
                            criticalThreats
                        );
                    } else {
                        console.warn("Security Alert:", assessment.threats);
                    }

                    this.securityAlerts.push(...assessment.threats);
                }
            } catch (error) {
                console.error("Security monitoring error:", error);
            }
        }, intervalMs);
    }

    /**
     * Disable security monitoring
     */
    public static disableSecurityMonitoring(): void {
        if (this.monitoringInterval) {
            clearInterval(this.monitoringInterval);
            this.monitoringInterval = null;
        }
        this.monitoringEnabled = false;
    }

    /**
     * Get security alerts
     */
    public static getSecurityAlerts(): string[] {
        return [...this.securityAlerts];
    }

    /**
     * Clear security alerts
     */
    public static clearSecurityAlerts(): void {
        this.securityAlerts = [];
    }

    /**
     * Get current threat level
     */
    public static getThreatLevel(): "low" | "medium" | "high" | "critical" {
        return this.threatLevel;
    }

    /**
     * Assess quantum readiness with realistic recommendations
     */
    public static assessQuantumReadiness(): {
        ready: boolean;
        score: number;
        recommendations: string[];
        algorithms: {
            name: string;
            quantumSafe: boolean;
            available: boolean;
        }[];
    } {
        const algorithms = [
            { name: "AES-256", quantumSafe: false, available: true },
            { name: "ChaCha20", quantumSafe: false, available: true },
            { name: "RSA-2048", quantumSafe: false, available: true },
            { name: "ECDSA", quantumSafe: false, available: true },
            { name: "Kyber", quantumSafe: true, available: false },
            { name: "Dilithium", quantumSafe: true, available: false },
            { name: "SPHINCS+", quantumSafe: true, available: false },
        ];

        const availableAlgorithms = algorithms.filter((a) => a.available);
        const quantumSafeAvailable = availableAlgorithms.filter(
            (a) => a.quantumSafe
        );

        const score =
            availableAlgorithms.length > 0
                ? (quantumSafeAvailable.length / availableAlgorithms.length) *
                  100
                : 0;

        const ready = score >= 25; // More realistic threshold

        const recommendations: string[] = [];
        if (!ready) {
            recommendations.push(
                "Evaluate post-quantum cryptography libraries"
            );
            recommendations.push("Plan quantum-safe migration strategy");
            recommendations.push("Monitor NIST post-quantum standards");
        } else {
            recommendations.push(
                "Continue monitoring quantum computing developments"
            );
            recommendations.push("Test quantum-safe implementations");
        }

        return {
            ready,
            score: Math.round(score),
            recommendations,
            algorithms,
        };
    }

    /**
     * Get monitoring status
     */
    public static getMonitoringStatus(): {
        enabled: boolean;
        lastCheck: number;
        alertCount: number;
        threatLevel: string;
    } {
        return {
            enabled: this.monitoringEnabled,
            lastCheck: this.lastSecurityCheck,
            alertCount: this.securityAlerts.length,
            threatLevel: this.threatLevel,
        };
    }
}

