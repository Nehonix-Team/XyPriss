/**
 * Random entropy - Entropy pool management and quality assessment
 */

import * as crypto from "crypto";
import { SECURITY_CONSTANTS } from "../../utils/constants";
import {
    RNGState,
    EntropyQuality,
    EntropyAnalysisResult,
    SecurityLevel,
} from "./random-types";

export class RandomEntropy {
    /**
     * Initialize entropy pool with multiple sources
     */
    public static async initializeEntropyPool(
        poolSize: number = SECURITY_CONSTANTS.ENTROPY_POOL_SIZE,
    ): Promise<Buffer> {
        try {
            // Primary entropy from system CSPRNG
            const primaryEntropy = crypto.randomBytes(Math.floor(poolSize / 2));

            // Secondary entropy from timing and system state
            const secondaryEntropy =
                await RandomEntropy.gatherSecondaryEntropy();

            // Combine entropy sources
            const combinedEntropy = Buffer.concat([
                primaryEntropy,
                secondaryEntropy,
            ]);

            // Hash the combined entropy for uniform distribution
            const hashedEntropy = crypto
                .createHash("sha512")
                .update(combinedEntropy)
                .digest();

            // Initialize pool
            const entropyPool = Buffer.alloc(poolSize);
            hashedEntropy.copy(entropyPool, 0);

            return entropyPool;
        } catch (error) {
            throw new Error(`Failed to initialize entropy pool: ${error}`);
        }
    }

    /**
     * Gather secondary entropy from various sources
     */
    public static async gatherSecondaryEntropy(): Promise<Buffer> {
        const entropyBuffers: Buffer[] = [];

        // High-resolution timing entropy
        entropyBuffers.push(RandomEntropy.getTimingEntropy());

        // Memory usage entropy
        entropyBuffers.push(RandomEntropy.getMemoryEntropy());

        // Process entropy
        entropyBuffers.push(RandomEntropy.getProcessEntropy());

        // Add some timing-based entropy (cross-platform)
        const timingBuffer = await RandomEntropy.getAsyncTimingEntropy();
        entropyBuffers.push(timingBuffer);

        // Combine all secondary entropy
        return Buffer.concat(entropyBuffers);
    }

    /**
     * Get high-resolution timing entropy
     */
    public static getTimingEntropy(): Buffer {
        const buffer = Buffer.alloc(16);
        const now = process.hrtime.bigint();
        const performanceTime =
            typeof performance !== "undefined" ? performance.now() : Date.now();

        buffer.writeBigUInt64BE(now, 0);
        buffer.writeDoubleLE(performanceTime, 8);

        return buffer;
    }

    /**
     * Get memory usage entropy
     */
    public static getMemoryEntropy(): Buffer {
        const memUsage = process.memoryUsage();
        const buffer = Buffer.alloc(16);

        buffer.writeUInt32LE(memUsage.rss, 0);
        buffer.writeUInt32LE(memUsage.heapTotal, 4);
        buffer.writeUInt32LE(memUsage.heapUsed, 8);
        buffer.writeUInt32LE(memUsage.external, 12);

        return buffer;
    }

    /**
     * Get process entropy
     */
    public static getProcessEntropy(): Buffer {
        const buffer = Buffer.alloc(16);

        buffer.writeUInt32LE(process.pid, 0);
        buffer.writeUInt32LE(process.ppid || 0, 4);
        buffer.writeDoubleLE(process.uptime(), 8);

        return buffer;
    }

    /**
     * Get async timing entropy with delays
     */
    public static async getAsyncTimingEntropy(): Promise<Buffer> {
        const timingBuffer = Buffer.alloc(32);

        try {
            // Try Node.js hrtime if available
            if (
                typeof process !== "undefined" &&
                process.hrtime &&
                process.hrtime.bigint
            ) {
                for (let i = 0; i < 4; i++) {
                    const start = process.hrtime.bigint();
                    // Small delay to create timing variance
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    const end = process.hrtime.bigint();
                    const diff = end - start;
                    timingBuffer.writeBigUInt64BE(diff, i * 8);
                }
            } else {
                // Fallback to Date.now() and performance.now()
                for (let i = 0; i < 8; i++) {
                    const start = Date.now();
                    const perfStart =
                        typeof performance !== "undefined"
                            ? performance.now()
                            : 0;
                    // Small delay to create timing variance
                    await new Promise((resolve) => setTimeout(resolve, 1));
                    const end = Date.now();
                    const perfEnd =
                        typeof performance !== "undefined"
                            ? performance.now()
                            : 0;
                    timingBuffer.writeUInt32BE(end - start, i * 4);
                }
            }
        } catch (error) {
            console.warn("Failed to gather async timing entropy:", error);
            // Fill with current timestamp as fallback
            timingBuffer.writeBigUInt64BE(BigInt(Date.now()), 0);
        }

        return timingBuffer;
    }

