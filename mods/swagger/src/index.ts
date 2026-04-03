import { logger, Logger } from "./configs/Logger";
import { meta } from "./configs/meta";
import { SwaggerServer } from "./server";
import { SwaggerConfig } from "./types";
import { Plugin } from "xypriss";

console.log("[swagger] internal plugin sys", __sys__.__root__);

export function SwaggerPlugin(config: SwaggerConfig): any {
    return Plugin.create(
        {
            name: meta.name,
            version: meta.version,
            description: meta.description,

            onRegister(_error) {
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
        },
        __sys__.__root__,
    );
}

