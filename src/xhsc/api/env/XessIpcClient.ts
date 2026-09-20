import * as net from "node:net";
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
 */
export class XessIpcClient {
    /**
     * Vérifie si le runtime tourne sous le confinement libXESS
     */
    public static isShielded(): boolean {
        return Boolean(process.env.XFPM_IPC_SOCK);
    }

    /**
     * Récupère le chemin du socket IPC libXESS
     */
    public static getSocketPath(): string | undefined {
        return process.env.XFPM_IPC_SOCK;
    }

    /**
     * Récupération synchrone des secrets lors de la phase de bootstrap initial.
     * Utilise un sous-processus isolé exécutant une connexion socket native.
     */
    public static fetchSecretsSync(socketPath?: string): Record<string, string> {
        const sock = socketPath || this.getSocketPath();
        if (!sock) {
            return {};
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
        } catch (err: any) {
            logger.warn(`[libXESS] Failed to fetch secrets from IPC socket (${sock}): ${err.message}`);
        }

        return {};
    }

    /**
     * Récupération asynchrone des secrets via net.Socket natif
     */
    public static async fetchSecretsAsync(socketPath?: string): Promise<Record<string, string>> {
        const sock = socketPath || this.getSocketPath();
        if (!sock) {
            return {};
        }

        return new Promise((resolve, reject) => {
            const client = net.createConnection(sock, () => {
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
