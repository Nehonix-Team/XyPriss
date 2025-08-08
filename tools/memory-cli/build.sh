#!/bin/bash

# Build script for cross-platform memory CLI
set -e

echo "Building XyPriss Memory CLI..."

# Create output directory
mkdir -p ../../bin

# Build for current platform
echo "Building for current platform..."
go build -o ../../bin/memory-cli main.go

# Build for all platforms
echo "Building for Linux x64..."
GOOS=linux GOARCH=amd64 go build -o ../../bin/memory-cli-linux-x64 main.go

echo "Building for macOS x64..."
GOOS=darwin GOARCH=amd64 go build -o ../../bin/memory-cli-darwin-x64 main.go

echo "Building for macOS ARM64..."
GOOS=darwin GOARCH=arm64 go build -o ../../bin/memory-cli-darwin-arm64 main.go

echo "Building for Windows x64..."
GOOS=windows GOARCH=amd64 go build -o ../../bin/memory-cli-windows-x64.exe main.go

echo "Building for Windows ARM64..."
GOOS=windows GOARCH=arm64 go build -o ../../bin/memory-cli-windows-arm64.exe main.go

echo "Build complete! Binaries available in bin/ directory:"
ls -la ../../bin/memory-cli*

echo ""
echo "Testing current platform binary..."
../../bin/memory-cli
