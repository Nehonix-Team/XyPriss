/**
 * Ultra-Optimized Execution Predictor
 *
 * Intelligent request analysis and routing system optimized for <1ms classification
 * Key optimizations:
 * - Pre-compiled regex patterns
 * - Bitwise flags for fast classification
 * - Minimal object allocation
 * - Hot path optimization
 * - Static lookup tables
 */

import {
    CLASSIFICATION_FLAGS,
    CONFIG_REGEX,
    HEALTH_ROUTES,
    PING_REGEX,
    STATIC_FILE_REGEX,
    STATIC_ROUTES,
    STATUS_REGEX,
    ULTRA_FAST_RESULT,
    FAST_RESULT,
    STANDARD_RESULT,
} from "../const/ExecutionPredictor_EP.const";
import {
    RequestPattern,
    RequestSignature,
    ClassificationResult,
} from "../../types/ExecutionPredictor.type";
import { Request } from "../ServerFactory";

export class ExecutionPredictor {
    private patterns: Map<string, RequestPattern> = new Map();

    // Performance tracking with minimal overhead
    private classificationCount = 0;
    private totalClassificationTime = 0;

    // Pre-allocated objects for hot path
    private tempSignature: RequestSignature = {
        method: "",
        pathPattern: "",
        flags: 0,
        complexity: 0,
    };

    /**
     * Ultra-fast classification with minimal overhead
     */
    public classify(req: Request): ClassificationResult {
        const start = performance.now();

        // Hot path: Pre-computed flags for instant decisions
        const flags = this.computeFlags(req);

        // Ultra-fast path: Static content and health checks
        if (flags & CLASSIFICATION_FLAGS.IS_HEALTH) {
            ULTRA_FAST_RESULT.overhead = performance.now() - start;
            this.updateStats(ULTRA_FAST_RESULT.overhead);
            return ULTRA_FAST_RESULT;
        }

        if (flags & CLASSIFICATION_FLAGS.IS_STATIC) {
            ULTRA_FAST_RESULT.overhead = performance.now() - start;
            this.updateStats(ULTRA_FAST_RESULT.overhead);
            return ULTRA_FAST_RESULT;
        }

        // Fast path: Simple GET requests
        if (
            flags & CLASSIFICATION_FLAGS.IS_GET &&
            !(flags & CLASSIFICATION_FLAGS.HAS_BODY) &&
            this.isSimpleRequest(flags)
        ) {
            ULTRA_FAST_RESULT.overhead = performance.now() - start;
            this.updateStats(ULTRA_FAST_RESULT.overhead);
            return ULTRA_FAST_RESULT;
        }

        // Pattern lookup (optimized for speed)
        const key = this.getPatternKey(req.method, req.path, flags);
        const pattern = this.patterns.get(key);

        let result: ClassificationResult;

        if (pattern && pattern.confidence > 0.7) {
            // Use cached pattern (hot path)
            result = this.classifyFromCachedPattern(pattern);
        } else {
            // Quick heuristic classification
            result = this.quickClassify(flags);

            // Update pattern asynchronously to avoid blocking
            if (!pattern) {
                setImmediate(() => this.createPattern(key, req, flags));
            }
        }

        result.overhead = performance.now() - start;
        this.updateStats(result.overhead);
        return result;
    }

    /**
     * Optimized pattern update with batching
     */
    public updatePattern(
        req: Request,
        responseTime: number,
        cacheHit: boolean
    ): void {
        const flags = this.computeFlags(req);
        const key = this.getPatternKey(req.method, req.path, flags);
        const pattern = this.patterns.get(key);

        if (pattern) {
            // Exponentially weighted moving average for speed
            pattern.frequency++;
            pattern.avgResponseTime =
                pattern.avgResponseTime * 0.9 + responseTime * 0.1;
            pattern.cacheHitRate =
                pattern.cacheHitRate * 0.9 + (cacheHit ? 1 : 0) * 0.1;
            pattern.lastSeen = Date.now();

            // Quick re-classification
            const newClass = this.fastReclassify(pattern);
            if (newClass !== pattern.classification) {
                pattern.classification = newClass;
                pattern.confidence = Math.max(0.5, pattern.confidence - 0.2);
            } else {
                pattern.confidence = Math.min(1.0, pattern.confidence + 0.05);
            }
        }
    }

    public getStats() {
        return {
            totalPatterns: this.patterns.size,
            avgClassificationTime:
                this.totalClassificationTime / this.classificationCount,
            classificationCount: this.classificationCount,
        };
    }

    // Ultra-optimized private methods

