import { createServer } from "../src";
import { testRouter } from "./test-router";

export const app = createServer({
    server: {
        port: 3001,
        // trustProxy: true, // Enable trust proxy for Nginx reverse proxy
    },
    security: {
        cors: {
            origin: ["localhost:*", "127.0.0.1:*", "::1:*", "*.test.com"],
        },
        routeConfig: {
            ldapInjection: {
                excludeRoutes: ["/api/templates/*", { path: "/api/product/*" }],
            },
            pathTraversal: {
                excludeRoutes: ["/api/templates/*", { path: "/api/product/*" }],
            },
            commandInjection: {
                excludeRoutes: ["/api/templates/*", { path: "/api/product/*" }],
            },
            // Désactiver XSS pour les routes de templates (contenu enrichi par IA)
            xss: {
                excludeRoutes: ["/api/templates/*", { path: "/api/product/*" }],
            },
            // Désactiver SQL injection pour les routes de templates
            sqlInjection: {
                excludeRoutes: ["/api/templates/*", { path: "/api/product/*" }],
            },
            // Désactiver XXE pour les routes de templates
            xxe: {
                excludeRoutes: [
                    "/api/templates/*",
                    { path: "/api/product/*", methods: ["POST", "PUT"] },
                ],
            },
        },
        helmet: {
            contentSecurityPolicy: {
                directives: {
                    defaultSrc: ["'self'"],
                    blockAllMixedContent: [],

                    fontSrc: ["'self'", "https:", "data:"],

                    frameAncestors: ["'self'", "https://accounts.google.com/"],
                    frameSrc: ["'self'", "https://accounts.google.com/"],

                    imgSrc: ["'self'", "data:"],

                    objectSrc: ["'self'", "blob:"],

                    mediaSrc: ["'self'", "blob:", "data:"],

                    scriptSrc: ["'self'", "https://apis.google.com"],
                    scriptSrcAttr: ["'none'"],

                    // ---- CONTINUATION FROM THE SECOND IMAGE ----

                    styleSrc: ["'self'", "https:", "'unsafe-inline'"],

                    upgradeInsecureRequests: [],

                    connectSrc: ["'self'", "https://my-app.herokuapp.com"],
                },
            },
        },
    },
});

app.use("/api", testRouter);

console.log("Starting upload test server on port 3001...");
app.start();

