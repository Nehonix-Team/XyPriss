/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2026 Nehonix. All rights reserved.
 ***************************************************************************** */

import {
    XyPrisRequest as Request,
    XyPrisResponse as Response,
    NextFunction,
    MiddlewareFunction,
} from "../../../types/httpServer.type";

/**
 * XMTG (XyPriss Middleware Topology Graph) Metadata & Configuration
 */
export interface XmtgOptions {
    /** Unique identifier for the middleware in the topology graph */
    id?: string;

    /** Explicitly declare whether this is an error handler */
    isErrorHandler?: boolean;

    /** Human-readable name or label */
    name?: string;

    /** Human-readable description for debugging and introspection */
    description?: string;

    /** Whether the middleware is active (default: true) */
    enabled?: boolean;

    /**
     * Sibling constraints: this middleware MUST execute BEFORE the specified middleware id(s).
     */
    before?: string | string[];

    /**
     * Sibling constraints: this middleware MUST execute AFTER the specified middleware id(s).
     */
    after?: string | string[];

    /** Strong placement constraint: enforce this middleware at the absolute head of the graph */
    first?: boolean;

    /** Strong placement constraint: enforce this middleware at the absolute tail of the graph */
    last?: boolean;

    /**
     * Numeric tie-breaker priority (lower number = higher precedence when no topological edge exists).
     * @default 100
     */
    priority?: number;

    /**
     * Confinement to specific XMS server IDs (e.g. ['authServer', 'mainServer']).
     * If undefined or empty, matches all servers.
     */
    servers?: string[];

    /**
     * Path / method targeting constraints for static route compilation.
     */
    match?: {
        path?: string | RegExp;
        methods?: string[];
        exclude?: (string | RegExp)[];
    };

    /**
     * Maximum execution duration in milliseconds for this specific middleware.
     * If exceeded, the middleware is short-circuited with an XMTG_TIMEOUT error.
     */
    timeoutMs?: number;
}

/**
 * An individual registered node in the XMTG topology graph.
 */
export interface XmtgNode {
    id: string;
    seq: number;
    options: XmtgOptions;
    handler: MiddlewareFunction;
    isErrorHandler: boolean; // handler.length === 4 or explicitly specified
}

/**
 * A compiled, route-attached immutable middleware item.
 */
export interface CompiledMiddlewareItem {
    id: string;
    handler: MiddlewareFunction;
    isErrorHandler: boolean;
    timeoutMs?: number;
}

/**
 * Pre-compiled, flattened pipeline ready for zero-overhead runtime dispatch.
 */
export interface CompiledPipeline {
    /** Route or Server identity this pipeline was compiled for */
    targetKey: string;
    /** Ordered list of executable middleware items */
    items: CompiledMiddlewareItem[];
}