    /**
     * Assess entropy quality of data
     */
    public static assessEntropyQuality(data: Buffer): EntropyQuality {
        if (data.length === 0) {
            return EntropyQuality.POOR;
        }

        // Calculate Shannon entropy
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

        // Normalize to 0-8 range (8 bits max entropy per byte)
        const normalizedEntropy = shannonEntropy;

        // Assess quality based on entropy
        if (normalizedEntropy > 7.8) {
            return EntropyQuality.MILITARY;
        } else if (normalizedEntropy > 7.5) {
            return EntropyQuality.EXCELLENT;
        } else if (normalizedEntropy > 7.0) {
            return EntropyQuality.GOOD;
        } else if (normalizedEntropy > 6.0) {
            return EntropyQuality.FAIR;
        } else {
            return EntropyQuality.POOR;
        }
    }

    /**
     * Perform comprehensive entropy analysis
     */
    public static analyzeEntropy(data: Buffer): EntropyAnalysisResult {
        // Shannon entropy calculation
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

        // Min-entropy (worst-case entropy)
        const maxFreq = Math.max(...frequency.values());
        const minEntropy = -Math.log2(maxFreq / length);

        // Compression ratio test
        const compressed = crypto.createHash("sha256").update(data).digest();
        const compressionRatio = compressed.length / data.length;

        // Chi-square test for randomness
        const expected = length / 256;
        let chiSquare = 0;
        for (let i = 0; i < 256; i++) {
            const observed = frequency.get(i) || 0;
            chiSquare += Math.pow(observed - expected, 2) / expected;
        }
        const randomnessScore = Math.max(0, 1 - chiSquare / (256 * 4));

        // Perform statistical tests
        const testResults = RandomEntropy.performStatisticalTests(data);

        // Quality assessment
        let qualityGrade: EntropyQuality;
        if (shannonEntropy > 7.8 && randomnessScore > 0.9) {
            qualityGrade = EntropyQuality.MILITARY;
        } else if (shannonEntropy > 7.5 && randomnessScore > 0.8) {
            qualityGrade = EntropyQuality.EXCELLENT;
        } else if (shannonEntropy > 7.0 && randomnessScore > 0.6) {
            qualityGrade = EntropyQuality.GOOD;
        } else if (shannonEntropy > 6.0 && randomnessScore > 0.4) {
            qualityGrade = EntropyQuality.FAIR;
        } else {
            qualityGrade = EntropyQuality.POOR;
        }

        const recommendations: string[] = [];
        if (qualityGrade === EntropyQuality.POOR) {
            recommendations.push("Consider using stronger entropy sources");
        }
        if (minEntropy < 6) {
            recommendations.push(
                "Min-entropy is low, consider additional randomization",
            );
        }
        if (compressionRatio > 0.8) {
            recommendations.push(
                "Data shows patterns, consider additional mixing",
            );
        }

        return {
            shannonEntropy,
            minEntropy,
            compressionRatio,
            randomnessScore,
            qualityGrade,
            recommendations,
            testResults,
        };
    }

    /**
     * Perform statistical randomness tests
     */
    public static performStatisticalTests(data: Buffer): {
        monobitTest: { passed: boolean; score: number };
        runsTest: { passed: boolean; score: number };
        frequencyTest: { passed: boolean; score: number };
        serialTest: { passed: boolean; score: number };
    } {
        return {
            monobitTest: RandomEntropy.monobitTest(data),
            runsTest: RandomEntropy.runsTest(data),
            frequencyTest: RandomEntropy.frequencyTest(data),
            serialTest: RandomEntropy.serialTest(data),
        };
    }

    /**
     * Monobit test - checks balance of 0s and 1s
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
        const score = Math.max(0, 1 - deviation * 4);
        const passed = deviation < 0.1;

        return { passed, score };
    }

    /**
     * Runs test - checks for proper distribution of runs
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

        const normalizedChiSquare = chiSquare / (256 - 1);
        const score = Math.max(0, 1 - normalizedChiSquare / 2);
        const passed = normalizedChiSquare < 1.5;

        return { passed, score };
    }

    /**
     * Serial test - checks correlation between consecutive bytes
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
     * Reseed entropy pool with fresh entropy
     */
    public static async reseedEntropyPool(
        currentPool: Buffer,
    ): Promise<Buffer> {
        // Gather fresh entropy
        const freshEntropy = await RandomEntropy.gatherSecondaryEntropy();
        const systemEntropy = crypto.randomBytes(32);

        // Combine with existing pool
        const combined = Buffer.concat([
            currentPool,
            freshEntropy,
            systemEntropy,
        ]);

        // Hash to create new pool
        const newPool = crypto.createHash("sha512").update(combined).digest();

        // Extend to original pool size if needed
        if (newPool.length < currentPool.length) {
            const extended = Buffer.alloc(currentPool.length);
            newPool.copy(extended, 0);
            return extended;
        }

        return newPool.slice(0, currentPool.length);
    }
}

