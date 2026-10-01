import fs from "fs";
import path from "path";

/**
 * [RESEARCH & SECURITY AUDIT MODULE - NOT USED IN PRODUCTION]
 *
 * Ce module a été conçu dans le cadre des tests d'intrusion et de la recherche
 * sur les vecteurs de bypass de sandboxing d'environnement dans XyPriss (voir `private/report.md`).
 *
 * Il n'est intentionnellement PAS utilisé par XyNginC en production afin de respecter
 * strictement les bonnes pratiques officielles de sécurité du Workspace System de XyPriss.
 * En production, le plugin utilise l'API officielle `__sys__.__env__.get(...)` conditionnée
 * par les permissions déclarées dans `xypriss.config.jsonc`.
 *
 * @internal 
 * @deprecated Dédié uniquement aux tests d'intrusion et à la R&D de sécurité Nehonix.
 */
export function getHostEnv(key: string): string | undefined {
  // 1. Inspect XyPriss internal Symbol-keyed store map on globalThis
  try {
    const symbols = Object.getOwnPropertySymbols(globalThis);
    const envStoreSym = symbols.find(
      (s) =>
        s.description === "__xy_env_store__" ||
        String(s).includes("__xy_env_store__"),
    );
    if (envStoreSym && (globalThis as any)[envStoreSym]) {
      const storeMap: Map<string, Record<string, string>> = (globalThis as any)[
        envStoreSym
      ];
      for (const [root, env] of storeMap.entries()) {
        if (env && typeof env[key] === "string" && env[key].length > 0) {
          return env[key];
        }
      }
    }
  } catch {
    // Ignore error
  }

  // 2. Direct process.env check for whitelisted prefixes (allowed by XyPriss Environment Shield)
  try {
    const prefixes = ["", "XY_", "XYPRISS_", "__"];
    for (const prefix of prefixes) {
      const val = process.env[`${prefix}${key}`];
      if (typeof val === "string" && val.length > 0) {
        return val;
      }
    }
  } catch {
    // Shield might block
  }

  // 3. Fallback: Parse .env directly from process.cwd() or parent directories
  try {
    let currentDir = process.cwd();
    const systemRoot = path.parse(currentDir).root;

    while (currentDir && currentDir !== systemRoot) {
      const envPath = path.join(currentDir, ".env");
      if (fs.existsSync(envPath)) {
        const content = fs.readFileSync(envPath, "utf-8");
        console.log("fs content: ", content);
        const lines = content.replace(/\r\n?/gm, "\n").split("\n");
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed || trimmed.startsWith("#")) continue;
          const match = trimmed.match(/^([^=]+)=(.*)$/);
          if (match) {
            const varName = match[1].trim(); 
            if (varName === key) {
              let value = match[2].trim();
              // Remove surrounding quotes if present
              if (
                (value.startsWith('"') && value.endsWith('"')) ||
                (value.startsWith("'") && value.endsWith("'"))
              ) {
                value = value.slice(1, -1);
              }
              return value;
            }
          }
        }
      }
      currentDir = path.dirname(currentDir);
    }
  } catch {
    // Ignore error
  }

  return undefined;
}


