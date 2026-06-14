import { createServer } from "xypriss";

/**
 * Sélectionne le scénario via la variable d'env SD_SCENARIO.
 *
 * Scénarios disponibles :
 * - "empty"     -> slowDown: {}              (config actuelle dans ton server.ts)
 * - "true"      -> slowDown: true            (defaults internes)
 * - "delayOnly" -> { windowMs, delayAfter }  (sans delayMs custom -> est-ce que le delay par défaut s'applique ?)
 * - "custom"    -> { windowMs, delayAfter, delayMs custom }
 * - "zeroAfter" -> delayAfter: 0             (cas limite, devrait délayer dès la 1ère requête ?)
 * - "disabled"  -> slowDown: false
 *
 * Exemple d'exécution :
 *   SD_SCENARIO=custom PORT=3000 npx tsx test-slowdown-server.ts
 */

declare const __sys__: any;
const SCENARIO = __sys__.__env__.get("SD_SCENARIO") || "empty";
const PORT = Number(__sys__.__env__.get("PORT") || 7522);

let slowDownConfig: any;

switch (SCENARIO) {
    case "true":
        slowDownConfig = true;
        break;

    case "delayOnly":
        slowDownConfig = {
            windowMs: 10_000, // 10s
            delayAfter: 3,
            // pas de delayMs -> on regarde si XyPriss applique un delay par défaut
        };
        break;

    case "custom":
        slowDownConfig = {
            windowMs: 10_000, // 10s
            delayAfter: 3,
            delayMs: (used: number, req: any) => {
                const delayAfter = req.slowDown?.limit || 3;
                return (used - delayAfter) * 200; // 200ms par requête au-delà de la limite
            },
        };
        break;

    case "zeroAfter":
        slowDownConfig = {
            windowMs: 10_000,
            delayAfter: 0,
            delayMs: (used: number) => used * 100,
        };
        break;

    case "disabled":
        slowDownConfig = false;
        break;

    case "empty":
    default:
        slowDownConfig = {};
        break;
}

console.log(
    `[SD TEST] scenario="${SCENARIO}" config=${JSON.stringify(
        slowDownConfig,
        (_k, v) => (typeof v === "function" ? "<function>" : v),
    )}`,
);

const app = createServer({
    server: { port: PORT },
    security: {
        slowDown: slowDownConfig,
    },
} as any);

app.get("/sd-test", (req: any, res: any) => {
    res.send({
        receivedAt: Date.now(),
        // on expose tout ce que XyPriss a pu attacher à req
        slowDownInfo: req.slowDown ?? null,
        rateLimitInfo: req.rateLimit ?? null,
    });
});

app.start();
