#!/bin/bash
# *****************************************************************************
# Nehonix XyPriss Build Script - xsys
# *****************************************************************************

set -e

PROJECT_ROOT=$(pwd)
OUTPUT_DIR="$PROJECT_ROOT/dist"
BIN_NAME="xsys"

echo "Building XyPriss System CLI ($BIN_NAME)..."

# Ensure output directory exists
mkdir -p "$OUTPUT_DIR"
mkdir -p "$PROJECT_ROOT/bin"

# Build for current platform (Host)
echo "Building for host platform..."
cargo build --release

# Copy host binary to dist and bin
if [ -f "target/release/$BIN_NAME" ]; then
    cp "target/release/$BIN_NAME" "$OUTPUT_DIR/$BIN_NAME"
    cp "target/release/$BIN_NAME" "$PROJECT_ROOT/bin/$BIN_NAME"
    echo "Successfully built and copied $BIN_NAME to dist/ and bin/"
else
    echo "Error: Host binary not found at target/release/$BIN_NAME"
    exit 1
fi

echo "Build process completed."
