/**
 * XyPrissSecurity Middleware System Tests
 * Tests middleware registration, execution order, and configuration
 */

import { createServer } from "../integrations/express/ServerFactory";
import request from "supertest";

describe("XyPrissSecurity Middleware System", () => {
    let app: any;

    beforeEach(() => {
        app = createServer({
            logging: {
                enabled: false,
                consoleInterception: { enabled: false },
            },
        });
    });

    afterEach(async () => {
        if (app && app.close) {
            await app.close();
        }
    });

    test("should register middleware immediately", () => {
        const middleware = app.middleware();

        const result = middleware.register((req: any, res: any, next: any) => {
            next();
        });

        expect(result).toBeDefined();
    });

    test("should execute middleware in registration order", async () => {
        const executionOrder: number[] = [];

        const middleware = app.middleware();

        middleware.register((req: any, res: any, next: any) => {
            executionOrder.push(1);
            next();
        });

        middleware.register((req: any, res: any, next: any) => {
            executionOrder.push(2);
            next();
        });

        app.get("/order-test", (req: any, res: any) => {
            res.json({ executionOrder });
        });

        const response = await request(app).get("/order-test");
        expect(response.status).toBe(200);
        expect(response.body.executionOrder).toEqual([1, 2]);
    });

    test("should handle middleware with options", () => {
        const middleware = app.middleware();

        expect(() => {
            middleware.register((req: any, res: any, next: any) => next(), {
                name: "test-middleware",
                priority: "high",
            });
        }).not.toThrow();
    });

    test("should support middleware configuration", () => {
        expect(() => {
            app.middleware({
                rateLimit: { enabled: true, max: 100 },
                cors: { enabled: true },
                compression: false,
                security: false,
            });
        }).not.toThrow();
    });

    test("should handle async middleware", async () => {
        let asyncExecuted = false;

        const middleware = app.middleware();
        middleware.register(async (req: any, res: any, next: any) => {
            await new Promise((resolve) => setTimeout(resolve, 10));
            asyncExecuted = true;
            next();
        });

        app.get("/async-test", (req: any, res: any) => {
            res.json({ asyncExecuted });
        });

        const response = await request(app).get("/async-test");
        expect(response.status).toBe(200);
        expect(response.body.asyncExecuted).toBe(true);
    });

    test("should handle middleware errors", async () => {
        const middleware = app.middleware();
        middleware.register((req: any, res: any, next: any) => {
            const error = new Error("Middleware error");
            next(error);
        });

        app.get("/error-middleware-test", (req: any, res: any) => {
            res.json({ success: true });
        });

        const response = await request(app).get("/error-middleware-test");
        expect(response.status).toBeGreaterThanOrEqual(400);
    });

    test("should support convenience methods", async () => {
        // Test security middleware
        app.enableSecurity();

        app.get("/security-test", (req: any, res: any) => {
            res.json({ security: true });
        });

        const response = await request(app).get("/security-test");
        expect(response.status).toBe(200);
        expect(response.headers["x-content-type-options"]).toBe("nosniff");
        expect(response.headers["x-frame-options"]).toBe("DENY");
    });

    test("should handle multiple middleware configurations", () => {
        const middleware1 = app.middleware({ rateLimit: { max: 50 } });
        const middleware2 = app.middleware({ cors: { enabled: true } });

        expect(middleware1).toBeDefined();
        expect(middleware2).toBeDefined();
    });

    test("should support middleware chaining", () => {
        const middleware = app.middleware();

        const result = middleware
            .register((req: any, res: any, next: any) => next())
            .register((req: any, res: any, next: any) => next());

        expect(result).toBeDefined();
    });
});

