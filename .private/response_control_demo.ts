/**
 * Demo of the new responseControl feature for multi-server mode
 * This shows how to control responses when routes don't match
 */

import { createServer } from "../src";

const app = createServer({
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "public-server",
                port: 9822,
                routePrefix: "/public",
                responseControl: {
                    enabled: true,
                    statusCode: 404,
                    content: "Custom 404: Public resource not found",
                    contentType: "text/plain",
                    headers: { "X-Server": "public" },
                },
            },
            {
                id: "api-server",
                port: 3728,
                routePrefix: "/api",
                responseControl: {
                    enabled: true,
                    statusCode: 404,
                    content: {
                        error: "API endpoint not found",
                        path: "/api/test",
                    },
                    contentType: "application/json",
                    headers: { "X-Server": "api" },
                },
            },
        ],
    },
});

// Register some routes
app.get("/public/view", (req, res) => {
    res.send("Hello world from '/public/view' route");
});

app.get("/api/test", (req, res) => {
    res.send("Hello world from 'api/test' route");
});

app.get("/", (req, res) => {
    res.send("Hello world from '/' route");
});

// Start servers
app.start().catch(console.error);
