import { Router } from "../src";

const testRouter = Router();

// Test endpoint for basic functionality
testRouter.get("/user", (req: any, res: any) => {
    res.send({
        message: "ok",
    });
});
 
// Test endpoint for trust proxy functionality
testRouter.get("/proxy-test", (req: any, res: any) => {
    res.json({
        message: "Trust proxy test endpoint",
        clientInfo: {
            ip: req.ip,
            ips: req.ips,
            protocol: req.protocol,
            secure: req.secure,
            hostname: req.hostname,
            originalUrl: req.originalUrl,
        },
        headers: {
            "x-forwarded-for": req.headers["x-forwarded-for"],
            "x-forwarded-proto": req.headers["x-forwarded-proto"],
            "x-forwarded-host": req.headers["x-forwarded-host"],
            "x-real-ip": req.headers["x-real-ip"],
            "host": req.headers["host"],
            "user-agent": req.headers["user-agent"],
        },
        rawHeaders: req.rawHeaders,
    });
});

export { testRouter };

