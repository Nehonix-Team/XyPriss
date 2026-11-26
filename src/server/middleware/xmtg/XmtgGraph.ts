/***************************************************************************
 * XyPrissJS - Fast And Secure
 *
 * @author Nehonix
 * @license Nehonix OSL (NOSL)
 *
 * Copyright (c) 2026 Nehonix. All rights reserved.
 ***************************************************************************** */

import { XmtgNode, XmtgOptions } from "./XmtgTypes";
import { MiddlewareFunction } from "../../../types/httpServer.type";

/**
 * Custom error thrown when a circular dependency is detected in the middleware graph.
 */
export class XmtgCycleError extends Error {
    constructor(public cyclePath: string[]) {
        super(
            `[XMTG Topology Error] Circular dependency detected in middleware graph: ${cyclePath.join(
                " -> ",
            )}`,
        );
        this.name = "XmtgCycleError";
    }
}

/**
 * XMTG Graph Engine
 *
 * Manages registered middlewares as nodes in a Directed Acyclic Graph (DAG)
 * and resolves their topological execution order with deterministic tie-breaking.
 */
export class XmtgGraph {
    private nodes: Map<string, XmtgNode> = new Map();
    private autoIdCounter = 0;
    private seqCounter = 0;
    public version = 0;

    /**
     * Register a new middleware node in the graph.
     */
    public addNode(
        handler: MiddlewareFunction,
        options: XmtgOptions = {},
    ): string {
        const id = options.id || options.name || `mw_${++this.autoIdCounter}`;
        if (this.nodes.has(id)) {
            // If already registered with identical id, append an incremental suffix
            const uniqueId = `${id}_${++this.autoIdCounter}`;
            return this.addNode(handler, { ...options, id: uniqueId });
        }

        const isErrorHandler =
            options.isErrorHandler !== undefined
                ? options.isErrorHandler
                : handler.length === 4;

        const node: XmtgNode = {
            id,
            seq: ++this.seqCounter,
            options: {
                ...options,
                id,
                priority: options.priority ?? 100,
                enabled: options.enabled !== false,
            },
            handler,
            isErrorHandler,
        };

        this.nodes.set(id, node);
        this.version++;
        return id;
    }

    /**
     * Get a node by ID.
     */
    public getNode(id: string): XmtgNode | undefined {
        return this.nodes.get(id);
    }

    /**
     * Get all registered nodes.
     */
    public getAllNodes(): XmtgNode[] {
        return Array.from(this.nodes.values());
    }

