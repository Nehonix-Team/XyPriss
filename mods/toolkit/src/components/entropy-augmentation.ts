/**
 * Entropy Augmentation Module
 *
 * This module provides methods to enhance the entropy (randomness) of
 * cryptographic operations by collecting additional entropy from various sources
 * and combining it with the system's built-in random number generator.
 *
 * This helps protect against weak or compromised random number generators
 * by adding multiple layers of entropy.
 */

import { EntropySource } from "../types";

/**
 * Entropy collection options
 */
export interface EntropyOptions {
    /**
     * Whether to collect timing entropy
     * @default true
     */
    useTiming?: boolean;

    /**
     * Whether to collect performance entropy
     * @default true
     */
    usePerformance?: boolean;

    /**
     * Whether to collect device entropy
     * @default true
     */
    useDevice?: boolean;

    /**
     * Whether to collect network entropy
     * @default false
     */
    useNetwork?: boolean;

    /**
     * Whether to collect user interaction entropy
     * @default false
     */
    useInteraction?: boolean;

    /**
     * Custom entropy sources to include
     */
    customSources?: Array<() => Uint8Array>;
}

/**
 * Entropy pool that collects and mixes entropy from multiple sources
 */
export class EntropyPool {
    private static instance: EntropyPool;
    private pool: Uint8Array;
    private poolSize: number;
    private poolPosition: number = 0;
    private reseedCounter: number = 0;
    private lastReseed: number = 0;
    private isInitialized: boolean = false;
    private entropyCollected: number = 0;
    private options: EntropyOptions;

    /**
     * Creates a new entropy pool
     *
     * @param poolSize - Size of the entropy pool in bytes
     * @param options - Entropy collection options
     */
    private constructor(poolSize: number = 1024, options: EntropyOptions = {}) {
        this.poolSize = poolSize;
        this.pool = new Uint8Array(poolSize);
        this.options = {
            useTiming: options.useTiming !== false,
            usePerformance: options.usePerformance !== false,
            useDevice: options.useDevice !== false,
            useNetwork: options.useNetwork || false,
            useInteraction: options.useInteraction || false,
            customSources: options.customSources || [],
        };

        // Initialize the pool with system random data
        this.initializePool();

        // Set up continuous entropy collection
        this.setupEntropyCollection();
    }

    /**
     * Gets the singleton instance of the entropy pool
     *
     * @param poolSize - Size of the entropy pool in bytes
     * @param options - Entropy collection options
     * @returns The entropy pool instance
     */
    public static getInstance(
        poolSize?: number,
        options?: EntropyOptions
    ): EntropyPool {
        if (!EntropyPool.instance) {
            EntropyPool.instance = new EntropyPool(poolSize, options);
        }
        return EntropyPool.instance;
    }

    /**
     * Initializes the entropy pool with system random data
     */
    private initializePool(): void {
        // Fill the pool with system random data
        if (
            typeof crypto !== "undefined" &&
            typeof crypto.getRandomValues === "function"
        ) {
            crypto.getRandomValues(this.pool);
        } else if (
            typeof window !== "undefined" &&
            typeof window.crypto !== "undefined" &&
            typeof window.crypto.getRandomValues === "function"
        ) {
            window.crypto.getRandomValues(this.pool);
        } else {
            // Fallback to less secure random data
            for (let i = 0; i < this.poolSize; i++) {
                this.pool[i] = Math.floor(Math.random() * 256);
            }
        }

        this.isInitialized = true;
        this.entropyCollected = this.poolSize * 8; // Bits of entropy
        this.lastReseed = Date.now();
    }

    /**
     * Sets up continuous entropy collection from various sources
     */
    private setupEntropyCollection(): void {
        // Collect timing entropy
        if (this.options.useTiming) {
            this.collectTimingEntropy();

            // Set up periodic collection
            setInterval(() => this.collectTimingEntropy(), 100);
        }

        // Collect performance entropy
        if (this.options.usePerformance && typeof performance !== "undefined") {
            this.collectPerformanceEntropy();

            // Set up periodic collection
            setInterval(() => this.collectPerformanceEntropy(), 500);
        }

        // Collect device entropy
        if (this.options.useDevice && typeof navigator !== "undefined") {
            this.collectDeviceEntropy();
        }

        // Collect network entropy
        if (this.options.useNetwork && typeof navigator !== "undefined") {
            // Set up periodic collection
            setInterval(() => this.collectNetworkEntropy(), 2000);
        }

        // Collect user interaction entropy
        if (this.options.useInteraction && typeof document !== "undefined") {
            this.setupInteractionCollection();
        }

        // Collect from custom sources
        if (
            this.options.customSources &&
            this.options.customSources.length > 0
        ) {
            for (const source of this.options.customSources) {
                try {
                    const entropy = source();
                    this.addEntropy(entropy);
                } catch (e) {
                    console.warn(
                        "Error collecting entropy from custom source:",
                        e
                    );
                }
            }
        }
    }

