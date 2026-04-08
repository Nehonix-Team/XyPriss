/**
 * List of flags reserved for internal XyPriss framework use only.
 * These flags must never be set directly by end-user (developer) code.
 * Unauthorized use will result in a fatal error at server creation time.
 */
export const internalFlags = ["isAuxiliary"] as const;

