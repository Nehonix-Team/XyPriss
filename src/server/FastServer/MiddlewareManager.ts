import { Logger } from "../../shared/logger/Logger";
import {
    XyPrisRequest as Request,
    XyPrisResponse as Response,
    NextFunction,
} from "../../types/httpServer.type";
import { createSafeJsonMiddleware } from "../../middleware/safe-json-middleware";
import { XJsonResponseHandler } from "../../middleware/XJsonResponseHandler";
import { createResponseManipulationMiddleware } from "../../middleware/built-in/ResponseManipulationMiddleware";
import { XyRequestManager } from "../core/request/XyRequestManager";
import { XyPrissApp, ServerOptions } from "../../types/types";

export class MiddlewareManager {
    constructor(
        private app: XyPrissApp,
        private logger: Logger,
        private options: ServerOptions,
        private requestManager: XyRequestManager,
    ) {}

    public addBodyParsingMiddleware(): void {
        this.app.use((_req: Request, _res: Response, next: NextFunction) => {
            next();
        });
        this.logger.debug(
            "middleware",
            "Custom body parsing middleware added (JSON and URL-encoded handled by CustomHttpServer)",
        );
    }

    public addSafeJsonMiddleware(): void {
        const safeJsonOptions = {
            enabled: true,
            maxDepth: 10,
            logCircularRefs: this.options.env === "development",
            truncateStrings: 1000,
        };
        this.app.use(createSafeJsonMiddleware(safeJsonOptions));
        this.logger.debug(
            "middleware",
            "Safe JSON middleware added for circular reference handling",
        );
    }

    public addXJsonMiddleware(): void {
        this.app.use(
            XJsonResponseHandler.createMiddleware({
                maxDepth: 20,
                truncateStrings: 10000,
                enableStreaming: true,
                chunkSize: 1024 * 64,
            }),
        );
        this.logger.debug(
            "middleware",
            "XJson middleware added for large data handling",
        );
    }

    public addResponseManipulationMiddleware(): void {
        if (this.options.responseManipulation?.enabled) {
            this.logger.debug(
                "server",
                "Adding response manipulation middleware",
            );
            this.app.use(
                createResponseManipulationMiddleware(
                    this.options.responseManipulation,
                ),
            );
        }
    }

    public configureTrustProxy(): void {
        const trustProxyConfig = this.options.server?.trustProxy;
        if (trustProxyConfig !== undefined) {
            (this.app as any).setTrustProxy(trustProxyConfig);
            this.logger.debug(
                "server",
                `Trust proxy configured: ${typeof trustProxyConfig === "function" ? "custom function" : JSON.stringify(trustProxyConfig)}`,
            );
        } else {
            (this.app as any).setTrustProxy(false);
            this.logger.debug("server", "Trust proxy set to default (false)");
        }
    }

    public initializeRequestManagement(): void {
        this.requestManager.initialize();
    }
}

