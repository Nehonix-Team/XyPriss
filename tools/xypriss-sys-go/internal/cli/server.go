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

package cli

import (
	"log"
	"strings"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/server"
	"github.com/spf13/cobra"
)

var (
	port                 uint16
	host                 string
	ipcPath              string
	timeout              uint64
	breakerEnabled       bool
	breakerThreshold     uint32
	breakerTimeout       uint64
	clusterEnabled       bool
	clusterWorkers       int
	clusterRespawnStr    string
	entryPoint           string
	maxBodySize          int64
	maxUrlLength         int
	intelligenceEnabled  bool
	preAllocate          bool
	rescueModeStr        string
	clusterMaxMemory     int
	clusterMaxCPU        int
	clusterStrategy      string
	clusterPriority      int
	fileDescriptorLimit  int
	gcHint               bool
	memCheckInterval     int
	enforceHardLimitsStr string
	maxConcurrentReqs    int
	maxPerIP             int
	maxQueueSize         int
	queueTimeout         int
	retryMax             int
	retryDelay           int
	qualityEnabled       bool
	qualityRejectPoor    bool
	qualityMinBW         int
	qualityMaxLat        int
	workerPoolEnabled    bool
	workerPoolMaxTasks   int
	workerPoolCpuMin     int
	workerPoolCpuMax     int
	workerPoolIoMin      int
	workerPoolIoMax      int

	// Performance
	perfCompression       bool
	perfCompressionAlgs    []string
	perfBatchSize         int
	perfConnectionPooling bool

	// Proxy
	proxyUpstreams []string
	proxyStrategy  string
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Start the XyPriss Hyper-System Core",
}

var serverStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the server",
	Run: func(cmd *cobra.Command, args []string) {
		if ipcPath == "" {
			ipcPath = "/tmp/xypriss.sock"
		}

		err := server.StartServer(
			host,
			port,
			ipcPath,
			timeout,
			maxBodySize,
			clusterEnabled,
			clusterWorkers,
			strings.ToLower(clusterRespawnStr) == "true",
			entryPoint,
			clusterStrategy,
			clusterPriority,
			fileDescriptorLimit,
			gcHint,
			memCheckInterval,
			strings.ToLower(enforceHardLimitsStr) == "true",
			maxUrlLength,
			intelligenceEnabled,
			preAllocate,
			strings.ToLower(rescueModeStr) == "true",
			clusterMaxMemory,
			clusterMaxCPU,
			perfCompression,
			perfCompressionAlgs,
			perfBatchSize,
			perfConnectionPooling,
			proxyUpstreams,
			proxyStrategy,
		)

		if err != nil {
			log.Fatalf("Failed to start server: %v", err)
		}
	},
}

