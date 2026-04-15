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
	"fmt"
)

type HeaderValue struct {
	Single   string   `json:"Single,omitempty"`
	Multiple []string `json:"Multiple,omitempty"`
}

// UnmarshalJSON implements custom unmarshaling for
// HeaderValue to handle both string and array of strings
func (h *HeaderValue) UnmarshalJSON(data []byte) error {
	if len(data) == 0 || string(data) == "null" {
		return nil
	}

	// Fast path based on the first character of JSON
	switch data[0] {
	case '"':
		var s string
		if err := json.Unmarshal(data, &s); err == nil {
			h.Single = s
			return nil
		}
	case '[':
		var ss []string
		if err := json.Unmarshal(data, &ss); err == nil {
			h.Multiple = ss
			return nil
		}
	case '{':
		// Use an Alias to avoid infinite recursion for struct mapping
		type Alias HeaderValue
		var alias Alias
		if err := json.Unmarshal(data, &alias); err == nil {
			*h = HeaderValue(alias)
			return nil
		}
	default:
		// Handle numeric header values gracefully (common in content-length, etc)
		var num float64
		if err := json.Unmarshal(data, &num); err == nil {
			h.Single = fmt.Sprintf("%v", num)
			return nil
		}
	}

	return fmt.Errorf("invalid header value format: %s", string(data))
}

type JsFile struct {
	FieldName    string `json:"fieldname"`
	OriginalName string `json:"originalname"`
	Encoding     string `json:"encoding"`
	MimeType     string `json:"mimetype"`
	Destination  string `json:"destination"`
	Filename     string `json:"filename"`
	Path         string `json:"path"`
	Size         int64  `json:"size"`
}

type UploadError struct {
	FieldName string `json:"fieldname"`
	FileName  string `json:"filename"`
	Message   string `json:"message"`
	Type      string `json:"type"`
}

type JsRequest struct {
	ID           string                 `json:"id"`
	Method       string                 `json:"method"`
	URL          string                 `json:"url"`
	Headers      map[string]HeaderValue `json:"headers"`
	Query        map[string]string      `json:"query"`
	Params       map[string]string      `json:"params"`
	RemoteAddr   string                 `json:"remote_addr"`
	LocalAddr    string                 `json:"local_addr"`
	Body         []byte                 `json:"body,omitempty"`
	Files        []JsFile               `json:"files,omitempty"`
	UploadErrors []UploadError          `json:"upload_errors,omitempty"`
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
	MsgTypeCoreCommand    = "CoreCommand"
)

type CoreCommandPayload struct {
	Module string                 `json:"module"`
	Action string                 `json:"action"`
	Params map[string]interface{} `json:"params"`
}

type IpcMessage struct {
	Type    string          `json:"type"`
	Payload json.RawMessage `json:"payload"`
}

type RegisterWorkerPayload struct {
	ID string `json:"id"`
}
