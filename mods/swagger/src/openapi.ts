import { meta } from "./configs/meta";

export interface OpenAPIConfig {
    openapi: string;
    info: {
        title: string;
        version: string;
        description?: string;
    };
    paths: Record<string, any>;
    components: {
        securitySchemes?: Record<string, any>;
    };
}

export function generateOpenAPI(registry: any[], config: any): OpenAPIConfig {
    const doc: OpenAPIConfig = {
        openapi: meta.version,
        info: {
            title:
                __sys__.vars.__name__ ||
                config.title ||
                "XyPriss API Documentation",
            version: config.version || "1.0.0",
            description: config.description || meta.description,
        },
        paths: {},
        components: {
            securitySchemes: {
                BearerAuth: {
                    type: "http",
                    scheme: "bearer",
                },
            },
        },
    };

    for (const route of registry) {
        if (!route.path || !route.method) continue;

        // Convert Express-like path /users/:id to Swagger-like path /users/{id}
        // Handles: :id, :id<number>, :id(\d+)
        const openApiPath = route.path.replace(
            /:([a-zA-Z0-9_]+)(?:<[^>]+>)?(?:\([^)]+\))?/g,
            "{$1}",
        );

        if (!doc.paths[openApiPath]) {
            doc.paths[openApiPath] = {};
        }

        const methodStr = (
            Array.isArray(route.method) ? route.method[0] : route.method
        ).toLowerCase();

        // Base operation object
        const operation: any = {
            summary: route.meta?.summary || `${route.method} ${route.path}`,
            description: route.meta?.description || "",
            tags: route.meta?.tags || ["Default"],
            parameters: [],
            responses: route.responses || {
                "200": {
                    description: "Successful response",
                },
            },
        };

        // If guards are detected, optionally assume it requires Auth
        if (route.hasGuards) {
            operation.security = [{ BearerAuth: [] }];
        }

        // Add Path Parameters
        if (route.paramNames && route.paramNames.length > 0) {
            for (const param of route.paramNames) {
                const constraint = route.paramConstraints?.[param];
                let type = "string";
                let pattern: string | undefined = undefined;

                if (constraint) {
                    if (
                        constraint.type === "number" ||
                        constraint.type === "integer"
                    ) {
                        type = "number";
                    } else if (constraint.type === "boolean") {
                        type = "boolean";
                    } else if (
                        constraint.type === "regex" &&
                        typeof constraint.options === "string"
                    ) {
                        pattern = constraint.options;
                    } else if (constraint.type === "uuid") {
                        pattern =
                            "^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$";
                    }
                }

                operation.parameters.push({
                    name: param,
                    in: "path",
                    required: true,
                    schema: {
                        type,
                        pattern,
                    },
                });
            }
        }

        // Add additional meta (like requestBody, query params) if defined by user within meta.openapi
        if (route.meta?.openapi) {
            Object.assign(operation, route.meta.openapi);
        }

        doc.paths[openApiPath][methodStr] = operation;
    }

    return doc;
}

