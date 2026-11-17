import fs from "node:fs";
import path from "node:path";
import { spawn } from "node:child_process";

console.log("=================================================");
console.log("   DIAGNOSTIC CIBLÉ : DÉMARRAGE DU DAEMON XHSC   ");
console.log("=================================================\n");

const sessionDir = process.env.XYPRISS_USER_TMP || process.env.XESS_SESSION_TMP;
const xhscBin = path.join(
    process.cwd(),
    "node_modules",
    "xypriss",
    "bin",
    "xhsc.exe",
);

console.log(`1. SessionDir : ${sessionDir}`);
console.log(`2. Binaire XHSC : ${xhscBin} (existe: ${fs.existsSync(xhscBin)})`);

// Test du lancement direct de xhsc daemon avec capture des logs
console.log(
    "\n3. Lancement manuel de 'xhsc.exe daemon' (observation pendant 2s) :",
);

const daemonProcess = spawn(xhscBin, ["daemon", process.cwd()], {
    env: {
        ...process.env,
        XYPRISS_USER_TMP: sessionDir,
        XESS_SESSION_TMP: sessionDir,
    },
    stdio: ["ignore", "pipe", "pipe"],
});

let daemonStdout = "";
let daemonStderr = "";

daemonProcess.stdout.on("data", (d) => {
    daemonStdout += d.toString();
});
daemonProcess.stderr.on("data", (d) => {
    daemonStderr += d.toString();
});

let exitedEarly = false;
let exitCode = null;

daemonProcess.on("exit", (code, signal) => {
    exitedEarly = true;
    exitCode = code;
    console.log(
        `   ⚠ Le daemon s'est arrêté prématurément ! Code: ${code}, Signal: ${signal}`,
    );
});

// Attendre 2 secondes pour inspecter le socket
await new Promise((resolve) => setTimeout(resolve, 2000));

console.log(`   - Sortie stdout du daemon : ${daemonStdout || "<VIDE>"}`);
console.log(`   - Sortie stderr du daemon : ${daemonStderr || "<VIDE>"}`);

const synapxSock = path.join(sessionDir, "synapx.sock");
console.log(
    `   - Présence de synapx.sock : ${fs.existsSync(synapxSock) ? "✔ OUI" : "❌ NON"}`,
);

// Nettoyage du daemon de test
if (!exitedEarly) {
    daemonProcess.kill();
}

// 4. Test d'appel réel createServer()
console.log("\n4. Test de createServer() depuis 'xypriss' :");
try {
    const { createServer } = await import("xypriss");
    console.log("   - Module 'xypriss' chargé, tentative de createServer()...");
    const app = createServer();
    console.log("   ✔ createServer() a RÉUSSI avec succès !");
} catch (err) {
    console.log("   ❌ createServer() a ÉCHOUÉ avec l'erreur :");
    console.log(err.stack || err);
}

console.log("\n=================================================");
