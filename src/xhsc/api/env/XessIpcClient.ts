import * as net from "node:net";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { Cipher } from "xypriss-security";
import { QuickLogger } from "../../../shared/logger/quickLogger";

const logger = new QuickLogger("LibXESS");

export interface XessIpcResponse {
    action: string;
    hash?: string;
    secrets?: Record<string, string>;
    value?: string;
    key?: string;
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
    /**
     * Calcule le chemin du socket IPC libXESS pour un répertoire donné.
     */
    private static getSocketForDir(dir: string): string {
        const hash = Cipher.hash
            .create(path.resolve(dir), { algorithm: "sha256" })
            .toString("hex")
            .slice(0, 12);
        return path.join(os.tmpdir(), `xess_ipc_${hash}.sock`);
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
                const candidate = XessIpcClient.getSocketForDir(current);
                if (fs.existsSync(candidate) && !candidates.includes(candidate)) {
                    candidates.push(candidate);
                }
                const parent = path.dirname(current);
                if (parent === current) break;
                current = parent;
            }
        };

        // 1. Purge et interception défensive d'une variable transitoire éventuelle
        if (typeof process !== "undefined" && process.env?.XFPM_IPC_SOCK) {
            const legacySock = process.env.XFPM_IPC_SOCK;
            try {
                delete (process.env as any).XFPM_IPC_SOCK;
            } catch {
                // Ignore si process.env est scellé
            }
            if (fs.existsSync(legacySock) && !candidates.includes(legacySock)) {
                candidates.push(legacySock);
            }
        }

        // 2. Dossier de travail courant (process.cwd()) où xfpm ancre son superviseur
        if (typeof process !== "undefined" && process.cwd) {
            addDirHierarchy(process.cwd());
        }

        // 3. Dossier de projet spécifique si différent
        if (projectDir) {
            addDirHierarchy(projectDir);
        }

        return candidates;
    }

    /**
     * Résout déterministement le chemin du socket IPC libXESS actif.
     */
    public static resolveSocketPath(projectDir?: string): string | undefined {
        const candidates = this.getCandidateSocketPaths(projectDir);
        return candidates.length > 0 ? candidates[0] : undefined;
    }

    /**
     * Vérifie si le runtime tourne sous le confinement actif de libXESS.
     */
    public static isShielded(projectDir?: string): boolean {
        return this.getCandidateSocketPaths(projectDir).length > 0;
    }

    /**
     * Récupère le chemin du socket IPC libXESS.
     */
    public static getSocketPath(projectDir?: string): string | undefined {
        return this.resolveSocketPath(projectDir);
    }

    /**
     * Récupération synchrone des secrets lors du bootstrap initial.
     * Tente les sockets candidats et purge automatiquement les sockets fantômes résiduels.
     */
    public static fetchSecretsSync(
        projectDirOrSocket?: string,
    ): Record<string, string> {
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

        if (candidates.length === 0) {
            throw new Error(
                "No active IPC socket found for project. libXESS confinement is required.",
            );
        }

        const targetDir =
            projectDirOrSocket && !projectDirOrSocket.endsWith(".sock")
                ? path.resolve(projectDirOrSocket)
                : "";

        const script = `
const net = require("net");
const sock = process.argv[1];
const targetDir = process.argv[2] || "";
const client = net.createConnection(sock, () => {
    client.write(JSON.stringify({ action: "INIT", projectDir: targetDir }) + "\\n");
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
                    ["-e", script, sock, targetDir],
                    {
                        encoding: "utf8",
                        timeout: 3000,
                        stdio: ["ignore", "pipe", "pipe"],
                    },
                );

                const parsed = JSON.parse(output.trim()) as XessIpcResponse;
                if (parsed && parsed.secrets) {
                    return parsed.secrets;
                }
            } catch (err: any) {
                lastErr = err;
                // Si le socket est orphelin/mort (connect ENOENT / ECONNREFUSED), suppression du fichier résiduel
                if (err.message && (err.message.includes("ENOENT") || err.message.includes("ECONNREFUSED"))) {
                    try {
                        fs.unlinkSync(sock);
                    } catch {
                        // Ignore
                    }
                }
            }
        }

        logger.error(
            `Failed to fetch secrets from libXESS IPC candidates: ${lastErr?.message}`,
        );
        throw new Error(
            `Fatal IPC error communicating with libXESS supervisor: ${lastErr?.message}`,
        );
    }

    /**
     * Récupération asynchrone des secrets via net.Socket natif.
     */
    public static async fetchSecretsAsync(
        projectDirOrSocket?: string,
    ): Promise<Record<string, string>> {
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

        if (candidates.length === 0) {
            return {};
        }

        const targetDir =
            projectDirOrSocket && !projectDirOrSocket.endsWith(".sock")
                ? path.resolve(projectDirOrSocket)
                : "";

        for (const sock of candidates) {
            try {
                const secrets = await new Promise<Record<string, string>>(
                    (resolve, reject) => {
                        const client = net.createConnection(sock, () => {
                            client.write(
                                JSON.stringify({
                                    action: "INIT",
                                    projectDir: targetDir,
                                }) + "\n",
                            );
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
                                    resolve(parsed.secrets || {});
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
                if (err.message && (err.message.includes("ENOENT") || err.message.includes("ECONNREFUSED"))) {
                    try {
                        fs.unlinkSync(sock);
                    } catch {
                        // Ignore
                    }
                }
            }
        }

        return {};
    }
}

