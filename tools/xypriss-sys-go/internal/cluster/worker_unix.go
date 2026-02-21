//go:build !windows

/* *****************************************************************************
 * Nehonix XyPriss System CLI
 * (see worker.go for full license header)
 ***************************************************************************** */

package cluster

import (
	"os"
	"os/exec"
	"syscall"
)

func applyOSSpecificSettings(cmd *exec.Cmd, config *ClusterConfig) {
	// Place the child in its own process group so we can signal the entire
	// group (child + any grandchildren) when needed.
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}

	if config.FileDescriptorLimit > 0 {
		if err := syscall.Setrlimit(syscall.RLIMIT_NOFILE, &syscall.Rlimit{
			Cur: config.FileDescriptorLimit,
			Max: config.FileDescriptorLimit,
		}); err != nil {
			// Non-fatal: log but continue
			_ = err
		}
	}
}

func setWorkerPriority(pid int, priority int) {
	if priority != 0 {
		_ = syscall.Setpriority(syscall.PRIO_PROCESS, pid, priority)
	}
}

// sendGracefulSignal sends SIGTERM to the process group so that child
// processes (e.g. node child workers) also receive the signal.
func sendGracefulSignal(process *os.Process) error {
	// Negative PID targets the entire process group.
	return syscall.Kill(-process.Pid, syscall.SIGTERM)
}