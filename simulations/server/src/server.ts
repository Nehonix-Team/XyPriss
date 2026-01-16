/**
 * XyPriss Application Server Entry Point
 *
 * This is the main entry point for your XyPriss application.
 * The server is configured with security, performance optimizations.
 *
 * @fileoverview Main server configuration and startup
 * @version 1.0.0
 * @author XyPriss Team
 * @since 2025-01-01
 *
 * @example
 * ```bash
 * # Development mode
 * npm run dev
 *
 * # Production build
 * npm run build && npm start
 * ```
 */

import { createServer } from "xypriss";
import dotenv from "dotenv";

// Load environment variables
dotenv.config();
 
// Import server configuration
import { serverConfig } from "./configs/xypriss.config.ts";

// Import route handlers
import router from "./routes/index.ts";

/**
 * Create and configure the XyPriss application server
 * This initializes the server with all configured features and middleware
 */
const app = createServer(serverConfig as any);

/**
 * Setup API routes
 * Define your application routes and handlers
 */
app.use("/api", router);
app.use("/", router);

app.start(undefined, () => {
    console.log(`📊 Health check: http://localhost:${__sys__.__port__}/health`);
    console.log(
        `📋 API status: http://localhost:${__sys__.__port__}/api/status`
    );
    console.log(`👥 Users API: http://localhost:${__sys__.__port__}/api/users`);
    console.log(
        `📤 File upload: http://localhost:${__sys__.__port__}/api/upload`
    );
    console.log(
        `✅ Validation: http://localhost:${__sys__.__port__}/api/validate`
    );
    console.log(` Press Ctrl+C to stop the server`);
});

/**
 * Export the app instance for testing
 * Allows importing the app in test files
 */
export default app;

