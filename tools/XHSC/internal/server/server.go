/* *****************************************************************************
 * Nehonix XyPriss System CLI
 *
 * ACCESS RESTRICTIONS:
 * - This software is exclusively for use by Authorized Personnel of NEHONIX
 * - Intended for Internal Use only within NEHONIX operations
 * - No rights granted to unauthorized individuals or entities
 * - All modifications are works made for hire assigned to NEHONIX
 *
 * PROHIBITED ACTIVITIES:
 * - Copying, distributing, or sublicensing without written permission
 * - Reverse engineering, decompiling, or disassembling
 * - Creating derivative works without explicit authorization
 * - External use or commercial distribution outside NEHONIX
 *
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
 * IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
 * FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
 * AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
 * LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
 * OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
 * SOFTWARE.
 *
 * For questions or permissions, contact:
 * NEHONIX Legal Department
 * Email: legal@nehonix.com
 * Website: www.nehonix.com
 ***************************************************************************** */

package server

import (
	"fmt"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"regexp"
	"strings"
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/XHSC/internal/cluster"
	"github.com/Nehonix-Team/XyPriss/tools/XHSC/internal/ipc"
	"github.com/Nehonix-Team/XyPriss/tools/XHSC/internal/proxy"
	"github.com/Nehonix-Team/XyPriss/tools/XHSC/internal/router"
)

