/***************************************************************************
 * XyPriss XMTG (Middleware Topology Graph) - Verification & Fair Benchmark
 *
 * Les tests marqués [BUG?] ciblent des défauts probables de l'implémentation
 * actuelle : ils sont ATTENDUS en échec tant que le correctif n'est pas fait.
 ***************************************************************************** */

import { EventEmitter } from "node:events";
import {
    XMTGraph,
    XmtgCompiler,
    XmtgExecutor,
    XmtgCycleError,
    XmtgTimeoutError,
} from "../src/server/middleware/xmtg";
import { MiddlewareManager as LegacyMiddlewareManager } from "../src/server/middleware/MiddlewareManager";
import { Logger } from "../src/shared/logger/Logger";

const logger = new Logger({ enabled: false } as any);

// ---------------------------------------------------------------------------
// Mini harness
// ---------------------------------------------------------------------------
let passed = 0;
let failed = 0;
const failures: string[] = [];

function assert(condition: boolean, msg: string) {
    if (condition) {
        console.log(`  ✅ ${msg}`);
        passed++;
    } else {
        console.error(`  ❌ ${msg}`);
        failed++;
        failures.push(msg);
    }
}

async function test(name: string, fn: () => void | Promise<void>) {
    console.log(`\n🧪 ${name}`);
    try {
        await fn();
    } catch (e: any) {
        assert(
            false,
            `"${name}" a levé une exception inattendue: ${e?.message}`,
        );
    }
}

const sleep = (ms: number) => new Promise<void>((r) => setTimeout(r, ms));

/** Échoue proprement au lieu de bloquer le runner si une promesse ne se résout jamais. */
function guard<T>(p: Promise<T>, ms = 500): Promise<T | "__HANG__"> {
    return Promise.race([p, sleep(ms).then(() => "__HANG__" as const)]);
}

/** Mock de réponse réaliste : end() émet "finish" et passe writableEnded à true. */
function makeRes(): any {
    const res: any = new EventEmitter();
    res.writableEnded = false;
    res.end = () => {
        res.writableEnded = true;
        res.emit("finish");
    };
    res.json = () => res.end();
    return res;
}

const noop = (_req: any, _res: any, next: any) => next();

// Capture des unhandled rejections pendant la suite
let unhandled = 0;
process.on("unhandledRejection", () => {
    unhandled++;
});

