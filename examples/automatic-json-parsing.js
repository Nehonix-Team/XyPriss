/**
 * XyPriss Automatic JSON Parsing Example
 * 
 * This example demonstrates how XyPriss automatically handles JSON parsing
 * without requiring manual import and setup of express.json() middleware.
 */

import { createServer } from "xypriss";
import { XyPrissSecurity as security, fString, fArray } from "xypriss-security";

console.log("🚀 Starting XyPriss server with automatic JSON parsing...\n");

// Create server - JSON parsing is automatic!
const server = createServer({
    server: {
        port: 3000,
        host: "localhost",
        // Optional: customize JSON parsing limits
        jsonLimit: "10mb",
        urlEncodedLimit: "10mb",
        // Optional: disable automatic JSON parsing if you want manual control
        // autoParseJson: false
    },
    logging: {
        enabled: true,
        level: "info"
    }
});

// ✅ No need to manually add: server.use(json());
// ✅ JSON parsing is handled automatically!

// Basic JSON endpoint
server.post("/api/basic", (req, res) => {
    console.log("📦 Received JSON data:", req.body);
    
    res.json({
        success: true,
        message: "JSON received and parsed automatically!",
        receivedData: req.body,
        timestamp: new Date().toISOString()
    });
});

// Secure route with XyPriss Security features
server.post("/api/secure-data", async (req, res) => {
    if (!req.body) {
        return res.status(400).json({ 
            error: "Request body is required" 
        });
    }

    console.log("🔒 Processing secure data:", {
        sensitiveArray: req.body.sensitiveArray?.length || 0,
        hasPassword: !!req.body.password
    });

    try {
        // Use secure data structures from XyPriss Security
        const secureData = fArray(req.body.sensitiveArray || []);
        const securePassword = fString(req.body.password || "", {
            protectionLevel: "maximum",
            enableEncryption: true,
        });

        // Generate secure token
        const token = security.generateSecureToken({
            length: 32,
            entropy: "maximum",
        });

        res.json({
            success: true,
            message: "Secure data processed successfully",
            token,
            dataLength: secureData.length,
            // Don't return sensitive data in response
            timestamp: new Date().toISOString()
        });
    } catch (error) {
        console.error("❌ Security operation failed:", error);
        res.status(500).json({ 
            error: "Security operation failed", 
            details: error.message 
        });
    }
});

// Complex nested JSON endpoint
server.post("/api/complex", (req, res) => {
    const { user, preferences, metadata } = req.body;
    
    console.log("🔍 Processing complex JSON:", {
        hasUser: !!user,
        hasPreferences: !!preferences,
        hasMetadata: !!metadata
    });

    // Process complex nested data
    const processedData = {
        user: {
            id: user?.id,
            name: user?.name,
            email: user?.email
        },
        preferences: {
            theme: preferences?.theme || "light",
            notifications: preferences?.notifications || true,
            language: preferences?.language || "en"
        },
        metadata: {
            ...metadata,
            processedAt: new Date().toISOString(),
            serverVersion: "XyPriss 1.1.2"
        }
    };

    res.json({
        success: true,
        message: "Complex JSON processed successfully",
        data: processedData
    });
});

// Array data endpoint
server.post("/api/array", (req, res) => {
    if (!Array.isArray(req.body)) {
        return res.status(400).json({
            error: "Expected array data",
            received: typeof req.body
        });
    }

    console.log("📊 Processing array data:", {
        length: req.body.length,
        types: [...new Set(req.body.map(item => typeof item))]
    });

    const processedArray = req.body.map((item, index) => ({
        index,
        originalValue: item,
        type: typeof item,
        processedAt: new Date().toISOString()
    }));

    res.json({
        success: true,
        message: "Array data processed successfully",
        originalLength: req.body.length,
        processedData: processedArray
    });
});

// Health check endpoint
server.get("/health", (req, res) => {
    res.json({
        status: "healthy",
        features: {
            automaticJsonParsing: true,
            securityIntegration: true,
            performanceOptimization: true
        },
        timestamp: new Date().toISOString()
    });
});

// Start the server
server.start(undefined, () => {
    console.log(`✅ XyPriss server running at http://localhost:${server.getPort()}`);
    console.log("\n📝 Available endpoints:");
    console.log("  POST /api/basic - Basic JSON processing");
    console.log("  POST /api/secure-data - Secure data processing with XyPriss Security");
    console.log("  POST /api/complex - Complex nested JSON processing");
    console.log("  POST /api/array - Array data processing");
    console.log("  GET  /health - Health check");
    console.log("\n🎯 Key Features:");
    console.log("  ✅ Automatic JSON parsing (no manual setup required)");
    console.log("  ✅ Integrated XyPriss Security features");
    console.log("  ✅ Configurable parsing limits");
    console.log("  ✅ URL-encoded data support");
    console.log("\n💡 Try sending POST requests with JSON data to test!");
});

// Graceful shutdown
process.on('SIGINT', () => {
    console.log('\n🛑 Shutting down server gracefully...');
    process.exit(0);
});
