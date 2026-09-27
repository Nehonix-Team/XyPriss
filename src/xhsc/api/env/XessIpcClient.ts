import * as net from "node:net";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { Cipher } from "xypriss-security";
import { QuickLogger } from "../../../shared/logger/quickLogger";
import {
    generateXUserTmpDir,
    getXessTempDir,
} from "../../../plugins/const/XyprissTempDir";
import { isCoreFrameworkPath } from "../../../utils/CorePathCheck";

const logger = new QuickLogger("LibXESS");

export interface XessIpcResponse {
    action: string;
    hash?: string;
    sessionKey?: string;
    secrets?: Record<string, string>;
    value?: string;
    key?: string;
    error?: string;
}

// Module-scoped security closures - strictly isolated from globalThis and reflection APIs
const _secretsCache = new Map<string, Record<string, string>>();
let _ephemeralAuthToken = "";
let _activeSessionKey = "";
let _isLibxessActive = false;

// Immediately consume the one-shot token at module evaluation time
if (typeof process !== "undefined") {
    if (process.env?.LIBXESS_ACTIVE === "1") {
        _isLibxessActive = true;
    }
    if (process.env?.XYPRISS_XESS_AUTH_TOKEN) {
        _ephemeralAuthToken = process.env.XYPRISS_XESS_AUTH_TOKEN;
        _isLibxessActive = true;
        try {
            delete (process.env as any).XYPRISS_XESS_AUTH_TOKEN;
        } catch {}
    }
}

const ppidScope = typeof process !== "undefined" && process.ppid ? process.ppid : "sys";
const SESSION_BRIDGE_KEY = Symbol.for(`__xypriss_session_bridge_${ppidScope}__`);

interface SessionBridge {
    getSessionKey(): string;
    getSecretsCache(): Map<string, Record<string, string>>;
    registerSession(key: string, cache: Map<string, Record<string, string>>): void;
}

function getSessionBridge(): SessionBridge {
    const g = globalThis as any;
    if (!g[SESSION_BRIDGE_KEY]) {
        let bridgeSessionKey = "";
        let bridgeCache = new Map<string, Record<string, string>>();

        const bridge: SessionBridge = {
            getSessionKey: () => {
                assertInternalCaller();
                return bridgeSessionKey;
            },
            getSecretsCache: () => {
                assertInternalCaller();
                return bridgeCache;
            },
            registerSession: (key: string, cache: Map<string, Record<string, string>>) => {
                assertInternalCaller();
                if (key) {
                    bridgeSessionKey = key;
                }
                if (cache) {
                    bridgeCache = cache;
                }
            },
        };

        try {
            Object.defineProperty(g, SESSION_BRIDGE_KEY, {
                value: bridge,
                writable: false,
                enumerable: false,
                configurable: false,
            });
        } catch {
            g[SESSION_BRIDGE_KEY] = bridge;
        }
    }
    return g[SESSION_BRIDGE_KEY];
}

/**
 * Asserts that the caller executing this method is directly part of the internal
 * XyPriss engine core. External plugins or untrusted scripts attempting to invoke
 * XessIpcClient are immediately rejected and halted.
 */
function assertInternalCaller(): void {
    const stack = new Error().stack || "";
    const lines = stack.split("\n");
    let callerFile = "";
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i];
        if (
            line.includes("XessIpcClient.") ||
            line.includes("assertInternalCaller") ||
            line.includes("getSessionBridge") ||
            line.includes("registerSession") ||
            line.includes("getSessionKey") ||
            line.includes("getSecretsCache")
        ) {
            continue;
        }
        const match =
            line.match(/\((.*):\d+:\d+\)$/) ||
            line.match(/at (.*):\d+:\d+$/) ||
            line.match(/at (.*)$/);
        if (match) {
            callerFile = match[1];
            break;
        }
    }
    if (callerFile && !isCoreFrameworkPath(callerFile)) {
        logger.error(
            `[libXESS Security Violation] Direct invocation of XessIpcClient from unauthorized caller '${callerFile}'. Confinement violation: halting process.`,
        );
        process.exit(1);
    }
}

