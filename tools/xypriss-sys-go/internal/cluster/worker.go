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

package cluster

import (
	"bufio"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"time"
)

type Worker struct {
	ID            int
	Process       *os.Process
	Cmd           *exec.Cmd
	StartTime     time.Time
	Restarts      uint32
	LastHeartbeat time.Time
}

func NewWorker(id int) *Worker {
	return &Worker{
		ID:            id,
		StartTime:     time.Now(),
		LastHeartbeat: time.Now(),
	}
}

type ClusterConfig struct {
	Workers             int               `json:"workers"`
	Respawn             bool              `json:"respawn"`
	IpcPath             string            `json:"ipc_path"`
	EntryPoint          string            `json:"entry_point"`
	Strategy            BalancingStrategy `json:"strategy"`
	MaxMemory           int               `json:"max_memory"`
	MaxCPU              int               `json:"max_cpu"`
	Priority            int               `json:"priority"`
	FileDescriptorLimit uint64            `json:"file_descriptor_limit"`
	GCHint              bool              `json:"gc_hint"`
	MemoryCheckInterval uint64            `json:"memory_check_interval"`
	EnforceHardLimits   bool              `json:"enforce_hard_limits"`
	IntelligenceEnabled bool              `json:"intelligence_enabled"`
	PreAllocate         bool              `json:"pre_allocate"`
	RescueMode          bool              `json:"rescue_mode"`
}

func (w *Worker) Spawn(config *ClusterConfig) error {
	log.Printf("Spawning worker %d (Node.js/Bun)", w.ID)

	runner := "node"
	if filepath.Ext(config.EntryPoint) == ".ts" {
		runner = "bun"
	}

	var args []string
	if runner == "node" {
		if config.MaxMemory > 0 {
			args = append(args, fmt.Sprintf("--max-old-space-size=%d", config.MaxMemory))
		}
		if config.GCHint {
			args = append(args, "--expose-gc")
		}
	}
	args = append(args, config.EntryPoint)

	cmd := exec.Command(runner, args...)

	// Environment variables
	cmd.Env = append(os.Environ(),
		"XYPRISS_WORKER_ID="+strconv.Itoa(w.ID),
		"XYPRISS_IPC_PATH="+config.IpcPath,
		"XYPRISS_MAX_CPU="+strconv.Itoa(config.MaxCPU),
		"NODE_ENV=production",
		"NO_COLOR=1",
	)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		return fmt.Errorf("failed to capture stdout: %w", err)
	}

	stderr, err := cmd.StderrPipe()
	if err != nil {
		return fmt.Errorf("failed to capture stderr: %w", err)
	}

	// Apply OS-specific limits and attributes
	applyOSSpecificSettings(cmd, config)

	if err := cmd.Start(); err != nil {
		return fmt.Errorf("failed to start worker: %w", err)
	}

	// Set Priority (Nice value)
	setWorkerPriority(cmd.Process.Pid, config.Priority)

	w.Process = cmd.Process
	w.Cmd = cmd
	w.StartTime = time.Now()
	w.LastHeartbeat = time.Now()

	// Stream logs in background
	go w.streamLogs(stdout, "INFO")
	go w.streamLogs(stderr, "WARN")

	return nil
}

func (w *Worker) streamLogs(r io.Reader, level string) {
	scanner := bufio.NewScanner(r)
	for scanner.Scan() {
		log.Printf("[%s][Worker %d] %s", level, w.ID, scanner.Text())
	}
}

func (w *Worker) IsAlive() bool {
	if w.Process == nil {
		return false
	}
	// On Unix, p.Signal(0) checks if process exists
	err := w.Process.Signal(os.Signal(nil))
	return err == nil
}

func (w *Worker) PID() int {
	if w.Process != nil {
		return w.Process.Pid
	}
	return 0
}
