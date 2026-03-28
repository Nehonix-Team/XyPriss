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
	"compress/gzip"
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"os/exec"
	"path/filepath"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"compress/zlib"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/cluster"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/ipc"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/proxy"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/router"
	"github.com/google/uuid"
	"github.com/tomasen/realip"
	"github.com/ulule/limiter/v3"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

type ServerState struct {
	Router       *router.XyRouter
	Ipc          *ipc.IpcBridge
	Root         string
	Metrics      *MetricsCollector
	MaxBodySize  int64
	TimeoutSec   uint64
	MaxUrlLength int
	Intelligence *cluster.IntelligenceManager
	Performance  struct {
		Compression       bool
		CompressionAlgs    []string
		CompressionLevel   int
		CompressionMinSize int
		CompressionTypes   []string
		BatchSize         int
		ConnectionPooling bool
		PoolTimeout       time.Duration
		PoolIdleTimeout   time.Duration
	}
	Connection struct {
		HTTP2MaxConcurrent uint32
		KeepAliveTimeout   time.Duration
		KeepAliveMaxReqs   int
	}
	Proxy *proxy.ProxyManager
	Firewall struct {
		Enabled  bool
		AutoOpen bool
		Allowed  []string
	}
	TrustProxy []string
	RateLimit  struct {
		Enabled         bool
		Strategy        string // fixed-window, sliding-window, token-bucket
		Max             int
		Window          time.Duration
		Message         string
		StandardHeaders bool
		LegacyHeaders   bool
		ExcludePaths    []string
		CompiledExclude []*regexp.Regexp
	}
	Concurrency struct {
		MaxConcurrent  int
		MaxPerIP       int
		MaxQueueSize   int
		QueueTimeout   time.Duration
		ActiveRequests int32
		IPMap          sync.Map // map[string]*int32
	}
	Resilience struct {
		BreakerEnabled   bool
		BreakerThreshold uint32
		BreakerTimeout   time.Duration
		RetryMax         int
		RetryDelay       time.Duration
		BreakerFailures  int32
		BreakerOpenUntil time.Time
		BreakerMutex     sync.RWMutex
	}
	Quality struct {
		Enabled    bool
		RejectPoor bool
		MinBW      int
		MaxLat     int
	}
}
func RateLimitMiddleware(next http.Handler, s *ServerState) http.Handler {
	rate := limiter.Rate{
		Period: s.RateLimit.Window,
		Limit:  int64(s.RateLimit.Max),
	}
	store := memory.NewStore()
	lmt := limiter.New(store, rate)

	var msg []byte
	contentType := "application/json; charset=utf-8"

	rawMsg := s.RateLimit.Message
	if rawMsg == "" {
		msg = []byte("{\"error\": \"Too many requests. Rate limit exceeded (XHSC).\"}")
	} else {
		// Detect if it's JSON (starts with { or [)
		trimmed := strings.TrimSpace(rawMsg)
		if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
			msg = []byte(rawMsg)
		} else {
			msg = []byte(fmt.Sprintf("{\"error\": \"%s\"}", strings.ReplaceAll(rawMsg, "\"", "\\\"")))
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.RateLimit.Enabled {
			next.ServeHTTP(w, r)
			return
		}

		// Check ExcludePaths
		path := r.URL.Path
		for _, re := range s.RateLimit.CompiledExclude {
			if re.MatchString(path) {
				next.ServeHTTP(w, r)
				return
			}
		}
		for _, exclude := range s.RateLimit.ExcludePaths {
			if exclude != "" && !strings.HasPrefix(exclude, "RE:") {
				if path == exclude || strings.HasPrefix(path, exclude) {
					next.ServeHTTP(w, r)
					return
				}
			}
		}

		ip := s.extractRealIP(r)

		context, err := lmt.Get(r.Context(), ip)
		if err != nil {
			log.Printf("[ERROR] Rate limit check failed: %v", err)
			next.ServeHTTP(w, r)
			return
		}

		if s.RateLimit.StandardHeaders {
			w.Header().Set("RateLimit-Limit", fmt.Sprintf("%d", context.Limit))
			w.Header().Set("RateLimit-Remaining", fmt.Sprintf("%d", context.Remaining))
			resetDelta := context.Reset - time.Now().Unix()
			if resetDelta < 0 {
				resetDelta = 0
			}
			w.Header().Set("RateLimit-Reset", fmt.Sprintf("%d", resetDelta))
		}

		if s.RateLimit.LegacyHeaders {
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", context.Limit))
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", context.Remaining))
			w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", context.Reset))
		}

		if context.Reached {
			w.Header().Set("Content-Type", contentType)
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write(msg)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func ConcurrencyMiddleware(next http.Handler, s *ServerState) http.Handler {
	var semaphore chan struct{}
	if s.Concurrency.MaxConcurrent > 0 {
		semaphore = make(chan struct{}, s.Concurrency.MaxConcurrent)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.Concurrency.MaxConcurrent <= 0 && s.Concurrency.MaxPerIP <= 0 {
			next.ServeHTTP(w, r)
			return
		}

		ip := s.extractRealIP(r)

		// 1. Per-IP Limit
		if s.Concurrency.MaxPerIP > 0 {
			val, _ := s.Concurrency.IPMap.LoadOrStore(ip, new(int32))
			ipCounter := val.(*int32)
			if atomic.LoadInt32(ipCounter) >= int32(s.Concurrency.MaxPerIP) {
				http.Error(w, "Too many concurrent requests from your IP (XHSC)", http.StatusTooManyRequests)
				return
			}
			atomic.AddInt32(ipCounter, 1)
			defer atomic.AddInt32(ipCounter, -1)
		}

		// 2. Global Limit with Queue
		if semaphore != nil {
			active := atomic.AddInt32(&s.Concurrency.ActiveRequests, 1)
			defer atomic.AddInt32(&s.Concurrency.ActiveRequests, -1)

			if s.Concurrency.MaxQueueSize > 0 && int(active) > s.Concurrency.MaxConcurrent+s.Concurrency.MaxQueueSize {
				http.Error(w, "Server too busy (Queue full - XHSC)", http.StatusServiceUnavailable)
				return
			}

			timeout := s.Concurrency.QueueTimeout
			if timeout == 0 {
				timeout = 30 * time.Second
			}

			// Try non-blocking first
			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			default:
				// Must wait
				timer := time.NewTimer(timeout)
				defer timer.Stop()

				select {
				case semaphore <- struct{}{}:
					defer func() { <-semaphore }()
				case <-timer.C:
					http.Error(w, "Request timed out in queue (XHSC)", http.StatusServiceUnavailable)
					return
				case <-r.Context().Done():
					return
				}
			}
		}

		next.ServeHTTP(w, r)
	})
}

type qualityResponseWriter struct {
	http.ResponseWriter
	bytesSent int64
	startTime time.Time
	status    int
}

func (w *qualityResponseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *qualityResponseWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytesSent += int64(n)
	return n, err
}

func QualityMiddleware(next http.Handler, s *ServerState) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.Quality.Enabled {
			next.ServeHTTP(w, r)
			return
		}

		startTime := time.Now()
		qw := &qualityResponseWriter{
			ResponseWriter: w,
			startTime:      startTime,
			status:         http.StatusOK,
		}

		next.ServeHTTP(qw, r)

		duration := time.Since(startTime)
		
		// Enforce Max Latency
		if s.Quality.MaxLat > 0 && duration > time.Duration(s.Quality.MaxLat)*time.Millisecond {
			log.Printf("[WARN] Request exceeded max latency: %v > %dms", duration, s.Quality.MaxLat)
			if s.Quality.RejectPoor && qw.status < 400 {
				// Too late to change status if headers already sent, 
				// but we can log it or close the connection if it was a stream.
			}
		}

		// Enforce Min Bandwidth (bytes/sec)
		if s.Quality.MinBW > 0 && duration.Seconds() > 1 {
			bw := float64(qw.bytesSent) / duration.Seconds()
			if bw < float64(s.Quality.MinBW) {
				log.Printf("[WARN] Request bandwidth too low: %.2f B/s < %d B/s", bw, s.Quality.MinBW)
			}
		}
	})
}

