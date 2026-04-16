/**
 * # AsyncUtils — XyPriss Async Control Flow
 *
 * A comprehensive library of asynchronous control flow primitives for TypeScript.
 * Each method is designed to be safe, performant, and composable.
 *
 * @example
 * ```ts
 * const async = new AsyncUtils();
 *
 * // Auto-retry + debounce + performance measurement in a few lines
 * const save = async.debounce(async (data: string) => {
 *   const { result, durationMs } = await async.measure(() =>
 *     async.retry(() => api.save(data), { maxAttempts: 3, delay: 1000 })
 *   );
 *   console.log(`Saved in ${durationMs.toFixed(1)}ms`, result);
 * }, 500);
 * ```
 *
 * @module AsyncUtils
 */

// ─── Types ────────────────────────────────────────────────────────────────────

/** Advanced options for {@link AsyncUtils.retry}. */
export interface RetryOptions {
    /** Maximum number of attempts. @default 3 */
    maxAttempts?: number;
    /** Initial delay between attempts (ms). @default 500 */
    delay?: number;
    /** Multiplicative factor for the delay at each attempt (exponential backoff). @default 1 */
    backoffFactor?: number;
    /** Maximum delay regardless of backoff (ms). @default Infinity */
    maxDelay?: number;
    /** Abort signal allowing to interrupt attempts at any time. */
    signal?: AbortSignal;
    /**
     * Optional predicate — returns `true` if the error is "retryable".
     * Useful for not retrying a 400 or 401 error that won't change.
     *
     * @example
     * ```ts
     * retryIf: (err) => err instanceof NetworkError
     * ```
     */
    retryIf?: (error: unknown, attempt: number) => boolean;
    /**
     * Callback called at each failed attempt (ideal for telemetry).
     *
     * @example
     * ```ts
     * onRetry: (err, attempt) => logger.warn(`Attempt ${attempt} failed`, err)
     * ```
     */
    onRetry?: (error: unknown, attempt: number) => void;
}

/** Options for {@link AsyncUtils.timeout}. */
export interface TimeoutOptions {
    /** Message of the error thrown in case of timeout. @default "Operation timed out" */
    message?: string;
    /** External signal allowing to cancel the promise before timeout. */
    signal?: AbortSignal;
}

/** Result of an execution via {@link AsyncUtils.measure}. */
export interface MeasureResult<T> {
    result: T;
    /** Operation duration in milliseconds (µs precision via `performance.now()`). */
    durationMs: number;
}

/** Result of an execution via {@link AsyncUtils.attempt}. */
export type AttemptResult<T> =
    | { ok: true; value: T; error?: never }
    | { ok: false; error: unknown; value?: never };

// ─── Class ────────────────────────────────────────────────────────────────────

export class AsyncUtils {
    // ─── Timing Primitives ───────────────────────────────────────────────────

    /**
     * ## Asynchronous Pause
     *
     * Suspends execution for a given duration.
     * Compatible with `AbortSignal`: sleep will be interrupted cleanly
     * if the signal is triggered (the promise **resolves** without error in this case).
     *
     * @param ms    - Pause duration in milliseconds.
     * @param signal - Optional cancellation signal (AbortController).
     * @returns A promise that resolves after `ms` ms (or earlier if signal triggered).
     *
     * @example Simple pause
     * ```ts
     * await utils.sleep(2000); // waits 2 seconds
     * ```
     *
     * @example Cancellation via AbortController
     * ```ts
     * const controller = new AbortController();
     * setTimeout(() => controller.abort(), 500);
     *
     * await utils.sleep(5000, controller.signal); // resolves after ~500ms
     * ```
     */
    public sleep(ms: number, signal?: AbortSignal): Promise<void> {
        return new Promise((resolve) => {
            if (signal?.aborted) return resolve();

            let timer: ReturnType<typeof setTimeout> | undefined;

            const onAbort = () => {
                if (timer) clearTimeout(timer);
                resolve();
            };

            timer = setTimeout(() => {
                signal?.removeEventListener("abort", onAbort);
                resolve();
            }, ms);

            signal?.addEventListener("abort", onAbort, { once: true });
        });
    }

    /**
     * ## Asynchronous Pause (alias of `sleep`)
     *
     * @alias sleep
     * @see {@link sleep}
     */
    public wait(ms: number, signal?: AbortSignal): Promise<void> {
        return this.sleep(ms, signal);
    }

    // ─── Robustness & Resilience ─────────────────────────────────────────────