async function runTests() {
    console.log("=".repeat(80));
    console.log("🚀 XMTG VERIFICATION SUITE");
    console.log("=".repeat(80));

    // =======================================================================
    // 1. GRAPHE : ordre topologique
    // =======================================================================
    await test("1.1 Ordre topologique first/last/before/after", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "normal_2", priority: 20 });
        g.addNode(noop, { id: "normal_1", priority: 10 });
        g.addNode(noop, { id: "first_mw", first: true });
        g.addNode(noop, { id: "last_mw", last: true });
        g.addNode(noop, { id: "auth", after: "normal_1", before: "normal_2" });

        const ids = g.resolveOrder().map((n) => n.id);
        assert(ids[0] === "first_mw", "first_mw en tête");
        assert(ids[ids.length - 1] === "last_mw", "last_mw en queue");
        assert(
            ids.indexOf("auth") > ids.indexOf("normal_1"),
            "auth après normal_1",
        );
        assert(
            ids.indexOf("auth") < ids.indexOf("normal_2"),
            "auth avant normal_2",
        );
    });

    await test("1.2 Priorité : plus petit = exécuté en premier", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "p300", priority: 300 });
        g.addNode(noop, { id: "p1", priority: 1 });
        g.addNode(noop, { id: "p50", priority: 50 });
        assert(
            g
                .resolveOrder()
                .map((n) => n.id)
                .join(",") === "p1,p50,p300",
            "ordre p1,p50,p300",
        );
    });

    await test("1.3 Déterminisme à priorité égale (ordre d'enregistrement)", () => {
        const build = () => {
            const g = new XMTGraph();
            ["a", "b", "c", "d", "e"].forEach((id) => g.addNode(noop, { id }));
            return g
                .resolveOrder()
                .map((n) => n.id)
                .join(",");
        };
        assert(
            build() === "a,b,c,d,e",
            "nœuds indépendants : ordre d'enregistrement",
        );
        assert(build() === build(), "deux résolutions identiques");
    });

    await test("1.4 [BUG?] Tie-break par ordre d'enregistrement pour un nœud débloqué", () => {
        // c enregistré en premier mais contraint après a ; b indépendant.
        const g = new XMTGraph();
        g.addNode(noop, { id: "c" });
        g.addNode(noop, { id: "a", before: "c" });
        g.addNode(noop, { id: "b" });
        const order = g
            .resolveOrder()
            .map((n) => n.id)
            .join(",");
        // Attendu avec un tie-break par seq : a,c,b (c a été enregistré avant b)
        assert(order === "a,c,b", `ordre = ${order} (attendu a,c,b)`);
    });

    await test("1.5 Nœud désactivé exclu + arêtes vers/depuis lui ignorées", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "A", before: "B" });
        g.addNode(noop, { id: "B", enabled: false });
        g.addNode(noop, { id: "C" });
        let ids: string[] = [];
        try {
            ids = g.resolveOrder().map((n) => n.id);
            assert(!ids.includes("B"), "B désactivé absent");
        } catch (e: any) {
            assert(false, `before → nœud désactivé a crashé: ${e.message}`);
        }
    });

    await test("1.6 [BUG?] after vers un nœud désactivé ne doit pas crasher", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "B", enabled: false });
        g.addNode(noop, { id: "D", after: "B" });
        g.addNode(noop, { id: "E" });
        try {
            const ids = g.resolveOrder().map((n) => n.id);
            assert(ids.includes("D") && ids.includes("E"), "D et E présents");
        } catch (e: any) {
            assert(false, `after → nœud désactivé a crashé: ${e.message}`);
        }
    });

    await test("1.7 Arête vers un id inexistant ignorée", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "A", before: "ghost" });
        g.addNode(noop, { id: "B", after: "ghost2" });
        assert(g.resolveOrder().length === 2, "2 nœuds résolus");
    });

    await test("1.8 Ids dupliqués : suffixe incrémental, aucun écrasement", () => {
        const g = new XMTGraph();
        const a = g.addNode(noop, { id: "dup" });
        const b = g.addNode(noop, { id: "dup" });
        assert(a !== b, `ids distincts (${a}, ${b})`);
        assert(g.getAllNodes().length === 2, "2 nœuds enregistrés");
    });

    await test("1.9 [BUG?] isErrorHandler explicite (handler enveloppé)", () => {
        const g = new XMTGraph();
        const wrapped = (...args: any[]) => (args[3] as any)();
        const id = g.addNode(
            wrapped as any,
            { id: "wrapped_err", isErrorHandler: true } as any,
        );
        assert(
            g.getNode(id)!.isErrorHandler === true,
            "option isErrorHandler:true respectée malgré handler.length === 0",
        );
    });

    // =======================================================================
    // 2. GRAPHE : cycles
    // =======================================================================
    await test("2.1 Cycle A→B→C→A", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "A", before: "B" });
        g.addNode(noop, { id: "B", before: "C" });
        g.addNode(noop, { id: "C", before: "A" });
        let err: any;
        try {
            g.resolveOrder();
        } catch (e) {
            err = e;
        }
        assert(err instanceof XmtgCycleError, "XmtgCycleError levée");
        assert(
            err instanceof XmtgCycleError &&
                ["A", "B", "C"].every((id) => err.cyclePath.includes(id)),
            "cyclePath contient A, B, C",
        );
    });

    await test("2.2 Auto-référence (before: soi-même)", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "self", before: "self" });
        g.addNode(noop, { id: "other" });
        let err: any;
        try {
            g.resolveOrder();
        } catch (e) {
            err = e;
        }
        assert(err instanceof XmtgCycleError, "XmtgCycleError levée");
    });

    await test("2.3 Contradiction first + before/after", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "F", first: true });
        g.addNode(noop, { id: "N", before: "F" }); // N doit précéder F, F doit précéder N
        let err: any;
        try {
            g.resolveOrder();
        } catch (e) {
            err = e;
        }
        assert(
            err instanceof XmtgCycleError,
            "contradiction détectée comme cycle",
        );
    });

    await test("2.4 Contradiction last + after", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "L", last: true });
        g.addNode(noop, { id: "N", after: "L" });
        let err: any;
        try {
            g.resolveOrder();
        } catch (e) {
            err = e;
        }
        assert(
            err instanceof XmtgCycleError,
            "contradiction détectée comme cycle",
        );
    });

    await test("2.5 Graphe vide et nœud unique", () => {
        assert(new XMTGraph().resolveOrder().length === 0, "graphe vide → []");
        const g = new XMTGraph();
        g.addNode(noop, { id: "solo" });
        assert(g.resolveOrder().length === 1, "un nœud → [solo]");
    });

    // =======================================================================
    // 3. COMPILER
    // =======================================================================
    await test("3.1 Confinement serveur + préfixe de chemin", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "global_tracer", first: true });
        g.addNode(noop, { id: "auth_only", servers: ["authServer"] });
        g.addNode(noop, { id: "api_only", servers: ["apiServer"] });
        g.addNode(noop, { id: "admin_prefix", match: { path: "/admin" } });
        const c = new XmtgCompiler(g);

        const a = c
            .compile({ serverId: "apiServer", path: "/api/items" })
            .items.map((i) => i.id);
        assert(
            a.includes("global_tracer") && a.includes("api_only"),
            "A: tracer + api_only",
        );
        assert(
            !a.includes("auth_only") && !a.includes("admin_prefix"),
            "A: sans auth_only/admin",
        );

        const b = c
            .compile({ serverId: "authServer", path: "/admin/users" })
            .items.map((i) => i.id);
        assert(
            b.includes("auth_only") && b.includes("admin_prefix"),
            "B: auth_only + admin_prefix",
        );
        assert(!b.includes("api_only"), "B: sans api_only");

        const noServer = c.compile({ path: "/x" }).items.map((i) => i.id);
        assert(
            !noServer.includes("auth_only") && !noServer.includes("api_only"),
            "sans serverId : nœuds confinés exclus",
        );
    });

    await test("3.2 [BUG?] Frontière de segment du préfixe", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "admin_mw", match: { path: "/admin" } });
        const c = new XmtgCompiler(g);
        const has = (p: string) =>
            c.compile({ path: p }).items.some((i) => i.id === "admin_mw");
        assert(has("/admin"), "/admin matche");
        assert(has("/admin/users"), "/admin/users matche");
        assert(!has("/administrator"), "/administrator NE matche PAS");
        assert(!has("/admin-panel"), "/admin-panel NE matche PAS");
    });

    await test("3.3 Filtrage par méthode HTTP (insensible à la casse)", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "writes", match: { methods: ["post", "PUT"] } });
        const c = new XmtgCompiler(g);
        const has = (m?: string) =>
            c
                .compile({ path: "/x", method: m })
                .items.some((i) => i.id === "writes");
        assert(has("POST"), "POST admis");
        assert(has("put"), "put admis");
        assert(!has("GET"), "GET refusé");
    });

    await test("3.4 [BUG?] exclude avec frontière de segment", () => {
        const g = new XMTGraph();
        g.addNode(noop, {
            id: "guard",
            match: { exclude: ["/health", /^\/public\//] },
        });
        const c = new XmtgCompiler(g);
        const has = (p: string) =>
            c.compile({ path: p }).items.some((i) => i.id === "guard");
        assert(!has("/health"), "/health exclu");
        assert(!has("/health/live"), "/health/live exclu");
        assert(has("/healthcheck-secret"), "/healthcheck-secret NON exclu");
        assert(!has("/public/logo.png"), "RegExp /public/ exclue");
        assert(has("/api"), "/api inclus");
    });

    await test("3.5 RegExp simple", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "v", match: { path: /^\/api\/v\d+\// } });
        const c = new XmtgCompiler(g);
        const has = (p: string) =>
            c.compile({ path: p }).items.some((i) => i.id === "v");
        assert(has("/api/v1/users"), "/api/v1/users matche");
        assert(!has("/api/users"), "/api/users ne matche pas");
    });

    await test("3.6 [BUG?] RegExp avec flag g : résultat stable entre requêtes", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "gre", match: { path: /^\/api/g } });
        const c = new XmtgCompiler(g);
        const results = ["/api/a", "/api/b", "/api/c", "/api/d"].map((p) =>
            c.compile({ path: p }).items.some((i) => i.id === "gre"),
        );
        assert(
            results.every(Boolean),
            `tous matchent (obtenu: ${results.join(",")})`,
        );
    });

    await test("3.7 Cache : même clé → même pipeline (référence)", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "a" });
        const c = new XmtgCompiler(g);
        const p1 = c.compile({ path: "/x", method: "GET" });
        const p2 = c.compile({ path: "/x", method: "GET" });
        const p3 = c.compile({ path: "/x", method: "POST" });
        assert(p1 === p2, "cache hit renvoie la même instance");
        assert(p1 !== p3, "méthode différente → clé différente");
        c.invalidateCache();
        assert(
            c.compile({ path: "/x", method: "GET" }) !== p1,
            "invalidateCache vide le cache",
        );
    });

    await test("3.8 [BUG?] addNode après compile doit être pris en compte", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "early" });
        const c = new XmtgCompiler(g);
        c.compile({ path: "/x" });
        g.addNode(noop, { id: "late" });
        const ids = c.compile({ path: "/x" }).items.map((i) => i.id);
        assert(
            ids.includes("late"),
            "'late' présent sans invalidation manuelle",
        );
    });

    await test("3.9 [BUG?] Cache borné face à des chemins dynamiques", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "a" });
        const c = new XmtgCompiler(g);
        for (let i = 0; i < 5000; i++) c.compile({ path: `/users/${i}` });
        const size = (c as any).cache.size as number;
        assert(
            size <= 1000,
            `taille du cache = ${size} (attendu ≤ 1000, LRU ou clé par pattern)`,
        );
    });

    await test("3.10 Pipeline conserve l'ordre topologique et propage timeoutMs", () => {
        const g = new XMTGraph();
        g.addNode(noop, { id: "z", priority: 5, timeoutMs: 250 });
        g.addNode(noop, { id: "y", priority: 1 });
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        assert(items.map((i) => i.id).join(",") === "y,z", "ordre y,z");
        assert(items[1].timeoutMs === 250, "timeoutMs propagé");
    });

    // =======================================================================
    // 4. EXECUTOR
    // =======================================================================
    await test("4.1 Chaîne normale : ordre d'exécution + retourne true", async () => {
        const log: string[] = [];
        const g = new XMTGraph();
        g.addNode(
            (_q, _s, n) => {
                log.push("a");
                n();
            },
            { id: "a", priority: 1 },
        );
        g.addNode(
            (_q, _s, n) => {
                log.push("b");
                setImmediate(n);
            },
            { id: "b", priority: 2 },
        );
        g.addNode(
            (_q, _s, n) => {
                log.push("c");
                n();
            },
            { id: "c", priority: 3 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        const r = await guard(XmtgExecutor.Exec(items, {} as any, makeRes()));
        assert(log.join("") === "abc", "ordre a,b,c");
        assert(r === true, "Exec retourne true");
    });

    await test("4.2 Réponse envoyée par un middleware : chaîne stoppée, retourne false", async () => {
        const log: string[] = [];
        const g = new XMTGraph();
        g.addNode(
            (_q, s, _n) => {
                log.push("a");
                s.json({ ok: 1 });
            },
            { id: "a", priority: 1 },
        );
        g.addNode(
            (_q, _s, n) => {
                log.push("b");
                n();
            },
            { id: "b", priority: 2 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        const r = await guard(XmtgExecutor.Exec(items, {} as any, makeRes()));
        assert(r === false, "Exec retourne false");
        assert(log.join("") === "a", "b jamais exécuté");
    });

    await test("4.3 Réponse asynchrone (res.json après un délai) sans next()", async () => {
        const g = new XMTGraph();
        g.addNode(
            (_q, s, _n) => {
                setTimeout(() => s.json({}), 20);
            },
            { id: "async_resp" },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        const r = await guard(XmtgExecutor.Exec(items, {} as any, makeRes()));
        assert(r === false, "résolu via l'événement finish, retourne false");
    });

    await test("4.4 next(err) → error handler (4 args) récupère → la chaîne reprend", async () => {
        const log: string[] = [];
        const g = new XMTGraph();
        g.addNode(
            (_q, _s, n) => {
                log.push("mw1");
                n(new Error("boom"));
            },
            { id: "mw1", priority: 1 },
        );
        g.addNode(
            (_q, _s, n) => {
                log.push("skipped");
                n();
            },
            { id: "skipped", priority: 2 },
        );
        g.addNode(
            ((err: any, _q: any, _s: any, n: any) => {
                log.push(`err:${err.message}`);
                n();
            }) as any,
            { id: "errh", priority: 3 },
        );
        g.addNode(
            (_q, _s, n) => {
                log.push("after");
                n();
            },
            { id: "after_mw", priority: 4 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        const r = await guard(XmtgExecutor.Exec(items, {} as any, makeRes()));
        assert(
            log.join("|") === "mw1|err:boom|after",
            `log = ${log.join("|")}`,
        );
        assert(r === true, "retourne true après récupération");
    });

    await test("4.5 Error handler ignoré quand aucune erreur", async () => {
        const log: string[] = [];
        const g = new XMTGraph();
        g.addNode(
            (_q, _s, n) => {
                log.push("mw");
                n();
            },
            { id: "mw", priority: 1 },
        );
        g.addNode(
            ((_e: any, _q: any, _s: any, n: any) => {
                log.push("errh");
                n();
            }) as any,
            { id: "errh", priority: 2 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        await guard(XmtgExecutor.Exec(items, {} as any, makeRes()));
        assert(log.join("") === "mw", "errh non appelé");
    });

    await test("4.6 Erreur non gérée : re-throw", async () => {
        const g = new XMTGraph();
        g.addNode((_q, _s, n) => n(new Error("fatal")), { id: "mw" });
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        let caught: any;
        try {
            await guard(XmtgExecutor.Exec(items, {} as any, makeRes()));
        } catch (e) {
            caught = e;
        }
        assert(caught?.message === "fatal", "erreur 'fatal' propagée");
    });

    await test("4.7 Throw synchrone traité comme une erreur", async () => {
        const g = new XMTGraph();
        g.addNode(
            () => {
                throw new Error("sync-boom");
            },
            { id: "mw", priority: 1 },
        );
        g.addNode(
            ((e: any, _q: any, _s: any, n: any) => {
                n();
            }) as any,
            { id: "errh", priority: 2 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        const r = await guard(XmtgExecutor.Exec(items, {} as any, makeRes()));
        assert(r === true, "error handler a absorbé le throw synchrone");
    });

    await test("4.8 [BUG?] Handler async qui throw (sans next) : pas de hang ni d'unhandled rejection", async () => {
        const before = unhandled;
        const g = new XMTGraph();
        g.addNode(
            (async (_q: any, _s: any, _n: any) => {
                throw new Error("async-boom");
            }) as any,
            { id: "async_mw", priority: 1 },
        );
        g.addNode(
            ((e: any, _q: any, _s: any, n: any) => {
                n();
            }) as any,
            { id: "errh", priority: 2 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        const r = await guard(
            XmtgExecutor.Exec(items, {} as any, makeRes()),
            300,
        );
        await sleep(20);
        assert(r !== "__HANG__", "l'Executor ne reste pas bloqué");
        assert(
            unhandled === before,
            `aucune unhandled rejection (+${unhandled - before})`,
        );
    });

    await test("4.9 Timeout : XmtgTimeoutError + next() tardif inoffensif", async () => {
        const before = unhandled;
        let lateCalls = 0;
        const g = new XMTGraph();
        g.addNode(
            (_q, _s, n) => {
                setTimeout(() => {
                    lateCalls++;
                    n();
                }, 150);
            },
            { id: "slow_oauth", timeoutMs: 30 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;

        const t0 = Date.now();
        let err: any;
        try {
            await XmtgExecutor.Exec(items, {} as any, makeRes());
        } catch (e) {
            err = e;
        }
        const elapsed = Date.now() - t0;

        assert(err instanceof XmtgTimeoutError, "XmtgTimeoutError levée");
        assert(
            err?.middlewareId === "slow_oauth" && err?.timeoutMs === 30,
            "id et durée exposés",
        );
        assert(elapsed < 120, `échec rapide (${elapsed}ms, pas 150ms)`);

        await sleep(200); // laisse le next() tardif se produire
        assert(lateCalls === 1, "le next() tardif a bien été appelé");
        assert(
            unhandled === before,
            "aucun crash / rejection due au next() tardif",
        );
    });

    await test("4.10 Timeout non déclenché si le middleware répond à temps", async () => {
        const g = new XMTGraph();
        g.addNode(
            (_q, _s, n) => {
                setTimeout(n, 10);
            },
            { id: "fast", timeoutMs: 100 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        const r = await guard(
            XmtgExecutor.Exec(items, {} as any, makeRes()),
            400,
        );
        assert(r === true, "chaîne complétée sans timeout");
    });

    await test("4.11 Pas de fuite de listeners 'finish' sur res", async () => {
        const g = new XMTGraph();
        for (let i = 0; i < 20; i++)
            g.addNode(noop, { id: `m${i}`, priority: i });
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        const res = makeRes();
        await XmtgExecutor.Exec(items, {} as any, res);
        assert(
            res.listenerCount("finish") === 0,
            `listeners restants: ${res.listenerCount("finish")}`,
        );
    });

    await test("4.12 Next appelé deux fois : ignoré", async () => {
        const log: string[] = [];
        const g = new XMTGraph();
        g.addNode(
            (_q, _s, n) => {
                n();
                n();
            },
            { id: "double", priority: 1 },
        );
        g.addNode(
            (_q, _s, n) => {
                log.push("next_mw");
                n();
            },
            { id: "after", priority: 2 },
        );
        const items = new XmtgCompiler(g).compile({ path: "/" }).items;
        await guard(XmtgExecutor.Exec(items, {} as any, makeRes()));
        assert(log.length === 1, "middleware suivant exécuté une seule fois");
    });

    // =======================================================================
    // 5. Sanity du LegacyMiddlewareManager (valide l'équité du bench)
    // =======================================================================
    await test("5.1 Legacy : tous les handlers sont bien appelés", async () => {
        const mgr = new LegacyMiddlewareManager(logger);
        let count = 0;
        for (let i = 0; i < 13; i++)
            mgr.use((_q: any, _s: any, n: any) => {
                count++;
                n?.();
            });
        await mgr.execute({ path: "/x" } as any, makeRes());
        assert(count === 13, `13 handlers appelés (obtenu ${count})`);
    });

    // =======================================================================
    // 6. BENCHMARK ÉQUITABLE
    // =======================================================================
    await benchmark();

    console.log("\n" + "=".repeat(80));
    console.log(`RÉSULTATS: ${passed} passed, ${failed} failed`);
    if (failures.length) {
        console.log("\nÉchecs :");
        failures.forEach((f) => console.log(`  - ${f}`));
    }
    console.log("=".repeat(80));

    process.exit(failed > 0 ? 1 : 0);
}

// ---------------------------------------------------------------------------
// Benchmark
// ---------------------------------------------------------------------------
const WARMUP = 2000;
const ITERS = 20000;
const RUNS = 5;

type Fn = () => Promise<unknown>;

async function timeOnce(fn: Fn): Promise<number> {
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < ITERS; i++) await fn();
    return Number(process.hrtime.bigint() - t0) / 1e6;
}

const median = (xs: number[]) =>
    [...xs].sort((a, b) => a - b)[Math.floor(xs.length / 2)];

/** Compare deux fonctions en alternant l'ordre à chaque run (neutralise l'effet "second = plus chaud"). */
async function compare(
    title: string,
    nameA: string,
    fnA: Fn,
    nameB: string,
    fnB: Fn,
) {
    for (let i = 0; i < WARMUP; i++) {
        await fnA();
        await fnB();
    }

    const a: number[] = [];
    const b: number[] = [];
    for (let r = 0; r < RUNS; r++) {
        if (r % 2 === 0) {
            a.push(await timeOnce(fnA));
            b.push(await timeOnce(fnB));
        } else {
            b.push(await timeOnce(fnB));
            a.push(await timeOnce(fnA));
        }
    }

    const mA = median(a);
    const mB = median(b);
    const fmt = (name: string, m: number, xs: number[]) =>
        `  ${name.padEnd(22)} median ${m.toFixed(2).padStart(8)} ms | ${Math.round(
            ITERS / (m / 1000),
        )
            .toLocaleString()
            .padStart(
                11,
            )} req/s | min ${Math.min(...xs).toFixed(1)} max ${Math.max(...xs).toFixed(1)}`;

    console.log(`\n▶ ${title}`);
    console.log(fmt(nameA, mA, a));
    console.log(fmt(nameB, mB, b));
    console.log(`  → ratio ${nameA}/${nameB} = ${(mA / mB).toFixed(2)}x`);
}

async function benchmark() {
    console.log("\n" + "=".repeat(80));
    console.log(
        `⚡ BENCHMARK  (warm-up ${WARMUP}, ${ITERS.toLocaleString()} iters × ${RUNS} runs, ordre alterné, res partagé)`,
    );
    console.log("=".repeat(80));

    const prefixes = ["/admin", "/auth", "/api/v1", "/dashboard", "/internal"];
    const res = makeRes(); // stateless : réutilisé, pas d'allocation dans la boucle mesurée

    // --- Legacy : 3 globaux seulement ---
    const legacy3 = new LegacyMiddlewareManager(logger);
    for (let i = 0; i < 3; i++)
        legacy3.use((_q: any, _s: any, n: any) => n?.());

    // --- Legacy : 3 globaux + 10 wrappers de préfixe ---
    const legacy13 = new LegacyMiddlewareManager(logger);
    for (let i = 0; i < 3; i++)
        legacy13.use((_q: any, _s: any, n: any) => n?.());
    for (const p of prefixes) {
        for (let k = 0; k < 2; k++) {
            legacy13.use((req: any, _s: any, n: any) => {
                if (req.path.startsWith(p)) return n?.();
                n?.();
            });
        }
    }

    // --- XMTG : mêmes 13 nœuds ---
    const graph = new XMTGraph();
    graph.addNode(noop, { id: "g1", first: true });
    graph.addNode(noop, { id: "g2" });
    graph.addNode(noop, { id: "g3" });
    for (const p of prefixes) {
        graph.addNode(noop, { match: { path: p } });
        graph.addNode(noop, { match: { path: p } });
    }
    const compiler = new XmtgCompiler(graph);

    // Chemins de test
    const reqFast = { path: "/api/perf/fast" } as any; // aucun préfixe → 3 items XMTG
    const reqAdmin = { path: "/admin/users" } as any; // /admin → 5 items XMTG
    const pFast = compiler.compile({ path: reqFast.path }).items;
    const pAdmin = compiler.compile({ path: reqAdmin.path }).items;

    console.log(
        `\nItems compilés : route non matchée = ${pFast.length}, /admin/users = ${pAdmin.length} (legacy exécute toujours 13)`,
    );

    // A. Workload IDENTIQUE : 3 middlewares des deux côtés → mesure le coût pur de l'exécuteur
    const xmtg3 = new XMTGraph();
    for (let i = 0; i < 3; i++) xmtg3.addNode(noop, { id: `x${i}` });
    const p3 = new XmtgCompiler(xmtg3).compile({ path: "/x" }).items;
    await compare(
        "A. Même workload (3 middlewares) : coût pur de l'exécuteur",
        "Legacy(3)",
        () => legacy3.execute(reqFast, res),
        "XMTG(3)",
        () => XmtgExecutor.Exec(p3, reqFast, res),
    );

    // B. Route non matchée : l'avantage AOT (filtrage en amont)
    await compare(
        "B. Route non matchée : Legacy 13 handlers vs XMTG 3 items (gain AOT)",
        "Legacy(13)",
        () => legacy13.execute(reqFast, res),
        "XMTG(3)",
        () => XmtgExecutor.Exec(pFast, reqFast, res),
    );

    // C. Route matchée : cas défavorable pour l'AOT
    await compare(
        "C. Route /admin/users : Legacy 13 handlers vs XMTG 5 items",
        "Legacy(13)",
        () => legacy13.execute(reqAdmin, res),
        "XMTG(5)",
        () => XmtgExecutor.Exec(pAdmin, reqAdmin, res),
    );

    // D. Coût de compile() à froid vs en cache, et croissance du cache
    console.log(
        "\n▶ D. Coût de compile() (cache miss vs hit) et croissance du cache",
    );
    const N = 5000;
    const cold = new XmtgCompiler(graph);
    const t0 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) cold.compile({ path: `/users/${i}` });
    const coldUs = Number(process.hrtime.bigint() - t0) / 1e3 / N;

    const t1 = process.hrtime.bigint();
    for (let i = 0; i < N; i++) cold.compile({ path: `/users/${i}` });
    const hitUs = Number(process.hrtime.bigint() - t1) / 1e3 / N;

    console.log(
        `  cache miss : ${coldUs.toFixed(2)} µs/compile (resolveOrder complet à chaque fois)`,
    );
    console.log(`  cache hit  : ${hitUs.toFixed(2)} µs/compile`);
    console.log(
        `  entrées en cache après ${N} chemins uniques : ${(cold as any).cache.size}`,
    );
    console.log(`  surcoût miss/hit : ${(coldUs / hitUs).toFixed(1)}x`);
}

runTests().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
});
