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
	"strings"
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
		BatchSize         int
		ConnectionPooling bool
	}
	Proxy *proxy.ProxyManager
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
) error {
	log.SetOutput(os.Stdout)
	log.Printf("Initializing XHSC0224")

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
		var err error
		proxyManager, err = proxy.NewProxyManager(proxy.ProxyConfig{
			Upstreams: proxyUpstreams,
			Strategy:  proxyStrategy,
		})
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
	state.Performance.BatchSize = perfBatchSize
	state.Performance.ConnectionPooling = perfConnectionPooling

	mux := http.NewServeMux()
	mux.HandleFunc("/_xypriss/b/status", state.statusHandler)
	mux.HandleFunc("/_xypriss/b/health", state.healthHandler)
	mux.HandleFunc("/", state.fallbackHandler)

	addr := fmt.Sprintf("%s:%d", host, port)
	
	var handler http.Handler = mux
	if perfCompression {
		handler = CompressionMiddleware(mux, perfCompressionAlgs)
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

	body, err := io.ReadAll(io.LimitReader(r.Body, s.MaxBodySize))
	if err != nil {
		s.Metrics.IncrementErrors()
		http.Error(w, "Failed to read body", http.StatusBadRequest)
		return
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
	// For workers, we treat HEAD as GET on the bridge to ensure the JS site logic runs.
	// net/http will discard the body for us if the client only wants headers.
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
		RemoteAddr: r.RemoteAddr,
		LocalAddr:  r.Host,
		Body:       body,
	}

	startTime := time.Now()
	res, err := s.Ipc.Dispatch(jsReq)
	duration := time.Since(startTime)

	if err != nil { 
		s.Metrics.IncrementErrors()
		
		workerCount := s.Ipc.GetWorkerCount()
		if s.Intelligence != nil && s.Intelligence.Config.RescueMode && workerCount == 0 {
			s.Intelligence.SetRescueActive(true)
			http.Error(w, "Rescue Mode: System is rebooting... (Rapid Recovery)", http.StatusServiceUnavailable)
			return
		}

		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}

	w.Header().Set("X-Response-Time", fmt.Sprintf("%.2fms", float64(duration.Microseconds())/1000.0))
	// log.Printf("[DEBUG-GO] Node response: status=%d, headers=%v, bodyLen=%d", res.Status, res.Headers, len(res.Body))

	for k, v := range res.Headers {
		// Skip Content-Length: the Go compression middleware may change the body size,
		// so we let net/http recompute it automatically after compression.
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

type compressionResponseWriter struct {
	http.ResponseWriter
	writer          io.Writer
	closer          io.Closer
	encoding        string
	negotiated      bool
	status          int
}

func (w *compressionResponseWriter) Header() http.Header {
	return w.ResponseWriter.Header()
}

func (w *compressionResponseWriter) WriteHeader(status int) {
	if w.negotiated {
		w.ResponseWriter.WriteHeader(status)
		return
	}

	w.status = status
	w.negotiated = true

	// If the handler didn't specifically set a Content-Encoding, use our negotiated one
	if w.Header().Get("Content-Encoding") == "" && w.encoding != "" {
		w.Header().Set("Content-Encoding", w.encoding)

		// Handle Vary header properly to avoid duplicates
		vary := w.Header().Get("Vary")
		if vary == "" {
			w.Header().Set("Vary", "Accept-Encoding")
		} else if !strings.Contains(strings.ToLower(vary), "accept-encoding") {
			w.Header().Add("Vary", "Accept-Encoding")
		}

		// Always delete Content-Length for compressed responses
		w.Header().Del("Content-Length")
	} else if w.Header().Get("Content-Encoding") != "" {
		// Handler set its own encoding (e.g. static file already compressed or middleware)
		// Revert to raw writer to avoid double compression
		w.writer = w.ResponseWriter
		w.encoding = ""
		w.closer = nil
	}

	w.ResponseWriter.WriteHeader(status)
}
func (w *compressionResponseWriter) Write(b []byte) (int, error) {
	if !w.negotiated {
		w.WriteHeader(http.StatusOK)
	}
	return w.writer.Write(b)
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

func CompressionMiddleware(next http.Handler, algorithms []string) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		acceptEncoding := r.Header.Get("Accept-Encoding")
		
		enabled := make(map[string]bool)
		for _, alg := range algorithms {
			enabled[strings.TrimSpace(alg)] = true
		}

		cw := &compressionResponseWriter{ResponseWriter: w, writer: w}

		// Priority: zstd > br > gzip > deflate
		if enabled["zstd"] && strings.Contains(acceptEncoding, "zstd") {
			zw, err := zstd.NewWriter(w)
			if err == nil {
				cw.encoding = "zstd"
				cw.writer = zw
				cw.closer = zw
			}
		} else if enabled["br"] && strings.Contains(acceptEncoding, "br") {
			bw := brotli.NewWriter(w)
			cw.encoding = "br"
			cw.writer = bw
			cw.closer = bw
		} else if enabled["gzip"] && strings.Contains(acceptEncoding, "gzip") {
			gw := gzip.NewWriter(w)
			cw.encoding = "gzip"
			cw.writer = gw
			cw.closer = gw
		} else if enabled["deflate"] && strings.Contains(acceptEncoding, "deflate") {
			zw := zlib.NewWriter(w)
			cw.encoding = "deflate"
			cw.writer = zw
			cw.closer = zw
		}

		if cw.closer != nil {
			defer cw.closer.Close()
		}
		next.ServeHTTP(cw, r)
	})
}