/**
 * **XessIpcClient**
 *
 * Client IPC sécurisé pour communiquer avec le superviseur libXESS.
 * Permet de récupérer les secrets authentiques en mémoire RAM via Unix Domain Socket
 * tout en maintenant l'isolation bipolaire (le fichier .env sur disque étant un leurre canary).
 *
 * L'adresse du socket IPC est résolue de manière déterministe hors process.env
 * à partir de l'empreinte cryptographique XSec de la racine du projet.
 */
export class XessIpcClient {
    private static get secretsCache(): Map<string, Record<string, string>> {
        try {
            const bridge = getSessionBridge();
            const cache = bridge.getSecretsCache();
            if (cache) {
                return cache;
            }
        } catch {}
        return _secretsCache;
    }

    /**
     * Calcule la liste des emplacements potentiels du socket IPC libXESS pour un répertoire donné.
     * Privilégie le dossier dédié scoped dans xuser/ tout en conservant les fallbacks.
     */
    private static getSocketCandidatesForDir(dir: string): string[] {
        const hash = Cipher.hash
            .create(path.resolve(dir), { algorithm: "sha256" })
            .toString("hex")
            .slice(0, 12);
        const fileName = `xess_ipc_${hash}.sock`;
        const candidates: string[] = [];

        // Emplacement unique scoped sous la session courante fournie par libproc
        try {
            const xessDir = getXessTempDir();
            if (xessDir) {
                candidates.push(path.join(xessDir, fileName));
            }
        } catch {}

        try {
            const sessionDir = generateXUserTmpDir();
            if (sessionDir) {
                candidates.push(path.join(sessionDir, "xess", fileName));
                candidates.push(path.join(sessionDir, fileName));
            }
        } catch {}

        return candidates;
    }

    /**
     * Liste ordonnée de tous les chemins de sockets candidats potentiels :
     * 1. process.cwd() (dossier d'exécution du CLI xfpm / superviseur libXESS)
     * 2. projectDir (dossier du projet ou plugin ciblé)
     * 3. Répertoires parents ascendants
     */
    public static getCandidateSocketPaths(projectDir?: string): string[] {
        const candidates: string[] = [];
        const seen = new Set<string>();

        const addDirHierarchy = (dir: string) => {
            let current = path.resolve(dir);
            while (current && !seen.has(current)) {
                seen.add(current);
                const candidatesForDir = XessIpcClient.getSocketCandidatesForDir(current);
                for (const candidate of candidatesForDir) {
                    if (fs.existsSync(candidate) && !candidates.includes(candidate)) {
                        candidates.push(candidate);
                    }
                }
                const parent = path.dirname(current);
                if (parent === current) break;
                current = parent;
            }
        };

        // 2. Dossier de travail courant (process.cwd()) où xfpm ancre son superviseur
        if (typeof process !== "undefined" && process.cwd) {
            addDirHierarchy(process.cwd());
        }

        // 3. Dossier de projet spécifique si différent
        if (projectDir) {
            addDirHierarchy(projectDir);
        }

        // 4. Sockets provisionnés directement dans le xessDir de cette session supervisée
        try {
            const xessDir = getXessTempDir();
            if (xessDir && fs.existsSync(xessDir)) {
                const files = fs.readdirSync(xessDir);
                for (const f of files) {
                    if (f.startsWith("xess_ipc_") && f.endsWith(".sock")) {
                        const sock = path.join(xessDir, f);
                        if (!candidates.includes(sock)) {
                            candidates.push(sock);
                        }
                    }
                }
            }
        } catch {}

        return candidates;
    }

    /**
     * Effectue une vérification synchrone de liveness sur un socket IPC.
     * Si le fichier socket existe sur le disque mais que le superviseur est mort (ECONNREFUSED / timeout),
     * le socket fantôme est immédiatement purgé du disque et la fonction retourne false.
     */
    public static probeSocketSync(socketPath: string): boolean {
        if (!fs.existsSync(socketPath)) return false;

        const script = `
const net = require("net");
const sock = process.argv[1];
const client = net.createConnection(sock, () => {
    client.end();
    process.exit(0);
});
client.on("error", () => process.exit(1));
setTimeout(() => process.exit(1), 80);
`;
        try {
            execFileSync(process.execPath, ["-e", script, socketPath], {
                timeout: 250,
                stdio: "ignore",
            });
            return true;
        } catch {
            // Fichier socket abandonné sur disque sans superviseur actif : purge atomique
            try {
                fs.unlinkSync(socketPath);
            } catch {}
            return false;
        }
    }

