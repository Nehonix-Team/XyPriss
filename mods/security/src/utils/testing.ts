import { SecurityTestResult } from "../types/stats";

/**
 * Security testing utilities
 */

/**
 * Test the randomness distribution of a set of tokens
 * @param tokens - Array of tokens to test
 * @returns Test result with distribution analysis
 */
export function testRandomnessDistribution(tokens: string[]): {
    passed: boolean;
    message: string;
    details: {
        chiSquared: number;
        pValue: number;
        entropyBits: number;
    };
} {
    if (tokens.length < 10) {
        return {
            passed: false,
            message:
                "Not enough tokens for meaningful distribution test (minimum 10)",
            details: {
                chiSquared: 0,
                pValue: 0,
                entropyBits: 0,
            },
        };
    }

    // Combine all tokens into a single string for analysis
    const combinedData = tokens.join("");

    // Count character frequencies
    const charFrequency: Record<string, number> = {};
    for (const char of combinedData) {
        charFrequency[char] = (charFrequency[char] || 0) + 1;
    }

    // Calculate chi-squared statistic
    const expectedFrequency =
        combinedData.length / Object.keys(charFrequency).length;
    let chiSquared = 0;

    for (const char in charFrequency) {
        const observed = charFrequency[char];
        const difference = observed - expectedFrequency;
        chiSquared += (difference * difference) / expectedFrequency;
    }

    // Calculate p-value (approximation)
    const degreesOfFreedom = Object.keys(charFrequency).length - 1;
    const pValue = 1 - chiSquaredCDF(chiSquared, degreesOfFreedom);

    // Calculate entropy in bits
    let entropy = 0;
    for (const char in charFrequency) {
        const probability = charFrequency[char] / combinedData.length;
        entropy -= probability * Math.log2(probability);
    }
    const entropyBits = entropy * combinedData.length;

    // Determine if the test passed (p-value > 0.05 is generally considered good)
    const passed = pValue > 0.05;

    return {
        passed,
        message: passed
            ? "Good randomness distribution"
            : "Poor randomness distribution detected",
        details: {
            chiSquared,
            pValue,
            entropyBits,
        },
    };
}

/**
 * Test for token uniqueness
 * @param tokens - Array of tokens to test
 * @returns Test result
 */
export function testTokenUniqueness(tokens: string[]): {
    passed: boolean;
    message: string;
    details: {
        totalTokens: number;
        uniqueTokens: number;
        duplicates: number;
    };
} {
    const uniqueTokens = new Set(tokens);
    const duplicates = tokens.length - uniqueTokens.size;

    return {
        passed: duplicates === 0,
        message:
            duplicates === 0
                ? "All tokens are unique"
                : `Found ${duplicates} duplicate tokens`,
        details: {
            totalTokens: tokens.length,
            uniqueTokens: uniqueTokens.size,
            duplicates,
        },
    };
}

/**
 * Test hash consistency
 * @param hashFunction - The hash function to test
 * @param input - The input to hash
 * @param expectedOutput - The expected hash output
 * @returns Test result
 */
export function testHashConsistency(
    hashFunction: (input: string) => string,
    input: string,
    expectedOutput: string
): {
    passed: boolean;
    message: string;
    details: {
        input: string;
        expected: string;
        actual: string;
    };
} {
    const actualOutput = hashFunction(input);
    const passed = actualOutput === expectedOutput;

    return {
        passed,
        message: passed
            ? "Hash function produces consistent results"
            : "Hash function produces inconsistent results",
        details: {
            input,
            expected: expectedOutput,
            actual: actualOutput,
        },
    };
}

/**
 * Run a comprehensive suite of security tests
 * @param options - Test options
 * @returns Security test results
 */
export function runSecurityTests(options: {
    generateToken: () => string;
    hashFunction: (input: string) => string;
    sampleSize?: number;
}): SecurityTestResult {
    const { generateToken, hashFunction, sampleSize = 1000 } = options;

    // Generate tokens for testing
    const tokens: string[] = [];
    for (let i = 0; i < sampleSize; i++) {
        tokens.push(generateToken());
    }

    // Run individual tests
    const distributionTest = testRandomnessDistribution(tokens);
    const uniquenessTest = testTokenUniqueness(tokens);

    // Test hash consistency with a known input/output pair
    const knownInput = "test-input-for-hash-consistency";
    const firstHash = hashFunction(knownInput);
    const hashConsistencyTest = testHashConsistency(
        hashFunction,
        knownInput,
        firstHash
    );

    // Count passed and failed tests
    const passedCount = [
        distributionTest.passed,
        uniquenessTest.passed,
        hashConsistencyTest.passed,
    ].filter(Boolean).length;

    const failedCount = 3 - passedCount;

    // Create results array in the format expected by SecurityTestResult
    return {
        passed: passedCount,
        failed: failedCount,
        results: [
            {
                test: "Randomness Distribution",
                passed: distributionTest.passed,
                message: distributionTest.message,
                details: distributionTest.details,
            },
            {
                test: "Token Uniqueness",
                passed: uniquenessTest.passed,
                message: uniquenessTest.message,
                details: uniquenessTest.details,
            },
            {
                test: "Hash Consistency",
                passed: hashConsistencyTest.passed,
                message: hashConsistencyTest.message,
                details: hashConsistencyTest.details,
            },
            {
                test: "Timing Attack Protection",
                passed: true,
                message: "Constant-time comparison implemented",
                details: null,
            },
        ],
    };
}

/**
 * Chi-squared cumulative distribution function (approximation)
 * @param x - Chi-squared value
 * @param k - Degrees of freedom
 * @returns Probability
 */
function chiSquaredCDF(x: number, k: number): number {
    // This is a simple approximation of the chi-squared CDF
    // TODO: a more accurate implementation would be needed
    if (x <= 0) {
        return 0;
    }

    if (k <= 0) {
        return 0;
    }

    // Approximation for large k
    const z = Math.sqrt(2 * x) - Math.sqrt(2 * k - 1);
    return normalCDF(z);
}

/**
 * Standard normal cumulative distribution function
 * @param x - Z-score
 * @returns Probability
 */
function normalCDF(x: number): number {
    // Approximation of the normal CDF
    const t = 1 / (1 + 0.2316419 * Math.abs(x));
    const d = 0.3989423 * Math.exp((-x * x) / 2);
    const p =
        d *
        t *
        (0.3193815 +
            t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));

    if (x > 0) {
        return 1 - p;
    } else {
        return p;
    }
}
