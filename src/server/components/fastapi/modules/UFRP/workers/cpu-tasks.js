/**
 * Real CPU-Intensive Task Implementations
 * These replace the mock implementations with actual CPU-intensive operations
 */

const crypto = require("crypto");

/**
 * Real CPU-intensive data processing tasks
 */

/**
 * Prime number calculation - CPU intensive
 */
function calculatePrimes(limit) {
    const primes = [];
    const sieve = new Array(limit + 1).fill(true);
    sieve[0] = sieve[1] = false;

    for (let i = 2; i * i <= limit; i++) {
        if (sieve[i]) {
            for (let j = i * i; j <= limit; j += i) {
                sieve[j] = false;
            }
        }
    }

    for (let i = 2; i <= limit; i++) {
        if (sieve[i]) primes.push(i);
    }

    return primes;
}

/**
 * Fibonacci sequence calculation - CPU intensive
 */
function calculateFibonacci(n) {
    if (n <= 1) return n;

    let a = 0,
        b = 1;
    const sequence = [a, b];

    for (let i = 2; i < n; i++) {
        const next = a + b;
        sequence.push(next);
        a = b;
        b = next;
    }

    return sequence;
}

/**
 * Matrix multiplication - CPU intensive
 */
function multiplyMatrices(matrixA, matrixB) {
    const rowsA = matrixA.length;
    const colsA = matrixA[0].length;
    const rowsB = matrixB.length;
    const colsB = matrixB[0].length;

    if (colsA !== rowsB) {
        throw new Error("Matrix dimensions don't match for multiplication");
    }

    const result = Array(rowsA)
        .fill()
        .map(() => Array(colsB).fill(0));

    for (let i = 0; i < rowsA; i++) {
        for (let j = 0; j < colsB; j++) {
            for (let k = 0; k < colsA; k++) {
                result[i][j] += matrixA[i][k] * matrixB[k][j];
            }
        }
    }

    return result;
}

/**
 * Hash computation - CPU intensive
 */
function computeHashes(data, iterations = 10000) {
    let hash = crypto
        .createHash("sha256")
        .update(JSON.stringify(data))
        .digest("hex");

    for (let i = 0; i < iterations; i++) {
        hash = crypto.createHash("sha256").update(hash).digest("hex");
    }

    return hash;
}

/**
 * Data sorting and analysis - CPU intensive
 */
function analyzeDataset(dataset) {
    if (!Array.isArray(dataset) || dataset.length === 0) {
        return { error: "Invalid dataset" };
    }

    // Sort the dataset
    const sorted = [...dataset].sort((a, b) => a - b);

    // Calculate statistics
    const sum = dataset.reduce((acc, val) => acc + val, 0);
    const mean = sum / dataset.length;
    const median =
        sorted.length % 2 === 0
            ? (sorted[sorted.length / 2 - 1] + sorted[sorted.length / 2]) / 2
            : sorted[Math.floor(sorted.length / 2)];

    // Calculate standard deviation
    const variance =
        dataset.reduce((acc, val) => acc + Math.pow(val - mean, 2), 0) /
        dataset.length;
    const stdDev = Math.sqrt(variance);

    return {
        count: dataset.length,
        sum,
        mean,
        median,
        min: sorted[0],
        max: sorted[sorted.length - 1],
        standardDeviation: stdDev,
        variance,
        sorted: sorted.slice(0, 100), // Return first 100 sorted values
    };
}

/**
 * Text processing and analysis - CPU intensive
 */
function analyzeText(text) {
    if (typeof text !== "string") {
        return { error: "Invalid text input" };
    }

    const words = text.toLowerCase().match(/\b\w+\b/g) || [];
    const wordCount = {};
    const charCount = {};

    // Count words
    words.forEach((word) => {
        wordCount[word] = (wordCount[word] || 0) + 1;
    });

    // Count characters
    for (const char of text.toLowerCase()) {
        if (char.match(/[a-z]/)) {
            charCount[char] = (charCount[char] || 0) + 1;
        }
    }

    // Find most common words
    const sortedWords = Object.entries(wordCount)
        .sort(([, a], [, b]) => b - a)
        .slice(0, 10);

    return {
        totalWords: words.length,
        uniqueWords: Object.keys(wordCount).length,
        totalCharacters: text.length,
        alphabeticCharacters: Object.values(charCount).reduce(
            (a, b) => a + b,
            0
        ),
        mostCommonWords: sortedWords,
        averageWordLength:
            words.reduce((acc, word) => acc + word.length, 0) / words.length,
        wordFrequency: wordCount,
    };
}

/**
 * Image processing simulation - CPU intensive
 */
function processImageData(imageData) {
    if (
        !imageData ||
        !imageData.width ||
        !imageData.height ||
        !imageData.pixels
    ) {
        return { error: "Invalid image data" };
    }

    const { width, height, pixels } = imageData;
    const processedPixels = [];

    // Apply a simple blur filter (CPU intensive)
    for (let y = 1; y < height - 1; y++) {
        for (let x = 1; x < width - 1; x++) {
            const index = y * width + x;

            // Get surrounding pixels
            const surrounding = [
                pixels[index - width - 1],
                pixels[index - width],
                pixels[index - width + 1],
                pixels[index - 1],
                pixels[index],
                pixels[index + 1],
                pixels[index + width - 1],
                pixels[index + width],
                pixels[index + width + 1],
            ];

            // Calculate average (blur effect)
            const average =
                surrounding.reduce((sum, pixel) => sum + pixel, 0) / 9;
            processedPixels[index] = Math.round(average);
        }
    }

    return {
        width,
        height,
        originalPixelCount: pixels.length,
        processedPixelCount: processedPixels.length,
        processingType: "blur_filter",
        checksum: crypto
            .createHash("md5")
            .update(processedPixels.join(","))
            .digest("hex"),
    };
}

/**
 * Cryptographic operations - CPU intensive
 */
function performCryptographicOperations(data, operations = 1000) {
    const results = {
        hashes: [],
        encryptions: [],
        signatures: [],
    };

    const dataString = JSON.stringify(data);

    // Generate multiple hashes
    for (let i = 0; i < operations; i++) {
        const hash = crypto
            .createHash("sha256")
            .update(dataString + i)
            .digest("hex");
        results.hashes.push(hash);
    }

    // Perform encryption operations
    for (let i = 0; i < Math.min(operations, 100); i++) {
        const key = crypto.randomBytes(32);
        const iv = crypto.randomBytes(16);
        const cipher = crypto.createCipheriv("aes-256-cbc", key, iv);

        let encrypted = cipher.update(dataString, "utf8", "hex");
        encrypted += cipher.final("hex");

        results.encryptions.push({
            encrypted: encrypted.substring(0, 32), // Store only first 32 chars
            keyHash: crypto
                .createHash("sha256")
                .update(key)
                .digest("hex")
                .substring(0, 16),
        });
    }

    return {
        operationsPerformed: operations,
        hashCount: results.hashes.length,
        encryptionCount: results.encryptions.length,
        totalProcessingTime: Date.now(),
        finalHash: results.hashes[results.hashes.length - 1],
    };
}

module.exports = {
    calculatePrimes,
    calculateFibonacci,
    multiplyMatrices,
    computeHashes,
    analyzeDataset,
    analyzeText,
    processImageData,
    performCryptographicOperations,
};

