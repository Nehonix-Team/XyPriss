/**
 * Advanced Entropy Analyzer Module
 * Provides optimized entropy analysis for SecureString
 */

import { HashEntropy } from "../../../core/hash/hash-entropy";
import type * as analyserType from "../types";

type EntropyAnalysisResult = analyserType.EntropyAnalysisResult;
type PatternAnalysisResult = analyserType.PatternAnalysisResult;

/**
 * Advanced entropy analyzer for strings
 */
export class EntropyAnalyzer {
    private static readonly KEYBOARD_PATTERNS = {
        qwerty: ["qwerty", "asdf", "zxcv", "1234", "qwer", "asdfg", "zxcvb"],
        dvorak: ["pyfg", "aoeu", "qjkx"],
    };

    private static readonly COMMON_WORDS = [
        "password",
        "admin",
        "user",
        "login",
        "secret",
        "test",
        "demo",
        "welcome",
        "hello",
        "world",
        "company",
        "system",
        "access",
    ];

    private static readonly SUBSTITUTIONS = {
        "@": "a",
        "3": "e",
        "1": "i",
        "0": "o",
        $: "s",
        "7": "t",
    };

    /**
     * Performs comprehensive entropy analysis
     */
    static analyzeEntropy(content: string): EntropyAnalysisResult {
        const charFreq = this.getCharacterFrequencies(content);
        const shannonEntropy = this.calculateShannonEntropy(content, charFreq);
        const minEntropy = this.calculateMinEntropy(content, charFreq);
        const maxEntropy = Math.log2(Object.keys(charFreq).length);
        const diversityScore = this.calculateDiversityScore(content, charFreq);
        const characterDistribution = this.getCharacterDistribution(
            content,
            charFreq
        );
        const bigramEntropy = this.calculateNGramEntropy(content, 2);
        const trigramEntropy = this.calculateNGramEntropy(content, 3);
        const patternComplexity = this.calculatePatternComplexity(content);
        const predictability = this.calculatePredictability(content);
        const randomnessScore = this.calculateRandomnessScore(
            shannonEntropy,
            patternComplexity,
            predictability
        );
        const recommendations = this.generateRecommendations(
            content,
            shannonEntropy,
            patternComplexity
        );

        return {
            shannonEntropy,
            minEntropy,
            maxEntropy,
            diversityScore,
            patternComplexity,
            characterDistribution,
            bigramEntropy,
            trigramEntropy,
            predictability,
            randomnessScore,
            recommendations,
        };
    }

    /**
     * Analyzes patterns in the string
     */
    static analyzePatterns(content: string): PatternAnalysisResult {
        const repeatingPatterns = this.findRepeatingPatterns(content);
        const sequentialPatterns = this.findSequentialPatterns(content);
        const keyboardPatterns = this.findKeyboardPatterns(content);
        const dictionaryWords = this.findDictionaryWords(content);
        const commonSubstitutions = this.findCommonSubstitutions(content);
        const overallComplexity = this.calculateOverallComplexity(content);

        return {
            repeatingPatterns,
            sequentialPatterns,
            keyboardPatterns,
            dictionaryWords,
            commonSubstitutions,
            overallComplexity,
        };
    }

    /**
     * Calculates Shannon entropy
     */
    private static calculateShannonEntropy(
        content: string,
        freq: Record<string, number>
    ): number {
        let entropy = 0;
        const length = content.length;
        for (const count of Object.values(freq)) {
            const prob = count / length;
            entropy -= prob * Math.log2(prob);
        }
        return entropy;
    }

    /**
     * Calculates min-entropy
     */
    private static calculateMinEntropy(
        content: string,
        freq: Record<string, number>
    ): number {
        const maxFreq = Math.max(...Object.values(freq));
        return -Math.log2(maxFreq / content.length);
    }

    /**
     * Calculates n-gram entropy
     */
    private static calculateNGramEntropy(content: string, n: number): number {
        if (content.length < n) return 0;
        const ngrams: Record<string, number> = {};
        const total = content.length - n + 1;

        for (let i = 0; i < total; i++) {
            const ngram = content.slice(i, i + n);
            ngrams[ngram] = (ngrams[ngram] || 0) + 1;
        }

        let entropy = 0;
        for (const count of Object.values(ngrams)) {
            const prob = count / total;
            entropy -= prob * Math.log2(prob);
        }
        return entropy;
    }

    /**
     * Calculates diversity score based on character variety
     */
    private static calculateDiversityScore(
        content: string,
        freq: Record<string, number>
    ): number {
        const uniqueChars = Object.keys(freq).length;
        const charsetSize = Math.min(95, uniqueChars); // ASCII printable chars
        return charsetSize / 95;
    }

