import { createServer, getMimes, XyGuard } from "xypriss";
import { SwaggerPlugin } from "xypriss-swagger";
import { router } from "./router";
import { multiServer } from "./xms";

const mimes = getMimes();
mimes.push("application/octet-stream");

const server = createServer({
    multiServer: multiServer as any,
    server: {
        port: 3728,
        trustProxy: ["loopback", "192.168.1.0/24"],
    }, 

    fileUpload: {
        enabled: true,
        maxFileSize: 1024 * 1024, // 1MB for testing
        maxFiles: 5,
        allowedExtensions: [
            ".jpg",
            ".png",
            ".webp",
            ".pdf",
            ".zip",
            ".docx",
            ".md",
        ],
        allowedMimeTypes: ["image/jpeg", "image/png", "application/pdf"],
    },
    env: "test",
    security: {
        enabled: true,
    },
    logging: {
        level: "info",
        types: {
            debug: false,
        },
    },
    performance: {
        preAllocate: true,
    },
    plugins: {
        register: [
            SwaggerPlugin({
                port: 9282,
            }),
        ],
    },
});

// ─────────────────────────────────────────────
// XyGuard Resolvers Definition
// ─────────────────────────────────────────────

// Authentication resolver
XyGuard.define("authenticated", (req) => {
    return !!req.session?.user_id;
});

// Role-based access control resolver
XyGuard.define("roles", (req, requiredRoles) => {
    const userRole = req.session?.role;
    return requiredRoles.includes(userRole);
});

// Permission-based access control resolver
XyGuard.define("permissions", (req, requiredPermissions) => {
    const userPermissions = req.session?.permissions || [];
    return requiredPermissions.every((p: string) =>
        userPermissions.includes(p),
    );
});

console.log("[SERVER:SIMULATION] root path: ", __sys__.__root__);
console.log("[SERVER:SIMULATION] os temp path: ", __sys__.path.tmpUserDir);

// ─────────────────────────────────────────────
// Routing Modularization
// ─────────────────────────────────────────────

// Use the consolidated modular router
server.use(router);

// Start the server and wait for readiness
await server.start();