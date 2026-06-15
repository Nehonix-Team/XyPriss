/**
 * XHSC Request Pipeline Timing Profiler
 *
 * Démarre le serveur XyPriss avec des hooks de timing intégrés
 * dans chaque phase du pipeline IPC pour identifier précisément
 * où le temps est perdu.
 *
 * Phases mesurées :
 *   T0 → demande reçue par Go et envoyée au worker Node.js (via XBP)
 *   T1 → worker Node.js commence à traiter la requête
 *   T2 → middleware auth terminé (après setTimeout 2ms)
 *   T3 → SendFileHandler.handle() appelé
 *   T4 → res.end() appelé (réponse envoyée à Go)
 *   T5 → Go reçoit la réponse et commence à servir le fichier
 *
 * Usage : bun run tools/debug/timing_profiler.ts
 */

import { createServer } from "xypriss";
import path from "path";
import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ASSET_PATH = path.resolve(__dirname, "../../bench/mixed-bench/assets/dummy-500k.bin");

// Compteur global pour calculer les statistiques
const timings: Record<string, number[]> = {
    "T0→T4 (IPC total Node.js)": [],
    "T1→T2 (auth middleware)": [],
    "T2→T4 (sendFile+end)": [],
};

let reqCount = 0;

const app = createServer({
    server: { port: 8093 },
    security: { enabled: false },
});

// Middleware auth identique au bench, mais avec timing
const authMiddleware = async (req: any, res: any, next: any) => {
    const t1 = process.hrtime.bigint();
    (req as any).__t1 = t1;

    await new Promise(r => setTimeout(r, 2));

    const t2 = process.hrtime.bigint();
    (req as any).__t2 = t2;
    req.user = { id: 1, role: "admin" };
    next();
};

app.get("/api/download", authMiddleware, async (req: any, res: any) => {
    const t3 = process.hrtime.bigint();
    (req as any).__t3 = t3;

    // Intercepter la fin de réponse pour mesurer T4
    const origEnd = res.end.bind(res);
    res.end = function (...args: any[]) {
        const t4 = process.hrtime.bigint();
        const t1 = req.__t1;
        const t2 = req.__t2;

        const authMs = Number(t2 - t1) / 1_000_000;
        const sendfileMs = Number(t4 - t2) / 1_000_000;
        const totalNodeMs = Number(t4 - t1) / 1_000_000;

        timings["T0→T4 (IPC total Node.js)"].push(totalNodeMs);
        timings["T1→T2 (auth middleware)"].push(authMs);
        timings["T2→T4 (sendFile+end)"].push(sendfileMs);

        reqCount++;
        if (reqCount % 10 === 0) {
            console.log(`\n[Timing Report — ${reqCount} requests]`);
            for (const [label, vals] of Object.entries(timings)) {
                const last20 = vals.slice(-20);
                const avg = last20.reduce((a, b) => a + b, 0) / last20.length;
                const min = Math.min(...last20);
                const max = Math.max(...last20);
                console.log(`  ${label}: min=${min.toFixed(1)}ms avg=${avg.toFixed(1)}ms max=${max.toFixed(1)}ms`);
            }
        }

        return origEnd(...args);
    };

    res.sendFile(ASSET_PATH);
});

app.start();
console.log("[TimingProfiler] Server started on :8093");
console.log("[TimingProfiler] Fire requests: npx autocannon -c 50 -d 10 http://127.0.0.1:8093/api/download");
 