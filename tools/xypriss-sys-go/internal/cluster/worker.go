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
	"context"
	"fmt"
	"io"
	"log"
	"os"
	"os/exec"
	"path/filepath"
	"strconv"
	"sync"
	"time"
)

// WorkerState represents the lifecycle state of a worker process.
type WorkerState int

const (
	WorkerStateIdle     WorkerState = iota
	WorkerStateRunning              // Process is alive
	WorkerStateStopped              // Exited cleanly
	WorkerStateCrashed              // Exited with non-zero code
	WorkerStateKilling              // Graceful shutdown in progress
)

// Worker represents a managed child process (Node.js / Bun).
type Worker struct {
	ID            int
	Process       *os.Process
	Cmd           *exec.Cmd
	StartTime     time.Time
	Restarts      uint32
	LastHeartbeat time.Time

	// Protected by mu
	mu       sync.RWMutex
	state    WorkerState
	exitCode int

	// cancelFn cancels the context used for the process lifetime.
	cancelFn context.CancelFunc

	// done is closed when cmd.Wait() returns.
	done chan struct{}
}

// NewWorker allocates a Worker with the given ID.
func NewWorker(id int) *Worker {
	return &Worker{
		ID:            id,
		StartTime:     time.Now(),
		LastHeartbeat: time.Now(),
		state:         WorkerStateIdle,
		exitCode:      -1,
		done:          make(chan struct{}),
	}
}

// ClusterConfig holds configuration for spawning and managing workers.
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
	// ShutdownTimeout is how long Kill() waits for graceful exit before SIGKILL.
	// Defaults to 5 seconds when zero.
	ShutdownTimeout time.Duration `json:"shutdown_timeout"`
}

// Spawn starts the worker process described by config.
// It is safe to call Spawn again after a worker has stopped (e.g. for respawning),
// but the caller must ensure the previous process is no longer running.
func (w *Worker) Spawn(config *ClusterConfig) error {
	if config == nil {
		return fmt.Errorf("worker %d: nil config", w.ID)
	}
	if config.EntryPoint == "" {
		return fmt.Errorf("worker %d: entry_point is required", w.ID)
	}

	log.Printf("[Worker %d] Spawning (restarts=%d)", w.ID, w.Restarts)

	runner := resolveRunner(config.EntryPoint)
	args := buildArgs(runner, config)

	ctx, cancel := context.WithCancel(context.Background())
	cmd := exec.CommandContext(ctx, runner, args...)

	cmd.Env = buildEnv(w.ID, config)

	stdout, err := cmd.StdoutPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("worker %d: stdout pipe: %w", w.ID, err)
	}
	stderr, err := cmd.StderrPipe()
	if err != nil {
		cancel()
		return fmt.Errorf("worker %d: stderr pipe: %w", w.ID, err)
	}

	applyOSSpecificSettings(cmd, config)

	if err := cmd.Start(); err != nil {
		cancel()
		return fmt.Errorf("worker %d: start: %w", w.ID, err)
	}

	setWorkerPriority(cmd.Process.Pid, config.Priority)

	// Reset the done channel so callers can Wait() on the new process.
	done := make(chan struct{})

	w.mu.Lock()
	w.Cmd = cmd
	w.Process = cmd.Process
	w.StartTime = time.Now()
	w.LastHeartbeat = time.Now()
	w.state = WorkerStateRunning
	w.exitCode = -1
	w.cancelFn = cancel
	w.done = done
	w.mu.Unlock()

	go w.streamLogs(stdout, "INFO")
	go w.streamLogs(stderr, "WARN")

	// Reap the child process so it does not become a zombie and
	// so that pipe file descriptors are properly released.
	go func() {
		defer close(done)
		defer cancel() // always release the context

		waitErr := cmd.Wait()

		w.mu.Lock()
		defer w.mu.Unlock()

		if waitErr != nil {
			if exitErr, ok := waitErr.(*exec.ExitError); ok {
				w.exitCode = exitErr.ExitCode()
			} else {
				w.exitCode = -1
			}
			if w.state != WorkerStateKilling {
				w.state = WorkerStateCrashed
			} else {
				w.state = WorkerStateStopped
			}
			log.Printf("[Worker %d] exited with error: %v (code=%d)", w.ID, waitErr, w.exitCode)
		} else {
			w.exitCode = 0
			w.state = WorkerStateStopped
			log.Printf("[Worker %d] exited cleanly", w.ID)
		}
	}()

	return nil
}