    /**
     * ## Retry with Exponential Backoff
     *
     * Retries an asynchronous operation up to `maxAttempts` times.
     * Supports exponential backoff, maximum delay, filter predicate,
     * and `AbortSignal` to interrupt the retry cycle.
     *
     * Delay formula: `min(delay × backoffFactor^attempt, maxDelay)`.
     *
     * @param fn      - The asynchronous function to execute.
     * @param options - Retry options (see {@link RetryOptions}).
     * @returns Resolved value of `fn` on the first successful attempt.
     * @throws Last error if all attempts fail.
     *
     * @example Basic retry (3 attempts, 500ms between each)
     * ```ts
     * const data = await utils.retry(() => fetch("/api/data").then(r => r.json()));
     * ```
     *
     * @example Exponential backoff: 200ms → 400ms → 800ms → max 1000ms
     * ```ts
     * const result = await utils.retry(() => unstableApi(), {
     *   maxAttempts: 4,
     *   delay: 200,
     *   backoffFactor: 2,
     *   maxDelay: 1000,
     *   onRetry: (err, n) => console.warn(`Retry #${n}`, err),
     * });
     * ```
     *
     * @example Do not retry auth errors
     * ```ts
     * await utils.retry(() => api.call(), {
     *   retryIf: (err) => !(err instanceof AuthError),
     * });
     * ```
     */
    public async retry<T>(
        fn: () => Promise<T>,
        options: RetryOptions = {},
    ): Promise<T> {
        const {
            maxAttempts = 3,
            delay = 500,
            backoffFactor = 1,
            maxDelay = Infinity,
            signal,
            retryIf,
            onRetry,
        } = options;

        let lastError: unknown;

        for (let attempt = 0; attempt < maxAttempts; attempt++) {
            if (signal?.aborted)
                throw lastError ?? new DOMException("Aborted", "AbortError");

            try {
                return await fn();
            } catch (err) {
                lastError = err;

                if (retryIf && !retryIf(err, attempt + 1)) throw err;
                if (attempt < maxAttempts - 1) {
                    onRetry?.(err, attempt + 1);
                    const wait = Math.min(
                        delay * Math.pow(backoffFactor, attempt),
                        maxDelay,
                    );
                    await this.sleep(wait, signal);
                }
            }
        }

        throw lastError;
    }

    /**
     * ## Promise Timeout
     *
     * Wraps a promise with a maximum duration. If the promise does not
     * resolve within the given time, an `Error` is thrown.
     *
     * Automatically handles internal timer cleanup to prevent memory leaks.
     *
     * @param fn      - Function returning the promise to monitor.
     * @param ms      - Maximum delay in milliseconds before rejecting.
     * @param options - Additional options (error message, cancellation signal).
     * @returns Resolved value if the promise succeeds within delay.
     * @throws `Error` with `options.message` if timeout is reached.
     *
     * @example
     * ```ts
     * const result = await utils.timeout(
     *   () => fetch("/slow-api").then(r => r.json()),
     *   3000,
     *   { message: "API took too long to respond" }
     * );
     * ```
     */
    public timeout<T>(
        fn: () => Promise<T>,
        ms: number,
        options: TimeoutOptions = {},
    ): Promise<T> {
        const { message = "Operation timed out", signal } = options;

        return new Promise<T>((resolve, reject) => {
            const onAbort = () => {
                clearTimeout(timer);
                reject(new DOMException("Aborted", "AbortError"));
            };

            const timer = setTimeout(() => {
                signal?.removeEventListener("abort", onAbort);
                reject(new Error(message));
            }, ms);

            signal?.addEventListener("abort", onAbort, { once: true });

            fn().then(
                (val) => {
                    clearTimeout(timer);
                    signal?.removeEventListener("abort", onAbort);
                    resolve(val);
                },
                (err) => {
                    clearTimeout(timer);
                    signal?.removeEventListener("abort", onAbort);
                    reject(err);
                },
            );
        });
    }

    /**
     * ## Safe Execution (Never Throws)
     *
     * Executes an asynchronous function and always captures the result as a
     * discriminated object `{ ok, value }` or `{ ok, error }`.
     * **Never throws exceptions**, simplifying control flow.
     *
     * Ideal for API calls, parsing, or any operation where failure is a normal outcome
     * and must be handled explicitly.
     *
     * @param fn - Asynchronous function to execute safely.
     * @returns Discriminated object indicating success or failure.
     *
     * @example Without `attempt` (verbose)
     * ```ts
     * let user;
     * try { user = await fetchUser(id); }
     * catch (e) { console.error(e); return; }
     * ```
     *
     * @example With `attempt` (concise)
     * ```ts
     * const { ok, value: user, error } = await utils.attempt(() => fetchUser(id));
     * if (!ok) { console.error(error); return; }
     * // `user` is guaranteed defined here
     * ```
     *
     * @example Combined with `retry`
     * ```ts
     * const { ok, value } = await utils.attempt(() =>
     *   utils.retry(() => api.getData(), { maxAttempts: 5 })
     * );
     * ```
     */
    public async attempt<T>(fn: () => Promise<T>): Promise<AttemptResult<T>> {
        try {
            const value = await fn();
            return { ok: true, value };
        } catch (error) {
            return { ok: false, error };
        }
    }

