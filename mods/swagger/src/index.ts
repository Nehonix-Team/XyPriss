import { logger, Logger } from "./configs/Logger";
import { meta, toPascalCase } from "./configs/meta";
import { SwaggerServer } from "./server";
import { SwaggerConfig } from "./types";
import { Plugin } from "xypriss";

console.log("[swagger] internal plugin sys", __sys__.__root__);

const pluginName = toPascalCase(meta.name);
export function SwaggerPlugin(config: SwaggerConfig) {
    return Plugin.create(
        {
            name: meta.name,
            version: meta.version,
            description: meta.description,
            onRegister(_error) {
                const log = Logger.for("Bootstrap");
                log.info("Starting swagger plugin...");
                if (_error) {
                    log.error(pluginName + " plugin failed to start:", _error);
                }
            },
            onServerStart(server) {
                logger.success(pluginName + " plugin has started");

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

