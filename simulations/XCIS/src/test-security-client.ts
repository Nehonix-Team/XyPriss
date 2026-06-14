import { spawn } from "child_process";
import http from "http";

const scenarios = ["empty", "xss-block", "xxe-block", "hpp-block", "helmet-enabled", "all"];

async function request(url: string, options: RequestInit): Promise<{ status: number; data: any; headers: any }> {
    try {
        const res = await fetch(url, options);
        let data: any;
        const text = await res.text();
        try {
            data = JSON.parse(text);
        } catch {
            data = text;
        }
        
        const headers: any = {};
        res.headers.forEach((value, key) => {
            headers[key] = value;
        });

        return { status: res.status, data, headers };
    } catch (err: any) {
        return { status: 0, data: err.message, headers: {} };
    }
}

function sleep(ms: number) {
    return new Promise((r) => setTimeout(r, ms));
}

async function testXSS(port: number) {
    console.log("  -> Testing XSS (Query & Body)");
    const qUrl = `http://127.0.0.1:${port}/test-get?q=<script>alert(1)</script>`;
    const qRes = await request(qUrl, { method: "GET" });
    console.log(`     [GET Query] Status: ${qRes.status}, Data: ${JSON.stringify(qRes.data).substring(0, 50)}...`);

    const bUrl = `http://127.0.0.1:${port}/test-post`;
    const bRes = await request(bUrl, {
        method: "POST",
        headers: { 
            "Content-Type": "application/json",
            "Referer": `http://127.0.0.1:${port}`
        },
        body: JSON.stringify({ data: "<img src=x onerror=alert(1)>" })
    });
    console.log(`     [POST Body] Status: ${bRes.status}, Data: ${JSON.stringify(bRes.data).substring(0, 50)}...`);
}

async function testXXE(port: number) {
    console.log("  -> Testing XXE");
    const url = `http://127.0.0.1:${port}/test-post`;
    const maliciousXML = `<?xml version="1.0" encoding="ISO-8859-1"?>
<!DOCTYPE foo [ <!ELEMENT foo ANY ><!ENTITY xxe SYSTEM "file:///etc/passwd" >]>
<foo>&xxe;</foo>`;
    
    const res = await request(url, {
        method: "POST",
        headers: { 
            "Content-Type": "application/xml",
            "Referer": `http://127.0.0.1:${port}`
        },
        body: maliciousXML
    });
    console.log(`     [POST XXE] Status: ${res.status}, Data: ${JSON.stringify(res.data).substring(0, 50)}...`);
}

async function testHPP(port: number) {
    console.log("  -> Testing HPP");
    const url = `http://127.0.0.1:${port}/test-get?id=1&id=2&id=3`;
    const res = await request(url, { method: "GET" });
    console.log(`     [GET HPP] Status: ${res.status}, Parsed Query: ${JSON.stringify(res.data?.query)}`);
}

async function testHelmet(port: number) {
    console.log("  -> Testing Helmet Headers");
    const url = `http://127.0.0.1:${port}/test-get`;
    const res = await request(url, { method: "GET" });
    
    const secHeaders = [
        "x-xss-protection",
        "x-frame-options",
        "strict-transport-security",
        "x-content-type-options",
        "content-security-policy"
    ];

    let found = 0;
    for (const h of secHeaders) {
        if (res.headers[h]) {
            console.log(`     ✅ Found: ${h} = ${res.headers[h]}`);
            found++;
        }
    }
    if (found === 0) {
        console.log(`     ❌ No security headers found.`);
    }
}

async function runScenario(scenario: string) {
    console.log(`\n========================================`);
    console.log(`Starting Scenario: ${scenario}`);
    console.log(`========================================`);

    let actualPort: number | null = null;
    let serverStarted = false;

    const serverProcess = spawn("bun", ["src/test-security-server.ts"], {
        env: { ...process.env, SEC_SCENARIO: scenario },
        cwd: process.cwd(),
        stdio: "pipe",
    });

    serverProcess.stdout.on("data", (d) => {
        const out = d.toString();
        console.log(`[SERVER]: ${out.trim()}`);
        const match = out.match(/listening on http:\/\/localhost:(\d+)/);
        if (match) {
            actualPort = parseInt(match[1], 10);
            serverStarted = true;
        }
    });
    serverProcess.stderr.on("data", (d) => {
        const out = d.toString();
        console.error(`[SERVER ERR]: ${out.trim()}`);
        const match = out.match(/listening on http:\/\/localhost:(\d+)/);
        if (match) {
            actualPort = parseInt(match[1], 10);
            serverStarted = true;
        }
    });

    for (let i = 0; i < 50; i++) {
        if (serverStarted && actualPort) break;
        await sleep(200);
    }

    if (!serverStarted || !actualPort) {
        console.error("Failed to detect server start.");
        serverProcess.kill();
        return;
    }

    await sleep(1000); // Give XHSC workers time to register

    try {
        await testXSS(actualPort);
        await testXXE(actualPort);
        await testHPP(actualPort);
        await testHelmet(actualPort);
    } catch (err: any) {
        console.error(`Error during test: ${err.message}`);
    } finally {
        serverProcess.kill();
        await sleep(500);
    }
}

async function main() {
    for (const scenario of scenarios) {
        await runScenario(scenario);
    }
    console.log("\nDone.");
}

main();
