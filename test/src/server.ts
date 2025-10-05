/**
 * XyPriss Application Server Entry Point
 *
 * This is the main entry point for your XyPriss application.
 * The server is configured with security, performance optimizations,
 * and all the features you selected during project initialization.
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

// Import system configuration
import { _sys } from "./_sys/index";

// Import server configuration
import { serverConfig } from "./configs/xypriss.config";

// Import route handlers
import router from "./routes/index";

// Import middleware
import { setupMiddleware } from "./middleware/index";

/**
 * Create and configure the XyPriss application server
 * This initializes the server with all configured features and middleware
 */
const app = createServer(serverConfig);

/**
 * Setup global middleware
 * Configure middleware that applies to all routes
 */
setupMiddleware(app as any);

/**
 * Setup API routes
 * Define your application routes and handlers
 */
app.use("/api", router);

app.start(undefined, () => {
  console.log(`📊 Health check: http://localhost:${_sys.__port}/health`);
  console.log(`📋 API status: http://localhost:${_sys.__port}/api/status`);
  console.log(`🛑 Press Ctrl+C to stop the server`);
});

/**
 * Export the app instance for testing
 * Allows importing the app in test files
 */
export default app;
