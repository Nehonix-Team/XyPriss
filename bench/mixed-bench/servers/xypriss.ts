import { createServer } from "xypriss";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSET_PATH = path.resolve(__dirname, '../assets/dummy-500k.bin');

const app = createServer({
    server: {
        port: 8093,
    },
    // We disable built-in security plugin for a raw benchmark comparison
    security: {
        enabled: false,
    },
});

// Simulate auth middleware (2ms delay)
const authMiddleware = async (req: any, res: any, next: any) => {
    await new Promise(r => setTimeout(r, 2));
    req.user = { id: 1, role: 'admin' };
    next();
};

app.get("/api/download", authMiddleware, (req, res) => {
    // Send 500KB file via XHSC delegation
    res.sendFile(ASSET_PATH);
});

app.start();
