/**
 * Request Validation Middleware using Fortify Schema
 *
 * This middleware provides request validation using fortify-schema,
 * a powerful validation library for TypeScript/JavaScript applications.
 *
 * @fileoverview Request validation middleware with fortify-schema
 * @version 1.0.0
 * @author XyPriss Team
 * @since 2025-01-01
 */

import type { Request, Response, NextFunction } from "xypriss";
import { InterfaceSchema } from "fortify-schema";

/**
 * Validation middleware factory
 *
 * @param schema - Fortify schema to validate against
 * @param property - Request property to validate ('body', 'query', 'params')
 * @returns Express middleware function
 */
export function validateRequest(
  schema: any,
  property: "body" | "query" | "params" = "body"
) {
  return (req: Request, res: Response, next: NextFunction) => {
    try {
      const data = req[property];
      const result = schema.safeParse(data);

      if (result.success) {
        // Replace request data with validated data
        (req as any)[property] = result.data;
        next();
      } else {
        res.status(400).json({
          error: {
            message: "Validation failed",
            details: result.errors,
            requestId: (req as any).requestId,
          },
        });
      }
    } catch (error) {
      next(error);
    }
  };
}

export function validateBody(schema: InterfaceSchema) {
  return validateRequest(schema, "body");
}
