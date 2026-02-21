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
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/sys"
)

type MonitorHandler struct {
	system *sys.XyPrissSys
}

func NewMonitorHandler() *MonitorHandler {
	return &MonitorHandler{
		system: sys.NewXyPrissSys(),
	}
}

func (h *MonitorHandler) MonitorSystem(duration, interval time.Duration, callback func(sys.SystemSnapshot)) {
	h.system.MonitorSystem(duration, interval, callback)
}

func (h *MonitorHandler) MonitorProcess(pid uint32, duration, interval time.Duration, callback func(sys.ProcessSnapshot)) {
	h.system.MonitorProcess(pid, duration, interval, callback)
}
