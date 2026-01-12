import { execSync } from "child_process";
import { existsSync, mkdirSync, createWriteStream } from "fs";
import { join, dirname } from "path";
import { platform, arch } from "os";
import https from "https";

import { fileURLToPath } from "url";

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

const REPO = "Nehonix-Team/XyPriss";
const BIN_NAME = "xsys";

async function install() {
    const targetDir = join(__dirname, "..", "bin");
    if (!existsSync(targetDir)) {
        mkdirSync(targetDir, { recursive: true });
    }

    const osName = platform();
    const archName = arch();

    let binaryTarget = "";
    if (osName === "linux") {
        binaryTarget = archName === "arm64" ? "linux-arm64" : "linux-amd64";
    } else if (osName === "darwin") {
        binaryTarget = archName === "arm64" ? "darwin-arm64" : "darwin-amd64";
    } else if (osName === "win32") {
        binaryTarget = "windows-amd64";
    } else {
        console.warn(
            `Unsupported platform/architecture: ${osName}/${archName}. Attempting to build from source...`
        );
        try {
            execSync("cd tools/xypriss-sys && cargo build --release", {
                stdio: "inherit",
            });
            execSync(
                `cp tools/xypriss-sys/target/release/${BIN_NAME} bin/${BIN_NAME}`,
                { stdio: "inherit" }
            );
            return;
        } catch (e) {
            console.error(
                "Failed to build from source. Please ensure Rust is installed."
            );
            process.exit(1);
        }
    }

    const url = `https://github.com/${REPO}/releases/latest/download/${BIN_NAME}-${binaryTarget}${
        osName === "win32" ? ".exe" : ""
    }`;
    const destPath = join(
        targetDir,
        BIN_NAME + (osName === "win32" ? ".exe" : "")
    );

    console.log(`Downloading ${BIN_NAME} from ${url}...`);

    // Note: Since this is a postinstall script, we might not have 'axios' or 'node-fetch'
    // We'll use built-in 'https'

    const download = (downloadUrl) => {
        https
            .get(
                downloadUrl,
                {
                    headers: { "User-Agent": "XyPriss-Installer" },
                },
                (response) => {
                    if (
                        response.statusCode >= 300 &&
                        response.statusCode < 400 &&
                        response.headers.location
                    ) {
                        download(response.headers.location);
                        return;
                    }

                    if (response.statusCode === 200) {
                        const file = createWriteStream(destPath);
                        response.pipe(file);
                        file.on("finish", () => {
                            file.close();
                            if (osName !== "win32") {
                                execSync(`chmod +x ${destPath}`);
                            }
                            console.log(
                                `${BIN_NAME} installed successfully at ${destPath}`
                            );
                        });
                    } else {
                        console.error(
                            `Failed to download binary: ${response.statusCode}`
                        );
                        process.exit(1);
                    }
                }
            )
            .on("error", (err) => {
                console.error(`Error downloading file: ${err.message}`);
                process.exit(1);
            });
    };

    download(url);
}

install().catch(console.error);

