#!/bin/bash
# *****************************************************************************
# Nehonix XyPriss System CLI Build Script
# 
# ACCESS RESTRICTIONS:
# - This software is exclusively for use by Authorized Personnel of NEHONIX
# - Intended for Internal Use only within NEHONIX operations
# - No rights granted to unauthorized individuals or entities
# - All modifications are works made for hire assigned to NEHONIX
#
# PROHIBITED ACTIVITIES:
# - Copying, distributing, or sublicensing without written permission
# - Reverse engineering, decompiling, or disassembling
# - Creating derivative works without explicit authorization
# - External use or commercial distribution outside NEHONIX
#
# THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
# IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
# FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
# AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
# LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
# OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
# SOFTWARE.
#
# For questions or permissions, contact:
# NEHONIX Legal Department
# Email: legal@nehonix.com
# Website: www.nehonix.com
# *****************************************************************************

set -e

APP_NAME="xsys"
BUILD_DIR="dist"
VERSION=$(git describe --tags --always 2>/dev/null || echo "v0.1.0-dev")
BUILD_TIME=$(date -u +'%Y-%m-%dT%H:%M:%SZ')
LDFLAGS="-X main.Version=$VERSION -X main.BuildTime=$BUILD_TIME -s -w"

# Parse arguments
COMPRESS=false
PARALLEL=false
for arg in "$@"; do
    case "$arg" in
        --compress) COMPRESS=true ;;
        --parallel) PARALLEL=true ;;
    esac
done

if [ "$COMPRESS" = true ]; then
    if ! command -v upx &> /dev/null; then
        echo "❌ upx command not found. Please install UPX to use the --compress flag."
        exit 1
    fi
fi

if [ "$PARALLEL" = true ] && [ "$COMPRESS" = false ]; then
    echo "⚠️  --parallel has no effect without --compress (builds are already fast)."
fi

# Create build directory
mkdir -p $BUILD_DIR

# Platforms to build for
PLATFORMS=(
    "linux/amd64"
    "linux/arm64"
    "darwin/amd64"
    "darwin/arm64"
    "windows/amd64"
    "windows/arm64"
)

echo "🚀 Starting Nehonix XyPriss System Core (Go) build..."
[ "$PARALLEL" = true ] && echo "⚡ Parallel mode enabled — builds and compressions will run concurrently."

# Holds background PIDs when running in parallel
PIDS=()
# Track failures: each job writes its platform here on error
FAILED=()

build_platform() {
    local PLATFORM="$1"
    local OS="${PLATFORM%/*}"
    local ARCH="${PLATFORM#*/}"
    local TAG="[$OS/$ARCH]"

    local OUTPUT_NAME="${APP_NAME}-${OS}-${ARCH}"
    [ "$OS" == "windows" ] && OUTPUT_NAME="${OUTPUT_NAME}.exe"

    echo "📦 $TAG Building..."
    if ! GOOS=$OS GOARCH=$ARCH go build -ldflags "$LDFLAGS" -o "${BUILD_DIR}/${OUTPUT_NAME}" ./cmd/xsys/main.go; then
        echo "❌ $TAG Build failed."
        return 1
    fi

    if [ "$COMPRESS" = true ]; then
        if [ "$OS" == "darwin" ]; then
            echo "⏭️  $TAG Skipping compression (UPX does not support macOS targets)."
        else
            echo "🗜️  $TAG Compressing with UPX..."
            if ! upx --best "${BUILD_DIR}/${OUTPUT_NAME}"; then
                echo "❌ $TAG Compression failed."
                return 1
            fi
        fi
    fi

    echo "✅ $TAG Done → ${BUILD_DIR}/${OUTPUT_NAME}"
}

if [ "$PARALLEL" = true ]; then
    # Launch all platforms in background
    for PLATFORM in "${PLATFORMS[@]}"; do
        build_platform "$PLATFORM" &
        PIDS+=($!)
    done

    # Wait for all jobs and collect failures
    FAIL=0
    for i in "${!PIDS[@]}"; do
        if ! wait "${PIDS[$i]}"; then
            FAILED+=("${PLATFORMS[$i]}")
            FAIL=1
        fi
    done

    if [ $FAIL -ne 0 ]; then
        echo ""
        echo "❌ Some builds failed: ${FAILED[*]}"
        exit 1
    fi
else
    for PLATFORM in "${PLATFORMS[@]}"; do
        build_platform "$PLATFORM"
    done
fi

echo ""
echo "✨ All builds complete! Binaries are in the '$BUILD_DIR' directory."