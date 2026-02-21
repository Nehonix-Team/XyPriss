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
	"encoding/json"
	"fmt"
	"strconv"
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/handlers"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/sys"
	"github.com/spf13/cobra"
)

var (
	monitorDuration int
	monitorInterval float64
)

var monitorCmd = &cobra.Command{
	Use:   "monitor",
	Short: "System and process monitoring",
}

var monitorProcessCmd = &cobra.Command{
	Use:   "process [pid]",
	Short: "Monitor specific process",
	Args:  cobra.ExactArgs(1),
	Run: func(cmd *cobra.Command, args []string) {
		pidVal, _ := strconv.Atoi(args[0])
		h := handlers.NewMonitorHandler()

		fmt.Printf("Monitoring process %d for %ds (interval: %.1fs)\n", pidVal, monitorDuration, monitorInterval)

		h.MonitorProcess(uint32(pidVal), time.Duration(monitorDuration)*time.Second, time.Duration(monitorInterval*float64(time.Second)), func(s sys.ProcessSnapshot) {
			if jsonOutput {
				data, _ := json.Marshal(s)
				fmt.Println(string(data))
			} else {
				fmt.Printf("\rCPU: %.1f%%  Memory: %d MB  Read: %d  Write: %d  ",
					s.CpuUsage,
					s.Memory/1024/1024,
					s.DiskRead,
					s.DiskWrite,
				)
			}
		})
		fmt.Println("\nMonitoring complete")
	},
}

var monitorSysCmd = &cobra.Command{
	Use:   "system",
	Short: "Monitor system resources",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewMonitorHandler()
		fmt.Printf("Monitoring system for %ds (interval: %.1fs)\n", monitorDuration, monitorInterval)

		h.MonitorSystem(time.Duration(monitorDuration)*time.Second, time.Duration(monitorInterval*float64(time.Second)), func(s sys.SystemSnapshot) {
			if jsonOutput {
				data, _ := json.Marshal(s)
				fmt.Println(string(data))
			} else {
				fmt.Printf("\rCPU: %.1f%%  RAM: %d / %d MB  Processes: %d  ",
					s.CpuUsage,
					s.MemoryUsed/1024/1024,
					s.MemoryTotal/1024/1024,
					s.ProcessCount,
				)
			}
		})
		fmt.Println("\nMonitoring complete")
	},
}

func init() {
	monitorSysCmd.Flags().IntVarP(&monitorDuration, "duration", "d", 10, "Monitoring duration in seconds")
	monitorSysCmd.Flags().Float64VarP(&monitorInterval, "interval", "i", 1.0, "Monitoring interval in seconds")

	monitorCmd.AddCommand(monitorSysCmd)
	rootCmd.AddCommand(monitorCmd)
}
