import { execSync } from "child_process";
import { existsSync, mkdirSync, createWriteStream } from "fs";
import { join } from "path";
import { platform, arch } from "os";
import https from "https";

const VERSION = "0.1.0"; // Should match xypriss-sys version
const REPO = "Nehonix-Team/XyPriss";
const BIN_NAME = "xsys";

async function install() {
    const targetDir = join(process.cwd(), "bin");
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

    const url = `https://github.com/${REPO}/releases/download/v${VERSION}/${BIN_NAME}-${binaryTarget}${
        osName === "win32" ? ".exe" : ""
    }`;
    const destPath = join(
        targetDir,
        BIN_NAME + (osName === "win32" ? ".exe" : "")
    );

    console.log(`Downloading ${BIN_NAME} from ${url}...`);

    // Note: Since this is a postinstall script, we might not have 'axios' or 'node-fetch'
    // We'll use built-in 'https'

    const file = createWriteStream(destPath);
    https
        .get(url, (response) => {
            if (response.statusCode === 302 || response.statusCode === 301) {
                https.get(response.headers.location, (res) => {
                    res.pipe(file);
                    file.on("finish", () => {
                        file.close();
                        if (osName !== "win32") {
                            execSync(`chmod +x ${destPath}`);
                        }
                        console.log(
                            `${BIN_NAME} installed successfully at ${destPath}`
                        );
                    });
                });
            } else if (response.statusCode === 200) {
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
                file.close();
            }
        })
        .on("error", (err) => {
            console.error(`Error downloading file: ${err.message}`);
            file.close();
        });
}

install().catch(console.error);