    // ─── Rate Limiting & Flow Control ────────────────────────────────────────

    /**
     * ## Debounce
     *
     * Delays execution of `fn` until `wait` ms have elapsed since the last call.
     * If a new call arrives before the delay ends, the previous one is cancelled
     * and the timer restarts from zero.
     *
     * Typical use cases: search fields (prevents one request per keystroke),
     * resize listeners, auto-save.
     *
     * The returned version exposes a `.cancel()` method to manually cancel the
     * pending timer, and `.flush()` to trigger execution immediately.
     *
     * @param fn   - Function to debounce.
     * @param wait - Quiet period required before execution (ms). @default 300
     * @returns Debounced version of `fn` with `.cancel()` and `.flush()` methods.
     *
     * @example Real-time search
     * ```ts
     * const search = utils.debounce((query: string) => {
     *   fetch(`/api/search?q=${query}`);
     * }, 400);
     *
     * input.addEventListener("input", (e) => search(e.target.value));
     * ```
     *
     * @example Explicit cancellation (e.g., on component unmount)
     * ```ts
     * const save = utils.debounce(saveToServer, 1000);
     * onUnmount(() => save.cancel());
     * ```
     *
     * @example Immediate flush (e.g., before navigation)
     * ```ts
     * window.addEventListener("beforeunload", () => save.flush());
     * ```
     */
    public debounce<T extends (...args: any[]) => any>(
        fn: T,
        wait: number = 300,
    ): ((...args: Parameters<T>) => void) & {
        cancel: () => void;
        flush: (...args: Parameters<T>) => void;
    } {
        let timeout: ReturnType<typeof setTimeout> | null = null;
        let lastArgs: Parameters<T> | null = null;

        const debounced = (...args: Parameters<T>): void => {
            lastArgs = args;
            if (timeout) clearTimeout(timeout);
            timeout = setTimeout(() => {
                timeout = null;
                fn(...args);
            }, wait);
        };

        debounced.cancel = () => {
            if (timeout) {
                clearTimeout(timeout);
                timeout = null;
            }
        };

        debounced.flush = (...args: Parameters<T>): void => {
            debounced.cancel();
            fn(...(args.length ? args : (lastArgs ?? [])));
        };

        return debounced;
    }

    /**
     * ## Throttle
     *
     * Guarantees that `fn` executes no more than once per `limit` ms window,
     * regardless of how many calls are received.
     *
     * Unlike debounce, throttle executes `fn` **immediately** on the first call,
     * then ignores subsequent calls until the window ends.
     *
     * Typical use cases: scroll handlers, mousemove, drag-and-drop, gamepads.
     *
     * The returned version exposes a `.cancel()` method to manually reset the
     * throttle window.
     *
     * @param fn    - Function to throttle.
     * @param limit - Minimum duration between two executions (ms). @default 300
     * @returns Throttled version of `fn` with `.cancel()` method.
     *
     * @example Scroll handler limited to 60fps (~16ms)
     * ```ts
     * const onScroll = utils.throttle(() => {
     *   updateScrollIndicator();
     * }, 16);
     *
     * window.addEventListener("scroll", onScroll);
     * ```
     */
    public throttle<T extends (...args: any[]) => any>(
        fn: T,
        limit: number = 300,
    ): ((...args: Parameters<T>) => void) & { cancel: () => void } {
        let inThrottle = false;
        let timerId: ReturnType<typeof setTimeout> | null = null;

        const throttled = (...args: Parameters<T>): void => {
            if (!inThrottle) {
                fn(...args);
                inThrottle = true;
                timerId = setTimeout(() => {
                    inThrottle = false;
                }, limit);
            }
        };

        throttled.cancel = () => {
            if (timerId) {
                clearTimeout(timerId);
                timerId = null;
            }
            inThrottle = false;
        };

        return throttled;
    }

    // ─── Measurement & Diagnostics ──────────────────────────────────────────

