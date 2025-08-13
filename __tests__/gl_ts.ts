import { createServer } from "..";
import { XyPrissSecurity, fString, fArray } from "xypriss-security";

const server = createServer({
    server: { port: 3000 },
    security: {
        enabled: true,
        csrf: { enabled: true },
        rateLimit: { 
            windowMs: 15 * 60 * 1000, // 15 minutes
            max: 100, // limit each IP to 100 requests per windowMs
        },
        helmet: { enabled: true },
        cors: {
            origin: ["https://yourdomain.com"],
            credentials: true,
        },
    },
});

// Secure route with encryption
server.post("/api/secure-data", async (req, res) => {
    try {
        // Use secure data structures
        const secureData = fArray(req.body.sensitiveArray);
        const securePassword = fString(req.body.password, {
            protectionLevel: "maximum",
            enableEncryption: true,
        });

        // Generate secure token
        const token = XyPrissSecurity.generateSecureToken({
            length: 32,
            entropy: "maximum",
        });

        res.json({
            success: true,
            token,
            dataLength: secureData.length,
        });
    } catch (error) {
        res.status(500).json({ error: "Security operation failed" });
    }
});

server.start(undefined, () => {
    console.log("Server started on port:", server.getPort());
});
