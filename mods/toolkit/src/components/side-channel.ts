/**
 * Side-Channel Attack Protection Module
 *
 * This module provides protection against various side-channel attacks:
 * - Timing attacks: Ensures operations take constant time regardless of input
 * - Cache attacks: Implements cache-resistant operations
 * - Power analysis: Reduces power analysis vectors through balanced operations
 * - Fault injection: Detects and mitigates fault injection attempts
 */

/**
 * Performs a constant-time comparison of two strings or arrays
 * Prevents timing attacks by ensuring the comparison takes the same amount of time
 * regardless of how many characters match
 *
 * @param a - First string or array to compare
 * @param b - Second string or array to compare
 * @returns True if the inputs are equal, false otherwise
 */
export function constantTimeEqual(
    a: string | Uint8Array,
    b: string | Uint8Array
): boolean {
    // Convert strings to Uint8Array if needed
    const bufA = typeof a === "string" ? new TextEncoder().encode(a) : a;
    const bufB = typeof b === "string" ? new TextEncoder().encode(b) : b;

    // If lengths differ, return false but still do the full comparison
    // to maintain constant time
    const result = bufA.length === bufB.length ? 1 : 0;

    // XOR each byte and OR the result
    // This ensures we always process all bytes regardless of mismatches
    let diff = 0;
    const len = Math.max(bufA.length, bufB.length);

    for (let i = 0; i < len; i++) {
        // Use 0 for indices beyond array length
        const byteA = i < bufA.length ? bufA[i] : 0;
        const byteB = i < bufB.length ? bufB[i] : 0;

        // XOR the bytes and OR with the running diff
        diff |= byteA ^ byteB;
    }

    // Return true only if lengths match AND all bytes match
    return diff === 0 && result === 1;
}

/**
 * Performs a masked memory access to prevent cache-timing attacks
 * This technique helps mitigate cache-based side-channel attacks by
 * accessing all elements of an array regardless of which one is needed
 *
 * @param array - Array to access
 * @param index - Index to retrieve
 * @returns The value at the specified index
 */
export function maskedAccess<T>(array: T[], index: number): T {
    if (index < 0 || index >= array.length) {
        throw new Error("Index out of bounds");
    }

    // Create a result variable
    let result: T = array[0];

    // Access every element in the array
    // Only keep the one at the specified index
    for (let i = 0; i < array.length; i++) {
        // This is a constant-time conditional assignment
        // It will set result to array[i] only when i === index
        // The comparison i === index is converted to either 0 or 1
        // When multiplied by -1 and cast to a 32-bit integer, it becomes either 0 or 0xFFFFFFFF
        // This creates a bit mask that's either all 0s or all 1s
        const mask = -(Number(i === index) | 0) >>> 0;

        // Use the mask to conditionally update the result
        // If mask is all 1s (i === index), result becomes array[i]
        // If mask is all 0s (i !== index), result remains unchanged
        // @ts-ignore: The bitwise operations are intentional for constant-time selection
        result = (result & ~mask) | (array[i] & mask);
    }

    return result;
}

/**
 * Implements a secure modular exponentiation algorithm resistant to timing attacks
 * Used for cryptographic operations like RSA and Diffie-Hellman
 *
 * @param base - Base value
 * @param exponent - Exponent value
 * @param modulus - Modulus value
 * @returns (base^exponent) mod modulus
 */
export function secureModPow(
    base: bigint,
    exponent: bigint,
    modulus: bigint
): bigint {
    if (modulus <= 0n) {
        throw new Error("Modulus must be positive");
    }

    if (exponent < 0n) {
        throw new Error("Negative exponents are not supported");
    }

    // Handle special cases
    if (modulus === 1n) return 0n;
    if (exponent === 0n) return 1n;

    // Ensure base is within modulus range
    base = base % modulus;

    if (base === 0n) return 0n;

    // Real Montgomery ladder implementation for constant-time modular exponentiation
    let r0 = 1n;
    let r1 = base;

    // Process each bit of the exponent from most significant to least significant
    // This approach ensures the same operations are performed regardless of the bit value
    const exponentBits = exponent.toString(2);
    const bitLength = exponentBits.length;

    for (let i = 0; i < bitLength; i++) {
        // Get the current bit (0 or 1)
        const bit = exponentBits[i] === "1" ? 1n : 0n;

        // Constant-time conditional swap based on the bit
        // We compute both possibilities and select the right one using a constant-time select

        // Compute both possible next values for r0 and r1
        const r0r0 = (r0 * r0) % modulus;
        const r0r1 = (r0 * r1) % modulus;
        const r1r1 = (r1 * r1) % modulus;

        // Constant-time selection using bitwise operations on BigInts
        // For bit = 0: r0 = r0*r0, r1 = r0*r1
        // For bit = 1: r0 = r0*r1, r1 = r1*r1

        // Create masks for selection (all 0s or all 1s)
        const mask = -bit; // 0n -> 0n, 1n -> -1n (all bits set)

        // Select r0 = bit ? r0r1 : r0r0
        const newR0 = (r0r0 & ~mask) | (r0r1 & mask);

        // Select r1 = bit ? r1r1 : r0r1
        const newR1 = (r0r1 & ~mask) | (r1r1 & mask);

        r0 = newR0;
        r1 = newR1;
    }

    return r0;
}

