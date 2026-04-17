import { MultiServerConfig } from "xypriss";

export const multiServer = {
    enabled: true,
    servers: [
        {
            id: "main",
            port: 3728,
            routePrefix: "/api",
            server: {
                trustProxy: ["loopback", "192.168.1.0/24"],
                security: {
                    enabled: true,
                },
                xems: {
                    enable: true,
                    autoRotation: process.env.XEMS_ROTATE !== "false",
                    persistence: {
                        enabled: true,
                        path: "./storage.xems",
                        secret: "q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6", // 32 chars
                    },
                },
            },
        },
        {
            id: "admin",
            port: 3729,
            routePrefix: "/admin-api",
            server: {
                trustProxy: ["loopback", "192.168.1.0/24"],
                security: {
                    enabled: true,
                    honeypotTarpit: false,
                },
                xems: {
                    enable: true,
                    autoRotation: process.env.XEMS_ROTATE !== "false",
                    persistence: {
                        enabled: true,
                        path: "./admin.storage.xems",
                        secret: "q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6", // 32 chars
                    },
                },
            },
        },
    ],
};

