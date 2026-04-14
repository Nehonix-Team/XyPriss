export const multiServer = {
    enabled: true,
    servers: [
        {
            id: "main",
            port: 3728,
            server: {
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
        },
        {
            id: "admin",
            port: 3729,
            server: {
                trustProxy: ["loopback", "192.168.1.0/24"],
                xems: {
                    enable: true,
                    persistence: {
                        enabled: true,
                        path: "./admin.storage.xems",
                        secret: "q1w2e3r4t5y6u7i8o9p0a1s2d3f4g5h6", // 32 chars
                    },
                },
            },
        },
    ],
}