type MetricsCollector struct {
	RequestsTotal uint64
	ErrorsTotal   uint64
}

func (m *MetricsCollector) IncrementRequests() {
	atomic.AddUint64(&m.RequestsTotal, 1)
}

func (m *MetricsCollector) IncrementErrors() {
	atomic.AddUint64(&m.ErrorsTotal, 1)
}

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
) error {
	log.SetOutput(os.Stdout)
	log.Printf("Initializing XHSC0227") //XHSC0224 pour désigner la date de la dernière version "02/24 (le 24 février)"

	sharedRouter := router.NewXyRouter()
	
	// Validate compression algorithms
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
		// Link bridge with intelligence if needed (ForceGC)
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

	// Start IPC Server
	if ipcBridge != nil {
		if err := ipcBridge.StartServer(); err != nil {
			return fmt.Errorf("failed to start IPC server: %w", err)
		}
	}

	// Start Cluster Workers
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
		// Apply pool/transport settings if connection pooling is enabled
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

	// Performance Configuration
	state.Performance.Compression = perfCompression
	state.Performance.CompressionAlgs = perfCompressionAlgs
	state.Performance.CompressionLevel = compressionLevel
	state.Performance.CompressionMinSize = compressionThreshold
	state.Performance.CompressionTypes = compressionTypes
	state.Performance.BatchSize = perfBatchSize
	state.Performance.ConnectionPooling = perfConnectionPooling
	state.Performance.PoolTimeout = time.Duration(poolTimeout) * time.Millisecond
	state.Performance.PoolIdleTimeout = time.Duration(poolIdleTimeout) * time.Millisecond

	// Connection Configuration
	state.Connection.HTTP2MaxConcurrent = http2MaxStreams
	state.Connection.KeepAliveTimeout = time.Duration(keepAliveTimeout) * time.Millisecond
	state.Connection.KeepAliveMaxReqs = keepAliveMaxReqs

	// Firewall Configuration
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

	// Concurrency settings
	state.Concurrency.MaxConcurrent = maxConcurrentReqs
	state.Concurrency.MaxPerIP = maxPerIP
	state.Concurrency.MaxQueueSize = maxQueueSize
	state.Concurrency.QueueTimeout = time.Duration(queueTimeout) * time.Millisecond

	// Quality settings
	state.Quality.Enabled = qualityEnabled
	state.Quality.RejectPoor = qualityRejectPoor
	state.Quality.MinBW = qualityMinBW
	state.Quality.MaxLat = qualityMaxLat

	// Resilience settings
	state.Resilience.BreakerEnabled = breakerEnabled
	state.Resilience.BreakerThreshold = breakerThreshold
	state.Resilience.BreakerTimeout = time.Duration(breakerTimeout) * time.Second
	state.Resilience.RetryMax = retryMax
	state.Resilience.RetryDelay = time.Duration(retryDelay) * time.Millisecond

	// Pre-compile regex excludes
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

func (s *ServerState) statusHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":         "online",
		"service":        "XHSC Go Edition",
		"uptime_seconds": time.Now().Unix(),
		"ipc_enabled":    s.Ipc != nil,
		"requests_total": atomic.LoadUint64(&s.Metrics.RequestsTotal),
		"errors_total":   atomic.LoadUint64(&s.Metrics.ErrorsTotal),
	})
}

