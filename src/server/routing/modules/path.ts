import { buildParamPattern } from "./helpers";
import { TYPED_PARAM_REGEX } from "./constants";
import { ParamConstraint } from "./types";

/** Path validation and normalization regexes */
export const PATH_PATTERNS = {
    leadingSlash: /^\/+/,
    trailingSlash: /\/+$/,
    multipleSlashes: /\/+/g,
    wildcardPattern: /\*+$/,
    pathValidation:
        /^\/(?:[a-zA-Z0-9\-._~:/?#[\]@!$&'()*+,;=\\<>{}|^]|%[0-9A-Fa-f]{2})*$/,
};

/** Normalize a path string */
export function normalizePath(path: string): string {
    if (path === "") return "/";
    if (path === undefined || path === null || typeof path !== "string") {
        throw new Error("Path must be a non-empty string");
    }
    let normalized = path.trim();
    if (!PATH_PATTERNS.leadingSlash.test(normalized)) {
        normalized = "/" + normalized;
    }
    if (normalized.length > 1) {
        normalized = normalized.replace(PATH_PATTERNS.trailingSlash, "");
    }
    normalized = normalized.replace(PATH_PATTERNS.multipleSlashes, "/");
    return normalized || "/";
}

/** Join two paths safely */
export function joinPaths(basePath: string, subPath: string): string {
    const normalizedBase = normalizePath(basePath);
    const normalizedSub = normalizePath(subPath);
    if (normalizedSub === "/") return normalizedBase;
    return normalizedBase === "/"
        ? normalizedSub
        : normalizedBase + normalizedSub;
}

/** Validate path format */
export function isValidPath(path: string): boolean {
    return PATH_PATTERNS.pathValidation.test(path);
}

/**
 * Compile a route pattern.
 * Supports:
 *  - :param           → standard param
 *  - :param<type>     → typed param (number, uuid, enum, …)
 *  - :param(regex)    → inline regex constraint
 *  - *                → single segment wildcard
 *  - **               → multi-segment wildcard
 */
export function compileRoutePattern(
    path: string,
    options: {
        strict?: boolean;
        caseSensitive?: boolean;
    },
): {
    pattern: RegExp;
    paramNames: string[];
    paramConstraints: Record<string, ParamConstraint>;
} {
    const paramNames: string[] = [];
    const paramConstraints: Record<string, ParamConstraint> = {};

    const parts: { type: "static" | "param"; value: string }[] = [];
    let lastIndex = 0;
    let match;

    TYPED_PARAM_REGEX.lastIndex = 0;
    while ((match = TYPED_PARAM_REGEX.exec(path)) !== null) {
        if (match.index > lastIndex) {
            parts.push({
                type: "static",
                value: path.substring(lastIndex, match.index),
            });
        }

        const [full, paramName, typeExpr, inlineRegex] = match;
        paramNames.push(paramName);

        let pattern = "([^/]+)";
        if (inlineRegex) {
            paramConstraints[paramName] = {
                name: paramName,
                type: "regex",
                options: inlineRegex,
            };
            pattern = `(${inlineRegex})`;
        } else if (typeExpr) {
            const { pattern: p, constraint } = buildParamPattern(typeExpr);
            paramConstraints[paramName] = {
                name: paramName,
                type: constraint,
            };
            pattern = `(${p})`;
        }

        parts.push({ type: "param", value: pattern });
        lastIndex = match.index + full.length;
    }

    if (lastIndex < path.length) {
        parts.push({
            type: "static",
            value: path.substring(lastIndex),
        });
    }

    let patternStr = parts
        .map((p) => {
            if (p.type === "static") {
                let s = p.value;
                if (PATH_PATTERNS.wildcardPattern.test(s)) {
                    const wildcardMatch = s.match(/\*+$/);
                    if (wildcardMatch) {
                        const wc = wildcardMatch[0].length;
                        const base = s.slice(0, -wc);
                        const escapedBase = base.replace(
                            /[*+?^${}()|[\]\\]/g,
                            "\\$&",
                        );
                        if (wc === 1) {
                            paramNames.push("*");
                            return escapedBase + "([^/]+)";
                        } else {
                            paramNames.push("**");
                            return escapedBase + "(.*)";
                        }
                    }
                }
                return s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
            }
            return p.value;
        })
        .join("");

    if (!options.strict && !patternStr.endsWith("/?")) {
        patternStr += "/?";
    }

    const flags = options.caseSensitive ? "" : "i";
    const pattern = new RegExp(`^${patternStr}$`, flags);

    return { pattern, paramNames, paramConstraints };
}