    /**
     * Collects entropy from timing variations
     */
    private collectTimingEntropy(): void {
        const buffer = new Uint8Array(8);
        const now = Date.now();
        const highRes =
            typeof performance !== "undefined" ? performance.now() : 0;

        // Use the lower bits of the timestamps which have more entropy
        const timeDiff = now - this.lastReseed;
        const timeDiffHigh = Math.floor(timeDiff / 256);
        const timeDiffLow = timeDiff % 256;

        const highResInt = Math.floor(highRes * 1000);
        const highResHigh = Math.floor(highResInt / 256);
        const highResLow = highResInt % 256;

        buffer[0] = timeDiffLow;
        buffer[1] = timeDiffHigh;
        buffer[2] = highResLow;
        buffer[3] = highResHigh;

        // Add some CPU timing jitter
        let jitter = 0;
        const startTime =
            typeof performance !== "undefined" ? performance.now() : Date.now();

        for (let i = 0; i < 10000; i++) {
            jitter = (jitter + i * 7) % 256;
        }

        const endTime =
            typeof performance !== "undefined" ? performance.now() : Date.now();
        const jitterTime = endTime - startTime;

        buffer[4] = jitter & 0xff;
        buffer[5] = (jitterTime * 1000) & 0xff;
        buffer[6] = Date.now() & 0xff;
        buffer[7] = (Math.random() * 256) & 0xff;

        // Add to the pool with estimated entropy (conservative estimate)
        this.addEntropy(buffer, 8); // Assume 1 bit of entropy per byte
    }

    /**
     * Collects entropy from performance measurements
     */
    private collectPerformanceEntropy(): void {
        if (typeof performance === "undefined") return;

        try {
            // Get performance data
            const memory = (performance as any).memory || {};
            const buffer = new Uint8Array(8);

            // Mix in performance timing values using modern Performance API
            let value = 0;

            // Use performance.now() and other non-deprecated values
            value ^= Math.floor(performance.now());

            // Use performance.timeOrigin if available
            if (performance.timeOrigin) {
                value ^= Math.floor(performance.timeOrigin);
            }

            // Use performance entries if available
            if (typeof performance.getEntriesByType === "function") {
                const navEntries = performance.getEntriesByType("navigation");
                if (navEntries && navEntries.length > 0) {
                    const nav = navEntries[0] as PerformanceNavigationTiming;
                    if (nav.connectEnd) value ^= Math.floor(nav.connectEnd);
                    if (nav.responseStart)
                        value ^= Math.floor(nav.responseStart);
                    if (nav.loadEventEnd) value ^= Math.floor(nav.loadEventEnd);
                }
            }

            buffer[0] = value & 0xff;
            buffer[1] = (value >> 8) & 0xff;

            // Mix in memory values if available
            if (memory.usedJSHeapSize) {
                buffer[2] = memory.usedJSHeapSize & 0xff;
                buffer[3] = (memory.usedJSHeapSize >> 8) & 0xff;
            }

            if (memory.totalJSHeapSize) {
                buffer[4] = memory.totalJSHeapSize & 0xff;
                buffer[5] = (memory.totalJSHeapSize >> 8) & 0xff;
            }

            // Add current time
            const now = Date.now();
            buffer[6] = now & 0xff;
            buffer[7] = (now >> 8) & 0xff;

            // Add to the pool with estimated entropy (conservative estimate)
            this.addEntropy(buffer, 4); // Assume 0.5 bits of entropy per byte
        } catch (e) {
            console.warn("Error collecting performance entropy:", e);
        }
    }