func (s *ServerState) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy"})
}

func (s *ServerState) fallbackHandler(w http.ResponseWriter, r *http.Request) {
	s.Metrics.IncrementRequests()

	if s.MaxUrlLength > 0 && len(r.RequestURI) > s.MaxUrlLength {
		http.Error(w, "URI Too Long", http.StatusRequestURITooLong)
		return
	}

	method := r.Method
	path := r.URL.Path

	// log.Printf("→ %s %s", method, path)

	rt, params := s.Router.MatchRoute(method, path)
	if rt == nil && method == "HEAD" {
		rt, params = s.Router.MatchRoute("GET", path)
	}

	if rt != nil {
		switch rt.Target.Type {
		case router.TargetJsWorker:
			s.handleJsWorker(w, r, params)
		case router.TargetStaticFile:
			http.ServeFile(w, r, rt.Target.Path)
		case router.TargetRedirect:
			http.Redirect(w, r, rt.Target.Destination, int(rt.Target.Code))
		default:
		}
		return
	}

	// Try Proxy if configured
	if s.Proxy != nil {
		s.Proxy.ServeHTTP(w, r)
		return
	}

	// Fallback to JS worker if IPC enabled
	if s.Ipc != nil {
		s.handleJsWorker(w, r, nil)
	} else {
		log.Printf("✗ Route not found: %s %s", method, path)
		s.Metrics.IncrementErrors()
		http.NotFound(w, r)
	}
}

