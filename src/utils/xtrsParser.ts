/**
 * @fileoverview XTRS (Temporal Rate Shield) rule parser & duration utility
 * @module XyPriss/utils/xtrsParser
 */

export interface XtrsParsedRule {
    max: number;
    windowMs: number;
    message?: string | Record<string, any>;
    statusCode?: number;
    blockDurationMs?: number;
    retryAfterMs?: number;
    raw?: string;
}

/**
 * Parses duration strings like '1s', '15m', '1h', '1d', '500ms' into milliseconds.
 */
export function parseDurationMs(durationStr: string): number {
    const match = durationStr.trim().match(/^(\d+(?:\.\d+)?)\s*([a-z]+)?$/i);
    if (!match) {
        throw new Error(`[XTRS] Invalid duration format: "${durationStr}"`);
    }

    const value = parseFloat(match[1]);
    const unit = (match[2] || "s").toLowerCase();

    switch (unit) {
        case "ms":
        case "millisecond":
        case "milliseconds":
            return Math.ceil(value);
        case "s":
        case "sec":
        case "second":
        case "seconds":
            return Math.ceil(value * 1000);
        case "m":
        case "min":
        case "minute":
        case "minutes":
            return Math.ceil(value * 60 * 1000);
        case "h":
        case "hr":
        case "hour":
        case "hours":
            return Math.ceil(value * 60 * 60 * 1000);
        case "d":
        case "day":
        case "days":
            return Math.ceil(value * 24 * 60 * 60 * 1000);
        default:
            throw new Error(
                `[XTRS] Unknown time unit "${unit}" in duration "${durationStr}"`,
            );
    }
}

/**
 * Parses blockDuration or retryAfter values into milliseconds.
 */
export function parseBlockDuration(duration?: string | number): number | undefined {
    if (duration === undefined || duration === null) return undefined;
    if (typeof duration === "number") return Math.ceil(duration);
    if (typeof duration === "string") return parseDurationMs(duration);
    return undefined;
}

/**
 * Parses a single XTRS rule expression ("10/1s", "300/1m") or rule object.
 */
export function parseXtrsRule(
    rule:
        | string
        | {
              rule?: string | { max: number; windowMs: number };
              max?: number;
              windowMs?: number;
              message?: string | Record<string, any>;
              statusCode?: number;
              blockDuration?: string | number;
              retryAfter?: string | number;
          },
    defaultMessage?: string | Record<string, any>,
    defaultStatusCode?: number,
    defaultBlockDuration?: string | number,
): XtrsParsedRule {
    let max = 0;
    let windowMs = 0;
    let raw: string | undefined = undefined;
    let message = defaultMessage;
    let statusCode = defaultStatusCode;
    let blockDurationVal = defaultBlockDuration;

    if (typeof rule === "object" && rule !== null) {
        if (rule.message !== undefined) message = rule.message;
        if (rule.statusCode !== undefined) statusCode = rule.statusCode;
        if (rule.blockDuration !== undefined) blockDurationVal = rule.blockDuration;
        if (rule.retryAfter !== undefined) blockDurationVal = rule.retryAfter;

        if (rule.rule) {
            if (typeof rule.rule === "string") {
                const parsed = parseXtrsRule(rule.rule);
                max = parsed.max;
                windowMs = parsed.windowMs;
                raw = parsed.raw;
            } else if (typeof rule.rule === "object") {
                max = Number(rule.rule.max);
                windowMs = Number(rule.rule.windowMs);
            }
        } else if (rule.max !== undefined) {
            max = Number(rule.max);
            windowMs = Number(rule.windowMs || 60 * 1000);
        }

        const blockDurationMs = parseBlockDuration(blockDurationVal);
        return {
            max,
            windowMs,
            message,
            statusCode,
            blockDurationMs,
            retryAfterMs: blockDurationMs ?? windowMs,
            raw,
        };
    }

    const str = String(rule).trim();
    if (str.includes("/")) {
        const [maxStr, durationStr] = str.split("/").map((s) => s.trim());
        max = parseInt(maxStr, 10);
        if (isNaN(max) || max <= 0) {
            throw new Error(
                `[XTRS] Invalid max request count "${maxStr}" in rule "${str}"`,
            );
        }
        windowMs = parseDurationMs(durationStr);
        const blockDurationMs = parseBlockDuration(blockDurationVal);
        return {
            max,
            windowMs,
            message,
            statusCode,
            blockDurationMs,
            retryAfterMs: blockDurationMs ?? windowMs,
            raw: str,
        };
    }

    // Single number string like "100" (defaulting to 1 minute = 60,000 ms)
    max = parseInt(str, 10);
    if (!isNaN(max) && max > 0) {
        windowMs = 60 * 1000;
        const blockDurationMs = parseBlockDuration(blockDurationVal);
        return {
            max,
            windowMs,
            message,
            statusCode,
            blockDurationMs,
            retryAfterMs: blockDurationMs ?? windowMs,
            raw: str,
        };
    }

    throw new Error(
        `[XTRS] Unrecognized rule format: "${str}". Expected format like "10/1s", "300/1m", "5000/1h"`,
    );
}

/**
 * Normalizes RateLimitConfig rules input into an array of XtrsParsedRule objects.
 */
export function normalizeXtrsRules(config: any): XtrsParsedRule[] {
    if (!config) return [];

    let inputRules: any[] = [];
    let defaultMessage: string | Record<string, any> | undefined = undefined;
    let defaultStatusCode: number | undefined = undefined;

    if (typeof config === "string") {
        inputRules = [config];
    } else if (Array.isArray(config)) {
        inputRules = config;
    } else if (typeof config === "object") {
        const xtrsObj =
            typeof config.xtrs === "object" && !Array.isArray(config.xtrs)
                ? config.xtrs
                : undefined;

        defaultMessage = xtrsObj?.message ?? config.message;
        defaultStatusCode = xtrsObj?.statusCode ?? config.statusCode;

        const rulesSource = config.rules ?? xtrsObj?.rules;
        const limitSource = config.limit ?? xtrsObj?.limit;
        const xtrsDirect =
            Array.isArray(config.xtrs) || typeof config.xtrs === "string"
                ? config.xtrs
                : undefined;

        if (rulesSource) {
            inputRules = Array.isArray(rulesSource)
                ? rulesSource
                : [rulesSource];
        } else if (limitSource) {
            inputRules = Array.isArray(limitSource)
                ? limitSource
                : [limitSource];
        } else if (xtrsDirect) {
            inputRules = Array.isArray(xtrsDirect)
                ? xtrsDirect
                : [xtrsDirect];
        } else if (config.max !== undefined) {
            const winMs =
                config.windowMs ??
                (config.window ? parseDurationMs(String(config.window)) : 60 * 1000);
            inputRules = [
                {
                    max: config.max,
                    windowMs: winMs,
                },
            ];
        }
    }

    return inputRules.map((r) =>
        parseXtrsRule(
            r,
            defaultMessage,
            defaultStatusCode,
        ),
    );
}
