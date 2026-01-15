const PORT = 6372;
const targetUrl = `http://127.0.0.1:${PORT}/`;

async function sendRequest(id: number) {
    console.log(`[${id}] Sending request...`);
    const start = Date.now();
    try {
        const response = await fetch(targetUrl);
        const text = await response.text();
        console.log(
            `[${id}] Status: ${response.status}, Time: ${Date.now() - start}ms`
        );
    } catch (e: any) {
        console.log(
            `[${id}] Error: ${e.message}, Time: ${Date.now() - start}ms`
        );
    }
}

console.log("Starting concurrency test (Target: 5 concurrent requests)");
// Limit is 2 in server.ts, with maxQueueSize defaulting to 1000 in Rust (if not provided)
// Wait, I updated server.ts but it might not be using my new maxQueueSize yet.

Promise.all([
    sendRequest(1),
    sendRequest(2),
    sendRequest(3),
    sendRequest(4),
    sendRequest(5),
]).then(() => {
    console.log("Test finished.");
});