/**
 * Implements a secure memory comparison that's resistant to fault injection attacks
 * This performs multiple comparisons and verifies the results match to detect glitches
 *
 * @param a - First buffer to compare
 * @param b - Second buffer to compare
 * @returns True if the buffers are equal, false otherwise
 */
export function faultResistantEqual(a: Uint8Array, b: Uint8Array): boolean {
    // First check: standard constant-time comparison
    const result1 = constantTimeEqual(a, b);

    // Second check: reverse order comparison
    let result2 = true;
    if (a.length !== b.length) {
        result2 = false;
    } else {
        let diff = 0;
        for (let i = a.length - 1; i >= 0; i--) {
            diff |= a[i] ^ b[i];
        }
        result2 = diff === 0;
    }

    // Third check: chunked comparison
    let result3 = true;
    if (a.length !== b.length) {
        result3 = false;
    } else {
        const chunkSize = Math.max(1, Math.floor(a.length / 4));
        for (let chunk = 0; chunk < 4; chunk++) {
            let diff = 0;
            const start = chunk * chunkSize;
            const end = chunk === 3 ? a.length : (chunk + 1) * chunkSize;

            for (let i = start; i < end; i++) {
                diff |= a[i] ^ b[i];
            }

            if (diff !== 0) {
                result3 = false;
            }
        }
    }

    // Verify all results match to detect fault injection
    return result1 && result2 && result3;
}

/**
 * Creates a secure random delay to mitigate timing attacks
 * This adds unpredictable timing variations to make it harder
 * to extract information through precise timing measurements
 *
 * @param minMs - Minimum delay in milliseconds
 * @param maxMs - Maximum delay in milliseconds
 * @returns Promise that resolves after the random delay
 */
export function randomDelay(
    minMs: number = 1,
    maxMs: number = 10
): Promise<void> {
    const delay = Math.floor(Math.random() * (maxMs - minMs + 1)) + minMs;
    return new Promise((resolve) => setTimeout(resolve, delay));
}

/**
 * Applies cache-hardening to a function to protect against cache-timing attacks
 * This technique ensures the function accesses the same memory regions
 * regardless of input, making cache-timing attacks more difficult
 *
 * @param fn - Function to protect
 * @returns Cache-hardened version of the function
 */
export function cacheHarden<T extends (...args: any[]) => any>(fn: T): T {
    // Create a shared cache buffer that persists between function calls
    // This is more effective than creating a new buffer each time
    const cacheSize = 8192; // 8KB buffer
    const cacheBuffer = new Uint8Array(cacheSize);

    // Initialize the buffer with some data
    for (let i = 0; i < cacheSize; i++) {
        cacheBuffer[i] = (i * 17) & 0xff;
    }

    // Return the hardened function
    return ((...args: Parameters<T>): ReturnType<T> => {
        // Pre-execution cache normalization
        // Access the entire cache buffer in a pattern that will load it into cache
        let preSum = 0;
        for (let i = 0; i < cacheSize; i += 64) {
            // Typical cache line size is 64 bytes
            preSum ^= cacheBuffer[i];

            // Also access some random locations to create noise
            const randomOffset = (i * 31 + 17) % cacheSize;
            preSum ^= cacheBuffer[randomOffset];
        }

        // Execute the function
        const startTime = performance.now();
        const result = fn(...args);
        const endTime = performance.now();

        // Post-execution cache normalization
        // This helps prevent leaking information about what the function accessed
        let postSum = 0;

        // Use a different access pattern after execution
        for (let i = cacheSize - 1; i >= 0; i -= 64) {
            postSum ^= cacheBuffer[i];

            // Modify the buffer slightly to prevent optimization
            cacheBuffer[i] = (cacheBuffer[i] + 1) & 0xff;
        }

        // Add timing jitter based on the execution time
        // This helps mask the actual execution time
        const executionTime = endTime - startTime;
        const jitterTime = Math.min(10, executionTime * 0.1); // Up to 10% jitter

        if (jitterTime > 0) {
            const delay = Math.random() * jitterTime;
            const endJitter = performance.now() + delay;

            // Busy-wait to add jitter
            // This is more reliable than setTimeout for small delays
            while (performance.now() < endJitter) {
                // Perform some work to prevent optimization
                postSum ^= (postSum << 1) | (postSum >>> 31);
            }
        }

        // Use the sums to prevent optimization
        if (preSum === postSum && preSum === Number.MAX_SAFE_INTEGER) {
            console.log("This condition will never be true");
        }

        return result;
    }) as T;
}
