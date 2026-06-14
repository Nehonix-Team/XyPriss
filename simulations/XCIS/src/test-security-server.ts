import { createServer, Send } from "xypriss";

declare const __sys__: any;
const SCENARIO = __sys__.__env__.get("SEC_SCENARIO") || "empty";
const PORT = Number(__sys__.__env__.get("PORT") || 5421);

let securityConfig: any = {};

switch (SCENARIO) {
    case "xss-block":
        securityConfig = {
            xss: { blockOnDetection: true }
        };
        break;
    case "xxe-block":
        securityConfig = {
            xxe: { blockOnDetection: true, allowDTD: false }
        };
        break;
    case "hpp-block":
        securityConfig = {
            hpp: { checkQuery: true, checkBody: true }
        };
        break;
    case "helmet-enabled":
        securityConfig = {
            helmet: true
        };
        break;
    case "all":
        securityConfig = {
            xss: { blockOnDetection: true },
            xxe: { blockOnDetection: true, allowDTD: false },
            hpp: { checkQuery: true },
            helmet: true
        };
        break;
    case "empty":
    default:
        securityConfig = {
            xss: {},
            xxe: {},
            hpp: {},
            helmet: {}
        };
        break;
}

console.log(`[SEC TEST] scenario="${SCENARIO}" config=${JSON.stringify(securityConfig)}`);

const app = createServer({
    server: { port: PORT },
    security: securityConfig,
} as any);

app.get("/test-get", (req: any, res: any) => {
    res.send({
        query: req.query,
        headers: req.headers
    });
});

app.post("/test-post", (req: any, res: any) => {
    res.send({
        body: req.body,
        query: req.query,
        headers: req.headers
    });
});

app.start();