    /**
     * Collects entropy from device information
     */
    private collectDeviceEntropy(): void {
        if (typeof navigator === "undefined") return;

        try {
            // Collect various device properties
            const properties = [
                navigator.userAgent,
                navigator.language,
                navigator.languages?.join(","),
                // Use userAgentData instead of deprecated platform if available
                (navigator as any).userAgentData?.platform ||
                    // Fallback to derived info from userAgent
                    (navigator.userAgent.indexOf("Win") !== -1
                        ? "Windows"
                        : navigator.userAgent.indexOf("Mac") !== -1
                        ? "MacOS"
                        : navigator.userAgent.indexOf("Linux") !== -1
                        ? "Linux"
                        : "Unknown"),
                navigator.hardwareConcurrency?.toString(),
                (navigator as any).deviceMemory?.toString(),
                screen.width?.toString(),
                screen.height?.toString(),
                screen.colorDepth?.toString(),
                screen.pixelDepth?.toString(),
                new Date().getTimezoneOffset().toString(),
            ]
                .filter(Boolean)
                .join("|");

            // Hash the properties
            const buffer = new Uint8Array(16);
            let hash = 0;

            for (let i = 0; i < properties.length; i++) {
                hash = (hash << 5) - hash + properties.charCodeAt(i);
                hash = hash & hash; // Convert to 32-bit integer
            }

            // Spread the hash across the buffer
            for (let i = 0; i < 16; i += 4) {
                buffer[i] = (hash >> 24) & 0xff;
                buffer[i + 1] = (hash >> 16) & 0xff;
                buffer[i + 2] = (hash >> 8) & 0xff;
                buffer[i + 3] = hash & 0xff;

                // Evolve the hash
                hash = (hash << 5) - hash + i;
            }

            // Add to the pool with estimated entropy (conservative estimate)
            this.addEntropy(buffer, 16); // Assume 1 bit of entropy per byte
        } catch (e) {
            console.warn("Error collecting device entropy:", e);
        }
    }

    /**
     * Collects entropy from network information
     */
    private collectNetworkEntropy(): void {
        if (typeof navigator === "undefined") return;

        try {
            const connection = (navigator as any).connection;

            if (connection) {
                const buffer = new Uint8Array(4);

                // Mix in connection properties
                let value = 0;

                if (connection.downlink)
                    value ^= Math.floor(connection.downlink * 1000);
                if (connection.rtt) value ^= connection.rtt;
                if (connection.effectiveType) {
                    const effectiveType = connection.effectiveType as string;
                    const typeMap: Record<string, number> = {
                        "slow-2g": 1,
                        "2g": 2,
                        "3g": 3,
                        "4g": 4,
                        "5g": 5,
                    };
                    const typeValue = typeMap[effectiveType] || 0;

                    value ^= typeValue << 16;
                }

                buffer[0] = value & 0xff;
                buffer[1] = (value >> 8) & 0xff;
                buffer[2] = (value >> 16) & 0xff;
                buffer[3] = (value >> 24) & 0xff;

                // Add to the pool with estimated entropy (conservative estimate)
                this.addEntropy(buffer, 2); // Assume 0.5 bits of entropy per byte
            }
        } catch (e) {
            console.warn("Error collecting network entropy:", e);
        }
    }

    /**
     * Sets up collection of entropy from user interactions
     */
    private setupInteractionCollection(): void {
        if (typeof document === "undefined") return;

        try {
            // Mouse movement entropy
            document.addEventListener("mousemove", (event) => {
                const buffer = new Uint8Array(6);

                buffer[0] = event.clientX & 0xff;
                buffer[1] = (event.clientX >> 8) & 0xff;
                buffer[2] = event.clientY & 0xff;
                buffer[3] = (event.clientY >> 8) & 0xff;
                buffer[4] = event.timeStamp & 0xff;
                buffer[5] = (event.timeStamp >> 8) & 0xff;

                this.addEntropy(buffer, 2); // Assume 0.33 bits of entropy per byte
            });

            // Keyboard entropy
            document.addEventListener("keypress", (event) => {
                const buffer = new Uint8Array(4);

                buffer[0] = (event.key ? event.key.charCodeAt(0) : 0) & 0xff;
                buffer[1] = event.timeStamp & 0xff;
                buffer[2] = (event.timeStamp >> 8) & 0xff;
                buffer[3] = Date.now() & 0xff;

                this.addEntropy(buffer, 2); // Assume 0.5 bits of entropy per byte
            });

            // Touch entropy
            document.addEventListener("touchmove", (event) => {
                if (event.touches.length > 0) {
                    const touch = event.touches[0];
                    const buffer = new Uint8Array(6);

                    buffer[0] = touch.clientX & 0xff;
                    buffer[1] = (touch.clientX >> 8) & 0xff;
                    buffer[2] = touch.clientY & 0xff;
                    buffer[3] = (touch.clientY >> 8) & 0xff;
                    buffer[4] = event.timeStamp & 0xff;
                    buffer[5] = (event.timeStamp >> 8) & 0xff;

                    this.addEntropy(buffer, 2); // Assume 0.33 bits of entropy per byte
                }
            });
        } catch (e) {
            console.warn("Error setting up interaction entropy collection:", e);
        }
    }

