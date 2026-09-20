import * as net from "node:net";
import * as crypto from "node:crypto";
import * as fs from "node:fs";
import * as os from "node:os";
import * as path from "node:path";
import { execFileSync } from "node:child_process";
import { logger } from "../../../shared/logger/Logger";

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
 * à partir de l'empreinte cryptographique de la racine du projet.
 */
export class XessIpcClient {
    /**
     * Résout déterministement le chemin du socket IPC libXESS sans dépendre de process.env.
     */
    public static resolveSocketPath(projectDir?: string): string | undefined {
        // 1. Purge et interception défensive de toute variable d'environnement transitoire
        if (typeof process !== "undefined" && process.env?.XFPM_IPC_SOCK) {
            const legacySock = process.env.XFPM_IPC_SOCK;
            try {
                delete (process.env as any).XFPM_IPC_SOCK;
            } catch {
                // Ignore si l'objet process.env est scellé
            }
            if (fs.existsSync(legacySock)) {
                return legacySock;
            }
        }

        // 2. Découverte déterministe basée sur le hash SHA-256 du répertoire projet (conforme au superviseur Go)
        const targetDir = projectDir ? path.resolve(projectDir) : process.cwd();
        const hash = crypto.createHash("sha256").update(targetDir).digest("hex").slice(0, 12);
        const candidate = path.join(os.tmpdir(), `xess_ipc_${hash}.sock`);

        if (fs.existsSync(candidate)) {
            return candidate;
        }

        // 3. Fallback sur le dossier de travail courant si différent de projectDir
        if (projectDir && path.resolve(projectDir) !== process.cwd()) {
            const cwdHash = crypto.createHash("sha256").update(process.cwd()).digest("hex").slice(0, 12);
            const cwdCandidate = path.join(os.tmpdir(), `xess_ipc_${cwdHash}.sock`);
            if (fs.existsSync(cwdCandidate)) {
                return cwdCandidate;
            }
        }

        return undefined;
    }

    /**
     * Vérifie si le runtime tourne sous le confinement actif de libXESS.
     */
    public static isShielded(projectDir?: string): boolean {
        const sock = this.resolveSocketPath(projectDir);
        return Boolean(sock && fs.existsSync(sock));
    }

    /**
     * Récupère le chemin du socket IPC libXESS.
     */
    public static getSocketPath(projectDir?: string): string | undefined {
        return this.resolveSocketPath(projectDir);
    }

    /**
     * Récupération synchrone des secrets lors de la phase de bootstrap initial.
     * Utilise un sous-processus isolé exécutant une connexion socket native.
     */
    public static fetchSecretsSync(projectDirOrSocket?: string): Record<string, string> {
        let sock: string | undefined;
        if (projectDirOrSocket && (projectDirOrSocket.endsWith(".sock") || (fs.existsSync(projectDirOrSocket) && !fs.statSync(projectDirOrSocket).isDirectory()))) {
            sock = projectDirOrSocket;
        } else {
            sock = this.resolveSocketPath(projectDirOrSocket);
        }

        if (!sock) {
            throw new Error("[libXESS] No active IPC socket found for project. libXESS confinement is required.");
        }

        try {
            // Script autonome qui se connecte au socket UNIX, envoie INIT\n et lit la réponse JSON
            const script = `
const net = require("net");
const sock = process.argv[1];
const client = net.createConnection(sock, () => {
    client.write(JSON.stringify({ action: "INIT" }) + "\\n");
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
            const output = execFileSync(process.execPath, ["-e", script, sock], {
                encoding: "utf8",
                timeout: 3000,
                stdio: ["ignore", "pipe", "pipe"],
            });

            const parsed = JSON.parse(output.trim()) as XessIpcResponse;
            if (parsed && parsed.secrets) {
                return parsed.secrets;
            }
            throw new Error(`[libXESS] Empty or malformed secrets payload received from IPC socket`);
        } catch (err: any) {
            logger.error(`[libXESS] Failed to fetch secrets from IPC socket (${sock}): ${err.message}`);
            throw new Error(`[libXESS] Fatal IPC error on socket (${sock}): ${err.message}`);
        }
    }

    /**
     * Récupération asynchrone des secrets via net.Socket natif.
     */
    public static async fetchSecretsAsync(projectDirOrSocket?: string): Promise<Record<string, string>> {
        let sock: string | undefined;
        if (projectDirOrSocket && (projectDirOrSocket.endsWith(".sock") || (fs.existsSync(projectDirOrSocket) && !fs.statSync(projectDirOrSocket).isDirectory()))) {
            sock = projectDirOrSocket;
        } else {
            sock = this.resolveSocketPath(projectDirOrSocket);
        }

        if (!sock) {
            return {};
        }

        return new Promise((resolve, reject) => {
            const client = net.createConnection(sock!, () => {
                client.write(JSON.stringify({ action: "INIT" }) + "\n");
            });

            let buffer = "";

            const timeout = setTimeout(() => {
                client.destroy();
                resolve({});
            }, 3000);

            client.on("data", (chunk) => {
                buffer += chunk.toString();
                if (buffer.includes("\n")) {
                    clearTimeout(timeout);
                    client.end();
                    try {
                        const parsed = JSON.parse(buffer.trim()) as XessIpcResponse;
                        resolve(parsed.secrets || {});
                    } catch (e) {
                        resolve({});
                    }
                }
            });

            client.on("error", (err) => {
                clearTimeout(timeout);
                client.destroy();
                logger.warn(`[libXESS] IPC async socket error: ${err.message}`);
                resolve({});
            });
        });
    }
}