func init() {
	serverStartCmd.Flags().Uint16VarP(&port, "port", "p", 4349, "Port to listen on")
	serverStartCmd.Flags().StringVar(&host, "host", "127.0.0.1", "Host to bind to")
	serverStartCmd.Flags().StringVar(&ipcPath, "ipc", "/tmp/xypriss.sock", "IPC path (Unix Domain Socket)")
	serverStartCmd.Flags().Uint64Var(&timeout, "timeout", 30, "Request timeout in seconds")

	// Circuit breaker
	serverStartCmd.Flags().BoolVar(&breakerEnabled, "breaker-enabled", false, "Enable circuit breaker")
	serverStartCmd.Flags().Uint32Var(&breakerThreshold, "breaker-threshold", 5, "Breaker failure threshold")
	serverStartCmd.Flags().Uint64Var(&breakerTimeout, "breaker-timeout", 60, "Breaker reset timeout")

	// Cluster
	serverStartCmd.Flags().BoolVar(&clusterEnabled, "cluster", false, "Enable clustering")
	serverStartCmd.Flags().IntVar(&clusterWorkers, "cluster-workers", 0, "Number of workers (0 = CPU count)")
	serverStartCmd.Flags().StringVar(&clusterRespawnStr, "cluster-respawn", "true", "Automatically respawn dead workers")
	serverStartCmd.Flags().StringVar(&entryPoint, "entry-point", "", "Entry point for workers (JS/TS file)")
	serverStartCmd.Flags().IntVar(&clusterMaxMemory, "cluster-max-memory", 0, "Max memory per worker in MB")
	serverStartCmd.Flags().IntVar(&clusterMaxCPU, "cluster-max-cpu", 0, "Max CPU percentage per worker")
	serverStartCmd.Flags().StringVar(&clusterStrategy, "cluster-strategy", "round-robin", "Load balancing strategy")
	serverStartCmd.Flags().IntVar(&clusterPriority, "cluster-priority", 0, "Worker process priority")
	serverStartCmd.Flags().IntVar(&fileDescriptorLimit, "file-descriptor-limit", 0, "File descriptor limit per worker")
	serverStartCmd.Flags().BoolVar(&gcHint, "gc-hint", false, "Enable GC hints for workers")
	serverStartCmd.Flags().IntVar(&memCheckInterval, "cluster-memory-check-interval", 0, "Memory check interval in ms")
	serverStartCmd.Flags().StringVar(&enforceHardLimitsStr, "cluster-enforce-hard-limits", "false", "Enforce hard resource limits")

	// Server settings
	serverStartCmd.Flags().Int64Var(&maxBodySize, "max-body-size", 10*1024*1024, "Max request body size in bytes")
	serverStartCmd.Flags().IntVar(&maxUrlLength, "max-url-length", 2048, "Max URL length")

	// Concurrency
	serverStartCmd.Flags().IntVar(&maxConcurrentReqs, "max-concurrent-requests", 0, "Max concurrent requests")
	serverStartCmd.Flags().IntVar(&maxPerIP, "max-per-ip", 0, "Max concurrent requests per IP")
	serverStartCmd.Flags().IntVar(&maxQueueSize, "max-queue-size", 0, "Max request queue size")
	serverStartCmd.Flags().IntVar(&queueTimeout, "queue-timeout", 0, "Queue timeout in ms")

	// Retry
	serverStartCmd.Flags().IntVar(&retryMax, "retry-max", 0, "Max retry attempts")
	serverStartCmd.Flags().IntVar(&retryDelay, "retry-delay", 0, "Retry delay in ms")

	// Network quality
	serverStartCmd.Flags().BoolVar(&qualityEnabled, "quality-enabled", false, "Enable network quality enforcement")
	serverStartCmd.Flags().BoolVar(&qualityRejectPoor, "quality-reject-poor", false, "Reject poor connections")
	serverStartCmd.Flags().IntVar(&qualityMinBW, "quality-min-bw", 0, "Minimum bandwidth in bytes/s")
	serverStartCmd.Flags().IntVar(&qualityMaxLat, "quality-max-lat", 0, "Maximum latency in ms")

	// Intelligence & Rescue
	serverStartCmd.Flags().BoolVar(&intelligenceEnabled, "intelligence", false, "Enable intelligence modules")
	serverStartCmd.Flags().BoolVar(&preAllocate, "pre-allocate", false, "Pre-allocate memory for intelligence")
	serverStartCmd.Flags().StringVar(&rescueModeStr, "rescue-mode", "false", "Enable rescue mode")

	// Worker Pool
	serverStartCmd.Flags().BoolVar(&workerPoolEnabled, "worker-pool", false, "Enable worker pool management")
	serverStartCmd.Flags().IntVar(&workerPoolMaxTasks, "worker-pool-max-tasks", 0, "Max concurrent tasks in pool")
	serverStartCmd.Flags().IntVar(&workerPoolCpuMin, "worker-pool-cpu-min", 0, "Min CPU for worker pool")
	serverStartCmd.Flags().IntVar(&workerPoolCpuMax, "worker-pool-cpu-max", 0, "Max CPU for worker pool")
	serverStartCmd.Flags().IntVar(&workerPoolIoMin, "worker-pool-io-min", 0, "Min IO for worker pool")
	serverStartCmd.Flags().IntVar(&workerPoolIoMax, "worker-pool-io-max", 0, "Max IO for worker pool")

	// Performance Flags
	serverStartCmd.Flags().BoolVar(&perfCompression, "perf-compression", true, "Enable response compression")
	serverStartCmd.Flags().StringSliceVar(&perfCompressionAlgs, "perf-compression-algs", []string{"gzip", "br"}, "Compression algorithms to use (gzip, br)")
	serverStartCmd.Flags().IntVar(&perfBatchSize, "perf-batch-size", 100, "Performance batch size")
	serverStartCmd.Flags().BoolVar(&perfConnectionPooling, "perf-connection-pooling", true, "Enable connection pooling")

	// Proxy Flags
	serverStartCmd.Flags().StringSliceVar(&proxyUpstreams, "proxy-upstreams", []string{}, "Comma-separated list of upstream URLs")
	serverStartCmd.Flags().StringVar(&proxyStrategy, "proxy-strategy", "round-robin", "Proxy load balancing strategy")

	serverCmd.AddCommand(serverStartCmd)
	rootCmd.AddCommand(serverCmd)
}