func (s *ServerState) handleJsWorker(w http.ResponseWriter, r *http.Request, params map[string]string) {
	if s.Ipc == nil {
		http.Error(w, "IPC Bridge not configured", http.StatusServiceUnavailable)
		return
	}

	// 1. Circuit Breaker check
	if s.Resilience.BreakerEnabled {
		s.Resilience.BreakerMutex.RLock()
		if !s.Resilience.BreakerOpenUntil.IsZero() && time.Now().Before(s.Resilience.BreakerOpenUntil) {
			s.Resilience.BreakerMutex.RUnlock()
			http.Error(w, "Circuit Breaker Open (XHSC)", http.StatusServiceUnavailable)
			return
		}
		s.Resilience.BreakerMutex.RUnlock()
	}

	var body []byte
	var jsFiles []ipc.JsFile

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		// Native Go Multipart Parsing
		if err := r.ParseMultipartForm(s.MaxBodySize); err != nil {
			s.Metrics.IncrementErrors()
			http.Error(w, "Failed to parse multipart form", http.StatusBadRequest)
			return
		}

		// Save files to .private/uploads
		uploadDir := ".private/uploads"
		if err := os.MkdirAll(uploadDir, 0755); err != nil {
			log.Printf("[ERROR] Failed to create upload dir: %v", err)
		}

		for fieldName, fileHeaders := range r.MultipartForm.File {
			for _, fileHeader := range fileHeaders {
				file, err := fileHeader.Open()
				if err != nil {
					continue
				}
				defer file.Close()

				// Generate unique name
				tempName := fmt.Sprintf("up-%s-%s", uuid.NewString(), fileHeader.Filename)
				tempPath := filepath.Join(uploadDir, tempName)

				out, err := os.Create(tempPath)
				if err != nil {
					log.Printf("[ERROR] Failed to create temp upload file: %v", err)
					continue
				}
				defer out.Close()

				size, err := io.Copy(out, file)
				if err != nil {
					continue
				}

				jsFiles = append(jsFiles, ipc.JsFile{
					FieldName: fieldName,
					FileName:  fileHeader.Filename,
					Size:      size,
					MimeType:  fileHeader.Header.Get("Content-Type"),
					TempPath:  tempPath,
				})
			}
		}

		formValues := make(map[string]interface{})
		for k, v := range r.MultipartForm.Value {
			if len(v) == 1 {
				formValues[k] = v[0]
			} else {
				formValues[k] = v
			}
		}
		body, _ = json.Marshal(formValues)
	} else {
		// Standard body reading
		var err error
		body, err = io.ReadAll(io.LimitReader(r.Body, s.MaxBodySize))
		if err != nil {
			s.Metrics.IncrementErrors()
			http.Error(w, "Failed to read body", http.StatusBadRequest)
			return
		}
	}

	headers := make(map[string]ipc.HeaderValue)
	for k, v := range r.Header {
		if len(v) == 1 {
			headers[k] = ipc.HeaderValue{Single: v[0]}
		} else {
			headers[k] = ipc.HeaderValue{Multiple: v}
		}
	}

	query := make(map[string]string)
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			query[k] = v[0]
		}
	}

	method := r.Method
	if method == "HEAD" {
		method = "GET"
	}

	jsReq := ipc.JsRequest{
		ID:         uuid.NewString(),
		Method:     method,
		URL:        r.URL.String(),
		Headers:    headers,
		Query:      query,
		Params:     params,
		RemoteAddr: s.extractRealIP(r),
		LocalAddr:  r.Host,
		Body:       body,
		Files:      jsFiles,
	}

	// 2. Dispatch with Retry
	var res ipc.JsResponse
	var err error

	maxAttempts := 1
	if s.Resilience.RetryMax > 0 {
		maxAttempts = 1 + s.Resilience.RetryMax
	}

	startTime := time.Now()
	for i := 0; i < maxAttempts; i++ {
		res, err = s.Ipc.Dispatch(jsReq)
		if err == nil {
			// Success! Reset breaker failures.
			if s.Resilience.BreakerEnabled {
				atomic.StoreInt32(&s.Resilience.BreakerFailures, 0)
			}
			break
		}

		log.Printf("[ERROR] IPC Dispatch failed (attempt %d/%d): %v", i+1, maxAttempts, err)

		if i < maxAttempts-1 {
			time.Sleep(s.Resilience.RetryDelay)
			continue
		}

		// Final attempt failed
		s.Metrics.IncrementErrors()

		// Update Breaker if enabled
		if s.Resilience.BreakerEnabled {
			failures := atomic.AddInt32(&s.Resilience.BreakerFailures, 1)
			if uint32(failures) >= s.Resilience.BreakerThreshold {
				s.Resilience.BreakerMutex.Lock()
				s.Resilience.BreakerOpenUntil = time.Now().Add(s.Resilience.BreakerTimeout)
				s.Resilience.BreakerMutex.Unlock()
				log.Printf("[WARN] Circuit Breaker OPENED for %v due to repeated failures", s.Resilience.BreakerTimeout)
			}
		}

		workerCount := s.Ipc.GetWorkerCount()
		if s.Intelligence != nil && s.Intelligence.Config.RescueMode && workerCount == 0 {
			s.Intelligence.SetRescueActive(true)
			http.Error(w, "Rescue Mode: System is rebooting... (Rapid Recovery)", http.StatusServiceUnavailable)
			return
		}

		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	duration := time.Since(startTime)

	w.Header().Set("X-Response-Time", fmt.Sprintf("%.2fms", float64(duration.Microseconds())/1000.0))

	for k, v := range res.Headers {
		if strings.EqualFold(k, "content-length") {
			continue
		}
		if v.Single != "" {
			w.Header().Set(k, v.Single)
		} else {
			for _, val := range v.Multiple {
				w.Header().Add(k, val)
			}
		}
	}
	w.WriteHeader(int(res.Status))
	w.Write(res.Body)
}

