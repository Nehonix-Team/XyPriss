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
import { serverConfig } from "./configs/xypriss.config";

// Import route handlers
import router from "./routes/index";

/**
 * Create and configure the XyPriss application server
 * This initializes the server with all configured features and middleware.
 *
 * XEMS (XyPriss Encrypted Memory Store) is automatically initialized.
 * You can manage sessions using req.xLink and res.xLink in your routes.
 * Configuration for XEMS is located in src/configs/xypriss.config.ts
 */
const app = createServer(serverConfig);

/**
 * Setup API routes
 * Define your application routes and handlers
 */
app.use("/api", router);
app.use("/", router);

app.start(undefined, () => {
  console.log(`⚡ XyPriss Server is alive!`);
  console.log(`📊 Health check: http://localhost:${__sys__.__port__}/health`);
  console.log(`📋 API status: http://localhost:${__sys__.__port__}/api/status`);
  console.log(
    `🔑 XEMS Login: http://localhost:${__sys__.__port__}/api/login (POST)`,
  );
  console.log(
    `👤 User Profile: http://localhost:${__sys__.__port__}/api/profile`,
  );
  console.log(` Press Ctrl+C to stop the server`);
});

/**
 * Export the app instance for testing
 * Allows importing the app in test files
 */
export default app;
