import { spawn } from "child_process";
import http from "http";

const scenarios = ["empty", "true", "delayOnly", "custom", "zeroAfter", "disabled"];
const BASE_PORT = 4000;

async function request(url: string): Promise<{ status: number; data: any; duration: number }> {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        http.get(url, (res) => {
            let data = "";
            res.on("data", (chunk) => (data += chunk));
            res.on("end", () => {
                const duration = Date.now() - start;
                try {
                    resolve({ status: res.statusCode || 500, data: JSON.parse(data), duration });
                } catch {
                    resolve({ status: res.statusCode || 500, data, duration });
                }
            });
        }).on("error", (err) => reject(err));
    });
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function runScenario(scenario: string) {
    console.log(`\n========================================`);
    console.log(`Starting Scenario: ${scenario}`);
    console.log(`========================================`);

    let actualPort: number | null = null;
    let serverStarted = false;

    const serverProcess = spawn("bun", ["src/test-slowdown-server.ts"], {
        env: { ...process.env, SD_SCENARIO: scenario },
        cwd: process.cwd(),
        stdio: "pipe",
    });

    serverProcess.stdout.on("data", (d) => {
        const out = d.toString();
        // console.log(`[SERVER]: ${out.trim()}`)
        const match = out.match(/listening on http:\/\/localhost:(\d+)/);
        if (match) {
            actualPort = parseInt(match[1], 10);
            serverStarted = true;
        }
    });
    serverProcess.stderr.on("data", (d) => {
        const out = d.toString();
        // console.error(`[SERVER ERR]: ${out.trim()}`)
        const match = out.match(/listening on http:\/\/localhost:(\d+)/);
        if (match) {
            actualPort = parseInt(match[1], 10);
            serverStarted = true;
        }
    });

    // Wait for server to start up to 10 seconds
    for (let i = 0; i < 50; i++) {
        if (serverStarted && actualPort) break;
        await sleep(200);
    }

    if (!serverStarted || !actualPort) {
        console.error("Failed to detect server start.");
        serverProcess.kill();
        return;
    }

    try {
        const url = `http://127.0.0.1:${actualPort}/sd-test`;
        console.log(`Sending 10 requests to ${url}...`);

        let previousDuration = 0;
        let isDelayed = false;

        for (let i = 1; i <= 10; i++) {
            const result = await request(url);
            console.log(`Req ${i}: status=${result.status}, duration=${result.duration}ms, data=${JSON.stringify(result.data)}`);
            
            if (i > 1 && result.duration > previousDuration + 50) {
                isDelayed = true;
            }
            previousDuration = result.duration;
            await sleep(100); // small delay between requests
        }

        console.log(`\nAnalysis for ${scenario}:`);
        if (isDelayed) {
            console.log(`✅ Delay behavior DETECTED. Server responses slowed down over time.`);
        } else {
            console.log(`❌ NO delay behavior detected. Responses remained fast.`);
        }

    } catch (err: any) {
        console.error(`Error during test: ${err.message}`);
    } finally {
        serverProcess.kill();
        await sleep(500); // Give it time to die
    }
}

async function main() {
    for (const scenario of scenarios) {
        await runScenario(scenario);
    }
    console.log("\nDone.");
}

main();
