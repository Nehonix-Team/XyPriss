import { MiddlewareOptions } from "../types";

// Helper: Extract client IP robustly
export function getClientIp(req: any): string {
    let ip =
        req.headers["x-forwarded-for"]?.split(",")[0]?.trim() ||
        req.connection?.remoteAddress ||
        req.socket?.remoteAddress ||
        req.ip ||
        "0.0.0.0";
    // Normalize IPv6 localhost
    if (ip === "::1") ip = "127.0.0.1";
    // Remove IPv6 prefix
    if (ip.startsWith("::ffff:")) ip = ip.slice(7);
    return ip;
}

// Helper: Merge secure headers with user custom headers
export function setSecureHeaders(res: any, opts: MiddlewareOptions) {
    const headers = {
        "Content-Security-Policy": opts.contentSecurityPolicy,
        "X-Content-Type-Options": "nosniff",
        "X-Frame-Options": "DENY",
        "X-XSS-Protection": "1; mode=block",
        "Strict-Transport-Security":
            "max-age=31536000; includeSubDomains; preload",
        "Referrer-Policy": "strict-origin-when-cross-origin",
        "Permissions-Policy": "geolocation=(), camera=(), microphone=()",
        ...opts.customHeaders,
    };
    for (const [k, v] of Object.entries(headers)) {
        res.setHeader(k, v);
    }
}

// Helper: Get CSRF token from request
export function extractCSRFToken(
    req: any,
    opts: MiddlewareOptions
): string | undefined {
    // Support header, body, query, cookie
    return (
        req.headers[opts?.headerName?.toLowerCase() || "X-CSRF-Token"] ||
        req.body?._csrf ||
        req.query?._csrf ||
        req.cookies?.[opts?.cookieName || "nehonix-xypriss_csrf"]
    );
}

// Helper: Respond with error JSON
export function respondError(
    res: any,
    code: number,
    message: string,
    extra: any = {}
) {
    res.status(code).json({ error: message, code, ...extra });
}