    /**
     * Adds entropy to the pool
     *
     * @param data - Entropy data to add
     * @param estimatedEntropy - Estimated entropy in bits (conservative)
     */
    public addEntropy(data: Uint8Array, estimatedEntropy: number = 0): void {
        if (!this.isInitialized) {
            this.initializePool();
        }

        // Mix the entropy into the pool using a simple mixing function
        for (let i = 0; i < data.length; i++) {
            const poolIndex = (this.poolPosition + i) % this.poolSize;

            // Mix using XOR and rotation
            this.pool[poolIndex] ^= data[i];

            // Additional mixing
            const prev = (poolIndex + this.poolSize - 1) % this.poolSize;
            const next = (poolIndex + 1) % this.poolSize;

            this.pool[prev] = (this.pool[prev] + this.pool[poolIndex]) & 0xff;
            this.pool[next] = (this.pool[next] ^ this.pool[poolIndex]) & 0xff;
        }

        // Update pool position
        this.poolPosition = (this.poolPosition + data.length) % this.poolSize;

        // Track entropy collection
        this.entropyCollected += estimatedEntropy;
        this.reseedCounter++;

        // Periodically remix the entire pool
        if (this.reseedCounter >= 100 || Date.now() - this.lastReseed > 60000) {
            this.remixPool();
        }
    }

    /**
     * Remixes the entire entropy pool to distribute entropy
     */
    private remixPool(): void {
        // Simple mixing function to distribute entropy throughout the pool
        for (let round = 0; round < 3; round++) {
            for (let i = 0; i < this.poolSize; i++) {
                const prev = (i + this.poolSize - 1) % this.poolSize;
                const next = (i + 1) % this.poolSize;

                this.pool[i] =
                    (this.pool[i] ^ this.pool[prev] ^ this.pool[next]) & 0xff;
                this.pool[i] =
                    ((this.pool[i] << 1) | (this.pool[i] >> 7)) & 0xff; // Rotate left by 1
            }
        }

        this.reseedCounter = 0;
        this.lastReseed = Date.now();
    }

    /**
     * Gets random bytes from the entropy pool
     *
     * @param length - Number of bytes to get
     * @returns Random bytes
     */
    public getRandomBytes(length: number): Uint8Array {
        if (!this.isInitialized) {
            this.initializePool();
        }

        // Ensure we have enough entropy
        if (this.entropyCollected < length * 8) {
            console.warn(
                `Entropy pool has only ${this.entropyCollected} bits, but ${
                    length * 8
                } bits requested`
            );
        }

        // Create result buffer
        const result = new Uint8Array(length);

        // Get system random bytes
        let systemRandom: Uint8Array | null = null;

        if (
            typeof crypto !== "undefined" &&
            typeof crypto.getRandomValues === "function"
        ) {
            systemRandom = new Uint8Array(length);
            crypto.getRandomValues(systemRandom);
        } else if (
            typeof window !== "undefined" &&
            typeof window.crypto !== "undefined" &&
            typeof window.crypto.getRandomValues === "function"
        ) {
            systemRandom = new Uint8Array(length);
            window.crypto.getRandomValues(systemRandom);
        }

        // Mix pool entropy with system entropy
        for (let i = 0; i < length; i++) {
            // Get a byte from the pool
            const poolIndex = (this.poolPosition + i) % this.poolSize;
            let value = this.pool[poolIndex];

            // Mix with system random if available
            if (systemRandom) {
                value ^= systemRandom[i];
            } else {
                // Fallback to Math.random()
                value ^= Math.floor(Math.random() * 256);
            }

            result[i] = value;

            // Update the pool (feedback)
            this.pool[poolIndex] =
                (this.pool[poolIndex] ^ result[i] ^ i) & 0xff;
        }

        // Update pool position
        this.poolPosition = (this.poolPosition + length) % this.poolSize;

        // Deduct used entropy
        this.entropyCollected = Math.max(0, this.entropyCollected - length * 4); // Conservative estimate

        // Remix if we've used a lot of entropy
        if (this.entropyCollected < this.poolSize * 4) {
            this.remixPool();
        }

        return result;
    }

    /**
     * Gets the current entropy source
     *
     * @returns The current entropy source
     */
    public getEntropySource(): EntropySource {
        return EntropySource.CUSTOM;
    }

    /**
     * Gets the estimated amount of entropy collected
     *
     * @returns Estimated entropy in bits
     */
    public getEstimatedEntropy(): number {
        return this.entropyCollected;
    }
}

