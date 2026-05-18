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
import { Configs } from "../../ConfigurationManager";
import { DEFAULT_OPTIONS } from "../const/default";
import { notFoundTemplate } from "./templates/notFoundTemplate";
import { __sys__ } from "../../xhsc";

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
            appName:
                (__sys__ as any)?.__name__ ||
                __sys__?.vars.__name__ ||
                "my-xypriss-app",
            contactEmail: d.contactEmail,
            customCSS: d.customCSS || "",
            faviconUrl: d.faviconUrl || "",
            message: d.message as any,
            redirectText: d.redirectText || "",
            redirectScript: d.redirectScript,
            redirectTo: d.redirectTo || "",
            requestedMethod: req.method,
            requestedPath: req.url,
            mode: d.mode || "system",
            title: d.title || "404 Not Found",
        };

        const html = notFoundTemplate(dt);

        res.status(404).html(html);
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
export function createNotFoundHandler(
    options: ServerOptions,
): NotFoundHandler | null {
    const cfg = Configs.get("notFound");
    const rc = Configs.get("responseControl");

    const isNotFoundEnabled = cfg?.enabled !== false;

    if (!isNotFoundEnabled) {
        if (!rc?.enabled) {
            throw new Error(
                "The 'notFound' handler cannot be disabled unless 'responseControl.enabled' is set to true in your configuration.",
            );
        }
        return null;
    }
    return new NotFoundHandler();
}