    /**
     * Résout déterministement le chemin du socket IPC libXESS actif.
     */
    public static resolveSocketPath(projectDir?: string): string | undefined {
        const candidates = this.getCandidateSocketPaths(projectDir);
        for (const candidate of candidates) {
            if (this.probeSocketSync(candidate)) {
                return candidate;
            }
        }
        return undefined;
    }

    /**
     * Vérifie si le runtime tourne sous le confinement actif de libXESS.
     */
    public static isShielded(projectDir?: string): boolean {
        const authToken = this.getOrConsumeAuthToken();
        const sessionKey = this.getSessionKey();
        const isActive =
            typeof process !== "undefined" &&
            (_isLibxessActive ||
                process.env?.LIBXESS_ACTIVE === "1" ||
                !!authToken ||
                !!sessionKey);
        if (!isActive) {
            return false;
        }

        const candidates = this.getCandidateSocketPaths(projectDir);
        for (const candidate of candidates) {
            if (this.probeSocketSync(candidate)) {
                return true;
            }
        }
        return false;
    }

    /**
     * Récupère le chemin du socket IPC libXESS.
     */
    public static getSocketPath(projectDir?: string): string | undefined {
        return this.resolveSocketPath(projectDir);
    }

    /**
     * Récupère le jeton d'authentification éphémère libXESS et purge immédiatement
     * la variable d'environnement de la mémoire pour empêcher toute réutilisation non autorisée.
     */
    private static getOrConsumeAuthToken(): string {
        if (_ephemeralAuthToken) {
            return _ephemeralAuthToken;
        }
        if (typeof process !== "undefined" && process.env?.XYPRISS_XESS_AUTH_TOKEN) {
            _ephemeralAuthToken = process.env.XYPRISS_XESS_AUTH_TOKEN;
            try {
                delete (process.env as any).XYPRISS_XESS_AUTH_TOKEN;
            } catch {}
        }
        return _ephemeralAuthToken;
    }

    private static getSessionKey(): string {
        if (_activeSessionKey) {
            return _activeSessionKey;
        }
        try {
            const bridge = getSessionBridge();
            const key = bridge.getSessionKey();
            if (key) {
                _activeSessionKey = key;
                return key;
            }
        } catch {}
        return "";
    }

    private static setSessionKey(key: string): void {
        _activeSessionKey = key;
        _ephemeralAuthToken = "";
        try {
            const bridge = getSessionBridge();
            bridge.registerSession(key, _secretsCache);
        } catch {}
    }

