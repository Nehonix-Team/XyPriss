import { generateOpenAPI } from "./openapi";
import { SwaggerServer } from "./server";
import { SwaggerConfig } from "./types";
import { getSwaggerUIHtml } from "./ui";
import { Plugin } from "xypriss";

export function SwaggerPlugin(config: SwaggerConfig): any {
    return Plugin.create({
        name: "@xypriss/swagger",
        version: "1.0.0",
        description:
            "Auto-generates OpenAPI documentation and serves Swagger UI",
        onAuxiliaryServerDeploy(ops, server) {
            SwaggerServer(config, ops, server);
        },
    });
}
