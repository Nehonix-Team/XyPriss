/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2026 Nehonix. All rights reserved.
 ***************************************************************************** */

import { MiddlewareFunction } from "./httpServer.type";
import { XmtgOptions } from "../server/middleware/xmtg/XmtgTypes";

/**
 * Middleware configuration (extends XMTG topological options)
 */
export interface MiddlewareConfig extends XmtgOptions {
    name?: string;
    enabled?: boolean;
    priority?: number; // Lower numbers = higher priority
    description?: string;
}

/**
 * Middleware entry
 */
export interface MiddlewareEntry {
    config: MiddlewareConfig;
    handler: MiddlewareFunction;
}
