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
	"encoding/hex"
	"os"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/fs"
)

type FsHandler struct {
	fs *fs.XyPrissFS
}

func NewFsHandler(root string) *FsHandler {
	return &FsHandler{
		fs: fs.NewXyPrissFS(root),
	}
}

func (h *FsHandler) Ls(path string, recursive, stats bool) (interface{}, error) {
	return h.fs.LsExtended(path, recursive, stats)
}

func (h *FsHandler) ReadFile(path string, bytes bool) (interface{}, error) {
	content, err := h.fs.ReadFile(path)
	if err != nil {
		return nil, err
	}
	if bytes {
		return hex.EncodeToString([]byte(content)), nil
	}
	return content, nil
}

func (h *FsHandler) WriteFile(path string, data string, append bool) error {
	if append {
		f, err := os.OpenFile(h.fs.Resolve(path), os.O_APPEND|os.O_CREATE|os.O_WRONLY, 0644)
		if err != nil {
			return err
		}
		defer f.Close()
		_, err = f.WriteString(data)
		return err
	}
	return h.fs.WriteFile(path, data)
}

func (h *FsHandler) Mkdir(path string, parents bool) error {
	if parents {
		return h.fs.Mkdir(path)
	}
	return os.Mkdir(h.fs.Resolve(path), 0755)
}

func (h *FsHandler) Remove(path string, force bool) error {
	if force {
		return h.fs.Remove(path)
	}
	return os.Remove(h.fs.Resolve(path))
}

func (h *FsHandler) Copy(src, dest string) error {
	return h.fs.Copy(src, dest)
}

func (h *FsHandler) Move(src, dest string) error {
	return h.fs.Move(src, dest)
}

func (h *FsHandler) Touch(path string) error {
	return h.fs.Touch(path)
}

func (h *FsHandler) Hash(path string) (string, error) {
	return h.fs.Hash(path)
}

func (h *FsHandler) Stats(path string) (fs.FileStats, error) {
	return h.fs.Stats(path)
}

func (h *FsHandler) Verify(path, hash string) (map[string]interface{}, error) {
	actual, err := h.fs.Hash(path)
	if err != nil {
		return nil, err
	}
	return map[string]interface{}{"valid": actual == hash}, nil
}

func (h *FsHandler) Size(path string, human bool) (fs.SizeInfo, error) {
	return h.fs.GetSize(path, human)
}

func (h *FsHandler) Link(src, dest string) error {
	return h.fs.CreateLink(src, dest)
}

func (h *FsHandler) Chmod(path, mode string) error {
	return h.fs.Chmod(path, mode)
}

func (h *FsHandler) Check(path string) fs.CheckStatus {
	return h.fs.Check(path)
}

func (h *FsHandler) Du(path string) (fs.DirUsage, error) {
	return h.fs.Du(path)
}

func (h *FsHandler) Sync(src, dest string) error {
	return h.fs.Sync(src, dest)
}

func (h *FsHandler) Dedupe(path string) ([]fs.DedupeGroup, error) {
	return h.fs.Dedupe(path)
}

func (h *FsHandler) Stream(path string, chunkSize int, hex bool) (string, error) {
	return h.fs.StreamContent(path, chunkSize, hex)
}

func (h *FsHandler) Resolve(path string) string {
	return h.fs.Resolve(path)
}