func (s *ServerState) extractRealIP(r *http.Request) string {
	remoteAddr := r.RemoteAddr
	if idx := strings.LastIndex(remoteAddr, ":"); idx != -1 {
		remoteAddr = remoteAddr[:idx]
	}

	if len(s.TrustProxy) == 0 {
		return remoteAddr
	}

	isTrusted := false
	for _, trusted := range s.TrustProxy {
		if trusted == "loopback" && (remoteAddr == "127.0.0.1" || remoteAddr == "::1" || remoteAddr == "localhost") {
			isTrusted = true
			break
		}
		if remoteAddr == trusted {
			isTrusted = true
			break
		}
	}

	if !isTrusted {
		return remoteAddr
	}

	return realip.RealIP(r)
}

func (s *ServerState) autoConfigureFirewall(port uint16) {
	log.Printf("[Firewall] Auto-tuning firewall for port %d...", port)

	// Check for UFW
	if _, err := exec.LookPath("ufw"); err == nil {
		log.Printf("[Firewall] UFW detected, ensuring port %d is open", port)
		cmd := exec.Command("sudo", "ufw", "allow", fmt.Sprintf("%d/tcp", port))
		if err := cmd.Run(); err != nil {
			log.Printf("[Firewall] ERROR: Failed to allow port %d via ufw: %v", port, err)
		} else {
			log.Printf("[Firewall] Port %d allowed successfully via UFW", port)
		}

		// Also allow common web ports if it's 80/443
		if port == 80 || port == 443 {
			_ = exec.Command("sudo", "ufw", "allow", "80/tcp").Run()
			_ = exec.Command("sudo", "ufw", "allow", "443/tcp").Run()
		}
	} else if _, err := exec.LookPath("iptables"); err == nil {
		log.Printf("[Firewall] iptables detected, ensuring port %d is open", port)
		_ = exec.Command("sudo", "iptables", "-A", "INPUT", "-p", "tcp", "--dport", fmt.Sprintf("%d", port), "-j", "ACCEPT").Run()
	} else {
		log.Printf("[Firewall] WARNING: No known firewall manager found (ufw/iptables). Please open port %d manually.", port)
	}
}

