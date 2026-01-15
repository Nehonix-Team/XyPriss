async function testCircuitBreaker() {
    const targetUrl = "http://127.0.0.1:6372/error";
    console.log("Starting Circuit Breaker Test...");
    console.log("Config: Threshold=3, Timeout=1s (req), Reset=5s");

    // 1. Trigger failures (Should take ~1s each due to timeout)
    for (let i = 1; i <= 4; i++) {
        const start = Date.now();
        console.log(`[${i}] Sending failing request...`);
        try {
            const res = await fetch(targetUrl);
            const text = await res.text();
            console.log(
                `[${i}] Status: ${res.status} (${Date.now() - start}ms)`
            );
        } catch (e: any) {
            console.log(`[${i}] Error: ${e.message} (${Date.now() - start}ms)`);
        }
    }

    // 2. Validate Circuit Open (Should fail INSTANTLY)
    console.log("\n[5] Testing Circuit State (Should fail FAST)...");
    const startFast = Date.now();
    try {
        const res = await fetch(targetUrl);
        const text = await res.text();
        console.log(
            `[5] Status: ${res.status}, Body: ${text} (${
                Date.now() - startFast
            }ms)`
        );
    } catch (e: any) {
        console.log(`[5] Error: ${e.message} (${Date.now() - startFast}ms)`);
    }

    // 3. Wait for Reset (5s)
    console.log("\nWaiting 6s for Circuit Reset...");
    await new Promise((resolve) => setTimeout(resolve, 6000));

    // 4. Test Half-Open (Should let request through, will cycle fail/timeout again but allowed)
    // Note: Since /error always fails, it will trip again, but we just want to see it attempted.
    console.log("[6] Testing Half-Open State...");
    const startReset = Date.now();
    try {
        const res = await fetch(targetUrl);
        console.log(`[6] Status: ${res.status} (${Date.now() - startReset}ms)`);
    } catch (e: any) {
        console.log(`[6] Error: ${e.message} (${Date.now() - startReset}ms)`);
    }
}

testCircuitBreaker();

