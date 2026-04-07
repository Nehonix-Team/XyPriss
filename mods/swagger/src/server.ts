import { logger } from "./configs/Logger";
import { meta, toPascalCase } from "./configs/meta";
import { generateOpenAPI } from "./openapi";
import { SwaggerConfig } from "./types";
import { getSwaggerUIStream } from "./ui";
import { Plugin } from "xypriss";
 
type auxis = NonNullable<
    ReturnType<typeof Plugin.create>["onAuxiliaryServerDeploy"]
>;
export type OpsServerManager = Parameters<auxis>["0"] & {
    getRouteRegistry?: () => any[];
};

export type XyPrissServer = Parameters<auxis>["1"];

export function SwaggerServer(
    config: SwaggerConfig,
    ops: OpsServerManager,
    _XServer: XyPrissServer,
) {
    const docPath = config.path || "/docs";
    const specPath = `${docPath}/swagger.json`;
    const workspaceSYS = __sys__.plugins.get(meta.name);

    if (!workspaceSYS) {
        throw new Error(
            toPascalCase(meta.name, "-") +
                " is not authorized in your xypriss.config.jsonc or xypriss.config.json. Please add ",
        );
    }
    
    const port = config.port || 7070;
    const server = ops.createAuxiliaryServer({
        server: { port },
        security: {
            enabled: false,
        },
    });

    // Serve the raw OpenAPI JSON specification
    server.get(specPath, (_req, res) => {
        try {
            let registry: any[] = [];

            if (ops.getRouteRegistry) {
                registry = ops.getRouteRegistry();
            }

            const spec = generateOpenAPI(registry, config);
            res.json(spec);
        } catch (error) {
            logger.error("Error generating OpenAPI spec:", error);
            res.status(500).json({
                error: "Failed to generate documentation",
            });
        }
    });

    // Serve the Swagger HTML Viewer
    server.get(docPath, (_req, res) => {
        const title =
            config.title || workspaceSYS?.vars?.__name__ || "API Documentation";
        const stream = getSwaggerUIStream(specPath, title);

        res.setHeader("Content-Type", "text/html");
        stream.pipe(res);
    });

    // Redirect root path of the sub-server to docPath
    server.redirect("/", docPath, 301);

    // Boot the auxiliary server immediately
    const url = `http://localhost:${port}${docPath}`;
    server.start(() => {
        logger.swagger(
            `${toPascalCase(meta.name)} Server isolated on port ${port}`,
        );
        logger.http(`GET ${url}`);
    });

}