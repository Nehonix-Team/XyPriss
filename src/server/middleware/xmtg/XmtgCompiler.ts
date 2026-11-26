/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2026 Nehonix. All rights reserved.
 ***************************************************************************** */

import {
    XmtgNode,
    CompiledPipeline,
    CompiledMiddlewareItem,
} from "./XmtgTypes";
import { XmtgGraph } from "./XmtgGraph";

export interface CompileContext {
    serverId?: string;
    path: string;
    method?: string;
}

const MAX_CACHE_ENTRIES = 1000;

/**
 * XMTG Pipeline Compiler
 *
 * Pre-compiles the topological middleware graph into static, route-attached
 * immutable pipelines. Eliminates all dynamic path checks and metadata evaluation
 * from the request lifecycle.
 */
export class XmtgCompiler {
    private cache: Map<string, CompiledPipeline> = new Map();
    private lastGraphVersion = -1;

    constructor(private graph: XmtgGraph) {}

    /**
     * Clear the compiled pipeline cache (e.g. after registering new routes or hot reloading).
     */
    public invalidateCache(): void {
        this.cache.clear();
    }

    /**
     * Compile a deterministic, flattened pipeline for a given route and server context.
     */
    public compile(context: CompileContext): CompiledPipeline {
        // Auto-invalidate cache if the underlying graph topology changed
        if (this.graph.version !== this.lastGraphVersion) {
            this.cache.clear();
            this.lastGraphVersion = this.graph.version;
        }

        const cacheKey = `${context.serverId || "global"}::${context.method || "*"}::${context.path}`;
        const cached = this.cache.get(cacheKey);
        if (cached) {
            return cached;
        }

        const orderedNodes = this.graph.resolveOrder();
        const items: CompiledMiddlewareItem[] = [];

        for (const node of orderedNodes) {
            if (!this.matchesContext(node, context)) {
                continue;
            }

            items.push({
                id: node.id,
                handler: node.handler,
                isErrorHandler: node.isErrorHandler,
                timeoutMs: node.options.timeoutMs,
            });
        }

        const pipeline: CompiledPipeline = {
            targetKey: cacheKey,
            items,
        };

        // Bound cache size to prevent unbounded memory growth on dynamic / randomized paths
        if (this.cache.size >= MAX_CACHE_ENTRIES) {
            const firstKey = this.cache.keys().next().value;
            if (firstKey !== undefined) {
                this.cache.delete(firstKey);
            }
        }

        this.cache.set(cacheKey, pipeline);
        return pipeline;
    }

    /**
     * Check whether a path segment matches target path respecting slash boundaries.
     * e.g., '/admin' matches '/admin' or '/admin/users', but NOT '/administrator' or '/admin-panel'.
     */
    private matchPathPrefix(targetPath: string, prefix: string): boolean {
        if (prefix === "/" || targetPath === prefix) {
            return true;
        }
        const boundary = prefix.endsWith("/") ? prefix : prefix + "/";
        return targetPath.startsWith(boundary);
    }

    /**
     * Check whether an XMTG node matches the target compilation context.
     */
    private matchesContext(node: XmtgNode, ctx: CompileContext): boolean {
        const opts = node.options;

        // 1. Server ID filtering (Multi-Server XMS)
        if (opts.servers && opts.servers.length > 0) {
            if (!ctx.serverId || !opts.servers.includes(ctx.serverId)) {
                return false;
            }
        }

        // 2. Path matching
        if (opts.match?.path) {
            const matcher = opts.match.path;
            if (typeof matcher === "string") {
                if (!this.matchPathPrefix(ctx.path, matcher)) {
                    return false;
                }
            } else if (matcher instanceof RegExp) {
                if (matcher.global || matcher.sticky) {
                    matcher.lastIndex = 0;
                }
                if (!matcher.test(ctx.path)) {
                    return false;
                }
            }
        }

        // 3. HTTP method matching
        if (
            opts.match?.methods &&
            opts.match.methods.length > 0 &&
            ctx.method
        ) {
            const admittedMethods = opts.match.methods.map((m) =>
                m.toUpperCase(),
            );
            if (!admittedMethods.includes(ctx.method.toUpperCase())) {
                return false;
            }
        }

        // 4. Path exclusion
        if (opts.match?.exclude && opts.match.exclude.length > 0) {
            for (const excl of opts.match.exclude) {
                if (typeof excl === "string") {
                    if (this.matchPathPrefix(ctx.path, excl)) {
                        return false;
                    }
                } else if (excl instanceof RegExp) {
                    if (excl.global || excl.sticky) {
                        excl.lastIndex = 0;
                    }
                    if (excl.test(ctx.path)) {
                        return false;
                    }
                }
            }
        }

        return true;
    }
}

