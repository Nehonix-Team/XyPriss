/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2026 Nehonix. All rights reserved.
 ***************************************************************************** */

import { Logger } from "../../shared/logger/Logger";
import {
    XyPrisRequest as Request,
    XyPrisResponse as Response,
    MiddlewareFunction,
} from "../../types/httpServer.type";
import {
    MiddlewareConfig,
    MiddlewareEntry,
} from "../../types/middlewareManager.types";
import { XmtgGraph } from "./xmtg/XmtgGraph";
import { XmtgCompiler } from "./xmtg/XmtgCompiler";
import { XmtgExecutor } from "./xmtg/XmtgExecutor";
import { XmtgOptions } from "./xmtg/XmtgTypes";

/**
 * High-Performance Middleware Manager powered by XMTG Topology Graph & AOT Compilation.
 * Handles middleware registration, graph dependency resolution, AOT route pipeline caching,
 * and high-throughput execution.
 */
export class MiddlewareManager {
    private graph: XmtgGraph = new XmtgGraph();
    private compiler: XmtgCompiler = new XmtgCompiler(this.graph);
    private legacyEntries: MiddlewareEntry[] = [];
    private logger: Logger;

    constructor(logger: Logger) {
        this.logger = logger;
        this.logger.debug("middleware", "Created XMTG-powered middleware manager");
    }

    /**
     * Get underlying XMTG graph engine
     */
    public getGraph(): XmtgGraph {
        return this.graph;
    }

    /**
     * Get XMTG AOT compiler
     */
    public getCompiler(): XmtgCompiler {
        return this.compiler;
    }

    /**
     * Register middleware with optional XMTG topological options
     */
    public use(
        handler: MiddlewareFunction,
        config: Partial<MiddlewareConfig> = {},
    ): void {
        const id = config.id || config.name || `mw_${this.legacyEntries.length + 1}`;
        const name = config.name || id;
        const enabled = config.enabled !== false;
        const priority = config.priority ?? 100;

        const xmtgOptions: XmtgOptions = {
            ...config,
            id,
            name,
            enabled,
            priority,
        };

        this.graph.addNode(handler, xmtgOptions);

        const entry: MiddlewareEntry = {
            config: {
                ...xmtgOptions,
                name,
                enabled,
                priority,
                description: config.description || "Custom middleware",
            },
            handler,
        };

        this.legacyEntries.push(entry);

        this.logger.debug(
            "middleware",
            `[XMTG] Registered node: ${id} (priority: ${priority})`,
        );
    }

    /**
     * Execute compiled AOT middleware pipeline for a request/response pair.
     * @returns true if all middleware completed successfully, false if chain was stopped or response ended.
     */
    public async execute(req: Request, res: Response): Promise<boolean> {
        try {
            const path = req.path || (req as any).url || "/";
            const method = req.method;
            const serverId = (req as any).serverId;

            const pipeline = this.compiler.compile({
                path,
                method,
                serverId,
            });

            return await XmtgExecutor.execute(pipeline.items, req, res);
        } catch (error) {
            this.logger.error(
                "middleware",
                "Request failed with unhandled error in XMTG executor:",
                error,
            );
            return false;
        }
    }

    /**
     * Get middleware statistics
     */
    public getStats(): {
        total: number;
        enabled: number;
        disabled: number;
        middleware: Array<{
            name: string;
            enabled: boolean;
            priority: number;
            description?: string;
        }>;
    } {
        const nodes = this.graph.getAllNodes();
        const enabled = nodes.filter((m) => m.options.enabled !== false);
        const disabled = nodes.filter((m) => m.options.enabled === false);

        return {
            total: nodes.length,
            enabled: enabled.length,
            disabled: disabled.length,
            middleware: nodes.map((m) => ({
                name: m.id,
                enabled: m.options.enabled !== false,
                priority: m.options.priority ?? 100,
                description: m.options.description,
            })),
        };
    }

    /**
     * Enable/disable middleware by ID or name
     */
    public setMiddlewareEnabled(name: string, enabled: boolean): boolean {
        const node = this.graph.getNode(name);
        if (node) {
            node.options.enabled = enabled;
            this.compiler.invalidateCache();
            this.logger.debug(
                "middleware",
                `[XMTG] ${enabled ? "Enabled" : "Disabled"} middleware: ${name}`,
            );
            return true;
        }

        const legacy = this.legacyEntries.find((m) => m.config.name === name || m.config.id === name);
        if (legacy) {
            legacy.config.enabled = enabled;
            return true;
        }

        return false;
    }

    /**
     * Clear all registered middleware and invalidate compiler cache
     */
    public clear(): void {
        this.graph = new XmtgGraph();
        this.compiler = new XmtgCompiler(this.graph);
        this.legacyEntries = [];
        this.logger.debug("middleware", `Cleared all XMTG middleware`);
    }

    /**
     * Get middleware by name
     */
    public getMiddleware(name: string): MiddlewareEntry | undefined {
        return this.legacyEntries.find(
            (m) => m.config.name === name || m.config.id === name,
        );
    }

    /**
     * List all middleware names
     */
    public listMiddleware(): string[] {
        return this.graph.getAllNodes().map((n) => n.id);
    }

    /**
     * Get all middleware entries
     */
    public getAllMiddleware(): MiddlewareEntry[] {
        return [...this.legacyEntries];
    }
}