    /**
     * ## High-Precision Execution Time Measurement
     *
     * Wraps a synchronous or asynchronous function and returns its result
     * along with its execution time in milliseconds (microsecond precision via `performance.now()`).
     *
     * @param fn - Function to measure (sync or async).
     * @returns An object `{ result, durationMs }`.
     *
     * @example Measuring an API call
     * ```ts
     * const { result, durationMs } = await utils.measure(() =>
     *   fetch("/api/heavy").then(r => r.json())
     * );
     * console.log(`Response received in ${durationMs.toFixed(2)}ms:`, result);
     * ```
     */
    public async measure<T>(
        fn: () => T | Promise<T>,
    ): Promise<MeasureResult<T>> {
        const start = performance.now();
        const result = await fn();
        return { result, durationMs: performance.now() - start };
    }

    // ─── Intervals & Loops ───────────────────────────────────────────────────

    /**
     * ## High-Precision Drift-Corrected Interval
     *
     * Repeatedly executes `fn` with automatic compensation for accumulated
     * clock drift. Unlike `setInterval`, this implementation adjusts each delay
     * based on actual elapsed time.
     *
     * The current tick count is passed as a parameter to `fn`, enabling
     * animations or progression counting.
     *
     * Execution stops cleanly when `signal` is aborted.
     *
     * @param fn     - Callback called at each tick, receiving the tick index (0-indexed).
     * @param ms     - Target interval in milliseconds.
     * @param signal - `AbortSignal` to stop the loop.
     * @returns A promise that resolves when the signal is aborted.
     *
     * @example Counter update every second
     * ```ts
     * const controller = new AbortController();
     *
     * utils.repeat((tick) => {
     *   console.log(`Tick ${tick} — ${new Date().toLocaleTimeString()}`);
     * }, 1000, controller.signal);
     *
     * // Stop after 5 seconds
     * setTimeout(() => controller.abort(), 5000);
     * ```
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
            const delay = nextExpected - Date.now();

            if (delay > 0) await this.sleep(delay, signal);
        }
    }

    /**
     * ## Parallel Execution with Limited Concurrency
     *
     * Processes an array of values in parallel via `fn`, limiting the number
     * of active promises simultaneously to `concurrency`. Results are returned
     * in the same order as inputs.
     *
     * Ideal for scenarios where you want to avoid saturating a server or database
     * with thousands of simultaneous requests.
     *
     * @param items       - Array of items to process.
     * @param fn          - Asynchronous function applied to each element.
     * @param concurrency - Maximum number of active parallel promises. @default 5
     * @returns Array of results in the same order as `items`.
     *
     * @example Batch file import (max 3 at a time)
     * ```ts
     * const files = ["f1.csv", "f2.csv", "f3.csv", "f4.csv"];
     * const results = await utils.pool(files, f => importFile(f), 3);
     * ```
     */
    public async pool<T, R>(
        items: T[],
        fn: (item: T, index: number) => Promise<R>,
        concurrency: number = 5,
    ): Promise<R[]> {
        const results: R[] = new Array(items.length);
        let index = 0;

        const worker = async (): Promise<void> => {
            while (index < items.length) {
                const i = index++;
                results[i] = await fn(items[i], i);
            }
        };

        const workers = Array.from(
            { length: Math.min(concurrency, items.length) },
            worker,
        );

        await Promise.all(workers);
        return results;
    }

    /**
     * ## Race with Built-in Timeout
     *
     * Launches multiple promises in parallel and returns the first one to resolve.
     * If none resolve within `timeoutMs`, an error is thrown.
     *
     * Similar to `Promise.race`, but with an integrated temporal safety net.
     *
     * @param fns       - Array of functions returning promises.
     * @param timeoutMs - Maximum delay in milliseconds. @default Infinity
     * @returns Value of the first resolved promise.
     * @throws `Error("Race timed out")` if timeout is reached.
     */
    public race<T>(
        fns: Array<() => Promise<T>>,
        timeoutMs: number = Infinity,
    ): Promise<T> {
        const promises: Promise<T>[] = fns.map((fn) => fn());

        if (timeoutMs !== Infinity) {
            promises.push(
                this.sleep(timeoutMs).then(() => {
                    throw new Error("Race timed out");
                }),
            );
        }

        return Promise.race(promises);
    }

    // ─── Advanced Patterns ───────────────────────────────────────────────────

