#!/bin/bash
# *****************************************************************************
# Nehonix XyPriss Build Script - xsys (System Core)
# PROFESSIONAL CROSS-PLATFORM BUILDER
# *****************************************************************************

set -e

# Base directory for the tool
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$SCRIPT_DIR"
cd "$PROJECT_ROOT"

OUTPUT_DIR="$PROJECT_ROOT/dist"
mkdir -p "$OUTPUT_DIR"

# Auto-detect zig-bin from root if exists or local
ZIG_BIN="$PROJECT_ROOT/../../tools/xyp/zig-bin"
if [ ! -d "$ZIG_BIN" ]; then
    ZIG_BIN="$PROJECT_ROOT/zig-bin"
fi

if [ -d "$ZIG_BIN" ]; then
    export PATH="$ZIG_BIN:$PATH"
fi

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }

# Targets to build
# Format: "rust-target|output-suffix|binary-extension|features"
# Note: xsys is more system-dependent (nix crate), so some targets may be limited
TARGETS=(
    "x86_64-unknown-linux-gnu|linux-amd64||"
    "x86_64-unknown-linux-musl|linux-amd64-musl||"
    "aarch64-unknown-linux-gnu|linux-arm64||"
    "x86_64-pc-windows-gnu|windows-amd64|.exe|"
    "aarch64-pc-windows-gnullvm|windows-arm64|.exe|"
    "x86_64-apple-darwin|darwin-amd64||"
    "aarch64-apple-darwin|darwin-arm64||"
)

echo -e "${BLUE}🚀 Starting XyPriss System Core (xsys) Multi-Platform Build...${NC}\n"

# 1. Host platform build
print_status "Building for host platform..."
if cargo build --release; then
    mkdir -p bin
    cp target/release/xsys bin/xsys
    print_success "Host binary saved to bin/xsys"
else
    print_error "Host build failed"
fi

# 2. Cross-platform builds
for ENTRY in "${TARGETS[@]}"; do
    IFS='|' read -r RUST_TARGET SUFFIX EXT FEATURES <<< "$ENTRY"
    TARGET_FILE="xsys-${SUFFIX}${EXT}"
    DEST_PATH="$OUTPUT_DIR/$TARGET_FILE"

    FEATURE_FLAG=""
    if [ ! -z "$FEATURES" ]; then
        FEATURE_FLAG="--features $FEATURES"
    fi

    echo "----------------------------------------------------"
    print_status "Building for $RUST_TARGET ($FEATURE_FLAG)..."

    # On utilise --jobs 4 pour ne pas saturer le CPU/RAM
    if RUSTFLAGS="-C link-arg=-s" cargo zigbuild --target "$RUST_TARGET" --release --jobs 4 $FEATURE_FLAG; then
        cp "target/$RUST_TARGET/release/xsys${EXT}" "$DEST_PATH"
        print_success "Successfully built and copied: $TARGET_FILE"
    else
        print_error "Failed to build for $RUST_TARGET"
    fi
done

echo -e "\n${GREEN}✅ Build process finished.${NC}"
print_status "Binaries are located in: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"
