//go:build windows

/* *****************************************************************************
 * Nehonix XyPriss System CLI
 * (see worker.go for full license header)
 ***************************************************************************** */

package cluster

import (
	"os"
	"os/exec"
)

func applyOSSpecificSettings(cmd *exec.Cmd, config *ClusterConfig) {
	// On Windows, process groups and FD limits work differently.
	// Job Objects would be the idiomatic approach for resource limiting,
	// but that requires additional Win32 API calls beyond the standard library.
	// Left as a future enhancement.
}

func setWorkerPriority(pid int, priority int) {
	// Setting nice/priority on Windows requires OpenProcess + SetPriorityClass
	// via golang.org/x/sys/windows. Not implemented with stdlib syscall.
}

// sendGracefulSignal on Windows uses os.Process.Signal with os.Interrupt,
// which maps to GenerateConsoleCtrlEvent (CTRL_C_EVENT) for console processes.
// For non-console processes this will fall back to TerminateProcess.
func sendGracefulSignal(process *os.Process) error {
	return process.Signal(os.Interrupt)
}