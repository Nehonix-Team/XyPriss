/**
 * Security Middleware
 * @module Security Middleware
 * @description This module defines a security middleware for XyPriss applications.
 * It provides various security features such as CSRF protection and Helmet configuration.
 * You can configure security middleware to protect your application from common web vulnerabilities
 * directly in your XyPriss config or here in the middleware module.
 */

import type { UltraFastApp, Response, Request } from "xypriss";
import { NehoID as ID } from "nehoid";

export function securityMdlw(app: UltraFastApp, max = 50) {
  const mdlw = app.middleware();
  mdlw.security({
    csrf: {},
    helmet: {},
    rateLimit: {
      max: 40,
      handler(req: Request, res: Response, next) {
        const headers = new Map([["x-powered-by", "NEHONIX"]]);
        res.setHeaders(headers);
        res.status(429).json({ ...req.headers });
      },
    },
  });

  mdlw.enable(ID.generate({ prefix: "mdlw" }));
}
