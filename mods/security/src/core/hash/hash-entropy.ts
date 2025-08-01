/**
 * Hash entropy analysis and quality assessment
 */

import * as crypto from "crypto";
import { HashEntropyAnalysis } from "./hash-types";

export class HashEntropy {
    /**
     * Advanced entropy analysis for hash quality assessment
     * @param data - Data to analyze
     * @returns Entropy analysis results
     */
    public static analyzeHashEntropy(
        data: Buffer | Uint8Array
    ): HashEntropyAnalysis {
        const buffer = Buffer.isBuffer(data) ? data : Buffer.from(data);
        const recommendations: string[] = []; 

        // Shannon entropy calculation
        const frequency = new Map<number, number>();
        for (const byte of buffer) {
            frequency.set(byte, (frequency.get(byte) || 0) + 1);
        }

        let shannonEntropy = 0;
        const length = buffer.length;
        for (const count of frequency.values()) {
            const probability = count / length;
            shannonEntropy -= probability * Math.log2(probability);
        }

        // Min-entropy (worst-case entropy)
        const maxFreq = Math.max(...frequency.values());
        const minEntropy = -Math.log2(maxFreq / length);

        // Compression ratio test
        const compressed = crypto.createHash("sha256").update(buffer).digest();
        const compressionRatio = compressed.length / buffer.length;

        // Chi-square test for randomness
        const expected = length / 256;
        let chiSquare = 0;
        for (let i = 0; i < 256; i++) {
            const observed = frequency.get(i) || 0;
            chiSquare += Math.pow(observed - expected, 2) / expected;
        }
        const randomnessScore = Math.max(0, 1 - chiSquare / (256 * 4));

        // Quality assessment
        let qualityGrade: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
        if (shannonEntropy > 7.8 && randomnessScore > 0.9) {
            qualityGrade = "EXCELLENT";
        } else if (shannonEntropy > 7.5 && randomnessScore > 0.8) {
            qualityGrade = "GOOD";
        } else if (shannonEntropy > 7.0 && randomnessScore > 0.6) {
            qualityGrade = "FAIR";
        } else {
            qualityGrade = "POOR";
            recommendations.push("Consider using stronger entropy sources");
        }

        if (minEntropy < 6) {
            recommendations.push(
                "Min-entropy is low, consider additional randomization"
            );
        }

        if (compressionRatio > 0.8) {
            recommendations.push(
                "Data shows patterns, consider additional mixing"
            );
        }

        return {
            shannonEntropy,
            minEntropy,
            compressionRatio,
            randomnessScore,
            qualityGrade,
            recommendations,
        };
    }

    /**
     * Perform statistical randomness tests
     * @param data - Data to test
     * @returns Test results
     */
    public static performRandomnessTests(data: Buffer): {
        monobitTest: { passed: boolean; score: number };
        runsTest: { passed: boolean; score: number };
        frequencyTest: { passed: boolean; score: number };
        serialTest: { passed: boolean; score: number };
        overallScore: number;
    } {
        // Monobit test (frequency of 1s and 0s in binary representation)
        const monobitResult = HashEntropy.monobitTest(data);

        // Runs test (sequences of consecutive identical bits)
        const runsResult = HashEntropy.runsTest(data);

        // Frequency test (distribution of byte values)
        const frequencyResult = HashEntropy.frequencyTest(data);

        // Serial test (correlation between consecutive bytes)
        const serialResult = HashEntropy.serialTest(data);

        // Calculate overall score
        const scores = [
            monobitResult.score,
            runsResult.score,
            frequencyResult.score,
            serialResult.score,
        ];
        const overallScore =
            scores.reduce((sum, score) => sum + score, 0) / scores.length;

        return {
            monobitTest: monobitResult,
            runsTest: runsResult,
            frequencyTest: frequencyResult,
            serialTest: serialResult,
            overallScore,
        };
    }

    /**
     * Monobit test - checks balance of 0s and 1s
     * @param data - Data to test
     * @returns Test result
     */
    private static monobitTest(data: Buffer): {
        passed: boolean;
        score: number;
    } {
        let ones = 0;
        let total = 0;

        for (const byte of data) {
            for (let i = 0; i < 8; i++) {
                if ((byte >> i) & 1) {
                    ones++;
                }
                total++;
            }
        }

        const ratio = ones / total;
        const deviation = Math.abs(ratio - 0.5);
        const score = Math.max(0, 1 - deviation * 4); // Scale deviation to 0-1
        const passed = deviation < 0.1; // Within 10% of expected

        return { passed, score };
    }

    /**
     * Runs test - checks for proper distribution of runs
     * @param data - Data to test
     * @returns Test result
     */
    private static runsTest(data: Buffer): { passed: boolean; score: number } {
        const bits: number[] = [];

        // Convert to bit array
        for (const byte of data) {
            for (let i = 0; i < 8; i++) {
                bits.push((byte >> i) & 1);
            }
        }

        // Count runs
        let runs = 1;
        for (let i = 1; i < bits.length; i++) {
            if (bits[i] !== bits[i - 1]) {
                runs++;
            }
        }

        // Expected number of runs
        const n = bits.length;
        const ones = bits.filter((bit) => bit === 1).length;
        const expectedRuns = (2 * ones * (n - ones)) / n + 1;

        const deviation = Math.abs(runs - expectedRuns) / expectedRuns;
        const score = Math.max(0, 1 - deviation);
        const passed = deviation < 0.2;

        return { passed, score };
    }