func StartServer(
	host string,
	port uint16,
	ipcPath string,
	timeoutSec uint64,
	maxBodySize int64,
	clusterEnabled bool,
	clusterWorkers int,
	clusterRespawn bool,
	entryPoint string,
	clusterStrategy string,
	clusterPriority int,
	fileDescriptorLimit int,
	gcHint bool,
	memCheckInterval int,
	enforceHardLimits bool,
	maxUrlLength int,
	intelligenceEnabled bool,
	preAllocate bool,
	rescueMode bool,
	clusterMaxMemory int,
	clusterMaxCPU int,
	perfCompression bool,
	perfCompressionAlgs []string,
	perfBatchSize int,
	perfConnectionPooling bool,
	proxyUpstreams []string,
	proxyStrategy string,
	trustProxy []string,
	rateLimitEnabled bool,
	rateLimitMax int,
	rateLimitWindow int,
	rateLimitMessage string,
	rateLimitHeaders bool,
	rateLimitLegacyHeaders bool,
	rateLimitExclude []string,
	maxConcurrentReqs int,
	maxPerIP int,
	maxQueueSize int,
	queueTimeout int,
	qualityEnabled bool,
	qualityRejectPoor bool,
	qualityMinBW int,
	qualityMaxLat int,
	breakerEnabled bool,
	breakerThreshold uint32,
	breakerTimeout uint64,
	retryMax int,
	retryDelay int,
	// New Intensive Network Flags
	compressionLevel int,
	compressionThreshold int,
	compressionTypes []string,
	http2MaxStreams uint32,
	keepAliveTimeout int,
	keepAliveMaxReqs int,
	poolTimeout int,
	poolIdleTimeout int,
	proxyHCEnabled bool,
	proxyHCInterval int,
	proxyHCTimeout int,
	proxyHCPath string,
	proxyHCUnhealthy int,
	proxyHCHealthy int,
	firewallEnabled bool,
	firewallAutoOpen bool,
	firewallAllowed []string,
	// File Upload Flags
	uploadDir string,
	uploadTempDir string,
	uploadUseTempFiles bool,
	uploadMaxFileSize int64,
	uploadAllowedMimes []string,
	uploadMaxFiles int,
	uploadUseSubDir bool,
	pluginPaths []string,
	projectRoot string,
) error {
	log.SetOutput(os.Stdout)
	log.Printf("Initializing Version XHSC_DEBUG_V1") // 04/15/2026

	PerformDeepAudit(projectRoot, pluginPaths)

	sharedRouter := router.NewXyRouter()
	
	if perfCompression {
		for _, alg := range perfCompressionAlgs {
			alg = strings.TrimSpace(alg)
			if alg != "gzip" && alg != "br" && alg != "deflate" && alg != "zstd" {
				return fmt.Errorf("unsupported compression algorithm: %s (supported: gzip, br, deflate, zstd)", alg)
			}
		} 
	}
	
	clusterConfig := &cluster.ClusterConfig{
		Workers:             clusterWorkers,
		Respawn:             clusterRespawn,
		IpcPath:             ipcPath,
		EntryPoint:          entryPoint,
		MaxMemory:           clusterMaxMemory,
		MaxCPU:              clusterMaxCPU,
		Strategy:            cluster.BalancingStrategy(clusterStrategy),
		Priority:            clusterPriority,
		FileDescriptorLimit: uint64(fileDescriptorLimit),
		GCHint:              gcHint,
		MemoryCheckInterval: uint64(memCheckInterval),
		EnforceHardLimits:   enforceHardLimits,
		IntelligenceEnabled: intelligenceEnabled,
		PreAllocate:         preAllocate,
		RescueMode:          rescueMode,
	}

	intelligenceManager := cluster.NewIntelligenceManager(clusterConfig)
	
	var ipcBridge *ipc.IpcBridge
	if ipcPath != "" {
		ipcBridge = ipc.NewIpcBridge(ipcPath, timeoutSec)
		ipcBridge.Router = sharedRouter
		ipcBridge.BatchSize = perfBatchSize
		go func() {
			for range intelligenceManager.GCNotify {
				log.Printf("[IPC] Broadcasting ForceGC to all workers")
				ipcBridge.Broadcast(ipc.IpcMessage{
					Type: ipc.MsgTypeForceGC,
				})
			}
		}()
	}

	var clusterManager *cluster.ClusterManager
	if clusterEnabled && entryPoint != "" {
		clusterManager = cluster.NewClusterManager(clusterConfig)
		clusterManager.Intelligence = intelligenceManager
	}

	if ipcBridge != nil {
		if err := ipcBridge.StartServer(); err != nil {
			return fmt.Errorf("failed to start IPC server: %w", err)
		}
	}

	if clusterManager != nil {
		if err := clusterManager.Start(); err != nil {
			log.Printf("Failed to start cluster manager: %v", err)
		}
	}

	var proxyManager *proxy.ProxyManager
	if len(proxyUpstreams) > 0 {
		pcfg := proxy.ProxyConfig{
			Upstreams:           proxyUpstreams,
			Strategy:            proxyStrategy,
			HealthCheck:         proxyHCEnabled,
			HealthCheckPath:     proxyHCPath,
			HealthCheckInterval: time.Duration(proxyHCInterval) * time.Millisecond,
			HealthCheckTimeout:  time.Duration(proxyHCTimeout) * time.Millisecond,
		}
		if perfConnectionPooling {
			pcfg.DialTimeout = time.Duration(poolTimeout) * time.Millisecond
			pcfg.IdleConnTimeout = time.Duration(poolIdleTimeout) * time.Millisecond
		}

		var err error
		proxyManager, err = proxy.NewProxyManager(pcfg)
		if err != nil {
			log.Printf("Failed to initialize proxy: %v", err)
		} else {
			log.Printf("Proxy initialized with %d upstreams", len(proxyUpstreams))
		}
	}

	state := &ServerState{
		Router:       sharedRouter,
		Ipc:          ipcBridge,
		Root:         ".",
		Metrics:      &MetricsCollector{},
		MaxBodySize:  maxBodySize,
		TimeoutSec:   timeoutSec,
		MaxUrlLength: maxUrlLength,
		Intelligence: intelligenceManager,
		Proxy:        proxyManager,
	}

	state.Performance.Compression = perfCompression
	state.Performance.CompressionAlgs = perfCompressionAlgs
	state.Performance.CompressionLevel = compressionLevel
	state.Performance.CompressionMinSize = compressionThreshold
	state.Performance.CompressionTypes = compressionTypes
	state.Performance.BatchSize = perfBatchSize
	state.Performance.ConnectionPooling = perfConnectionPooling
	state.Performance.PoolTimeout = time.Duration(poolTimeout) * time.Millisecond
	state.Performance.PoolIdleTimeout = time.Duration(poolIdleTimeout) * time.Millisecond

	state.Connection.HTTP2MaxConcurrent = http2MaxStreams
	state.Connection.KeepAliveTimeout = time.Duration(keepAliveTimeout) * time.Millisecond
	state.Connection.KeepAliveMaxReqs = keepAliveMaxReqs

	state.Firewall.Enabled = firewallEnabled
	state.Firewall.AutoOpen = firewallAutoOpen
	state.Firewall.Allowed = firewallAllowed

	if firewallEnabled && firewallAutoOpen {
		go state.autoConfigureFirewall(port)
	}

	state.TrustProxy = trustProxy
	state.RateLimit.Enabled = rateLimitEnabled
	state.RateLimit.Max = rateLimitMax
	state.RateLimit.Window = time.Duration(rateLimitWindow) * time.Millisecond
	state.RateLimit.Message = rateLimitMessage
	state.RateLimit.StandardHeaders = rateLimitHeaders
	state.RateLimit.LegacyHeaders = rateLimitLegacyHeaders
	state.RateLimit.ExcludePaths = rateLimitExclude

	state.Concurrency.MaxConcurrent = maxConcurrentReqs
	state.Concurrency.MaxPerIP = maxPerIP
	state.Concurrency.MaxQueueSize = maxQueueSize
	state.Concurrency.QueueTimeout = time.Duration(queueTimeout) * time.Millisecond

	state.Quality.Enabled = qualityEnabled
	state.Quality.RejectPoor = qualityRejectPoor
	state.Quality.MinBW = qualityMinBW
	state.Quality.MaxLat = qualityMaxLat

	state.Resilience.BreakerEnabled = breakerEnabled
	state.Resilience.BreakerThreshold = breakerThreshold
	state.Resilience.BreakerTimeout = time.Duration(breakerTimeout) * time.Second
	state.Resilience.RetryMax = retryMax
	state.Resilience.RetryDelay = time.Duration(retryDelay) * time.Millisecond

	state.FileUpload.Dir = uploadDir
	if state.FileUpload.Dir == "" {
		state.FileUpload.Dir = "uploads"
	}

	if uploadTempDir != "" {
		state.FileUpload.TempDir = uploadTempDir
		if err := os.MkdirAll(uploadTempDir, 0755); err != nil {
			log.Printf("[ERROR] Failed to create specified upload-temp-dir: %v", err)
		}
	} else {
		tmpDir := filepath.Join(XyprissTempDir, "uploads")
		if err := os.MkdirAll(tmpDir, 0755); err != nil {
			tmpDir = os.TempDir() // fallback sur le répertoire temp parent
		}
		state.FileUpload.TempDir = tmpDir
	}

	state.FileUpload.UseTempFiles = uploadUseTempFiles
	state.FileUpload.MaxFileSize = uploadMaxFileSize
	
	// Normalize allowed MIME types (strip charset/parameters)
	normalizedMimes := make([]string, 0, len(uploadAllowedMimes))
	for _, m := range uploadAllowedMimes {
		pure, _, _ := mime.ParseMediaType(m)
		if pure != "" {
			normalizedMimes = append(normalizedMimes, pure)
		} else {
			normalizedMimes = append(normalizedMimes, strings.ToLower(strings.TrimSpace(m)))
		}
	}
	state.FileUpload.AllowedMimes = normalizedMimes
	
	state.FileUpload.MaxFiles = uploadMaxFiles
	state.FileUpload.UseSubDir = uploadUseSubDir

	for _, exclude := range rateLimitExclude {
		if strings.HasPrefix(exclude, "RE:") {
			pattern := exclude[3:]
			re, err := regexp.Compile(pattern)
			if err == nil {
				state.RateLimit.CompiledExclude = append(state.RateLimit.CompiledExclude, re)
			} else {
				log.Printf("[WARN] Failed to compile rate limit exclude regex '%s': %v", pattern, err)
			}
		}
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/_xypriss/b/status", state.statusHandler)
	mux.HandleFunc("/_xypriss/b/health", state.healthHandler)
	mux.HandleFunc("/", state.fallbackHandler)

	addr := fmt.Sprintf("%s:%d", host, port)
	
	var handler http.Handler = mux
	if qualityEnabled {
		handler = QualityMiddleware(handler, state)
	}
	if maxConcurrentReqs > 0 || maxPerIP > 0 {
		handler = ConcurrencyMiddleware(handler, state)
	}
	if rateLimitEnabled {
		handler = RateLimitMiddleware(handler, state)
	}
	if perfCompression {
		handler = CompressionMiddleware(handler, state)
	}

	server := &http.Server{
		Addr:         addr,
		Handler:      handler,
		ReadTimeout:  time.Duration(timeoutSec) * time.Second,
		WriteTimeout: time.Duration(timeoutSec) * time.Second,
	}

	log.Printf("XHSC Edition listening on http://%s", addr)
	return server.ListenAndServe()
}