    /**
     * Récupération synchrone des secrets lors du bootstrap initial.
     * Tente les sockets candidats et purge automatiquement les sockets fantômes résiduels.
     */
    public static fetchSecretsSync(
        projectDirOrSocket?: string,
    ): Record<string, string> {
        assertInternalCaller();

        let candidates: string[] = [];
        if (
            projectDirOrSocket &&
            (projectDirOrSocket.endsWith(".sock") ||
                (fs.existsSync(projectDirOrSocket) &&
                    !fs.statSync(projectDirOrSocket).isDirectory()))
        ) {
            candidates = [projectDirOrSocket];
        } else {
            candidates = this.getCandidateSocketPaths(projectDirOrSocket);
        }

        const targetDir =
            projectDirOrSocket && !projectDirOrSocket.endsWith(".sock")
                ? path.resolve(projectDirOrSocket)
                : "";

        const cacheKey = targetDir || "__root__";
        if (this.secretsCache.has(cacheKey)) {
            return this.secretsCache.get(cacheKey)!;
        }

        const authToken = this.getOrConsumeAuthToken();
        const sessionKey = this.getSessionKey();
        const isShieldedActive =
            typeof process !== "undefined" &&
            (_isLibxessActive ||
                process.env?.LIBXESS_ACTIVE === "1" ||
                !!authToken ||
                !!sessionKey);

        if (!isShieldedActive) {
            // Mode sans confinement libXESS (ex: exécution hors xfpm ou sans le flag -l xess)
            const envPath = path.join(targetDir || (typeof process !== "undefined" ? process.cwd() : ""), ".env");
            if (fs.existsSync(envPath)) {
                try {
                    const raw = fs.readFileSync(envPath, "utf-8");
                    const parsed: Record<string, string> = {};
                    for (const line of raw.split("\n")) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith("#")) continue;
                        const eqIdx = trimmed.indexOf("=");
                        if (eqIdx !== -1) {
                            const k = trimmed.slice(0, eqIdx).trim();
                            let v = trimmed.slice(eqIdx + 1).trim();
                            if (
                                (v.startsWith('"') && v.endsWith('"')) ||
                                (v.startsWith("'") && v.endsWith("'"))
                            ) {
                                v = v.slice(1, -1);
                            }
                            parsed[k] = v;
                        }
                    }
                    this.secretsCache.set(cacheKey, parsed);
                    return parsed;
                } catch {}
            }
            return {};
        }

        if (candidates.length === 0) {
            const msg =
                "[libXESS] No active libXESS Bridge found for project. Direct execution without libXESS confinement is strictly prohibited.";
            logger.error(msg);
            process.exit(1);
        }

        const action = sessionKey ? "GET_PROJECT" : "HANDSHAKE";
        const credential = sessionKey || authToken;

        const script = `
const net = require("net");
const sock = process.argv[1];
const targetDir = process.argv[2] || "";
const action = process.argv[3];
const credential = process.argv[4] || "";
const client = net.createConnection(sock, () => {
    const payload = action === "HANDSHAKE"
        ? { action: "HANDSHAKE", projectDir: targetDir, token: credential }
        : { action: action, projectDir: targetDir, sessionKey: credential };
    client.write(JSON.stringify(payload) + "\\n");
});
let data = "";
client.on("data", (chunk) => {
    data += chunk.toString();
    if (data.includes("\\n")) {
        client.end();
        process.stdout.write(data.trim());
        process.exit(0);
    }
});
client.on("error", (err) => {
    process.stderr.write(err.message);
    process.exit(1);
});
setTimeout(() => { process.exit(1); }, 3000);
`;

        let lastErr: Error | undefined;

        for (const sock of candidates) {
            try {
                const output = execFileSync(
                    process.execPath,
                    ["-e", script, sock, targetDir, action, credential],
                    {
                        encoding: "utf8",
                        timeout: 3000,
                        stdio: ["ignore", "pipe", "pipe"],
                    },
                );

                const parsed = JSON.parse(output.trim()) as XessIpcResponse;
                if (parsed.action === "UNAUTHORIZED" || parsed.error) {
                    const msg = `[libXESS] Authentication rejected: ${parsed.error || "Unauthorized"}. Confinement violation.`;
                    logger.error(msg);
                    process.exit(1);
                }
                if (parsed.sessionKey) {
                    this.setSessionKey(parsed.sessionKey);
                }
                if (parsed && parsed.secrets) {
                    this.secretsCache.set(cacheKey, parsed.secrets);
                    return parsed.secrets;
                }
            } catch (err: any) {
                lastErr = err;
            }
        }

        const msg = `[libXESS] Failed to fetch secrets from libXESS: ${lastErr?.message || "unknown error"}. Confinement violation: halting execution.`;
        logger.error(msg);
        process.exit(1);
    }

    /**
     * Récupération asynchrone des secrets via net.Socket natif.
     */
    public static async fetchSecretsAsync(
        projectDirOrSocket?: string,
    ): Promise<Record<string, string>> {
        assertInternalCaller();

        let candidates: string[] = [];
        if (
            projectDirOrSocket &&
            (projectDirOrSocket.endsWith(".sock") ||
                (fs.existsSync(projectDirOrSocket) &&
                    !fs.statSync(projectDirOrSocket).isDirectory()))
        ) {
            candidates = [projectDirOrSocket];
        } else {
            candidates = this.getCandidateSocketPaths(projectDirOrSocket);
        }

        const targetDir =
            projectDirOrSocket && !projectDirOrSocket.endsWith(".sock")
                ? path.resolve(projectDirOrSocket)
                : "";

        const cacheKey = targetDir || "__root__";
        if (this.secretsCache.has(cacheKey)) {
            return this.secretsCache.get(cacheKey)!;
        }

        const authToken = this.getOrConsumeAuthToken();
        const sessionKey = this.getSessionKey();
        const isShieldedActive =
            typeof process !== "undefined" &&
            (_isLibxessActive ||
                process.env?.LIBXESS_ACTIVE === "1" ||
                !!authToken ||
                !!sessionKey);

        if (!isShieldedActive) {
            const envPath = path.join(
                targetDir || (typeof process !== "undefined" ? process.cwd() : ""),
                ".env",
            );
            if (fs.existsSync(envPath)) {
                try {
                    const raw = fs.readFileSync(envPath, "utf-8");
                    const parsed: Record<string, string> = {};
                    for (const line of raw.split("\n")) {
                        const trimmed = line.trim();
                        if (!trimmed || trimmed.startsWith("#")) continue;
                        const eqIdx = trimmed.indexOf("=");
                        if (eqIdx !== -1) {
                            const k = trimmed.slice(0, eqIdx).trim();
                            let v = trimmed.slice(eqIdx + 1).trim();
                            if (
                                (v.startsWith('"') && v.endsWith('"')) ||
                                (v.startsWith("'") && v.endsWith("'"))
                            ) {
                                v = v.slice(1, -1);
                            }
                            parsed[k] = v;
                        }
                    }
                    this.secretsCache.set(cacheKey, parsed);
                    return parsed;
                } catch {}
            }
            return {};
        }

        if (candidates.length === 0) {
            const msg =
                "[libXESS] No active libXESS Bridge found for project. Direct execution without libXESS confinement is strictly prohibited.";
            logger.error(msg);
            process.exit(1);
        }

        const action = sessionKey ? "GET_PROJECT" : "HANDSHAKE";
        const credential = sessionKey || authToken;

        let lastErr: Error | undefined;

        for (const sock of candidates) {
            try {
                const secrets = await new Promise<Record<string, string>>(
                    (resolve, reject) => {
                        const client = net.createConnection(sock, () => {
                            const payload = action === "HANDSHAKE"
                                ? { action: "HANDSHAKE", projectDir: targetDir, token: credential }
                                : { action: action, projectDir: targetDir, sessionKey: credential };
                            client.write(JSON.stringify(payload) + "\n");
                        });

                        let buffer = "";
                        const timeout = setTimeout(() => {
                            client.destroy();
                            reject(new Error("Socket timeout"));
                        }, 3000);

                        client.on("data", (chunk) => {
                            buffer += chunk.toString();
                            if (buffer.includes("\n")) {
                                clearTimeout(timeout);
                                client.end();
                                try {
                                    const parsed = JSON.parse(
                                        buffer.trim(),
                                    ) as XessIpcResponse;
                                    if (parsed.action === "UNAUTHORIZED" || parsed.error) {
                                        logger.error(`[libXESS] Authentication rejected: ${parsed.error || "Unauthorized"}`);
                                        process.exit(1);
                                    }
                                    if (parsed.sessionKey) {
                                        this.setSessionKey(parsed.sessionKey);
                                    }
                                    const sec = parsed.secrets || {};
                                    this.secretsCache.set(cacheKey, sec);
                                    resolve(sec);
                                } catch (e) {
                                    resolve({});
                                }
                            }
                        });

                        client.on("error", (err) => {
                            clearTimeout(timeout);
                            client.destroy();
                            reject(err);
                        });
                    },
                );

                return secrets;
            } catch (err: any) {
                lastErr = err;
            }
        }

        const msg = `[libXESS] Failed to fetch secrets from libXESS: ${lastErr?.message || "unknown error"}. Confinement violation: halting execution.`;
        logger.error(msg);
        process.exit(1);
    }
}
