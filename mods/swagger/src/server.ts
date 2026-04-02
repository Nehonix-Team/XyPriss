import { logger } from "./configs/Logger";
import { meta, toPascalCase } from "./configs/meta";
import { generateOpenAPI } from "./openapi";
import { SwaggerConfig } from "./types";
import { getSwaggerUIHtml } from "./ui";
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
    console.log("plugin root path: ", __sys__.__root__);
    // console.log(
    //     "😇 env de HELLO depuis le plugin: ",
    //     __sys__.__env__.get("HELLO"),
    // );
    // console.log(
    //     "🤧 env de COMMON_VAR du root du project (devrait être undefined): ",
    //     __sys__.__env__.get("COMMON_VAR"),
    // );

    console.log(
        "🤠 env from root using __sys__ (devrait être strictement undefined vue que ici, sys.__root__ devrait conduire vers '/home/idevo/Documents/projects/XyPriss/mods/swagger') pourtant le .env de cette root n'a pas de name: ",
        __sys__.__env__.get("NAME"),
    );

    const workspaceSYS = __sys__.plugins.get(meta.name);

    // console.log("workspaceFS: ", workspaceFS);

    if (!workspaceSYS) {
        throw new Error(
            toPascalCase(meta.name, "-") +
                " is not authorized in your xypriss.config.jsonc or xypriss.config.json. Please add ",
        );
    }
    console.log("🤠 env from root using workspaceSYS (devrait être undefined selon la config de l'utilisateur: en mode ROOT:// ça devrait conduire vers _sys__.root ('/home/idevo/Documents/projects/XyPriss/mods/swagger') et CWD:// devrait envoyer process.cwd() ('/home/idevo/Documents/projects/XyPriss' (vue qu'on excute la cmd ici))): ", workspaceSYS.__env__.get("NAME"));
    console.log("😝 root path: ", workspaceSYS.__root__);
    console.log("😅 listing directory path: ", workspaceSYS.fs.ls("."));

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
        const html = getSwaggerUIHtml(
            specPath,
            config.title || workspaceSYS?.vars?.__name__ || "API Documentation",
        );
        res.html(html);
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





