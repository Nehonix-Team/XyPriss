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

package handlers

import (
	"os"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/sys"
)

type SysHandler struct {
	system *sys.XyPrissSys
}

func NewSysHandler() *SysHandler {
	return &SysHandler{
		system: sys.NewXyPrissSys(),
	}
}

func (h *SysHandler) GetInfo() (sys.SysInfo, error) {
	return h.system.GetSystemInfo()
}

func (h *SysHandler) GetCpu() ([]sys.CpuInfo, error) {
	return h.system.GetCpuInfo()
}

func (h *SysHandler) GetMemory() (sys.MemoryInfo, error) {
	return h.system.GetMemoryInfo()
}

func (h *SysHandler) GetDisks() ([]sys.DiskInfo, error) {
	return h.system.GetDisksInfo()
}

func (h *SysHandler) GetProcesses() ([]sys.ProcessInfo, error) {
	return h.system.GetProcesses()
}

func (h *SysHandler) KillProcess(pid uint32) error {
	return h.system.KillProcess(pid)
}

func (h *SysHandler) GetNetwork() ([]sys.NetworkInterface, error) {
	return h.system.GetNetworkInterfaces()
}

func (h *SysHandler) GetHealth() int {
	return h.system.GetSystemHealthScore()
}

func (h *SysHandler) GetEnv() map[string]string {
	return h.system.GetEnvVars()
}

func (h *SysHandler) GetEnvVar(name string) string {
	return os.Getenv(name)
}

func (h *SysHandler) GetUser() (*sys.UserInfo, error) {
	return h.system.GetCurrentUser()
}

func (h *SysHandler) GetBattery() (sys.BatteryInfo, error) {
	return h.system.GetBatteryInfo()
}

func (h *SysHandler) GetTemp() ([]sys.TemperatureInfo, error) {
	return h.system.GetTempInfo()
}

func (h *SysHandler) GetPaths() []string {
	return h.system.GetPathDirs()
}

func (h *SysHandler) GetPorts() ([]sys.PortInfo, error) {
	return h.system.GetPorts()
}
