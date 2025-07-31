import { NextFunction } from "express";
import { ExecutionPredictor } from "../../server/optimization/ExecutionPredictor";
import { PerformanceProfiler } from "../../server/optimization/PerformanceProfiler";
import { UltraFastExpressOptimizer } from "../../server/optimization/UltraFastOptimizer";
import { ServerOptions, UltraFastApp } from "../types";

export interface MiddlewareManagerOptions {
    server?: ServerOptions["server"];
    security?: ServerOptions["security"];
    performance?: ServerOptions["performance"];
}

export interface MiddlewareManagerDependencies {
    app: UltraFastApp;
    ultraFastOptimizer?: UltraFastExpressOptimizer;
    performanceProfiler: PerformanceProfiler;
    executionPredictor: ExecutionPredictor;
    optimizationEnabled: boolean;
    optimizationStats: any;
    handleUltraFastPath: (
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ) => Promise<void>;
    handleFastPath: (
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ) => Promise<void>;
    handleStandardPath: (
        req: any,
        res: any,
        next: NextFunction,
        requestId: string,
        classification: any
    ) => Promise<void>;
}
