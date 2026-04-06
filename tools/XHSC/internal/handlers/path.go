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

	"github.com/Nehonix-Team/XyPriss/tools/XHSC/internal/fs"
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

func (h *PathHandler) IsChild(parent, child string) (bool, error) {
	p := h.fs.Resolve(parent)
	c := h.fs.Resolve(child)
	rel, err := filepath.Rel(p, c)
	if err != nil {
		return false, nil
	}
	return !strings.HasPrefix(rel, "..") && rel != "..", nil
}

func (h *PathHandler) SecureJoin(base string, segments ...string) (string, error) {
	fullBase := h.fs.Resolve(base)
	joined := filepath.Join(append([]string{fullBase}, segments...)...)
	
	rel, err := filepath.Rel(fullBase, joined)
	if err != nil || strings.HasPrefix(rel, "..") {
		return fullBase, nil // Return base if traversal detected
	}
	return joined, nil
}

func (h *PathHandler) Metadata(p string) (map[string]interface{}, error) {
	return map[string]interface{}{
		"dir":         filepath.Dir(p),
		"base":        filepath.Base(p),
		"ext":         filepath.Ext(p),
		"name":        strings.TrimSuffix(filepath.Base(p), filepath.Ext(p)),
		"is_absolute": filepath.IsAbs(p),
	}, nil
}

func (h *PathHandler) ToNamespaced(p string) (string, error) {
	// filepath.ToNamespacedPath is essentially for Windows, on other platforms it returns the path
	return filepath.Clean(p), nil
}

func (h *PathHandler) NormalizeSeparators(p string) (string, error) {
	return filepath.FromSlash(filepath.ToSlash(p)), nil
}

func (h *PathHandler) CommonBase(paths ...string) (string, error) {
	if len(paths) == 0 {
		return "", nil
	}
	if len(paths) == 1 {
		return filepath.Dir(paths[0]), nil
	}

	// Simple common prefix logic for paths
	parts := strings.Split(filepath.Clean(paths[0]), string(filepath.Separator))
	for i := 1; i < len(paths); i++ {
		other := strings.Split(filepath.Clean(paths[i]), string(filepath.Separator))
		if len(other) < len(parts) {
			parts = parts[:len(other)]
		}
		for j := 0; j < len(parts); j++ {
			if parts[j] != other[j] {
				parts = parts[:j]
				break
			}
		}
	}
	
	if len(parts) == 0 {
		if filepath.IsAbs(paths[0]) {
			return string(filepath.Separator), nil
		}
		return ".", nil
	}
	
	return strings.Join(parts, string(filepath.Separator)), nil
}

func (h *PathHandler) IsAbsolute(p string) (bool, error) {
	return filepath.IsAbs(p), nil
}
