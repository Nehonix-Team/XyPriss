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
    XServer: XyPrissServer,
) {
    const docPath = config.path || "/docs";
    const specPath = `${docPath}/swagger.json`;
    console.log("plugin root path: ", __sys__.__root__);
    console.log(
        "😇 env de HELLO depuis le plugin: ",
        __sys__.__env__.get("HELLO"),
    );
    console.log(
        "🤧 env de COMMON_VAR du root du project (devrait être undefined): ",
        __sys__.__env__.get("COMMON_VAR"),
    );
    const port = config.port || 7070;
    const server = ops.createAuxiliaryServer({
        server: { port },
        logging: { enabled: true, level: "info" },
        performance: { optimizationEnabled: false }, // Avoid aggressive precompiling for UI assets
        plugins: { register: [] }, // Disable plugins to prevent infinite recursion
    });

    // Serve the raw OpenAPI JSON specification
    server.get(specPath, (req: any, res: any) => {
        try {
            let registry: any[] = [];

            if (ops.getRouteRegistry) {
                registry = ops.getRouteRegistry();
            }

            const spec = generateOpenAPI(registry, config);
            res.json(spec);
        } catch (error) {
            console.error("[SWAGGER] Error generating OpenAPI spec:", error);
            res.status(500).json({
                error: "Failed to generate documentation",
            });
        }
    });

    // Serve the Swagger HTML Viewer
    server.get(docPath, (req: any, res: any) => {
        const html = getSwaggerUIHtml(
            specPath,
            config.title || "API Documentation",
        );
        res.html(html);
    });

    // Redirect root path of the sub-server to docPath
    server.get("/", (req: any, res: any) => {
        res.redirect(docPath);
    });

    // Boot the auxiliary server immediately
    server.start(() => {
        console.log(
            `[SWAGGER] 🛡️ Official Documentation Server securely isolated at http://localhost:${port}${docPath}`,
        );
    });
}


