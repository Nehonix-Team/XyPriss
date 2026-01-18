/**
 * Routes Configuration
 *
 * This module defines all API routes for the XyPriss application.
 * Routes are organized by feature and include proper error handling.
 *
 * @fileoverview Route configuration and setup
 * @version 1.0.0
 * @author XyPriss Team
 * @since 2025-01-01
 */

import { validateBody } from "@/middleware/validation.middleware";
import { userSchema } from "@/schema/user.schema";
import { Router, type Request, type Response } from "xypriss";

const router = Router();

// Health check endpoint
router.get("/health", (reqw: Request, res: Response) => {
  res.json({
    status: "healthy",
    timestamp: new Date().toISOString(),
    version: __sys__.__version__,
    environment: __sys__.__env__,
  });
});

// API status endpoint
router.get("/status", (reqw: Request, res: Response) => {
  res.json({
    name: "XyPriss Application",
    version: __sys__.__version__,
    author: "XyPriss Team",
    environment: __sys__.__env__,
    features: {
      fileUpload: true,
      caching: true,
      compression: true,
    },
  });
});

// Welcome endpoint
router.get("/", (reqw: Request, res: Response) => {
  res.json({
    message: "Welcome to XyPriss Application",
    description: "High-performance Node.js web framework",
    docs: "/api/status",
    health: "/health",
    poweredBy: "XyPriss ⚡",
  });
});

// User management routes (example implementation)
router.get("/users", (reqw: Request, res: Response) => {
  // TODO: Implement user listing with authentication
  res.json({
    message: "User management endpoint",
    note: "Implement authentication and database integration",
  });
});

router.post("/users", (reqw: Request, res: Response) => {
  // TODO: Implement user creation with validation
  res.status(201).json({
    message: "User creation endpoint",
    note: "Implement input validation and database storage",
  });
});

// File upload routes (example implementation)
router.post("/upload", (reqw: Request, res: Response) => {
  // TODO: Implement file upload with multer integration
  res.json({
    message: "File upload endpoint",
    note: "Implement multer middleware and file processing",
  });
});

// Validation routes (example implementation)
router.post(
  "/validate",
  validateBody(userSchema),
  (reqw: Request, res: Response) => {
    const validatedData = reqw.body;
    console.log("validatedData", validatedData);
    // TODO: Implement input validation with validation middleware
    res.json({
      message: "Input validation endpoint",
      note: "Implement validation middleware and schema validation",
      validatedData,
    });
  }
);

export default router;
