/**
 * XyPriss Performance Benchmark Suite:
 * Native process.env vs XyPriss __sys__.__env__ (EnvApi)
 *
 * Measures:
 * 1. Single Key Read (Whitelisted: 'PORT')
 * 2. Protected Application Secret Read ('DATABASE_URL')
 * 3. Absent Key Read with Default Fallback
 * 4. Key Existence Check ('has' vs 'in')
 * 5. Batch Reads (10 keys per request cycle)
 * 6. Dynamic Variable Mutation ('set')
 */
import { __sys__ } from "../src/index";

interface BenchmarkResult {
    name: string;
    iterations: number;
    totalTimeMs: number;
    opsPerSec: number;
    avgLatencyNs: number;
    minLatencyNs: number;
    maxLatencyNs: number;
    p50LatencyNs: number;
    p95LatencyNs: number;
    p99LatencyNs: number;
}

function calculatePercentiles(latencies: Float64Array | number[]): {
    min: number;
    max: number;
    p50: number;
    p95: number;
    p99: number;
} {
    const sorted = Array.from(latencies).sort((a, b) => a - b);
    const n = sorted.length;
    return {
        min: sorted[0] ?? 0,
        max: sorted[n - 1] ?? 0,
        p50: sorted[Math.floor(n * 0.50)] ?? 0,
        p95: sorted[Math.floor(n * 0.95)] ?? 0,
        p99: sorted[Math.floor(n * 0.99)] ?? 0,
    };
}

function runBenchmark(
    name: string,
    iterations: number,
    fn: (i: number) => void,
    warmupIterations = 10
): BenchmarkResult {
    // Warmup phase
    for (let i = 0; i < warmupIterations; i++) {
        try { fn(i); } catch {}
    }

    const samples = new Float64Array(iterations);
    const startTotal = process.hrtime.bigint();

    for (let i = 0; i < iterations; i++) {
        const startOp = process.hrtime.bigint();
        fn(i);
        const endOp = process.hrtime.bigint();
        samples[i] = Number(endOp - startOp);
    }

    const endTotal = process.hrtime.bigint();
    const totalTimeNs = Number(endTotal - startTotal);
    const totalTimeMs = Number((totalTimeNs / 1_000_000).toFixed(3));
    const opsPerSec = Math.round((iterations / (totalTimeNs / 1_000_000_000)));
    const avgLatencyNs = Math.round(totalTimeNs / iterations);

    const { min, max, p50, p95, p99 } = calculatePercentiles(samples);

    return {
        name,
        iterations,
        totalTimeMs,
        opsPerSec,
        avgLatencyNs,
        minLatencyNs: Math.round(min),
        maxLatencyNs: Math.round(max),
        p50LatencyNs: Math.round(p50),
        p95LatencyNs: Math.round(p95),
        p99LatencyNs: Math.round(p99),
    };
}

