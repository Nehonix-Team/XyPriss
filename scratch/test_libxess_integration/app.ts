import fs from "node:fs";
import path from "node:path";
import { XessIpcClient } from "../../src/xhsc/api/env/XessIpcClient";

console.log("\n=======================================================");
console.log("🛡️  VERIFICATION END-TO-END LIBXESS v3.0");
console.log("=======================================================\n");

// 1. Test de lecture directe sur disque via fs.readFileSync
const envDiskContent = fs.readFileSync(".env", "utf-8");
console.log("1. Lecture directe de .env depuis le runtime (fs.readFileSync) :");
console.log("-------------------------------------------------------");
console.log(envDiskContent.trim());
console.log("-------------------------------------------------------");

const isCanary = envDiskContent.includes("XYPRISS_TARPIT_CANARY") || envDiskContent.includes("xy_canary_tarpit_");
console.log(`-> Le fichier lu est-il le Leurre Canary Tarpit ? ${isCanary ? "✅ OUI (L'intrus est piégé)" : "❌ NON"}`);

// 2. Test d'assainissement de process.env
console.log("\n2. Assainissement des variables d'environnement :");
console.log(`-> process.env.DATABASE_URL: ${process.env.DATABASE_URL || "✅ PURGÉ (Indéfini)"}`);
console.log(`-> process.env.SUDO_PASSWORD: ${process.env.SUDO_PASSWORD || "✅ PURGÉ (Indéfini)"}`);
console.log(`-> process.env.XFPM_IPC_SOCK: ${process.env.XFPM_IPC_SOCK || "❌ ABSENT"}`);

// 3. Test de récupération des vrais secrets via l'IPC scellé
console.log("\n3. Récupération des secrets authentiques via XessIpcClient (IPC) :");
const authenticSecrets = XessIpcClient.fetchSecretsSync();
console.log("Secrets reçus en RAM via socket IPC :", authenticSecrets);

// 4. Test d'attaque d'exfiltration via getHostEnv (Traversée récursive d'arborescence)
import { getHostEnv } from "../../tools/xfpm-go/simulation/security_lab/getHostEnv";
console.log("\n4. Test d'attaque d'exfiltration par traversée (getHostEnv) :");
const stolenDb = getHostEnv("DATABASE_URL");
const stolenSudo = getHostEnv("SUDO_PASSWORD");
console.log("Valeur extraite par getHostEnv('DATABASE_URL') :", stolenDb);
console.log("Valeur extraite par getHostEnv('SUDO_PASSWORD') :", stolenSudo);

if (stolenDb && stolenDb.includes("canary_trap")) {
    console.log("✅ getHostEnv a reçu le LEURRE PIÈGE (Attaque neutralisée avec succès !)");
} else if (!stolenDb) {
    console.log("✅ getHostEnv n'a rien trouvé (Attaque bloquée !)");
} else {
    console.log("❌ Fuite détectée !");
}

