#!/bin/bash
# *****************************************************************************
# Nehonix XyPriss Build Script - xsys
# PROFESSIONAL CROSS-PLATFORM BUILDER (Matching XyPCLI patterns with UPX)
# *****************************************************************************

set -e

PROJECT_ROOT=$(pwd)
OUTPUT_DIR="$PROJECT_ROOT/dist"
BIN_NAME="xsys"

# Colors for output
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

print_status() { echo -e "${BLUE}[INFO]${NC} $1"; }
print_success() { echo -e "${GREEN}[SUCCESS]${NC} $1"; }
print_warning() { echo -e "${YELLOW}[WARNING]${NC} $1"; }
print_error() { echo -e "${RED}[ERROR]${NC} $1"; }

echo "🚀 Building XyPriss System CLI ($BIN_NAME)..."

mkdir -p "$OUTPUT_DIR"
mkdir -p "$PROJECT_ROOT/bin"

# Mapping targets to XyPriss standard names
# Format: "rust-target|output-suffix|binary-extension"
TARGET_MAP=(
    "x86_64-unknown-linux-gnu|linux-amd64|"
    "x86_64-unknown-linux-musl|linux-amd64-musl|"
    "aarch64-unknown-linux-gnu|linux-arm64|"
    "x86_64-pc-windows-gnu|windows-amd64|.exe"
    "x86_64-apple-darwin|darwin-amd64|"
    "aarch64-apple-darwin|darwin-arm64|"
)

compress_binary() {
    local FILE=$1
    if command -v upx &> /dev/null; then
        print_status "Compressing $FILE with UPX..."
        upx --best "$FILE" 
    else
        print_warning "UPX not found, skipping compression"
    fi
}

build_standard_target() {
    local ENTRY=$1
    IFS='|' read -r RUST_TARGET SUFFIX EXT <<< "$ENTRY"
    local TARGET_FILE="${BIN_NAME}-${SUFFIX}${EXT}"
    local DEST_PATH="$OUTPUT_DIR/$TARGET_FILE"
    
    print_status "Building for $RUST_TARGET ($TARGET_FILE)..."
    
    # Try to build
    # Using LDFLAGS equivalent for Rust (stripping symbols)
    if RUSTFLAGS="-C link-arg=-s" cargo build --release --target "$RUST_TARGET" 2>/dev/null; then
        cp "target/$RUST_TARGET/release/${BIN_NAME}${EXT}" "$DEST_PATH"
        print_success "Successfully built: $TARGET_FILE"
        compress_binary "$DEST_PATH"
    else
        print_warning "Could not build for $RUST_TARGET. (Linker missing?)"
    fi
}

print_status "Building host platform..."
# Build host version with stripping
if RUSTFLAGS="-C link-arg=-s" cargo build --release; then
    cp "target/release/$BIN_NAME" "$PROJECT_ROOT/bin/$BIN_NAME"
    
    HOST_OS=$(uname -s | tr '[:upper:]' '[:lower:]')
    HOST_ARCH=$(uname -m)
    if [[ "$HOST_ARCH" == "x86_64" ]]; then HOST_ARCH="amd64"; fi
    if [[ "$HOST_ARCH" == "aarch64" ]]; then HOST_ARCH="arm64"; fi
    
    HOST_DIST_PATH="$OUTPUT_DIR/${BIN_NAME}-${HOST_OS}-${HOST_ARCH}"
    cp "target/release/$BIN_NAME" "$HOST_DIST_PATH"
    
    print_success "Host binary saved to bin/ and dist/"
    compress_binary "$HOST_DIST_PATH"
    # Also compress the local bin for tests
    compress_binary "$PROJECT_ROOT/bin/$BIN_NAME"
else
    print_error "Failed to build host platform"
    exit 1
fi

for ENTRY in "${TARGET_MAP[@]}"; do
    # Skip host target if we already built it via host platform logic to avoid duplication
    # but for simplicity and correct naming we'll let it run or filter it.
    IFS='|' read -r RUST_TARGET SUFFIX EXT <<< "$ENTRY"
    # Actually, build_target logic handles the suffixing correctly, so we'll just let it run.
    build_standard_target "$ENTRY"
done

echo ""
print_success "✅ Build process finished."
echo "Final binaries located in: $OUTPUT_DIR"
ls -lh "$OUTPUT_DIR"