    /**
     * Calculates pattern complexity
     */
    private static calculatePatternComplexity(content: string): number {
        let complexity = 0;
        const uniqueChars = new Set(content).size;
        complexity += uniqueChars / content.length;

        const charTypes = [
            /[A-Z]/.test(content),
            /[a-z]/.test(content),
            /\d/.test(content),
            /[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(content),
        ];
        complexity += charTypes.filter(Boolean).length / 4;

        const patterns = this.findRepeatingPatterns(content);
        complexity -= patterns.length / Math.max(1, content.length / 4);

        return Math.max(0, Math.min(1, complexity));
    }

    /**
     * Calculates predictability score
     */
    private static calculatePredictability(content: string): number {
        let predictability = 0;
        let sequential = 0,
            repeated = 0;
        for (let i = 1; i < content.length; i++) {
            if (
                Math.abs(content.charCodeAt(i) - content.charCodeAt(i - 1)) ===
                1
            )
                sequential++;
            if (content[i] === content[i - 1]) repeated++;
        }
        predictability += (sequential + repeated) / (content.length - 1);
        return Math.min(1, predictability);
    }

    /**
     * Calculates overall randomness score
     */
    private static calculateRandomnessScore(
        entropy: number,
        complexity: number,
        predictability: number
    ): number {
        const normalizedEntropy = entropy / Math.log2(256);
        return (normalizedEntropy + complexity + (1 - predictability)) / 3;
    }

    /**
     * Finds repeating patterns
     */
    private static findRepeatingPatterns(
        content: string
    ): Array<{ pattern: string; count: number; positions: number[] }> {
        const patterns: Record<string, { count: number; positions: number[] }> =
            {};
        const maxLen = Math.min(content.length >> 1, 8);

        for (let len = 2; len <= maxLen; len++) {
            for (let i = 0; i <= content.length - len; i++) {
                const pattern = content.slice(i, i + len);
                patterns[pattern] = patterns[pattern] || {
                    count: 0,
                    positions: [],
                };
                patterns[pattern].count++;
                patterns[pattern].positions.push(i);
            }
        }

        return Object.entries(patterns)
            .filter(([, { count }]) => count > 1)
            .map(([pattern, data]) => ({ pattern, ...data }))
            .sort((a, b) => b.count - a.count)
            .slice(0, 5);
    }

    /**
     * Finds sequential patterns
     */
    private static findSequentialPatterns(
        content: string
    ): Array<{ pattern: string; type: "ascending" | "descending" }> {
        const patterns: Array<{
            pattern: string;
            type: "ascending" | "descending";
        }> = [];
        const maxLen = Math.min(content.length, 6);

        for (let len = 3; len <= maxLen; len++) {
            for (let i = 0; i <= content.length - len; i++) {
                const substr = content.slice(i, i + len);
                const codes = substr.split("").map((c) => c.charCodeAt(0));
                const isAsc = codes.every(
                    (c, j) => j === 0 || c === codes[j - 1] + 1
                );
                const isDesc = codes.every(
                    (c, j) => j === 0 || c === codes[j - 1] - 1
                );
                if (isAsc)
                    patterns.push({ pattern: substr, type: "ascending" });
                else if (isDesc)
                    patterns.push({ pattern: substr, type: "descending" });
            }
        }

        return patterns.slice(0, 5);
    }

    /**
     * Finds keyboard patterns
     */
    private static findKeyboardPatterns(
        content: string
    ): Array<{ pattern: string; layout: string }> {
        const patterns: Array<{ pattern: string; layout: string }> = [];
        const lower = content.toLowerCase();

        for (const [layout, layoutPatterns] of Object.entries(
            this.KEYBOARD_PATTERNS
        )) {
            for (const pattern of layoutPatterns) {
                if (lower.includes(pattern)) {
                    patterns.push({ pattern, layout });
                }
            }
        }

        return patterns.slice(0, 5);
    }

    /**
     * Finds dictionary words
     */
    private static findDictionaryWords(
        content: string
    ): Array<{ word: string; position: number; confidence: number }> {
        const words: Array<{
            word: string;
            position: number;
            confidence: number;
        }> = [];
        const lower = content.toLowerCase();

        for (const word of this.COMMON_WORDS) {
            let pos = lower.indexOf(word);
            while (pos !== -1) {
                words.push({
                    word,
                    position: pos,
                    confidence: word.length / content.length,
                });
                pos = lower.indexOf(word, pos + 1);
            }
        }

        return words.sort((a, b) => b.confidence - a.confidence).slice(0, 5);
    }

    /**
     * Finds common substitutions
     */
    private static findCommonSubstitutions(
        content: string
    ): Array<{ original: string; substituted: string }> {
        return Object.entries(this.SUBSTITUTIONS)
            .filter(([, substituted]) => content.includes(substituted))
            .map(([substituted, original]) => ({ original, substituted }));
    }

    /**
     * Helper methods
     */
    private static getCharacterFrequencies(
        content: string
    ): Record<string, number> {
        const freq: Record<string, number> = {};
        for (const char of content) {
            freq[char] = (freq[char] || 0) + 1;
        }
        return freq;
    }

    private static getCharacterDistribution(
        content: string,
        freq: Record<string, number>
    ): Record<string, number> {
        const dist: Record<string, number> = {};
        const len = content.length;
        for (const [char, count] of Object.entries(freq)) {
            dist[char] = count / len;
        }
        return dist;
    }

    private static generateRecommendations(
        content: string,
        entropy: number,
        complexity: number
    ): string[] {
        const rec: string[] = [];
        if (entropy < 3)
            rec.push("Increase character variety to improve entropy");
        if (complexity < 0.5) rec.push("Reduce predictable patterns");
        if (content.length < 12)
            rec.push("Consider increasing length for better security");
        if (!/[A-Z]/.test(content)) rec.push("Add uppercase letters");
        if (!/[a-z]/.test(content)) rec.push("Add lowercase letters");
        if (!/\d/.test(content)) rec.push("Add numbers");
        if (!/[!@#$%^&*()_+\-=\[\]{};':"\\|,.<>\/?]/.test(content))
            rec.push("Add special characters");
        return rec;
    }

    private static calculateOverallComplexity(content: string): number {
        const entropy = this.calculateShannonEntropy(
            content,
            this.getCharacterFrequencies(content)
        );
        const patterns = this.findRepeatingPatterns(content);
        const sequences = this.findSequentialPatterns(content);
        let complexity = entropy / Math.log2(256);
        complexity -=
            (patterns.length + sequences.length) /
            Math.max(1, content.length / 4);
        return Math.max(0, Math.min(1, complexity));
    }
}
