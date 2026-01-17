const { execSync } = require("child_process");
const fs = require("fs");
const path = require("path");
const os = require("os");

// *****************************************************************************
// Nehonix XyPriss Git Release Builder
// *****************************************************************************

const BIN_NAME = "xyp";
const PROJECT_ROOT = path.dirname(__dirname);
const OUTPUT_DIR = path.join(PROJECT_ROOT, "dist");
const BIN_DIR = path.join(PROJECT_ROOT, "bin");

const TARGETS = [
    {
        target: "x86_64-unknown-linux-gnu",
        suffix: "linux-amd64",
        ext: "",
        features: "mimalloc",
    },
    {
        target: "x86_64-unknown-linux-musl",
        suffix: "linux-amd64-musl",
        ext: "",
        features: "mimalloc",
    },
    {
        target: "aarch64-unknown-linux-gnu",
        suffix: "linux-arm64",
        ext: "",
        features: "mimalloc",
    },
    {
        target: "x86_64-apple-darwin",
        suffix: "darwin-amd64",
        ext: "",
        features: "",
    },
    {
        target: "aarch64-apple-darwin",
        suffix: "darwin-arm64",
        ext: "",
        features: "",
    },
    {
        target: "x86_64-pc-windows-gnu",
        suffix: "windows-amd64",
        ext: ".exe",
        features: "mimalloc",
    },
];

const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    green: "\x1b[32m",
    blue: "\x1b[34m",
};
function print_status(msg) {
    console.log(`${colors.blue}[INFO]${colors.reset} ${msg}`);
}
function print_success(msg) {
    console.log(`${colors.green}[SUCCESS]${colors.reset} ${msg}`);
}
function print_error(msg) {
    console.log(`${colors.red}[ERROR]${colors.reset} ${msg}`);
}

if (!fs.existsSync(OUTPUT_DIR)) fs.mkdirSync(OUTPUT_DIR, { recursive: true });
if (!fs.existsSync(BIN_DIR)) fs.mkdirSync(BIN_DIR, { recursive: true });

const ZIG_BIN = path.join(PROJECT_ROOT, "zig-bin");
const customEnv = { ...process.env, RUSTFLAGS: "-C link-arg=-s" };
if (fs.existsSync(ZIG_BIN)) {
    customEnv.PATH = `${ZIG_BIN}${path.delimiter}${process.env.PATH}`;
}

print_status("🚀 Starting Release Build process...");

for (const { target, suffix, ext, features } of TARGETS) {
    const targetFile = `${BIN_NAME}-${suffix}${ext}`;
    const destPath = path.join(OUTPUT_DIR, targetFile);

    print_status(`Building ${targetFile}...`);

    try {
        const featureFlag = features
            ? `--features ${features}`
            : "--no-default-features";
        // On limite les JOBS pour éviter de saturer la RAM sur les grosses cibles
        execSync(
            `cargo zigbuild --release --target ${target} ${featureFlag} --jobs 4`,
            {
                stdio: "inherit",
                env: customEnv,
            },
        );

        const buildArtifact = path.join(
            PROJECT_ROOT,
            "target",
            target,
            "release",
            `${BIN_NAME}${ext}`,
        );
        if (fs.existsSync(buildArtifact)) {
            fs.copyFileSync(buildArtifact, destPath);
            print_success(`Built: ${targetFile}`);
        }
    } catch (e) {
        print_error(`Failed ${target}.`);
    }
}

print_success("\n✅ RELEASE READY. Binaries are in: " + OUTPUT_DIR);

