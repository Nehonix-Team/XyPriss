import { createServer } from "xypriss";
import * as fs from "fs";
import * as path from "path";
import { spawnSync } from "child_process";

// === WORKER CODE ===
if (process.argv.includes("--worker")) {
    const configStr = process.argv[process.argv.indexOf("--config") + 1];
    const reqStr = process.argv[process.argv.indexOf("--requests") + 1];
    
    const config = JSON.parse(configStr || "{}");
    const testRequests = JSON.parse(reqStr || "[]");
    
    async function runWorker() {
        const app = createServer({
            security: config,
            performance: { optimizationEnabled: false }
        });

        app.get("/test-get", (req, res) => res.send("OK GET"));
        app.post("/test-post", (req, res) => res.send({ body: req.body }));

        let server;
        try {
            server = await app.start();
            const actualPort = app.getPort ? app.getPort() : 3000;
            
            // Wait a moment for XHSC to be fully ready
            await new Promise(r => setTimeout(r, 1000));
            
            const results = [];
            for (const req of testRequests) {
                try {
                    const startTime = Date.now();
                    const response = await fetch(`http://localhost:${actualPort}${req.path}`, {
                        method: req.method,
                        headers: { "Content-Type": "application/json", ...req.headers },
                        body: req.body ? JSON.stringify(req.body) : undefined,
                    });
                    const text = await response.text();
                    const endTime = Date.now();
                    results.push({
                        name: req.name,
                        status: response.status,
                        time: endTime - startTime,
                        body: text.substring(0, 200),
                        success: req.expectedStatus ? response.status === req.expectedStatus : false
                    });
                } catch (e: any) {
                    results.push({ name: req.name, error: e.message });
                }
            }
            
            console.log("WORKER_RESULT:" + JSON.stringify(results));
        } catch (e: any) {
            console.error("Worker error:", e);
        } finally {
            if (app.stop) {
                await app.stop();
            } else if (server && server.close) {
                server.close();
            }
            process.exit(0);
        }
    }
    
    runWorker();
} 
// === MASTER CODE ===
else {
    function runTestProcess(testName: string, securityConfig: any, testRequests: any[]) {
        console.log(`\n--- Starting Test: ${testName} ---`);
        let md = `### Test: ${testName}\n\n`;
        md += `**Configuration:**\n\`\`\`json\n${JSON.stringify(securityConfig, null, 2)}\n\`\`\`\n\n`;
        
        const result = spawnSync("bun", ["run", __filename, "--worker", "--config", JSON.stringify(securityConfig), "--requests", JSON.stringify(testRequests)], {
            encoding: "utf-8"
        });

        // Parse stdout to find WORKER_RESULT
        const lines = result.stdout.split("\n");
        let workerData = null;
        for (const line of lines) {
            if (line.startsWith("WORKER_RESULT:")) {
                try {
                    workerData = JSON.parse(line.substring(14));
                } catch(e){}
            }
        }
        
        if (!workerData && result.stderr) {
             md += `**Erreur Serveur:** \`${result.stderr}\`\n\n`;
             return md;
        }

        if (workerData) {
            for (let i = 0; i < testRequests.length; i++) {
                const req = testRequests[i];
                const res = workerData[i];
                if (!res) continue;
                
                md += `#### Requête: ${req.name}\n`;
                md += `- **Méthode:** ${req.method}\n`;
                md += `- **Path:** ${req.path}\n`;
                if (req.body) md += `- **Body:** \`${JSON.stringify(req.body)}\`\n`;
                
                if (res.error) {
                    md += `- **Erreur Réseau:** ${res.error}\n\n`;
                } else {
                    md += `- **Status Obtenu:** ${res.status}\n`;
                    md += `- **Temps de réponse:** ${res.time}ms\n`;
                    md += `- **Réponse:** \`${res.body}\`\n\n`;
                    md += `**Résultat:** ${res.success ? "✅ Conforme" : "⚠️ À vérifier / Non conforme"}\n\n`;
                }
            }
        } else {
            md += `**Erreur:** Aucun résultat retourné par le worker.\n\n`;
        }
        
        return md;
    }

    async function runAllTests() {
        let report = "# Rapport de Test des Modules de Sécurité XyPriss\n\n";
        report += "Ce rapport présente les résultats des tests manuels automatisés pour chaque option de sécurité.\n\n";

        report += "## 1. Module XSS\n\n";
        report += runTestProcess("XSS - Block On Detection", { xss: { blockOnDetection: true }, csrf: false }, [
            { name: "Requête saine", method: "POST", path: "/test-post", body: { name: "John" }, expectedStatus: 200 },
            { name: "Requête avec payload XSS", method: "POST", path: "/test-post", body: { name: "<script>alert(1)</script>" }, expectedStatus: 403 }
        ]);

        report += "## 2. Module SlowDown\n\n";
        const slowDownRequests = [];
        for(let i=0; i<5; i++) {
            slowDownRequests.push({ name: `Requête SlowDown #${i+1}`, method: "GET", path: "/test-get", expectedStatus: 200 });
        }
        report += runTestProcess("SlowDown - Custom Delay", {
            slowDown: { windowMs: 10000, delayAfter: 2 }, csrf: false
        }, slowDownRequests);

        report += "## 3. Module XXE\n\n";
        report += runTestProcess("XXE - Block On Detection", { xxe: { blockOnDetection: true, allowExternalEntities: false }, csrf: false }, [
            { name: "Payload XXE", method: "POST", path: "/test-post", headers: { "Content-Type": "application/xml" }, body: `<?xml version="1.0" encoding="ISO-8859-1"?><!DOCTYPE foo [<!ELEMENT foo ANY ><!ENTITY xxe SYSTEM "file:///etc/passwd" >]><foo>&xxe;</foo>`, expectedStatus: 403 }
        ]);

        report += "## 4. Module HPP (HTTP Parameter Pollution)\n\n";
        report += runTestProcess("HPP - Check Query", { hpp: { checkQuery: true, whitelist: ["allowed"] }, csrf: false }, [
            { name: "Requête polluée non autorisée", method: "GET", path: "/test-get?id=1&id=2", expectedStatus: 400 },
            { name: "Requête polluée autorisée (whitelist)", method: "GET", path: "/test-get?allowed=1&allowed=2", expectedStatus: 200 }
        ]);

        report += "## 5. Module Helmet\n\n";
        report += runTestProcess("Helmet - Base", { helmet: true, csrf: false }, [
            { name: "Vérification des Headers", method: "GET", path: "/test-get", expectedStatus: 200 }
        ]);

        report += "## 6. SQL Injection\n\n";
        report += runTestProcess("SQL Injection - Block", { sqlInjection: { blockOnDetection: true, strictMode: true }, csrf: false }, [
            { name: "Payload SQLi", method: "POST", path: "/test-post", body: { query: "SELECT * FROM users WHERE id = 1 OR 1=1" }, expectedStatus: 403 }
        ]);
        
        report += "## 7. Command Injection\n\n";
        report += runTestProcess("Command Injection - Block", { commandInjection: { blockOnDetection: true }, csrf: false }, [
            { name: "Payload Command Inject", method: "POST", path: "/test-post", body: { cmd: "ls -la; cat /etc/passwd" }, expectedStatus: 403 }
        ]);
        
        report += "## 8. Path Traversal\n\n";
        report += runTestProcess("Path Traversal - Block", { pathTraversal: { blockOnDetection: true }, csrf: false }, [
            { name: "Payload Path Traversal", method: "POST", path: "/test-post", body: { file: "../../../etc/passwd" }, expectedStatus: 403 }
        ]);

        const reportPath = path.join(process.cwd(), "security_tests_results.md");
        fs.writeFileSync(reportPath, report);
        console.log(`\nTests finished. Report generated at ${reportPath}`);
    }

    runAllTests().catch(console.error);
}
