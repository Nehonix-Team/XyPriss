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
	"log"
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/handlers"
	"github.com/spf13/cobra"
)

var sysCmd = &cobra.Command{
	Use:   "sys",
	Short: "System information and management",
}

var (
	extended bool
	cores    bool
	watch    bool
	topCpu   int
	topMem   int
	pid      uint32
)

var infoCmd = &cobra.Command{
	Use:   "info",
	Short: "General system information",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		res, err := h.GetInfo()
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		if jsonOutput {
			data, _ := json.MarshalIndent(res, "", "  ")
			fmt.Println(string(data))
		} else {
			fmt.Printf("Hostname: %s\nOS: %s %s\n", res.Hostname, res.OSName, res.OSVersion)
		}
	},
}

var cpuCmd = &cobra.Command{
	Use:   "cpu",
	Short: "CPU information",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		for {
			res, err := h.GetCpu()
			if err != nil {
				log.Fatalf("Error: %v", err)
			}
			if jsonOutput {
				data, _ := json.Marshal(res)
				fmt.Println(string(data))
			} else {
				for _, c := range res {
					fmt.Printf("Core %d: %.1f%%  ", c.Index, c.Usage)
				}
				fmt.Println()
			}
			if !cores && !watch { // If neither core-detail nor watch is requested, exit after one run
				break
			}
			// If cores or watch is requested, we keep watching
			time.Sleep(1 * time.Second)
			if !watch { break }
		}
	},
}

var memCmd = &cobra.Command{
	Use:   "memory",
	Short: "Memory information",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		for {
			res, err := h.GetMemory()
			if err != nil {
				log.Fatalf("Error: %v", err)
			}
			if jsonOutput {
				data, _ := json.Marshal(res)
				fmt.Println(string(data))
			} else {
				fmt.Printf("\rUsed: %d MB / %d MB (%.1f%%)   ", res.Used/1024/1024, res.Total/1024/1024, res.UsagePercent)
			}
			if !watch {
				fmt.Println()
				break
			}
			time.Sleep(1 * time.Second)
		}
	},
}

var procCmd = &cobra.Command{
	Use:   "processes",
	Short: "Process list",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		res, err := h.GetProcesses()
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		// Apply filters here if needed
		data, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println(string(data))
	},
}

var tempCmd = &cobra.Command{
	Use:   "temp",
	Short: "Temperature sensors",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		res, err := h.GetTemp()
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		data, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println(string(data))
	},
}

var pathsCmd = &cobra.Command{
	Use:   "paths",
	Short: "System PATH directories",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		res := h.GetPaths()
		data, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println(string(data))
	},
}

var quickCmd = &cobra.Command{
	Use:   "quick",
	Short: "Quick system summary",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		info, _ := h.GetInfo()
		mem, _ := h.GetMemory()
		res := map[string]interface{}{
			"hostname": info.Hostname,
			"os":       info.OSName,
			"cpu":      info.CPUBrand,
			"memory":   fmt.Sprintf("%.1f%% used", mem.UsagePercent),
			"uptime":   info.Uptime,
		}
		data, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println(string(data))
	},
}

var portsCmd = &cobra.Command{
	Use:   "ports",
	Short: "Listening ports",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		res, err := h.GetPorts()
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		data, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println(string(data))
	},
}

var batteryCmd = &cobra.Command{
	Use:   "battery",
	Short: "Battery status",
	Run: func(cmd *cobra.Command, args []string) {
		h := handlers.NewSysHandler()
		res, err := h.GetBattery()
		if err != nil {
			log.Fatalf("Error: %v", err)
		}
		data, _ := json.MarshalIndent(res, "", "  ")
		fmt.Println(string(data))
	},
}

func init() {
	infoCmd.Flags().BoolVarP(&extended, "extended", "e", false, "Extended info")
	cpuCmd.Flags().BoolVarP(&cores, "cores", "c", false, "Per-core usage")
	memCmd.Flags().BoolVarP(&watch, "watch", "w", false, "Watch memory (continuous)")
	procCmd.Flags().Uint32Var(&pid, "pid", 0, "Specific PID")
	procCmd.Flags().IntVar(&topCpu, "top-cpu", 0, "Top CPU consumers")
	procCmd.Flags().IntVar(&topMem, "top-mem", 0, "Top memory consumers")

	sysCmd.AddCommand(infoCmd)
	sysCmd.AddCommand(cpuCmd)
	sysCmd.AddCommand(memCmd)
	sysCmd.AddCommand(procCmd)
	sysCmd.AddCommand(tempCmd)
	sysCmd.AddCommand(pathsCmd)
	sysCmd.AddCommand(quickCmd)
	sysCmd.AddCommand(portsCmd)
	sysCmd.AddCommand(batteryCmd)
	rootCmd.AddCommand(sysCmd)
}
