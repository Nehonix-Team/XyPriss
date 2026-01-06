import { createServer } from "../src/index";

const app = createServer({
    server: {
        port: 8085,
    },
    plugins: {
        register: [
            {
                name: "test",
                version: "1.0.0",
                onRateLimit(limitData, req, res) {
                    
                },
                managePlugins(manager) {
                    
                },
                onResponseTime(responseTime, req, res) {
                    
                },
                
            }
        ],
    },
});

app.get("/", (req, res) => {
    res.json({ message: "Hello World" });
});

app.start();

