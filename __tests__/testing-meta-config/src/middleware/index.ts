/**
 * Middleware Configuration
 *
 * This module sets up all middleware for the XyPriss application.
 * Middleware includes logging, security, CORS, and other request processing.
 *
 * @fileoverview Middleware configuration and setup
 * @version 1.0.0
 * @author XyPriss Team
 * @since 2025-01-01
 */

import { UltraFastApp } from "xypriss";

/**
 * Setup global middleware for the application
 *
 * @param app - The XyPriss application instance
 */
export function setupMiddleware(app: UltraFastApp): void {
  // Request logging middleware
  app.use((req: any, res: any, next: any) => {
    const timestamp = new Date().toISOString();
    const method = req.method;
    const url = req.url;

    console.log(`[${timestamp}] ${method} ${url}`);

    // Add request ID for tracking
    (req as any).requestId = Math.random().toString(36).substring(2, 15);

    next();
  });

  // Security headers middleware (Helmet is handled by server config)
  // CORS is handled by server config
  // Rate limiting is handled by server config

  console.log("✅ Middleware configured successfully");
}