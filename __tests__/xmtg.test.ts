/***************************************************************************
 * XyPriss XMTG (Middleware Topology Graph) Battle Test & Benchmark
 ***************************************************************************** */

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

async function runTests() {
    console.log("================================================================================");
    console.log("🚀 STARTING XMTG (XyPriss Middleware Topology Graph) VERIFICATION SUITE");
    console.log("================================================================================\n");

    let passed = 0;
    let failed = 0;

    function assert(condition: boolean, msg: string) {
        if (condition) {
            console.log(`  ✅ PASS: ${msg}`);
            passed++;
        } else {
            console.error(`  ❌ FAIL: ${msg}`);
            failed++;
        }
    }

    // -------------------------------------------------------------------------
    // TEST 1: Topological Ordering with before/after/first/last
    // -------------------------------------------------------------------------
    console.log("🧪 TEST 1: Topological Ordering (DAG)");
    try {
        const graph = new XMTGraph();
        const executionLog: string[] = [];

        graph.addNode((_req, _res, next) => { executionLog.push("normal_2"); next(); }, { id: "normal_2", priority: 20 });
        graph.addNode((_req, _res, next) => { executionLog.push("normal_1"); next(); }, { id: "normal_1", priority: 10 });
        graph.addNode((_req, _res, next) => { executionLog.push("first_mw"); next(); }, { id: "first_mw", first: true });
        graph.addNode((_req, _res, next) => { executionLog.push("last_mw"); next(); }, { id: "last_mw", last: true });
        graph.addNode((_req, _res, next) => { executionLog.push("auth"); next(); }, { id: "auth", after: "normal_1", before: "normal_2" });

        const ordered = graph.resolveOrder();
        const ids = ordered.map((n) => n.id);

        assert(ids[0] === "first_mw", "'first_mw' is positioned at index 0");
        assert(ids[ids.length - 1] === "last_mw", "'last_mw' is positioned at the tail");
        assert(ids.indexOf("auth") > ids.indexOf("normal_1"), "'auth' executes after 'normal_1'");
        assert(ids.indexOf("auth") < ids.indexOf("normal_2"), "'auth' executes before 'normal_2'");
    } catch (e: any) {
        assert(false, `Test 1 threw error: ${e.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 2: Cycle Detection
    // -------------------------------------------------------------------------
    console.log("\n🧪 TEST 2: Cycle Detection (Fail-Closed Protection)");
    try {
        const graph = new XMTGraph();
        graph.addNode((_req, _res, next) => next(), { id: "mw_A", before: "mw_B" });
        graph.addNode((_req, _res, next) => next(), { id: "mw_B", before: "mw_C" });
        graph.addNode((_req, _res, next) => next(), { id: "mw_C", before: "mw_A" }); // Circular loop!

        let detected = false;
        try {
            graph.resolveOrder();
        } catch (e) {
            if (e instanceof XmtgCycleError) {
                detected = true;
                assert(true, `Circular dependency caught properly: ${e.message}`);
            }
        }
        assert(detected, "Graph properly threw XmtgCycleError on cycle");
    } catch (e: any) {
        assert(false, `Test 2 threw error: ${e.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 3: AOT Route and Server Confinement Compilation
    // -------------------------------------------------------------------------
    console.log("\n🧪 TEST 3: Ahead-Of-Time (AOT) Route Compilation & Server Confinement");
    try {
        const graph = new XMTGraph();
        graph.addNode((_req, _res, next) => next(), { id: "global_tracer", first: true });
        graph.addNode((_req, _res, next) => next(), { id: "auth_only", servers: ["authServer"] });
        graph.addNode((_req, _res, next) => next(), { id: "api_only", servers: ["apiServer"] });
        graph.addNode((_req, _res, next) => next(), { id: "admin_prefix", match: { path: "/admin" } });

        const compiler = new XmtgCompiler(graph);

        // Scenario A: request on apiServer to /api/items
        const pipelineA = compiler.compile({ serverId: "apiServer", path: "/api/items" });
        const idsA = pipelineA.items.map((i) => i.id);
        assert(idsA.includes("global_tracer"), "Pipeline A includes global_tracer");
        assert(idsA.includes("api_only"), "Pipeline A includes api_only");
        assert(!idsA.includes("auth_only"), "Pipeline A excludes auth_only (server confinement)");
        assert(!idsA.includes("admin_prefix"), "Pipeline A excludes admin_prefix (path confinement)");

        // Scenario B: request to /admin/users on authServer
        const pipelineB = compiler.compile({ serverId: "authServer", path: "/admin/users" });
        const idsB = pipelineB.items.map((i) => i.id);
        assert(idsB.includes("global_tracer"), "Pipeline B includes global_tracer");
        assert(idsB.includes("auth_only"), "Pipeline B includes auth_only");
        assert(idsB.includes("admin_prefix"), "Pipeline B includes admin_prefix");
        assert(!idsB.includes("api_only"), "Pipeline B excludes api_only");
    } catch (e: any) {
        assert(false, `Test 3 threw error: ${e.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 4: Middleware Execution Timeout (timeoutMs circuit-breaker)
    // -------------------------------------------------------------------------
    console.log("\n🧪 TEST 4: Individual Middleware Timeout Enforcement");
    try {
        const graph = new XMTGraph();
        graph.addNode(
            (_req, _res, next) => {
                // Simulates a hanging or stalled async middleware (e.g. unresponsive database/OAuth)
                setTimeout(() => next(), 500);
            },
            { id: "slow_oauth", timeoutMs: 50 },
        );

        const compiler = new XmtgCompiler(graph);
        const pipeline = compiler.compile({ path: "/test" });

        const fakeReq = { path: "/test" } as any;
        const fakeRes = {
            once: (_event: string, _cb: any) => {},
            removeListener: (_event: string, _cb: any) => {},
            writableEnded: false,
        } as any;

        let timeoutTriggered = false;
        try {
            await XmtgExecutor.Exec(pipeline.items, fakeReq, fakeRes);
        } catch (e) {
            if (e instanceof XmtgTimeoutError) {
                timeoutTriggered = true;
                assert(true, `Middleware timeout was caught: ${e.message}`);
            }
        }
        assert(timeoutTriggered, "XmtgTimeoutError was properly enforced after 50ms");
    } catch (e: any) {
        assert(false, `Test 4 threw error: ${e.message}`);
    }

    // -------------------------------------------------------------------------
    // TEST 5: Comparative Benchmark (Legacy Linear Loop vs XMTG AOT Pipeline)
    // -------------------------------------------------------------------------
    console.log("\n================================================================================");
    console.log("⚡ BENCHMARK: Legacy Linear Loop vs XMTG Pre-Compiled AOT Pipeline");
    console.log("================================================================================");

    const ITERATIONS = 20000;
    console.log(`Running ${ITERATIONS.toLocaleString()} request evaluations per engine...\n`);

    // Setup 15 middlewares (common enterprise setup: 5 global, 5 prefix /admin, 5 prefix /auth)
    const prefixes = ["/admin", "/auth", "/api/v1", "/dashboard", "/internal"];

    // 1. Setup Legacy MiddlewareManager
    const legacyMgr = new LegacyMiddlewareManager(logger);
    // 3 globals
    legacyMgr.use((_req, _res, next) => next?.());
    legacyMgr.use((_req, _res, next) => next?.());
    legacyMgr.use((_req, _res, next) => next?.());
    // 10 path-specific wrappers
    for (const prefix of prefixes) {
        legacyMgr.use((req, res, next) => {
            if (req.path.startsWith(prefix)) {
                // simulate path middleware
                return next?.();
            }
            next?.();
        });
        legacyMgr.use((req, res, next) => {
            if (req.path.startsWith(prefix)) {
                return next?.();
            }
            next?.();
        });
    }

    // 2. Setup XMTG Graph & Compiler
    const xmtgGraph = new XMTGraph();
    xmtgGraph.addNode((_req, _res, next) => next(), { id: "g1", first: true });
    xmtgGraph.addNode((_req, _res, next) => next(), { id: "g2" });
    xmtgGraph.addNode((_req, _res, next) => next(), { id: "g3" });
    for (const prefix of prefixes) {
        xmtgGraph.addNode((_req, _res, next) => next(), { match: { path: prefix } });
        xmtgGraph.addNode((_req, _res, next) => next(), { match: { path: prefix } });
    }
    const xmtgCompiler = new XmtgCompiler(xmtgGraph);

    // Warm-up & Target route: /api/perf/fast (unrelated to /admin or /auth)
    const req = { path: "/api/perf/fast" } as any;
    const makeRes = () => ({
        once: (_ev: string, _cb: any) => {},
        removeListener: (_ev: string, _cb: any) => {},
        writableEnded: false,
    } as any);

    // Run Legacy Benchmark
    const t0Legacy = process.hrtime.bigint();
    for (let i = 0; i < ITERATIONS; i++) {
        await legacyMgr.execute(req, makeRes());
    }
    const t1Legacy = process.hrtime.bigint();
    const legacyMs = Number(t1Legacy - t0Legacy) / 1e6;
    const legacyOps = Math.round((ITERATIONS / (legacyMs / 1000)));

    // Run XMTG Benchmark (using compiled pipeline for this route)
    const compiledPipeline = xmtgCompiler.compile({ path: "/api/perf/fast" });
    const t0Xmtg = process.hrtime.bigint();
    for (let i = 0; i < ITERATIONS; i++) {
        await XmtgExecutor.Exec(compiledPipeline.items, req, makeRes());
    }
    const t1Xmtg = process.hrtime.bigint();
    const xmtgMs = Number(t1Xmtg - t0Xmtg) / 1e6;
    const xmtgOps = Math.round((ITERATIONS / (xmtgMs / 1000)));

    const speedup = (legacyMs / xmtgMs).toFixed(2);

    console.log(`📊 [Legacy Linear Loop] : ${legacyMs.toFixed(2)} ms | ${legacyOps.toLocaleString()} req/s`);
    console.log(`🚀 [XMTG AOT Pipeline]  : ${xmtgMs.toFixed(2)} ms | ${xmtgOps.toLocaleString()} req/s`);
    console.log(`\n🏆 Performance Gain: XMTG is ${speedup}x FASTER!`);

    console.log("\n================================================================================");
    console.log(`RESULTS: ${passed} passed, ${failed} failed.`);
    console.log("================================================================================");

    if (failed > 0) {
        process.exit(1);
    }
}

runTests().catch((err) => {
    console.error("Test runner crashed:", err);
    process.exit(1);
});