async function main() {
    console.log("===============================================================================");
    console.log(" 🔬 XyPriss Performance Benchmark: Native process.env vs __sys__.__env__");
    console.log("===============================================================================");
    console.log(`Platform : ${process.platform} (${process.arch})`);
    console.log(`Node/Bun : ${process.version}`);
    console.log(`PID      : ${process.pid}`);
    console.log(`Date     : ${new Date().toISOString()}`);
    console.log("-------------------------------------------------------------------------------\n");

    const testSecretKey = "DATABASE_URL";
    const testSecretValue = "postgresql://postgres:secret_pass_123@127.0.0.1:5432/production_db";
    const whitelistedKey = "PORT";
    const whitelistedValue = "8080";
    const nonExistentKey = "NON_EXISTENT_VAR_KEY_404";

    // Initialize values in __sys__.__env__
    __sys__.__env__.set(testSecretKey, testSecretValue);
    __sys__.__env__.set(whitelistedKey, whitelistedValue);

    // Baseline unshielded memory map
    const rawEnvMock: Record<string, string> = {
        ...process.env,
        [testSecretKey]: testSecretValue,
        [whitelistedKey]: whitelistedValue,
    };

    const results: Array<{
        category: string;
        description: string;
        native: BenchmarkResult;
        sysEnv: BenchmarkResult;
    }> = [];

    const NATIVE_ITERS = 50_000;
    const SYS_ITERS = 500; // Calibrated for high-precision measurement under IPC supervisor

    // -------------------------------------------------------------------------
    // Test 1: Whitelisted Key Read ('PORT')
    // -------------------------------------------------------------------------
    console.log("▶ [1/6] Benchmarking: Whitelisted Key Read ('PORT')...");
    const resNativeWhitelist = runBenchmark("raw process.env['PORT']", NATIVE_ITERS, () => {
        const val = rawEnvMock[whitelistedKey];
        if (!val) throw new Error("Missing value");
    });
    const resSysWhitelist = runBenchmark("__sys__.__env__.get('PORT')", SYS_ITERS, () => {
        const val = __sys__.__env__.get(whitelistedKey);
        if (!val) throw new Error("Missing value");
    });
    results.push({
        category: "Whitelisted Key Read ('PORT')",
        description: "Direct read of a standard system variable",
        native: resNativeWhitelist,
        sysEnv: resSysWhitelist,
    });
    console.log(`  ✓ Native : ${resNativeWhitelist.opsPerSec.toLocaleString()} ops/s (${resNativeWhitelist.avgLatencyNs} ns/op)`);
    console.log(`  ✓ __sys__: ${resSysWhitelist.opsPerSec.toLocaleString()} ops/s (${(resSysWhitelist.avgLatencyNs / 1000).toFixed(1)} µs/op)`);

    // -------------------------------------------------------------------------
    // Test 2: Protected Application Secret Read ('DATABASE_URL')
    // -------------------------------------------------------------------------
    console.log("▶ [2/6] Benchmarking: Protected Secret Read ('DATABASE_URL')...");
    const resNativeSecret = runBenchmark("raw process.env['DATABASE_URL']", NATIVE_ITERS, () => {
        const val = rawEnvMock[testSecretKey];
        if (!val) throw new Error("Missing value");
    });
    const resSysSecret = runBenchmark("__sys__.__env__.get('DATABASE_URL')", SYS_ITERS, () => {
        const val = __sys__.__env__.get(testSecretKey);
        if (!val) throw new Error("Missing value");
    });
    results.push({
        category: "Protected Secret Read ('DATABASE_URL')",
        description: "Isolated secret lookup verified through Zero-Trust IPC",
        native: resNativeSecret,
        sysEnv: resSysSecret,
    });
    console.log(`  ✓ Native : ${resNativeSecret.opsPerSec.toLocaleString()} ops/s (${resNativeSecret.avgLatencyNs} ns/op)`);
    console.log(`  ✓ __sys__: ${resSysSecret.opsPerSec.toLocaleString()} ops/s (${(resSysSecret.avgLatencyNs / 1000).toFixed(1)} µs/op)`);

    // -------------------------------------------------------------------------
    // Test 3: Absent Key with Default Fallback
    // -------------------------------------------------------------------------
    console.log("▶ [3/6] Benchmarking: Absent Key with Fallback Value...");
    const resNativeFallback = runBenchmark("raw process.env['ABSENT'] ?? default", NATIVE_ITERS, () => {
        const val = rawEnvMock[nonExistentKey] ?? "default_fallback_val";
        if (!val) throw new Error("Missing fallback");
    });
    const resSysFallback = runBenchmark("__sys__.__env__.get('ABSENT', default)", SYS_ITERS, () => {
        const val = __sys__.__env__.get(nonExistentKey, "default_fallback_val");
        if (!val) throw new Error("Missing fallback");
    });
    results.push({
        category: "Absent Key with Fallback",
        description: "Lookup of non-existent variable returning fallback string",
        native: resNativeFallback,
        sysEnv: resSysFallback,
    });
    console.log(`  ✓ Native : ${resNativeFallback.opsPerSec.toLocaleString()} ops/s (${resNativeFallback.avgLatencyNs} ns/op)`);
    console.log(`  ✓ __sys__: ${resSysFallback.opsPerSec.toLocaleString()} ops/s (${(resSysFallback.avgLatencyNs / 1000).toFixed(1)} µs/op)`);

    // -------------------------------------------------------------------------
    // Test 4: Key Existence Check ('has' vs 'in')
    // -------------------------------------------------------------------------
    console.log("▶ [4/6] Benchmarking: Key Existence Check ('has' vs 'in')...");
    const resNativeHas = runBenchmark("'DATABASE_URL' in process.env", NATIVE_ITERS, () => {
        const exists = testSecretKey in rawEnvMock;
        if (!exists) throw new Error("Should exist");
    });
    const resSysHas = runBenchmark("__sys__.__env__.has('DATABASE_URL')", SYS_ITERS, () => {
        const exists = __sys__.__env__.has(testSecretKey);
        if (!exists) throw new Error("Should exist");
    });
    results.push({
        category: "Key Existence Check ('has')",
        description: "Checking whether a configuration variable exists",
        native: resNativeHas,
        sysEnv: resSysHas,
    });
    console.log(`  ✓ Native : ${resNativeHas.opsPerSec.toLocaleString()} ops/s (${resNativeHas.avgLatencyNs} ns/op)`);
    console.log(`  ✓ __sys__: ${resSysHas.opsPerSec.toLocaleString()} ops/s (${(resSysHas.avgLatencyNs / 1000).toFixed(1)} µs/op)`);

    // -------------------------------------------------------------------------
    // Test 5: Batch Reads (10 configuration keys per request cycle)
    // -------------------------------------------------------------------------
    console.log("▶ [5/6] Benchmarking: Batch Reads (10 configuration keys per request cycle)...");
    const batchKeys = [
        "PORT", "NODE_ENV", "DATABASE_URL", "JWT_SECRET", "REDIS_HOST",
        "REDIS_PORT", "API_KEY", "LOG_LEVEL", "APP_ENV", "CORS_ORIGIN"
    ];
    for (const k of batchKeys) {
        rawEnvMock[k] = `value_${k}`;
        __sys__.__env__.set(k, `value_${k}`);
    }
    const BATCH_NATIVE_ITERS = 10_000;
    const BATCH_SYS_ITERS = 100; // 100 cycles = 1,000 IPC reads
    const resNativeBatch = runBenchmark("raw process.env batch (10 keys)", BATCH_NATIVE_ITERS, () => {
        for (let j = 0; j < batchKeys.length; j++) {
            const v = rawEnvMock[batchKeys[j]];
        }
    });
    const resSysBatch = runBenchmark("__sys__.__env__ batch (10 keys)", BATCH_SYS_ITERS, () => {
        for (let j = 0; j < batchKeys.length; j++) {
            const v = __sys__.__env__.get(batchKeys[j]);
        }
    });
    results.push({
        category: "Batch Reads (10 keys / request)",
        description: "10 distinct environment reads simulating request handler initialization",
        native: resNativeBatch,
        sysEnv: resSysBatch,
    });
    console.log(`  ✓ Native : ${resNativeBatch.opsPerSec.toLocaleString()} cycles/s (${resNativeBatch.avgLatencyNs} ns/cycle)`);
    console.log(`  ✓ __sys__: ${resSysBatch.opsPerSec.toLocaleString()} cycles/s (${(resSysBatch.avgLatencyNs / 1000).toFixed(1)} µs/cycle)`);

    // -------------------------------------------------------------------------
    // Test 5b: Native Batch Read ('getMany' - 10 keys in 1 single IPC round-trip)
    // -------------------------------------------------------------------------
    console.log("▶ [5b/6] Benchmarking: Native Batch Read ('getMany' - 10 keys / 1 IPC)...");
    const resSysBatchNative = runBenchmark("__sys__.__env__.getMany(10 keys)", SYS_ITERS, () => {
        const cfg = __sys__.__env__.getMany(batchKeys);
        void cfg.PORT;
    });
    results.push({
        category: "Batch Native getMany (10 keys / 1 IPC)",
        description: "10 distinct environment reads resolved atomically in 1 IPC round-trip",
        native: resNativeBatch,
        sysEnv: resSysBatchNative,
    });
    console.log(`  ✓ Native : ${resNativeBatch.opsPerSec.toLocaleString()} cycles/s (${resNativeBatch.avgLatencyNs} ns/cycle)`);
    console.log(`  ✓ __sys__: ${resSysBatchNative.opsPerSec.toLocaleString()} cycles/s (${(resSysBatchNative.avgLatencyNs / 1000).toFixed(1)} µs/cycle)`);

    // -------------------------------------------------------------------------
    // Test 6: Dynamic Variable Mutation ('set')
    // -------------------------------------------------------------------------
    console.log("▶ [6/6] Benchmarking: Dynamic Mutation ('set')...");
    const resNativeSet = runBenchmark("raw process.env['KEY'] = val", NATIVE_ITERS, (i) => {
        rawEnvMock["DYN_TEST_KEY"] = `val_${i}`;
    });
    const resSysSet = runBenchmark("__sys__.__env__.set('KEY', val)", SYS_ITERS, (i) => {
        __sys__.__env__.set("DYN_TEST_KEY", `val_${i}`);
    });
    results.push({
        category: "Dynamic Variable Mutation ('set')",
        description: "Updating or declaring an environment variable at runtime",
        native: resNativeSet,
        sysEnv: resSysSet,
    });
    console.log(`  ✓ Native : ${resNativeSet.opsPerSec.toLocaleString()} ops/s (${resNativeSet.avgLatencyNs} ns/op)`);
    console.log(`  ✓ __sys__: ${resSysSet.opsPerSec.toLocaleString()} ops/s (${(resSysSet.avgLatencyNs / 1000).toFixed(1)} µs/op)`);

    // -------------------------------------------------------------------------
    // Output Formatted Summary Table & JSON Output for Artifact
    // -------------------------------------------------------------------------
    console.log("\n============================================================================================================================================");
    console.log(" 📊 BENCHMARK SUMMARY RESULTS");
    console.log("============================================================================================================================================");
    console.log(
        "| Category                            | Native Ops/s   | __sys__ Ops/s  | Native Avg     | __sys__ Avg    | p95 Latency   | Overhead Factor |"
    );
    console.log(
        "| :---------------------------------- | :------------- | :------------- | :------------- | :------------- | :------------ | :-------------- |"
    );

    for (const r of results) {
        const factor = (r.native.opsPerSec / r.sysEnv.opsPerSec).toFixed(0);
        const namePad = r.category.padEnd(35, " ");
        const natOpsPad = r.native.opsPerSec.toLocaleString().padStart(14, " ");
        const sysOpsPad = r.sysEnv.opsPerSec.toLocaleString().padStart(14, " ");
        const natLatPad = `${r.native.avgLatencyNs.toLocaleString()} ns`.padStart(14, " ");
        const sysLatPad = `${(r.sysEnv.avgLatencyNs / 1000).toFixed(2)} µs`.padStart(14, " ");
        const p95Pad = `${(r.sysEnv.p95LatencyNs / 1000).toFixed(2)} µs`.padStart(13, " ");
        const factorPad = `${Number(factor).toLocaleString()}x`.padStart(15, " ");

        console.log(`| ${namePad} | ${natOpsPad} | ${sysOpsPad} | ${natLatPad} | ${sysLatPad} | ${p95Pad} | ${factorPad} |`);
    }
    console.log("============================================================================================================================================\n");

    console.log("---BEGIN_RAW_BENCHMARK_DATA---");
    console.log(JSON.stringify(results, null, 2));
    console.log("---END_RAW_BENCHMARK_DATA---");

    process.exit(0);
}

main().catch((err) => {
    console.error("Benchmark execution failed:", err);
    process.exit(1);
});
