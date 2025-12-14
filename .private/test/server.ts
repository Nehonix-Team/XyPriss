import { createServer } from "../../src";
import XNCP from "xynginc";

const app = createServer({
    plugins: {
        register: [
            {
                name: "test-plg",
                version: "1.0.0",
                onServerStart(server) {
                    console.log("[NORMAL USE CASES] ☺️ Test plugin started");
                    console.log("😰 normal instance: ", server)
                },
                onServerStop(server) {
                    console.log("[NORMAL USE CASES] 🤨 Test plugin stopped");
                },
            },
        ],
    },
});

const multiserver = createServer({
    server: {
        port: 8000,
    },
    multiServer: {
        enabled: true,
        servers: [
            {
                id: "server1",
                port: 3309,
                responseControl: {
                    enabled: true,
                    content: "test",
                },
            },
            {
                id: "server2",
                port: 3310,
            },
        ],
    },
    plugins: {
        register: [
            {
                name: "test-plg",
                version: "1.0.0",
                onServerStart(server) {
                    console.log("[MULTISERVER USE CASES] ☺️ Test plugin started");
                    console.log("mutiserver instance: ", server)
                },
                onServerStop(server) {
                    console.log("[MULTISERVER USE CASES] 🤨 Test plugin stopped");
                },
            },
            // XNCP({
            //     domains: [
            //         {
            //             domain: "api.example.com",
            //             port: 3000,
            //             ssl: true,
            //             email: "admin@example.com",
            //         },
            //     ],
            // }) as any,
        ],
    },
});

multiserver.start();
app.start();

