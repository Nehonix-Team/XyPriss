/**
 * XyPriss Custom 404 Not Found Handler
 *
 * Customizable 404 error pages with XyPriss branding
 * and user configuration options.
 */

import { ServerOptions, Request, Response } from "../ServerFactory";
import { __dirname__ } from "../utils/es_modules";
import {
    NotFoundConfig,
    NotFoundTemplateData,
    validate404Cfg,
} from "../../types/NotFoundConfig";
import { Configs } from "../../config";
import { DEFAULT_OPTIONS } from "../const/default";
import { notFoundTemplate } from "./templates/notFoundTemplate";

export class NotFoundHandler {
    private config: NotFoundConfig;

    constructor() {
        const config = Configs.get("notFound") || {};

        this.config = config;
    }

    /**
     * XyPriss middleware handler for 404 errors
     */
    public handler = (req: Request, res: Response): void => {
        const d = this.config;
        try {
            validate404Cfg(d);
        } catch (error) {
            console.error("error: ", error);
            // res.set("Content-Type", "text/html");
            // res.status(404).send("404 Not Found");
            // return;
            throw error;
        }

        // This logic would never be reached if 'config' is disabled because of previous validation
        // if (!this.config.enabled) {
        //     res.set("Content-Type", "text/html");
        //     res.status(404).send("404 Not Found");
        //     return;
        // }

        const dt: NotFoundTemplateData = {
            appName: __sys__?.__name__ || "XyPriss",
            contactEmail: d.contactEmail,
            customCSS: d.customCSS || "",
            faviconUrl: d.faviconUrl || "",
            message: d.message as any,
            redirectText: d.redirectText || "",
            redirectScript: d.redirectScript,
            redirectTo: d.redirectTo || "",
            requestedMethod: req.method,
            requestedPath: req.url,
            themeClass: d.themeClass || "auto",
            title: d.title || "404 Not Found",
        };

        res.status(404);
        res.set("Content-Type", "text/html");
        res.send(notFoundTemplate(dt));
    };

    /**
     * Update configuration
     */
    public updateConfig(newConfig: Partial<NotFoundConfig>): void {
        // this.config = { ...this.config, ...newConfig };
        Configs.update("notFound", newConfig);
    }
}

/**
 * Create NotFoundHandler from ServerOptions
 */
export function createNotFoundHandler(options: ServerOptions): NotFoundHandler {
    const cfg = Configs.get("notFound");
    if (!cfg?.enabled) {
        throw new Error(
            "The 'notFound' handler is currently disabled. Please enable it by setting 'notFound.enabled' to true in your configuration."
        );
    }
    return new NotFoundHandler();
}

