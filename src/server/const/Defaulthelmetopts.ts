import { getSysApi } from "../../plugins/const/getSysApi";
import { HelmetConfig } from "../../types/mod/security";
import { logger } from "../../shared/logger/Logger";

type TSec = HelmetConfig;

/**
 * Determines whether the relaxed (development) security profile should be applied.
 *
 * Dev mode is only enabled when BOTH conditions are true:
 *   1. The runtime environment reports development mode (`NODE_ENV` / equivalent).
 *   2. The `XSEC_TRUST` environment variable is not explicitly set to a value
 *      other than `"true"` (it defaults to `"true"` when unset).
 *
 * This allows an operator to keep `NODE_ENV=development` while still forcing
 * the strict, production-grade security headers by setting `XSEC_TRUST=false`
 * in the `.env` file — useful for staging environments that mimic dev but
 * must not relax CSP/HSTS/COEP.
 */
const isDev =
    getSysApi().__env__.isDevelopment() &&
    getSysApi().__env__.get("XSEC_TRUST", "true") === "true";

/**
 * "Trusted" third-party origins, allowed in the CSP directives ONLY when
 * running in dev mode. Never exposed in production builds.
 */
const TRUSTED_EXTERNAL = {
    scripts: ["https://cdnjs.cloudflare.com", "https://cdn.jsdelivr.net"],
    styles: ["https://fonts.googleapis.com", "https://cdnjs.cloudflare.com"],
    fonts: ["https://fonts.gstatic.com"],
    images: ["https://dll.nehonix.com"],
    connect: ["https://dll.nehonix.com", "https://api.nehonix.com"],
} as const;

/**
 * Localhost origins, allowed in the CSP directives ONLY when running in dev
 * mode (HTTP/WS, both `localhost` and `127.0.0.1`, any port).
 */
const LOCALHOST = [
    "http://localhost:*",
    "http://127.0.0.1:*",
    "ws://localhost:*",
    "ws://127.0.0.1:*",
];

/** Returns the given sources only when `isDev` is true, otherwise an empty array. */
const devOnly = <T>(...sources: T[]): T[] => (isDev ? sources : []);

/** Returns a copy of the given source list only when `isDev` is true, otherwise an empty array. */
const devSources = (srcs: readonly string[]): string[] =>
    isDev ? [...srcs] : [];

/**
 * Default Helmet configuration for the application.
 *
 * Security posture:
 *   - Production: strict CSP (self-only), COEP/CORP enforced, HSTS enabled,
 *     no DNS prefetch, `strict-origin-when-cross-origin` referrer policy.
 *   - Development: CSP relaxed to allow trusted CDNs/fonts/APIs and
 *     localhost, COEP/CORP relaxed, HSTS disabled, DNS prefetch allowed.
 *
 * See `isDev` above for how the active profile is determined.
 */
export const defaultHelmetOpts: TSec = {
    contentSecurityPolicy: {
        directives: {
            defaultSrc: ["'self'"],

            scriptSrc: [
                "'self'",
                "'unsafe-inline'", // prod: self only
                ...devSources(TRUSTED_EXTERNAL.scripts), // dev: cdnjs, jsdelivr...
                ...devOnly(...LOCALHOST), // dev: localhost
            ],

            styleSrc: [
                "'self'",
                "'unsafe-inline'",
                ...devSources(TRUSTED_EXTERNAL.styles), // dev: google fonts, cdnjs
                ...devOnly(...LOCALHOST),
            ],

            fontSrc: [
                "'self'",
                ...devSources(TRUSTED_EXTERNAL.fonts), // dev: gstatic
            ],

            imgSrc: [
                "'self'",
                "data:",
                ...devSources(TRUSTED_EXTERNAL.images), // dev: dll.nehonix.com
                ...devOnly(...LOCALHOST),
            ],

            connectSrc: [
                "'self'",
                ...devSources(TRUSTED_EXTERNAL.connect), // dev: nehonix APIs
                ...devOnly(...LOCALHOST),
            ],

            frameSrc: ["'none'"],
            objectSrc: ["'none'"],
            mediaSrc: ["'self'"],
            workerSrc: ["'self'", "blob:"],
        },
    },

    // Zero Trust: strict COEP/CORP in production, relaxed in dev
    crossOriginEmbedderPolicy: isDev ? false : true,
    crossOriginOpenerPolicy: true,
    crossOriginResourcePolicy: {
        policy: isDev ? "cross-origin" : "same-origin",
    },

    dnsPrefetchControl: { allow: isDev }, // no point exposing DNS prefetch in prod
    frameguard: { action: "deny" },
    hidePoweredBy: true,

    hsts: {
        maxAge: isDev ? 0 : 31536000, // no HSTS in dev
        includeSubDomains: !isDev,
        preload: false,
    },

    ieNoOpen: true,
    noSniff: true,
    originAgentCluster: true,
    permittedCrossDomainPolicies: false,
    referrerPolicy: {
        policy: isDev ? "no-referrer" : "strict-origin-when-cross-origin",
    },
    xssFilter: true,
};

// Log a warning if the development profile is active
if (isDev) {
    logger.warn(
        "security",
        "Development security profile active. CSP, COEP, and CORP headers are relaxed for local development. Learn more or customize: https://xypriss.nehonix.com/docs/security/enhanced-csp-configuration#development-security-profile-automatic",
    );
}
