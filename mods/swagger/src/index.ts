import { logger, Logger } from "./configs/Logger";
import { meta } from "./configs/meta";
import { SwaggerServer } from "./server";
import { SwaggerConfig } from "./types";
import { Plugin } from "xypriss";

export function SwaggerPlugin(config: SwaggerConfig): any {
    return Plugin.create({
        name: meta.name,
        version: meta.version,
        description: meta.description,

        onRegister(_server) {
            const log = Logger.for("Bootstrap");
            log.info("Starting swagger plugin...");
        },
        onServerStart(server) {
            logger.success("Swagger plugin has started");

            server.app.get("/swagger", (_req: any, res: any) => {
                res.redirect(`http://localhost:${config.port}`);
            });
        },
        onAuxiliaryServerDeploy(ops, server) {
            SwaggerServer(config, ops, server);
        },
    });
}

