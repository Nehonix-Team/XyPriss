import { createServer, getMimes, XyGuard } from "xypriss";
import { SwaggerPlugin } from "xypriss-swagger";
import { router } from "./router";

const mimes = getMimes();
mimes.push("application/octet-stream");

const server = createServer({
    server: {
        port: 3728,
        trustProxy: ["loopback", "192.168.1.0/24"],
        xems: {
            enable: true,
            persistence: {
                enabled: true,
                path: "./storage.xems",
                secret: "q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6", // 32 chars
            },
        },
    },

    isAuxiliary: true,

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
    performance: {
        preAllocate: true,
    },
    pluginPermissions: [
        {
            name: "xypriss-swagger",
            allowedHooks: ["PLG.OPS.AUXILIARY_SERVER"],
        },
    ],
    plugins: {
        register: [
            SwaggerPlugin({
                port: 9282,
            }),
        ],
    },
} as any);


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

// ─────────────────────────────────────────────
// Routing Modularization
// ─────────────────────────────────────────────

// Use the consolidated modular router
server.use(router);

// Start the server
server.start();