// Wait blocks until the worker's process exits. It returns immediately if the
// worker was never started.
func (w *Worker) Wait() {
	w.mu.RLock()
	done := w.done
	w.mu.RUnlock()
	if done != nil {
		<-done
	}
}

// Kill sends a graceful termination signal to the worker. After ShutdownTimeout
// (default 5 s) it forcibly kills the process if it has not already exited.
// Kill is a no-op if the worker is not running.
func (w *Worker) Kill() error {
	w.mu.Lock()
	if w.state != WorkerStateRunning {
		w.mu.Unlock()
		return nil
	}
	w.state = WorkerStateKilling
	done := w.done
	process := w.Process
	w.mu.Unlock()

	timeout := w.shutdownTimeout()

	// Platform-specific graceful signal (SIGTERM on Unix, TerminateProcess on Windows).
	if err := sendGracefulSignal(process); err != nil {
		log.Printf("[Worker %d] graceful signal failed: %v — forcing kill", w.ID, err)
		_ = process.Kill()
		return err
	}

	// Wait for the process to exit, then force-kill if it takes too long.
	select {
	case <-done:
		// exited cleanly within timeout window
	case <-time.After(timeout):
		log.Printf("[Worker %d] did not exit within %s — sending SIGKILL", w.ID, timeout)
		if err := process.Kill(); err != nil {
			return fmt.Errorf("worker %d: force kill: %w", w.ID, err)
		}
	}
	return nil
}

// IsAlive returns true if the worker process is currently running.
func (w *Worker) IsAlive() bool {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.state == WorkerStateRunning || w.state == WorkerStateKilling
}

// State returns the current WorkerState.
func (w *Worker) State() WorkerState {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.state
}

// ExitCode returns the exit code of the last process run, or -1 if unavailable.
func (w *Worker) ExitCode() int {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return w.exitCode
}

// PID returns the PID of the current (or last) process, or 0 if none.
func (w *Worker) PID() int {
	w.mu.RLock()
	defer w.mu.RUnlock()
	if w.Process != nil {
		return w.Process.Pid
	}
	return 0
}

// UpdateHeartbeat records the current time as the last heartbeat.
func (w *Worker) UpdateHeartbeat() {
	w.mu.Lock()
	w.LastHeartbeat = time.Now()
	w.mu.Unlock()
}

// HeartbeatAge returns how long ago the last heartbeat was received.
func (w *Worker) HeartbeatAge() time.Duration {
	w.mu.RLock()
	defer w.mu.RUnlock()
	return time.Since(w.LastHeartbeat)
}

// ─── helpers ─────────────────────────────────────────────────────────────────

func (w *Worker) shutdownTimeout() time.Duration {
	// We can't read config here without storing it, so use a sane default.
	// Callers that need a custom timeout can be extended later.
	return 5 * time.Second
}

func resolveRunner(entryPoint string) string {
	if filepath.Ext(entryPoint) == ".ts" {
		return "bun"
	}
	return "node"
}

func buildArgs(runner string, config *ClusterConfig) []string {
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
	return args
}

func buildEnv(workerID int, config *ClusterConfig) []string {
	return append(os.Environ(),
		"XYPRISS_WORKER_ID="+strconv.Itoa(workerID),
		"XYPRISS_IPC_PATH="+config.IpcPath,
		"XYPRISS_MAX_CPU="+strconv.Itoa(config.MaxCPU),
		"NODE_ENV=production",
		"NO_COLOR=1",
	)
}

func (w *Worker) streamLogs(r io.Reader, level string) {
	scanner := bufio.NewScanner(r)
	scanner.Buffer(make([]byte, 64*1024), 256*1024)
	for scanner.Scan() {
		log.Printf("[%s][Worker %d] %s", level, w.ID, scanner.Text())
	}
	if err := scanner.Err(); err != nil {
		log.Printf("[%s][Worker %d] log scanner error: %v", level, w.ID, err)
	}
}