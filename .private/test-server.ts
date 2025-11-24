import { createServer } from "../src";
import { testRouter } from "./test-router";

export const app = createServer({
    server: {
        port: 3001,
        // trustProxy: true, // Enable trust proxy for Nginx reverse proxy
    },
    security: {
        cors: {
            origin: [
                /^localhost:\d+$/, // RegExp: localhost:any-port
                "127.0.0.1:*", // RegExp: 127.0.0.1:any-port //  /^127\.0\.0\.1:\d+$/
                /\.nehonix\.com$/, // RegExp: *.nehonix.com
                "https://production.com", // Exact match
            ], // Your frontend URL
            credentials: true,
            methods: ["GET", "POST", "PUT", "DELETE"],
            allowedHeaders: ["Content-Type", "Authorization"],
        },
        // requestSignature: {
        //     secret: "my-super-secret-api-key-12345",
        //     debug: true,
        // },
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
                    defaultSrc: ["api.nehonix.com"],
                    scriptSrc: ["cdn.quilljs.com"],
                },
            },
        },
        browserOnly: false,
    },
});

app.use("/api", testRouter);

console.log("Starting upload test server on port 3001...");
app.start();

