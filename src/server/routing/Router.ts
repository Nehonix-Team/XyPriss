/**
 * XyPriss Router System — Ultra-Rich Edition
 * Multi-module enterprise-grade router for XyPrissJS.
 */

import { RouteHandler, MiddlewareFunction } from "../../types/httpServer.type";
import { Logger } from "../../shared/logger/Logger";
import {
    RouterOptions,
    MiddlewareEntry,
} from "../../types/XyPrissRouter.types";
import { SUPPORTED_HTTP_METHODS } from "../const/http";
import { Upload } from "../components/fastapi/upload/file-upload";

// Modular Components
import {
    RichRouteDefinition,
    RichRouteOptions,
    RouteGroupOptions,
    RouteRegistryEntry,
    XyPrisRequest,
    XyPrisResponse,
} from "./modules/types";
import { normalizePath } from "./modules/path";
import { addRichRoute, mountRouter, IRouterInternal } from "./modules/registry";
import { handleGroup } from "./modules/groups";

export class XyPrissRouter implements IRouterInternal {
    private routes: RichRouteDefinition[] = [];
    private middleware: MiddlewareEntry[] = [];
    private logger: Logger;
    private routerOptions: RouterOptions;

    static featureResolver: ((flag: string) => boolean) | null = null;
    static setFeatureResolver(fn: (flag: string) => boolean): void {
        XyPrissRouter.featureResolver = fn;
    }

    constructor(options: RouterOptions = {}) {
        this.routerOptions = {
            caseSensitive: false,
            mergeParams: false,
            strict: false,
            ...options,
        };
        this.logger = new Logger({ components: { router: true } });
    }

    public get upload() {
        return Upload;
    }

    // ─── Middleware ──────────────────────────────────────────────────────────

    use(middleware: MiddlewareFunction): XyPrissRouter;
    use(path: string, middleware: MiddlewareFunction): XyPrissRouter;
    use(path: string, router: XyPrissRouter): XyPrissRouter;
    use(pathOrM: any, mOrR?: any): XyPrissRouter {
        try {
            if (typeof pathOrM === "function") {
                this.middleware.push({ handler: pathOrM });
            } else if (typeof mOrR === "function") {
                this.middleware.push({
                    path: normalizePath(pathOrM),
                    handler: mOrR,
                });
            } else if (mOrR instanceof XyPrissRouter) {
                mountRouter(pathOrM, mOrR, this._getState());
            }
        } catch (e) {
            this.logger.error("router", `Middleware error: ${e}`);
            throw e;
        }
        return this;
    }

    // ─── HTTP Methods ────────────────────────────────────────────────────────

    get(
        path: string,
        options: RichRouteOptions,
        ...handlers: RouteHandler[]
    ): XyPrissRouter;
    get(path: string, ...handlers: RouteHandler[]): XyPrissRouter;
    get(path: string, ...args: any[]) {
        return this._addRichRoute("GET", path, args);
    }

    post(
        path: string,
        options: RichRouteOptions,
        ...handlers: RouteHandler[]
    ): XyPrissRouter;
    post(path: string, ...handlers: RouteHandler[]): XyPrissRouter;
    post(path: string, ...args: any[]) {
        return this._addRichRoute("POST", path, args);
    }

    put(
        path: string,
        options: RichRouteOptions,
        ...handlers: RouteHandler[]
    ): XyPrissRouter;
    put(path: string, ...handlers: RouteHandler[]): XyPrissRouter;
    put(path: string, ...args: any[]) {
        return this._addRichRoute("PUT", path, args);
    }

    patch(
        path: string,
        options: RichRouteOptions,
        ...handlers: RouteHandler[]
    ): XyPrissRouter;
    patch(path: string, ...handlers: RouteHandler[]): XyPrissRouter;
    patch(path: string, ...args: any[]) {
        return this._addRichRoute("PATCH", path, args);
    }

    delete(
        path: string,
        options: RichRouteOptions,
        ...handlers: RouteHandler[]
    ): XyPrissRouter;
    delete(path: string, ...handlers: RouteHandler[]): XyPrissRouter;
    delete(path: string, ...args: any[]) {
        return this._addRichRoute("DELETE", path, args);
    }

    head(
        path: string,
        options: RichRouteOptions,
        ...handlers: RouteHandler[]
    ): XyPrissRouter;
    head(path: string, ...handlers: RouteHandler[]): XyPrissRouter;
    head(path: string, ...args: any[]) {
        return this._addRichRoute("HEAD", path, args);
    }

    options(
        path: string,
        options: RichRouteOptions,
        ...handlers: RouteHandler[]
    ): XyPrissRouter;
    options(path: string, ...handlers: RouteHandler[]): XyPrissRouter;
    options(path: string, ...args: any[]) {
        return this._addRichRoute("OPTIONS", path, args);
    }

    all(
        path: string,
        options: RichRouteOptions,
        ...handlers: RouteHandler[]
    ): XyPrissRouter;
    all(path: string, ...handlers: RouteHandler[]): XyPrissRouter;
    all(path: string, ...args: any[]) {
        SUPPORTED_HTTP_METHODS.forEach((m) =>
            this._addRichRoute(m, path, args),
        );
        return this;
    }

    // ─── Advanced Features ───────────────────────────────────────────────────

    group(options: RouteGroupOptions, callback: (r: XyPrissRouter) => void) {
        const child = new XyPrissRouter(this.routerOptions);
        handleGroup(this, child, options, callback, this._getState());
        return this;
    }

    version(ver: string, callback: (r: XyPrissRouter) => void) {
        return this.group({ version: ver }, callback);
    }

    redirect(from: string, to: string, status: 301 | 302 | 307 | 308 = 302) {
        return this._addRichRoute("GET", from, [
            {
                meta: { summary: `Redirect → ${to}`, tags: ["redirect"] },
                priority: 10,
            },
            (_req: any, res: any) => res.redirect(status, to),
        ]);
    }

    // ─── Registry & Inspection ───────────────────────────────────────────────

    getRoutes() {
        return this.routes.filter((r) => r.active);
    }
    getAllRoutes() {
        return [...this.routes];
    }
    getMiddleware() {
        return [...this.middleware];
    }
    findById(id: string) {
        return this.routes.find((r) => r.id === id);
    }

    toRegistry(): RouteRegistryEntry[] {
        return this.getRoutes().map((r) => ({
            id: r.id,
            method: r.method,
            path: r.originalPath,
            version: r.version,
            meta: r.meta,
            hasGuards: !!r.guards,
            hasRateLimit: !!r.rateLimit,
            hasCache: !!r.cache,
            paramNames: r.paramNames,
            paramConstraints: r.paramConstraints,
            responses: r.responses,
        }));
    }

    getStats() {
        const active = this.getRoutes();
        return {
            totalRoutes: this.routes.length,
            activeRoutes: active.length,
            totalMiddleware: this.middleware.length,
            routesByMethod: active.reduce(
                (a, r) => ({ ...a, [r.method]: (a[r.method] || 0) + 1 }),
                {} as any,
            ),
            options: this.routerOptions,
        };
    }

    // ─── Internal ───────────────────────────────────────────────────────────

    private _addRichRoute(method: string, path: string, args: any[]) {
        addRichRoute(this, method, path, args, this._getState());
        return this;
    }

    private _getState() {
        return {
            routes: this.routes,
            middleware: this.middleware,
            logger: this.logger,
            options: this.routerOptions,
            featureResolver: XyPrissRouter.featureResolver,
        };
    }
}

export const Router = (opts?: RouterOptions) => new XyPrissRouter(opts);
export default Router;