    /**
     * Resolve the deterministic topological execution order of all active nodes.
     * Uses Kahn's algorithm with a priority queue tie-breaker and cycle detection.
     *
     * @throws {XmtgCycleError} if a circular dependency is detected
     */
    public resolveOrder(): XmtgNode[] {
        const activeNodes = Array.from(this.nodes.values()).filter(
            (n) => n.options.enabled !== false,
        );

        if (activeNodes.length <= 1) {
            return activeNodes;
        }

        // 1. Build adjacency list and in-degree map
        const adj = new Map<string, Set<string>>();
        const inDegree = new Map<string, number>();

        for (const node of activeNodes) {
            adj.set(node.id, new Set());
            inDegree.set(node.id, 0);
        }

        const addEdge = (fromId: string, toId: string) => {
            // Only add edges between active nodes
            if (!adj.has(fromId) || !adj.has(toId)) {
                return;
            }
            if (fromId === toId) {
                throw new XmtgCycleError([fromId, toId]);
            }
            const neighbors = adj.get(fromId)!;
            if (!neighbors.has(toId)) {
                neighbors.add(toId);
                inDegree.set(toId, (inDegree.get(toId) || 0) + 1);
            }
        };

        // 2. Add structural constraints (first / last)
        const firstNodes = activeNodes.filter((n) => n.options.first);
        const lastNodes = activeNodes.filter((n) => n.options.last);
        const normalNodes = activeNodes.filter(
            (n) => !n.options.first && !n.options.last,
        );

        // Every 'first' node must precede every normal node and every 'last' node
        for (const f of firstNodes) {
            for (const n of normalNodes) {
                addEdge(f.id, n.id);
            }
            for (const l of lastNodes) {
                addEdge(f.id, l.id);
            }
        }

        // Every normal node must precede every 'last' node
        for (const n of normalNodes) {
            for (const l of lastNodes) {
                addEdge(n.id, l.id);
            }
        }

        // 3. Add explicit sibling dependencies (before / after)
        for (const node of activeNodes) {
            if (node.options.before) {
                const targets = Array.isArray(node.options.before)
                    ? node.options.before
                    : [node.options.before];
                for (const targetId of targets) {
                    addEdge(node.id, targetId);
                }
            }

            if (node.options.after) {
                const targets = Array.isArray(node.options.after)
                    ? node.options.after
                    : [node.options.after];
                for (const targetId of targets) {
                    addEdge(targetId, node.id);
                }
            }
        }

        // 4. Kahn's Algorithm with Priority-based & seq deterministic queue
        const ready: XmtgNode[] = [];
        for (const node of activeNodes) {
            if (inDegree.get(node.id) === 0) {
                ready.push(node);
            }
        }

        // Sort ready queue: lower priority first, then registration order (seq)
        ready.sort(
            (a, b) =>
                a.options.priority! - b.options.priority! || a.seq - b.seq,
        );

        const result: XmtgNode[] = [];

        while (ready.length > 0) {
            // Pick highest priority available node
            const current = ready.shift()!;
            result.push(current);

            const neighbors = adj.get(current.id) || new Set();
            for (const nextId of neighbors) {
                const nextDegree = inDegree.get(nextId)! - 1;
                inDegree.set(nextId, nextDegree);
                if (nextDegree === 0) {
                    const nextNode = this.nodes.get(nextId)!;
                    insertSorted(ready, nextNode);
                }
            }
        }

        // 5. Detect cycles
        if (result.length < activeNodes.length) {
            const cyclePath = this.detectCyclePath(activeNodes, adj, inDegree);
            throw new XmtgCycleError(cyclePath);
        }

        return result;
    }

    /**
     * Diagnostic helper: trace the exact cycle path when cycle is detected.
     */
    private detectCyclePath(
        nodes: XmtgNode[],
        adj: Map<string, Set<string>>,
        inDegree: Map<string, number>,
    ): string[] {
        const cycleNodeIds = new Set(
            nodes.filter((n) => (inDegree.get(n.id) || 0) > 0).map((n) => n.id),
        );

        const visited = new Set<string>();
        const path: string[] = [];

        const dfs = (curr: string): boolean => {
            if (path.includes(curr)) {
                path.push(curr);
                return true;
            }
            if (visited.has(curr)) return false;

            visited.add(curr);
            path.push(curr);

            const neighbors = adj.get(curr) || new Set();
            for (const next of neighbors) {
                if (cycleNodeIds.has(next)) {
                    if (dfs(next)) return true;
                }
            }

            path.pop();
            return false;
        };

        for (const id of cycleNodeIds) {
            path.length = 0;
            if (dfs(id)) {
                const startIdx = path.indexOf(path[path.length - 1]);
                return path.slice(startIdx);
            }
        }

        return Array.from(cycleNodeIds);
    }
}

/**
 * Inserts a node into a sorted array maintaining priority ascending then seq ascending order.
 */
function insertSorted(arr: XmtgNode[], node: XmtgNode): void {
    let low = 0;
    let high = arr.length;
    const p = node.options.priority!;
    const s = node.seq;

    while (low < high) {
        const mid = (low + high) >>> 1;
        const midP = arr[mid].options.priority!;
        const midS = arr[mid].seq;
        if (midP < p || (midP === p && midS <= s)) {
            low = mid + 1;
        } else {
            high = mid;
        }
    }
    arr.splice(low, 0, node);
}

export { XmtgGraph as XMTGraph };

