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
	"encoding/json"
	"fmt"
	"io"
	"log"
	"net/http"
	"os"
	"sync/atomic"
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/cluster"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/ipc"
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
	maxUrlLength int,
	intelligenceEnabled bool,
	preAllocate bool,
	rescueMode bool,
	clusterMaxMemory int,
	clusterMaxCPU int,
) error {
	log.SetOutput(os.Stdout)
	log.Printf("Initializing XHSC-GO")

	sharedRouter := router.NewXyRouter()
	
	clusterConfig := &cluster.ClusterConfig{
		Workers:             clusterWorkers,
		Respawn:             clusterRespawn,
		IpcPath:             ipcPath,
		EntryPoint:          entryPoint,
		MaxMemory:           clusterMaxMemory,
		MaxCPU:              clusterMaxCPU,
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

	state := &ServerState{
		Router:       sharedRouter,
		Ipc:          ipcBridge,
		Root:         ".",
		Metrics:      &MetricsCollector{},
		MaxBodySize:  maxBodySize,
		TimeoutSec:   timeoutSec,
		MaxUrlLength: maxUrlLength,
		Intelligence: intelligenceManager,
	}

	mux := http.NewServeMux()
	mux.HandleFunc("/_xypriss/b/status", state.statusHandler)
	mux.HandleFunc("/_xypriss/b/health", state.healthHandler)
	mux.HandleFunc("/", state.fallbackHandler)

	addr := fmt.Sprintf("%s:%d", host, port)
	server := &http.Server{
		Addr:         addr,
		Handler:      mux,
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

	log.Printf("→ %s %s", method, path)

	rt, params := s.Router.MatchRoute(method, path)
	if rt != nil {
		switch rt.Target.Type {
		case router.TargetJsWorker:
			s.handleJsWorker(w, r, params)
		case router.TargetStaticFile:
			http.ServeFile(w, r, rt.Target.Path)
		case router.TargetRedirect:
			http.Redirect(w, r, rt.Target.Destination, int(rt.Target.Code))
		default:
			http.Error(w, "Internal Action", http.StatusOK)
		}
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

	jsReq := ipc.JsRequest{
		ID:         uuid.NewString(),
		Method:     r.Method,
		URL:        r.URL.String(),
		Headers:    headers,
		Query:      query,
		Params:     params,
		RemoteAddr: r.RemoteAddr,
		LocalAddr:  r.Host,
		Body:       body,
	}

	res, err := s.Ipc.Dispatch(jsReq)
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

	for k, v := range res.Headers {
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
