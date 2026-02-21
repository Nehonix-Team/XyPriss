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
	"path/filepath"
	"strings"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/fs"
)

type PathHandler struct {
	fs *fs.XyPrissFS
}

func NewPathHandler(root string) *PathHandler {
	return &PathHandler{
		fs: fs.NewXyPrissFS(root),
	}
}

func (h *PathHandler) Resolve(paths ...string) (string, error) {
	return h.fs.Resolve(filepath.Join(paths...)), nil
}

func (h *PathHandler) Join(paths ...string) (string, error) {
	return filepath.Join(paths...), nil
}

func (h *PathHandler) Dirname(path string) (string, error) {
	return filepath.Dir(path), nil
}

func (h *PathHandler) Basename(path string, suffix string) (string, error) {
	base := filepath.Base(path)
	if suffix != "" {
		return strings.TrimSuffix(base, suffix), nil
	}
	return base, nil
}

func (h *PathHandler) Extname(path string) (string, error) {
	return filepath.Ext(path), nil
}

func (h *PathHandler) Relative(from, to string) (string, error) {
	return filepath.Rel(from, to)
}

func (h *PathHandler) Normalize(path string) (string, error) {
	return filepath.Clean(path), nil
}
