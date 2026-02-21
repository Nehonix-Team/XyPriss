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

for PLATFORM in "${PLATFORMS[@]}"; do
    OS="${PLATFORM%/*}"
    ARCH="${PLATFORM#*/}"
    
    OUTPUT_NAME="${APP_NAME}-${OS}-${ARCH}"
    if [ "$OS" == "windows" ]; then
        OUTPUT_NAME="${OUTPUT_NAME}.exe"
    fi
    
    echo "📦 Building for $OS/$ARCH..."
    
    GOOS=$OS GOARCH=$ARCH go build -ldflags "$LDFLAGS" -o "${BUILD_DIR}/${OUTPUT_NAME}" ./cmd/xsys/main.go
    
    echo "✅ Finished $OUTPUT_NAME"
done

echo "✨ All builds complete! Binaries are in the '$BUILD_DIR' directory."