    private computeFlags(req: Request): number {
        let flags = 0;
        const { method, path, params, query, body } = req;

        // Method flags (single comparison)
        if (method === "GET") flags |= CLASSIFICATION_FLAGS.IS_GET;
        else if (method === "POST") flags |= CLASSIFICATION_FLAGS.IS_POST;

        // Content flags (minimal object access)
        if (params && Object.keys(params).length > 0)
            flags |= CLASSIFICATION_FLAGS.HAS_PARAMS;
        if (query && Object.keys(query).length > 0)
            flags |= CLASSIFICATION_FLAGS.HAS_QUERY;
        if (body && Object.keys(body).length > 0)
            flags |= CLASSIFICATION_FLAGS.HAS_BODY;

        // Route type flags (pre-compiled checks)
        if (
            HEALTH_ROUTES.has(path) ||
            PING_REGEX.test(path) ||
            STATUS_REGEX.test(path)
        ) {
            flags |= CLASSIFICATION_FLAGS.IS_HEALTH;
        }

        if (
            STATIC_ROUTES.has(path) ||
            STATIC_FILE_REGEX.test(path) ||
            CONFIG_REGEX.test(path)
        ) {
            flags |= CLASSIFICATION_FLAGS.IS_STATIC;
        }

        return flags;
    }

    private isSimpleRequest(flags: number): boolean {
        const paramCount = flags & CLASSIFICATION_FLAGS.HAS_PARAMS ? 1 : 0;
        const queryCount = flags & CLASSIFICATION_FLAGS.HAS_QUERY ? 1 : 0;
        return paramCount + queryCount <= 2;
    }

    private getPatternKey(method: string, path: string, flags: number): string {
        // Use bitwise operations for fast key generation
        return `${method[0]}${path.length}${flags}`;
    }

    private classifyFromCachedPattern(
        pattern: RequestPattern
    ): ClassificationResult {
        // Direct lookup without object creation
        if (pattern.classification === CLASSIFICATION_FLAGS.ULTRA_FAST) {
            return ULTRA_FAST_RESULT;
        }
        if (pattern.classification === CLASSIFICATION_FLAGS.FAST) {
            return FAST_RESULT;
        }
        return STANDARD_RESULT;
    }

    private quickClassify(flags: number): ClassificationResult {
        // Ultra-fast decision tree
        if (
            flags &
                (CLASSIFICATION_FLAGS.IS_HEALTH |
                    CLASSIFICATION_FLAGS.IS_STATIC) ||
            (flags & CLASSIFICATION_FLAGS.IS_GET &&
                !(flags & CLASSIFICATION_FLAGS.HAS_BODY))
        ) {
            return ULTRA_FAST_RESULT;
        }

        if (
            flags &
                (CLASSIFICATION_FLAGS.IS_GET | CLASSIFICATION_FLAGS.IS_POST) &&
            this.isSimpleRequest(flags)
        ) {
            return FAST_RESULT;
        }

        return STANDARD_RESULT;
    }

    private fastReclassify(pattern: RequestPattern): number {
        // Numeric comparison for speed
        if (pattern.avgResponseTime <= 1 && pattern.cacheHitRate >= 0.8) {
            return CLASSIFICATION_FLAGS.ULTRA_FAST;
        }
        if (pattern.avgResponseTime <= 5 && pattern.cacheHitRate >= 0.5) {
            return CLASSIFICATION_FLAGS.FAST;
        }
        return CLASSIFICATION_FLAGS.STANDARD;
    }

    private createPattern(key: string, req: Request, flags: number): void {
        // Asynchronous pattern creation to avoid blocking hot path
        const pattern: RequestPattern = {
            signature: {
                method: req.method,
                pathPattern: req.path,
                flags,
                complexity: this.calculateComplexity(flags),
            },
            frequency: 1,
            avgResponseTime: 0,
            cacheHitRate: 0,
            lastSeen: Date.now(),
            classification: CLASSIFICATION_FLAGS.STANDARD,
            confidence: 0.5,
        };

        this.patterns.set(key, pattern);
    }

    private calculateComplexity(flags: number): number {
        let score = 1;
        if (flags & CLASSIFICATION_FLAGS.HAS_PARAMS) score += 0.5;
        if (flags & CLASSIFICATION_FLAGS.HAS_QUERY) score += 0.3;
        if (flags & CLASSIFICATION_FLAGS.HAS_BODY) score += 2;
        return Math.min(score, 10);
    }

    private updateStats(overhead: number): void {
        this.classificationCount++;
        this.totalClassificationTime += overhead;
    }
}

