import { __strl__, MaliciousPatternType } from "strulink";

const payloads = [
    { name: "XSS 1", url: "http://localhost:8085/rc/handler/<script>alert(document.cookie)</script>" },
    { name: "XSS 2 (URL encoded)", url: "http://localhost:8085/rc/handler/%3Cscript%3Ealert(1)%3C/script%3E" },
    { name: "Legit 1", url: "http://localhost:8085/rc/handler/status" },
    { name: "Legit 2 (query)", url: "http://localhost:8085/api/users?name=john&sort=desc" },
    { name: "Legit 3 (path with special chars)", url: "http://localhost:8085/api/file/document-2023_final.pdf" },
    { name: "Path Traversal (malicious)", url: "http://localhost:8085/static/../../package.json" },
    { name: "Double Encoding (malicious)", url: "http://localhost:8085/static/..%2F..%2F..%2Fetc%2Fpasswd" }
];

async function testAgainstServer() {
    console.log("=== Testing against XCIS local server ===");
    for (const p of payloads) {
        try {
            const res = await fetch(p.url, { method: "GET" });
            const body = await res.text();
            
            if (res.status === 403 && body.includes("EMALICIOUSURL")) {
                console.log(`[BLOCKED] ${p.name}: Server returned 403 Forbidden with EMALICIOUSURL.`);
            } else if (res.status === 404) {
                // If it's a legit URL but not implemented on server, 404 is expected and not blocked
                console.log(`[ALLOWED] ${p.name}: Server returned 404 (Expected for unhandled legit URLs).`);
            } else if (res.status === 200) {
                console.log(`[ALLOWED] ${p.name}: Server returned 200 OK.`);
            } else {
                console.log(`[UNKNOWN] ${p.name}: Server returned ${res.status}. Body: ${body.substring(0, 50)}`);
            }
        } catch (err: any) {
            console.error(`[ERROR] ${p.name}: Failed to fetch: ${err.message}`);
        }
    }
}

async function runLocalScan() {
    console.log("\n=== Testing with recommended configuration (Local __strl__) ===");
    for (const p of payloads) {
        const result = await __strl__.scanUrl(p.url, {
            enabledPatternTypes: [
                MaliciousPatternType.XSS,
                MaliciousPatternType.PATH_TRAVERSAL,
                MaliciousPatternType.COMMAND_INJECTION,
                MaliciousPatternType.SQL_INJECTION,
                MaliciousPatternType.TEMPLATE_INJECTION
            ],
            minScore: 40,
            sensitivity: 1.0,
            advanced: {
                maxEncodingLayers: 3,
                entropyThreshold: 4.8
            }
        });
        console.log(`[${result.isMalicious ? "BLOCKED" : "ALLOWED"}] ${p.name}: score=${result.score} confidence=${result.confidence}`);
        if (result.isMalicious) {
            console.log(`  -> Reasons: ${result.detectedPatterns.map(dp => dp.type).join(", ")}`);
        }
    }
}

await testAgainstServer();
await runLocalScan();


// console.log(
//     await __strl__.scanUrl(
//         "http://localhost:8085/rc/handler/<script>alert(document.cookie)</script>",
//     ),
// );