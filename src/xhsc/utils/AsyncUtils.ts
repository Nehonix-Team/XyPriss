/**
 * **AsyncUtils — XyPriss Async Control Flow**
 */
export class AsyncUtils {
    /**
     * **Asynchronous Delay**
     * @alias sleep
     */
    public wait(ms: number): Promise<void> {
        return this.sleep(ms);
    }

    /**
     * **Asynchronous Delay**
     */
    public sleep(ms: number): Promise<void> {
        return new Promise((resolve) => setTimeout(resolve, ms));
    }

    /**
     * **Retry Async Operation**
     */
    public async retry<T>(
        fn: () => Promise<T>,
        maxAtt: number = 3,
        dly: number = 500,
    ): Promise<T> {
        let lastError: any;
        for (let i = 0; i < maxAtt; i++) {
            try {
                return await fn();
            } catch (err) {
                lastError = err;
                if (i < maxAtt - 1) await this.sleep(dly);
            }
        }
        throw lastError;
    }

    /**
     * **Debounce Execution**
     */
    public debounce<T extends (...args: any[]) => any>(
        fn: T,
        wait: number = 300,
    ): (...args: Parameters<T>) => void {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        return (...args: Parameters<T>) => {
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => fn(...args), wait);
        };
    }

    /**
     * **Throttle Execution**
     */
    public throttle<T extends (...args: any[]) => any>(
        fn: T,
        limit: number = 300,
    ): (...args: Parameters<T>) => void {
        let inThrottle = false;
        return (...args: Parameters<T>) => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                setTimeout(() => (inThrottle = false), limit);
            }
        };
    }

    /**
     * **Measure High-Precision Execution Time**
     */
    public async measure<T>(
        fn: () => T | Promise<T>,
    ): Promise<{ result: T; durationMs: number }> {
        const start = performance.now();
        const result = await fn();
        return { result, durationMs: performance.now() - start };
    }

    /**
     * **High-Precision Drift-Corrected Interval**
     *
     * Répète une action de façon optimisée en compensant la dérive temporelle.
     */
    public async repeat(
        fn: (tick: number) => void | Promise<void>,
        ms: number,
        signal?: AbortSignal,
    ): Promise<void> {
        let count = 0;
        const startTime = Date.now();

        while (!signal?.aborted) {
            await fn(count++);

            const nextExpected = startTime + count * ms;
            const now = Date.now();
            const delay = nextExpected - now;

            if (delay > 0) {
                await this.sleep(delay);
            }
        }
    }
}

