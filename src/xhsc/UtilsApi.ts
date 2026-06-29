/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2025 Nehonix. All rights reserved.
 *
 * This License governs the use, modification, and distribution of software
 * provided by NEHONIX under its open source projects.
 * NEHONIX is committed to fostering collaborative innovation while strictly
 * protecting its intellectual property rights.
 * Violation of any term of this License will result in immediate termination of all granted rights
 * and may subject the violator to legal action.
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR IMPLIED,
 * INCLUDING BUT NOT LIMITED TO WARRANTIES OF MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE,
 * AND NON-INFRINGEMENT.
 * IN NO EVENT SHALL NEHONIX BE LIABLE FOR ANY DIRECT, INDIRECT, INCIDENTAL, SPECIAL, EXEMPLARY,
 * OR CONSEQUENTIAL DAMAGES ARISING FROM THE USE OR INABILITY TO USE THE SOFTWARE,
 * EVEN IF ADVISED OF THE POSSIBILITY OF SUCH DAMAGES.
 *
 ***************************************************************************** */
// import { initializeNativeApiBlocker } from "./server/core/NativeApiBlocker";

import { StringUtils } from "./utils/StringUtils";
import { NumberUtils } from "./utils/NumberUtils";
import { DateUtils } from "./utils/DateUtils";
import { ObjectUtils } from "./utils/ObjectUtils";
import { ArrayUtils } from "./utils/ArrayUtils";
import { AsyncUtils } from "./utils/AsyncUtils";
import { ValidationUtils } from "./utils/ValidationUtils";
import { IdUtils } from "./utils/IdUtils";
import { FunctionUtils } from "./utils/FunctionUtils";
import { LoggerUtils } from "./utils/LoggerUtils";

/**
 * **UtilsApi — XyPriss System Utility Module**
 *
 * A comprehensive, high-performance utility class for application development.
 * Utilities are grouped into specialized categories for better modularity.
 *
 * Exposed via `__sys__.utils`.
 *
 * @example
 * ```ts
 * __sys__.utils.num.formatBytes(1048576);      // "1 MB"
 * __sys__.utils.is.email("test@example.com");  // true
 * __sys__.utils.id.uuid();                     // "550e8400-e29b-41d4-a716-446655440000"
 *
 * // Logger — quick global usage
 * __sys__.utils.log.info("Server started", { port: 3000 });
 * __sys__.utils.log.success("User authenticated");
 * __sys__.utils.log.error("Connection refused", new Error("ECONNREFUSED"));
 *
 * // Logger — scoped instance with namespace
 * const log = __sys__.utils.createLogger({ namespace: "Auth", minLevel: "info" });
 * log.warn("Token expiring soon", { expiresIn: "5m" });
 *
 * // Logger — child namespace
 * const dbLog = log.child("DB"); // namespace → "Auth:DB"
 * dbLog.debug("Query executed", { rows: 42 });
 *
 * // Logger — execution timer
 * const stop = log.time("Fetch users");
 * await fetchUsers();
 * stop(); // ✅ [Auth] Fetch users — 38 ms
 * ```
 */
export class UtilsApi {
    /** **String Utilities** (`slugify`, `truncate`, `randomString`, etc.) */
    public readonly str = new StringUtils();

    /** **Number & Math Utilities** (`clamp`, `lerp`, `formatBytes`, etc.) */
    public readonly num = new NumberUtils();

    /** **Date & Time Utilities** (`formatDuration`, `timeAgo`, etc.) */
    public readonly date = new DateUtils();

    /** **Object Utilities** (`deepClone`, `parse`, `pick`, etc.) */
    public readonly obj = new ObjectUtils();

    /** **Array Utilities** (`chunk`, `unique`, `groupBy`, etc.) */
    public readonly arr = new ArrayUtils();

    /** **Async & Control Flow Utilities** (`sleep`, `retry`, `debounce`, etc.) */
    public readonly async = new AsyncUtils();

    /** **Validation Utilities** (`email`, `url`, `nullish`) */
    public readonly is = new ValidationUtils();

    /** **Identity Utilities** (`uuid`) */
    public readonly id = new IdUtils();

    /** **Functional Utilities** (`memo`) */
    public readonly fn = new FunctionUtils();

    /**
     * **Logger Utilities** — Structured, colorful console logger.
     *
     * This is the **global** logger instance (no namespace).
     * For scoped/namespaced loggers, use {@link UtilsApi.createLogger}.
     *
     * @example
     * ```ts
     * __sys__.utils.log.info("App ready");
     * __sys__.utils.log.warn("Low memory", { freeKb: 128 });
     * __sys__.utils.log.error("Crash", new Error("OOM"));
     * ```
     */
    public readonly log = new LoggerUtils();

    /**
     * **Create a scoped logger** with a custom namespace and options.
     *
     * Use this instead of `log` when you want per-module namespacing,
     * a minimum level filter, or plain-text output for CI environments.
     *
     * @example
     * ```ts
     * const log = __sys__.utils.createLogger({ namespace: "DB", minLevel: "warn" });
     * log.warn("Slow query detected", { ms: 850 });
     *
     * // Plain mode — no ANSI colors (great for log files / CI)
     * const ciLog = __sys__.utils.createLogger({ namespace: "CI", plain: true });
     * ```
     */
    public createLogger(
        opts: ConstructorParameters<typeof LoggerUtils>[0] = {},
    ): LoggerUtils {
        return new LoggerUtils(opts);
    }
}
