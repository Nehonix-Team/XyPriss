import http from "node:http";
import { performance } from "node:perf_hooks";

const agent = new http.Agent({
    keepAlive: true,
    maxSockets: 500,
    maxFreeSockets: 100,
});

async function sendRequest(port, path, method = "GET", body = null, extraHeaders = {}) {
    return new Promise((resolve) => {
        const start = performance.now();
        const bodyBuf = body ? Buffer.from(typeof body === "string" ? body : JSON.stringify(body)) : null;
        const options = {
            hostname: "127.0.0.1",
            port: port,
            path: path,
            method: method,
            agent: agent,
            headers: {
                ...(bodyBuf ? {
                    "Content-Type": "application/json",
                    "Content-Length": bodyBuf.length,
                } : {}),
                ...extraHeaders,
            },
        };

        const req = http.request(options, (res) => {
            let data = "";
            res.on("data", (chunk) => { data += chunk; });
            res.on("end", () => {
                const duration = performance.now() - start;
                resolve({
                    ok: res.statusCode >= 200 && res.statusCode < 400,
                    status: res.statusCode,
                    headers: res.headers,
                    duration,
                    data,
                });
            });
        });

        req.on("error", (err) => {
            const duration = performance.now() - start;
            resolve({
                ok: false,
                status: 0,
                headers: {},
                duration,
                error: err.message,
            });
        });

        if (bodyBuf) {
            req.write(bodyBuf);
        }
        req.end();
    });
}

async function runScenario(name, port, totalRequests, concurrency, requestFn) {
    console.log(`\n===============================================================`);
    console.log(`🚀 SCENARIO: ${name}`);
    console.log(`   Requests: ${totalRequests.toLocaleString()} | Concurrency: ${concurrency} | Port: ${port}`);
    console.log(`===============================================================`);

    const latencies = [];
    let success = 0;
    let failed = 0;
    const statusCodes = {};

    let index = 0;
    const startTime = performance.now();

    async function worker() {
        while (index < totalRequests) {
            const i = index++;
            const res = await requestFn(i);
            statusCodes[res.status] = (statusCodes[res.status] || 0) + 1;
            if (res.ok) {
                success++;
                latencies.push(res.duration);
            } else {
                failed++;
            }
        }
    }

    const workers = [];
    for (let i = 0; i < concurrency; i++) {
        workers.push(worker());
    }
    await Promise.all(workers);

    const totalTime = (performance.now() - startTime) / 1000;
    latencies.sort((a, b) => a - b);

    const avg = latencies.length > 0 ? latencies.reduce((a, b) => a + b, 0) / latencies.length : 0;
    const p50 = latencies[Math.floor(latencies.length * 0.50)] || 0;
    const p90 = latencies[Math.floor(latencies.length * 0.90)] || 0;
    const p95 = latencies[Math.floor(latencies.length * 0.95)] || 0;
    const p99 = latencies[Math.floor(latencies.length * 0.99)] || 0;
    const min = latencies[0] || 0;
    const max = latencies[latencies.length - 1] || 0;
    const rps = totalRequests / (totalTime || 1);

    console.log(`📊 Results for "${name}":`);
    console.log(`   ✅ Success:           ${success.toLocaleString()} / ${totalRequests.toLocaleString()} (${((success/totalRequests)*100).toFixed(2)}%)`);
    console.log(`   ❌ Failed:            ${failed.toLocaleString()}`);
    console.log(`   📡 Status Codes:      ${JSON.stringify(statusCodes)}`);
    console.log(`   ⏱️  Total Duration:    ${totalTime.toFixed(3)}s`);
    console.log(`   ⚡ Throughput:        ${rps.toFixed(0)} req/sec`);
    console.log(`   📈 Latency (ms):`);
    console.log(`      • Min:             ${min.toFixed(2)} ms`);
    console.log(`      • P50 (Median):    ${p50.toFixed(2)} ms`);
    console.log(`      • P90:             ${p90.toFixed(2)} ms`);
    console.log(`      • P95:             ${p95.toFixed(2)} ms`);
    console.log(`      • P99:             ${p99.toFixed(2)} ms`);
    console.log(`      • Max:             ${max.toFixed(2)} ms`);
    console.log(`      • Average:         ${avg.toFixed(2)} ms`);
}

async function main() {
    console.log(`\n===============================================================`);
    console.log(`🔥 SYNAPX HIGH-PERFORMANCE DISPATCHER & STRESS BENCHMARK 🔥`);
    console.log(`===============================================================`);

    // Warm-up & retrieve CSRF token
    console.log(`\n⏳ Warming up JIT & Connection Pools (200 requests)...`);
    let csrfToken = "";
    let cookie = "";
    for (let i = 0; i < 200; i++) {
        const res = await sendRequest(5618, "/ping", "GET");
        if (res.headers && res.headers["x-csrf-token"]) {
            csrfToken = res.headers["x-csrf-token"];
        }
        if (res.headers && res.headers["set-cookie"]) {
            cookie = res.headers["set-cookie"].map(c => c.split(";")[0]).join("; ");
        }
    }
    console.log(`✅ Warm-up complete. Session initialized (CSRF: ${csrfToken ? "Active" : "None"}).`);

    const postHeaders = {
        ...(csrfToken ? { "X-CSRF-Token": csrfToken } : {}),
        ...(cookie ? { "Cookie": cookie } : {}),
    };

    // Scenario 1: Ultra-fast GET (/ping) - 2,000 requests, Concurrency 50
    await runScenario("GET /ping (Standard Concurrency)", 5618, 2000, 50, (i) => {
        return sendRequest(5618, "/ping", "GET");
    });

    // Scenario 2: POST /hello with JSON payload - 2,000 requests, Concurrency 50
    await runScenario("POST /hello (JSON Payload + CSRF Auth)", 5618, 2000, 50, (i) => {
        return sendRequest(5618, "/hello", "POST", {
            requestId: i,
            client: "synapx-stress-tester",
            timestamp: Date.now(),
            payload: {
                user: "nehonix-admin",
                actions: ["read", "write", "dispatch"],
                metadata: { cluster: "xhsc-g4", mode: "zero-trust" }
            }
        }, postHeaders);
    });

    // Scenario 3: High Concurrency Burst GET (/ping) - 5,000 requests, Concurrency 150
    await runScenario("GET /ping (High Concurrency Burst)", 5618, 5000, 150, (i) => {
        return sendRequest(5618, "/ping", "GET");
    });

    // Scenario 4: Heavy Multi-Server Cross-Check on port 5628 - 2,000 requests
    await runScenario("GET /ping (Multi-Server Instance xypriss.inter:5628)", 5628, 2000, 50, (i) => {
        return sendRequest(5628, "/ping", "GET");
    });

    // Scenario 5: Security / WAF Penetration Check (Blocked Payloads)
    await runScenario("SECURITY: Attack Payload Filtering (XSS & Traversal)", 5618, 500, 25, (i) => {
        const path = i % 2 === 0 ? "/ping?q=<script>alert(1)</script>" : "/static/../../etc/passwd";
        return sendRequest(5618, path, "GET");
    });

    console.log(`\n===============================================================`);
    console.log(`🏁 All Benchmark Scenarios Complete!`);
    console.log(`===============================================================\n`);
    process.exit(0);
}

main().catch(console.error);
