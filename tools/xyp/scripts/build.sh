#!/bin/bash
# *****************************************************************************
# Nehonix XyPriss Build Script - xyp
# PROFESSIONAL CROSS-PLATFORM BUILDER
# *****************************************************************************

set -e

# Base directory for the xyp tool
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
cd "$PROJECT_ROOT"

OUTPUT_DIR="$PROJECT_ROOT/dist"
mkdir -p "$OUTPUT_DIR"

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
# Format: "rust-target|output-suffix|binary-extension"
TARGETS=(
    "x86_64-unknown-linux-gnu|linux-amd64|"
    "x86_64-unknown-linux-musl|linux-amd64-musl|"
    "aarch64-unknown-linux-gnu|linux-arm64|"
    "x86_64-pc-windows-gnu|windows-amd64|.exe"
    "x86_64-apple-darwin|darwin-amd64|"
    "aarch64-apple-darwin|darwin-arm64|"
)

echo -e "${BLUE}🚀 Starting XyPriss Multi-Platform Build...${NC}\n"

# 1. Host platform build (Fastest access for local dev)
print_status "Building for host platform..."
if cargo build --release; then
    mkdir -p bin
    cp target/release/xyp bin/xyp
    print_success "Host binary saved to bin/xyp"
else
    print_error "Host build failed"
fi

# 2. Cross-platform builds
for ENTRY in "${TARGETS[@]}"; do
    IFS='|' read -r RUST_TARGET SUFFIX EXT <<< "$ENTRY"
    TARGET_FILE="xyp-${SUFFIX}${EXT}"
    DEST_PATH="$OUTPUT_DIR/$TARGET_FILE"

    echo "----------------------------------------------------"
    print_status "Building for $RUST_TARGET..."

    # On utilise --jobs 4 pour ne pas saturer le CPU/RAM en parallèle
    if RUSTFLAGS="-C link-arg=-s" cargo zigbuild --target "$RUST_TARGET" --release --jobs 4; then
        cp "target/$RUST_TARGET/release/xyp${EXT}" "$DEST_PATH"
        print_success "Successfully built and copied: $TARGET_FILE"
    else
        print_error "Failed to build for $RUST_TARGET"
        # On ne s'arrête pas pour permettre aux autres targets de finir
    fi
done

echo -e "\n${GREEN}✅ Build process finished.${NC}"
print_status "Binaries are located in: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"
