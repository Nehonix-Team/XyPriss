/**
 * XyPriss Router System Exports
 */

export { XyPrissRouter, Router } from "./Router";

export type {
    /**
     * Alias for XyPrisRequest
     */
    XyPrisRequest as XRequest,
    /**
     * Alias for XyPrisResponse
     */
    XyPrisResponse as XResponse,
} from "./modules/types";

export type { XyPrisRequest, XyPrisResponse } from "./modules/types";

// Default export for convenience (Express-like)
export { Router as default } from "./Router";