    /**
     * ## Async Memoization with TTL
     *
     * Returns a memoized version of `fn`: results are cached for `ttlMs` milliseconds.
     * After this delay, the next call triggers a fresh execution.
     *
     * If multiple identical calls arrive simultaneously (while the promise is pending),
     * they share the same promise — avoiding "thundering herd" on cold caches.
     *
     * @param fn    - Asynchronous function to memoize.
     * @param ttlMs - Cache entry TTL (ms). `0` = no expiration.
     * @param keyFn - Serialization function for arguments into cache keys.
     *                @default `JSON.stringify`
     * @returns Memoized version of `fn` with `.clear()` method.
     */
    public memoize<TArgs extends any[], TResult>(
        fn: (...args: TArgs) => Promise<TResult>,
        ttlMs: number = 0,
        keyFn: (...args: TArgs) => string = (...args) => JSON.stringify(args),
    ): ((...args: TArgs) => Promise<TResult>) & { clear: () => void } {
        type CacheEntry = { promise: Promise<TResult>; expiresAt: number };
        const cache = new Map<string, CacheEntry>();

        const memoized = (...args: TArgs): Promise<TResult> => {
            const key = keyFn(...args);
            const now = Date.now();
            const entry = cache.get(key);

            if (entry && (ttlMs === 0 || entry.expiresAt > now)) {
                return entry.promise;
            }

            const promise = fn(...args).catch((err) => {
                cache.delete(key);
                throw err;
            });

            cache.set(key, {
                promise,
                expiresAt: ttlMs > 0 ? now + ttlMs : Infinity,
            });

            return promise;
        };

        memoized.clear = () => cache.clear();
        return memoized;
    }

    /**
     * ## Sequential Queue
     *
     * Guarantees that tasks are executed **one by one, in the order they were added**.
     * Tasks submitted while another is pending are queued and executed sequentially.
     *
     * Unlike `pool(items, fn, 1)`, `queue` allows adding tasks dynamically over time.
     *
     * @returns An object `{ add, size }`:
     *   - `add(fn)` — Enqueues a task and returns a promise for its result.
     *   - `size` — Getter for the current number of pending tasks.
     *
     * @example Critical Database Mutation
     * ```ts
     * const db = utils.queue();
     *
     * async function transfer(from: string, to: string, amount: number) {
     *   return db.add(async () => {
     *     const balance = await getBalance(from);
     *     if (balance < amount) throw new Error("Insufficient funds");
     *     await debit(from, amount);
     *     await credit(to, amount);
     *   });
     * }
     * ```
     */
    public queue(): {
        add: <T>(fn: () => Promise<T>) => Promise<T>;
        readonly size: number;
    } {
        let chain: Promise<unknown> = Promise.resolve();
        let pending = 0;

        return {
            add<T>(fn: () => Promise<T>): Promise<T> {
                pending++;
                const result = chain.then(fn).finally(() => {
                    pending--;
                });
                chain = result.catch(() => {});
                return result as Promise<T>;
            },
            get size() {
                return pending;
            },
        };
    }

    /**
     * ## Once — Guaranteed Single Execution
     *
     * Returns a version of `fn` that executes only **once**, regardless of how
     * many calls are made. Subsequent calls receive the cached promise or value
     * without re-executing `fn`.
     *
     * Particularly useful for expensive initializations (DB connections, config loading).
     *
     * @param fn - The function to execute exactly once.
     * @returns A function that always returns the same resolved promise.
     */
    public once<TArgs extends any[], TResult>(
        fn: (...args: TArgs) => Promise<TResult>,
    ): (...args: TArgs) => Promise<TResult> {
        let promise: Promise<TResult> | null = null;
        return (...args: TArgs): Promise<TResult> => {
            if (!promise) promise = fn(...args);
            return promise;
        };
    }

    /**
     * ## Conditional Polling
     *
     * Repeatedly polls `fn` until `predicate` returns `true` or a signal is aborted.
     *
     * @param fn        - Asynchronous function returning value to test.
     * @param predicate - Success condition for the returned value.
     * @param interval  - Delay between attempts (ms). @default 1000
     * @param signal    - `AbortSignal` to stop polling.
     * @returns The value for which `predicate` returned `true`.
     * @throws `DOMException("AbortError")` if signal is aborted before success.
     */
    public async poll<T>(
        fn: () => Promise<T>,
        predicate: (value: T) => boolean,
        interval: number = 1000,
        signal?: AbortSignal,
    ): Promise<T> {
        while (true) {
            if (signal?.aborted)
                throw new DOMException("Aborted", "AbortError");

            const value = await fn();
            if (predicate(value)) return value;

            await this.sleep(interval, signal);
        }
    }
}