    /**
     * Frequency test - checks distribution of byte values
     * @param data - Data to test
     * @returns Test result
     */
    private static frequencyTest(data: Buffer): {
        passed: boolean;
        score: number;
    } {
        const frequency = new Array(256).fill(0);

        for (const byte of data) {
            frequency[byte]++;
        }

        const expected = data.length / 256;
        let chiSquare = 0;

        for (let i = 0; i < 256; i++) {
            const observed = frequency[i];
            chiSquare += Math.pow(observed - expected, 2) / expected;
        }

        // Normalize chi-square value
        const normalizedChiSquare = chiSquare / (256 - 1);
        const score = Math.max(0, 1 - normalizedChiSquare / 2);
        const passed = normalizedChiSquare < 1.5;

        return { passed, score };
    }

    /**
     * Serial test - checks correlation between consecutive bytes
     * @param data - Data to test
     * @returns Test result
     */
    private static serialTest(data: Buffer): {
        passed: boolean;
        score: number;
    } {
        if (data.length < 2) {
            return { passed: true, score: 1 };
        }

        const pairs = new Map<string, number>();

        for (let i = 0; i < data.length - 1; i++) {
            const pair = `${data[i]}-${data[i + 1]}`;
            pairs.set(pair, (pairs.get(pair) || 0) + 1);
        }

        const totalPairs = data.length - 1;
        const expectedFreq = totalPairs / (256 * 256);
        let chiSquare = 0;

        // Check all possible pairs
        for (let i = 0; i < 256; i++) {
            for (let j = 0; j < 256; j++) {
                const pair = `${i}-${j}`;
                const observed = pairs.get(pair) || 0;
                chiSquare +=
                    Math.pow(observed - expectedFreq, 2) / expectedFreq;
            }
        }

        const normalizedChiSquare = chiSquare / (256 * 256 - 1);
        const score = Math.max(0, 1 - normalizedChiSquare / 2);
        const passed = normalizedChiSquare < 1.5;

        return { passed, score };
    }

    /**
     * Estimate entropy rate of data
     * @param data - Data to analyze
     * @returns Entropy rate in bits per byte
     */
    public static estimateEntropyRate(data: Buffer): number {
        if (data.length === 0) return 0;

        // Use compression-based entropy estimation
        const compressed = crypto.createHash("sha256").update(data).digest();
        const compressionRatio = compressed.length / data.length;

        // Estimate entropy based on compression
        const estimatedEntropy = 8 * (1 - compressionRatio);

        // Also calculate Shannon entropy for comparison
        const frequency = new Map<number, number>();
        for (const byte of data) {
            frequency.set(byte, (frequency.get(byte) || 0) + 1);
        }

        let shannonEntropy = 0;
        const length = data.length;
        for (const count of frequency.values()) {
            const probability = count / length;
            shannonEntropy -= probability * Math.log2(probability);
        }

        // Return the more conservative estimate
        return Math.min(estimatedEntropy, shannonEntropy);
    }

    /**
     * Generate entropy quality report
     * @param data - Data to analyze
     * @returns Comprehensive entropy report
     */
    public static generateEntropyReport(data: Buffer): {
        analysis: HashEntropyAnalysis;
        randomnessTests: ReturnType<typeof HashEntropy.performRandomnessTests>;
        entropyRate: number;
        recommendations: string[];
        overallGrade: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
    } {
        const analysis = HashEntropy.analyzeHashEntropy(data);
        const randomnessTests = HashEntropy.performRandomnessTests(data);
        const entropyRate = HashEntropy.estimateEntropyRate(data);

        const recommendations: string[] = [...analysis.recommendations];

        // Add recommendations based on randomness tests
        if (!randomnessTests.monobitTest.passed) {
            recommendations.push("Data fails monobit test - check bit balance");
        }
        if (!randomnessTests.runsTest.passed) {
            recommendations.push("Data fails runs test - check for patterns");
        }
        if (!randomnessTests.frequencyTest.passed) {
            recommendations.push(
                "Data fails frequency test - improve byte distribution"
            );
        }
        if (!randomnessTests.serialTest.passed) {
            recommendations.push("Data fails serial test - reduce correlation");
        }

        // Determine overall grade
        const scores = [
            analysis.shannonEntropy / 8, // Normalize to 0-1
            analysis.randomnessScore,
            randomnessTests.overallScore,
            entropyRate / 8, // Normalize to 0-1
        ];
        const overallScore =
            scores.reduce((sum, score) => sum + score, 0) / scores.length;

        let overallGrade: "POOR" | "FAIR" | "GOOD" | "EXCELLENT";
        if (overallScore > 0.9) {
            overallGrade = "EXCELLENT";
        } else if (overallScore > 0.8) {
            overallGrade = "GOOD";
        } else if (overallScore > 0.6) {
            overallGrade = "FAIR";
        } else {
            overallGrade = "POOR";
        }

        return {
            analysis,
            randomnessTests,
            entropyRate,
            recommendations: [...new Set(recommendations)], // Remove duplicates
            overallGrade,
        };
    }
}
