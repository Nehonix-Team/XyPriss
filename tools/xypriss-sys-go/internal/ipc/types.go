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

package ipc

import (
	"encoding/json"
)

type HeaderValue struct {
	Single   string   `json:"Single,omitempty"`
	Multiple []string `json:"Multiple,omitempty"`
}

// UnmarshalJSON implements custom unmarshaling for
// HeaderValue to handle both string and array of strings
func (h *HeaderValue) UnmarshalJSON(data []byte) error {
	var s string
	if err := json.Unmarshal(data, &s); err == nil {
		h.Single = s
		return nil
	}
	var ss []string
	if err := json.Unmarshal(data, &ss); err == nil {
		h.Multiple = ss
		return nil
	}
	return json.Unmarshal(data, h)
}

type JsRequest struct {
	ID         string                 `json:"id"`
	Method     string                 `json:"method"`
	URL        string                 `json:"url"`
	Headers    map[string]HeaderValue `json:"headers"`
	Query      map[string]string      `json:"query"`
	Params     map[string]string      `json:"params"`
	RemoteAddr string                 `json:"remote_addr"`
	LocalAddr  string                 `json:"local_addr"`
	Body       []byte                 `json:"body,omitempty"`
}

type JsResponse struct {
	ID      string                 `json:"id"`
	Status  uint16                 `json:"status"`
	Headers map[string]HeaderValue `json:"headers"`
	Body    []byte                 `json:"body,omitempty"`
}

type RouteConfig struct {
	Method   string  `json:"method"`
	Path     string  `json:"path"`
	Target   string  `json:"target"`
	FilePath *string `json:"file_path,omitempty"`
}

const (
	MsgTypeRequest        = "Request"
	MsgTypeResponse       = "Response"
	MsgTypeSyncRoutes     = "SyncRoutes"
	MsgTypePing           = "Ping"
	MsgTypePong           = "Pong"
	MsgTypeRegisterWorker = "RegisterWorker"
	MsgTypeForceGC        = "ForceGC"
	MsgTypeTask           = "Task"
	MsgTypeTaskResult     = "TaskResult"
)

type IpcMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type RegisterWorkerPayload struct {
	ID string `json:"id"`
}
