//go:build !windows

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
	"os/exec"
	"syscall"
)

func applyOSSpecificSettings(cmd *exec.Cmd, config *ClusterConfig) {
	// Set process group so we can kill children if needed
	cmd.SysProcAttr = &syscall.SysProcAttr{
		Setpgid: true,
	}

	// File descriptor limits
	if config.FileDescriptorLimit > 0 {
		var rLimit syscall.Rlimit
		rLimit.Max = config.FileDescriptorLimit
		rLimit.Cur = config.FileDescriptorLimit
		_ = syscall.Setrlimit(syscall.RLIMIT_NOFILE, &rLimit)
	}
}

func setWorkerPriority(pid int, priority int) {
	if priority != 0 {
		_ = syscall.Setpriority(syscall.PRIO_PROCESS, pid, priority)
	}
}
