# Cross-Platform Memory Detection

XyPriss uses a sophisticated cross-platform memory detection system to provide accurate memory information across all operating systems.

## Architecture

### 1. **Go CLI Binary** (Primary Method)
- **Location**: Downloaded to `bin/` directory during installation
- **Accuracy**: Highest - uses native OS APIs
- **Platforms**: Linux, macOS, Windows (x64 and ARM64)
- **Size**: ~3MB per binary

### 2. **Node.js Fallback** (Secondary Method)
- **Trigger**: When Go CLI is unavailable
- **Accuracy**: Good on Linux (uses `/proc/meminfo`), limited on other platforms
- **Platforms**: All Node.js supported platforms
- **Size**: No additional overhead

## Installation Process

### Automatic Installation (Recommended)
```bash
npm install xypriss
# Automatically downloads platform-specific binary during postinstall
```

### Manual Installation
```bash
npm run install-memory-cli
# Downloads binary for current platform
```

### Skip Binary Download
```bash
CI=true npm install
# or
SKIP_BINARY_DOWNLOAD=true npm install
```

## Binary Distribution

### CDN Hosting
- **Base URL**: `https://sdk.nehonix.space/dl/mds/xypriss/bin/`
- **Binaries**:
  - `memory-cli-linux-x64`
  - `memory-cli-darwin-x64`
  - `memory-cli-darwin-arm64`
  - `memory-cli-windows-x64.exe`
  - `memory-cli-windows-arm64.exe`

### Platform Detection
```javascript
const platform = process.platform; // 'linux', 'darwin', 'win32'
const arch = process.arch;         // 'x64', 'arm64'
```

## Memory Information Provided

### Go CLI Output (JSON)
```json
{
  "platform": "linux",
  "totalMemory": 8080842752,
  "availableMemory": 2674950144,    // Available for applications
  "freeMemory": 610963456,          // Truly free memory
  "usedMemory": 5405892608,
  "usagePercentage": 66.9,
  "buffersMemory": 72757248,        // Linux/Unix only
  "cachedMemory": 3027869696,       // Linux/Unix only
  "swapTotal": 8334077952,
  "swapUsed": 1614811136,
  "swapFree": 6719266816
}
```

### Platform-Specific Details

#### Linux
- **Source**: `/proc/meminfo`
- **Key Metric**: `MemAvailable` (includes freeable buffers/cache)
- **Accuracy**: Excellent

#### macOS
- **Source**: `vm_stat` + `sysctl`
- **Key Metric**: Free + Inactive + Speculative pages
- **Accuracy**: Very Good

#### Windows
- **Source**: `wmic` + Performance Counters
- **Key Metric**: Available Bytes counter
- **Accuracy**: Very Good

## Usage in Code

### Basic Usage
```typescript
import { CrossPlatformMemory } from './src/cluster/modules/CrossPlatformMemory';

const memory = new CrossPlatformMemory(true); // Enable fallback
const info = await memory.getMemoryInfo();

console.log(`Available: ${CrossPlatformMemory.formatMemory(info.availableMemory)}`);
```

### Integration with MemoryManager
```typescript
// Automatically used by MemoryManager
const memoryManager = new MemoryManager(config);
const stats = await memoryManager.getSystemMemoryStats();
```

## Troubleshooting

### Binary Not Found
```
Memory CLI binary not found. Searched:
  - /path/to/bin/memory-cli-linux-x64
  - /path/to/bin/memory-cli
  - /path/to/tools/memory-cli/../../bin/memory-cli-linux-x64
Run 'npm run install-memory-cli' or use fallback mode.
```

**Solutions**:
1. Run `npm run install-memory-cli`
2. Check internet connectivity
3. Verify CDN accessibility
4. Use fallback mode (automatic)

### Permission Issues
```bash
chmod +x bin/memory-cli-*
```

### CI/CD Environments
Set `CI=true` or `SKIP_BINARY_DOWNLOAD=true` to skip binary download and use fallback mode.

## Performance Comparison

| Method | Linux | macOS | Windows | Accuracy | Speed |
|--------|-------|-------|---------|----------|-------|
| Go CLI | ✅ Excellent | ✅ Excellent | ✅ Excellent | 95%+ | Fast |
| Node.js + /proc | ✅ Very Good | ❌ Limited | ❌ Limited | 90% | Fast |
| Node.js os.freemem() | ⚠️ Poor | ⚠️ Poor | ⚠️ Poor | 60% | Fast |

## Memory Detection Accuracy

### Before (Node.js only)
```
Available: 546 MB (from os.freemem())
Actual Available: 2.9 GB (from /proc/meminfo)
Error: 81% underreporting
```

### After (Go CLI)
```
Available: 2.67 GB (from Go CLI)
Actual Available: 2.9 GB (from /proc/meminfo)
Error: <8% variance
```

## Build Process

### Local Development
```bash
cd tools/memory-cli
./build.sh
```

### Cross-Platform Builds
```bash
# Linux
GOOS=linux GOARCH=amd64 go build -o memory-cli-linux-x64

# macOS
GOOS=darwin GOARCH=amd64 go build -o memory-cli-darwin-x64
GOOS=darwin GOARCH=arm64 go build -o memory-cli-darwin-arm64

# Windows
GOOS=windows GOARCH=amd64 go build -o memory-cli-windows-x64.exe
GOOS=windows GOARCH=arm64 go build -o memory-cli-windows-arm64.exe
```

## Security Considerations

1. **Binary Verification**: CLI includes `--help` verification
2. **CDN Security**: HTTPS-only downloads
3. **Fallback Safety**: Graceful degradation to Node.js methods
4. **No Elevation**: No admin/root privileges required

## Future Enhancements

1. **Binary Signing**: Code signing for enhanced security
2. **Compression**: Reduce binary sizes with UPX
3. **Caching**: Local cache for repeated downloads
4. **Auto-Updates**: Automatic binary updates
