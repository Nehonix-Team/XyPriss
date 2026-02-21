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
	"strconv"

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
	clusterRespawnStr    string // Changed to string to handle "true"/"false" from bridge
	entryPoint           string
	maxBodySize          int64
	maxUrlLength         int
	intelligenceEnabled  bool
	preAllocate          bool
	rescueModeStr        string // Changed to string
	clusterMaxMemory     int
	clusterMaxCPU        int
)

var serverCmd = &cobra.Command{
	Use:   "server",
	Short: "Start the XyPriss Hybrid Server Core",
}

var serverStartCmd = &cobra.Command{
	Use:   "start",
	Short: "Start the server",
	Run: func(cmd *cobra.Command, args []string) {
		if ipcPath == "" {
			ipcPath = "/tmp/xypriss.sock"
		}

		respawn, _ := strconv.ParseBool(clusterRespawnStr)
		rescue, _ := strconv.ParseBool(rescueModeStr)

		err := server.StartServer(
			host,
			port,
			ipcPath,
			timeout,
			maxBodySize,
			clusterEnabled,
			clusterWorkers,
			respawn,
			entryPoint,
			maxUrlLength,
			intelligenceEnabled,
			preAllocate,
			rescue,
			clusterMaxMemory,
			clusterMaxCPU,
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
	serverStartCmd.Flags().BoolVar(&breakerEnabled, "breaker-enabled", false, "Enable circuit breaker")
	serverStartCmd.Flags().Uint32Var(&breakerThreshold, "breaker-threshold", 5, "Breaker failure threshold")
	serverStartCmd.Flags().Uint64Var(&breakerTimeout, "breaker-timeout", 60, "Breaker reset timeout")
	
	// Cluster Aliases for Rust compatibility
	serverStartCmd.Flags().BoolVar(&clusterEnabled, "cluster", false, "Enable clustering")
	serverStartCmd.Flags().IntVar(&clusterWorkers, "cluster-workers", 0, "Number of workers (0 = CPU count)")
	serverStartCmd.Flags().StringVar(&clusterRespawnStr, "cluster-respawn", "true", "Automatically respawn dead workers")
	serverStartCmd.Flags().StringVar(&entryPoint, "entry-point", "", "Entry point for workers (JS/TS file)")
	serverStartCmd.Flags().IntVar(&clusterMaxMemory, "cluster-max-memory", 0, "Max memory per worker in MB")
	serverStartCmd.Flags().IntVar(&clusterMaxCPU, "cluster-max-cpu", 0, "Max CPU percentage per worker")
	
	// Server settings alignment
	serverStartCmd.Flags().Int64Var(&maxBodySize, "max-body-size", 10*1024*1024, "Max request body size in bytes")
	serverStartCmd.Flags().IntVar(&maxUrlLength, "max-url-length", 2048, "Max URL length")
	
	// Intelligence & Rescue alignment
	serverStartCmd.Flags().BoolVar(&intelligenceEnabled, "intelligence", false, "Enable intelligence modules")
	serverStartCmd.Flags().BoolVar(&preAllocate, "pre-allocate", false, "Pre-allocate memory for intelligence")
	serverStartCmd.Flags().StringVar(&rescueModeStr, "rescue-mode", "false", "Enable rescue mode")

	serverCmd.AddCommand(serverStartCmd)
	rootCmd.AddCommand(serverCmd)
}