func CompressionMiddleware(next http.Handler, s *ServerState) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.Performance.Compression {
			next.ServeHTTP(w, r)
			return
		}

		acceptEncoding := r.Header.Get("Accept-Encoding")
		algorithms := s.Performance.CompressionAlgs

		enabled := make(map[string]bool)
		for _, alg := range algorithms {
			enabled[strings.TrimSpace(alg)] = true
		}

		cw := &compressionResponseWriter{ResponseWriter: w, writer: w}

		// Negotiate algorithm
		if enabled["zstd"] && strings.Contains(acceptEncoding, "zstd") {
			cw.encoding = "zstd"
		} else if enabled["br"] && strings.Contains(acceptEncoding, "br") {
			cw.encoding = "br"
		} else if enabled["gzip"] && strings.Contains(acceptEncoding, "gzip") {
			cw.encoding = "gzip"
		} else if enabled["deflate"] && strings.Contains(acceptEncoding, "deflate") {
			cw.encoding = "deflate"
		}

		// We delay writer creation until WriteHeader where we check Content-Type and threshold
		cw.s = s
		next.ServeHTTP(cw, r)

		if cw.closer != nil {
			cw.closer.Close()
		}
	})
}

// Update compressionResponseWriter to use ServerState
type compressionResponseWriter struct {
	http.ResponseWriter
	writer          io.Writer
	closer          io.Closer
	encoding        string
	negotiated      bool
	status          int
	s               *ServerState
	shouldCompress bool
}

func (w *compressionResponseWriter) WriteHeader(status int) {
	if w.negotiated {
		w.ResponseWriter.WriteHeader(status)
		return
	}

	w.status = status
	w.negotiated = true

	// 1. Check if we have an encoding to use
	if w.encoding == "" || w.Header().Get("Content-Encoding") != "" {
		w.ResponseWriter.WriteHeader(status)
		return
	}

	// 2. Check Content-Type against allowed types
	contentType := w.Header().Get("Content-Type")
	if len(w.s.Performance.CompressionTypes) > 0 {
		allowed := false
		ct := strings.Split(contentType, ";")[0]
		for _, t := range w.s.Performance.CompressionTypes {
			if t == ct || strings.HasPrefix(ct, t) {
				allowed = true
				break
			}
		}
		if !allowed {
			w.ResponseWriter.WriteHeader(status)
			return
		}
	} else {
		// Default types to compress if none specified
		defaultTypes := []string{"text/", "application/json", "application/javascript", "application/xml"}
		allowed := false
		for _, t := range defaultTypes {
			if strings.HasPrefix(contentType, t) {
				allowed = true
				break
			}
		}
		if !allowed {
			w.ResponseWriter.WriteHeader(status)
			return
		}
	}

	// 3. Check Content-Length against threshold
	contentLength := w.Header().Get("Content-Length")
	if contentLength != "" && w.s.Performance.CompressionMinSize > 0 {
		var size int64
		fmt.Sscanf(contentLength, "%d", &size)
		if size < int64(w.s.Performance.CompressionMinSize) {
			w.ResponseWriter.WriteHeader(status)
			return
		}
	}

	// 4. Initialize the compressed writer
	w.shouldCompress = true
	switch w.encoding {
	case "zstd":
		zw, _ := zstd.NewWriter(w.ResponseWriter)
		w.writer = zw
		w.closer = zw
	case "br":
		bw := brotli.NewWriter(w.ResponseWriter)
		w.writer = bw
		w.closer = bw
	case "gzip":
		gw := gzip.NewWriter(w.ResponseWriter)
		w.writer = gw
		w.closer = gw
	case "deflate":
		zw := zlib.NewWriter(w.ResponseWriter)
		w.writer = zw
		w.closer = zw
	}

	if w.shouldCompress {
		w.Header().Set("Content-Encoding", w.encoding)
		w.Header().Del("Content-Length")
		// Handle Vary
		vary := w.Header().Get("Vary")
		if vary == "" {
			w.Header().Set("Vary", "Accept-Encoding")
		} else if !strings.Contains(strings.ToLower(vary), "accept-encoding") {
			w.Header().Add("Vary", "Accept-Encoding")
		}
	}

	w.ResponseWriter.WriteHeader(status)
}

func (w *compressionResponseWriter) Write(b []byte) (int, error) {
	if !w.negotiated {
		w.WriteHeader(http.StatusOK)
	}
	if w.shouldCompress && w.writer != nil {
		return w.writer.Write(b)
	}
	return w.ResponseWriter.Write(b)
}
func (w *compressionResponseWriter) Flush() {
	if f, ok := w.writer.(interface{ Flush() }); ok {
		f.Flush()
	} else if f, ok := w.writer.(interface{ Flush() error }); ok {
		_ = f.Flush()
	}
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
