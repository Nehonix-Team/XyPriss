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
	"encoding/binary"
	"encoding/hex"
	"encoding/json"
	"fmt"
	"io"
	"net"
	"os"
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/XHSC/internal/fs"
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

func (h *FsHandler) Cat(path string, writer io.Writer, offset, length int64) error {
	return h.fs.Cat(path, writer, offset, length)
}

func (h *FsHandler) CatWrite(path string, reader io.Reader) error {
	return h.fs.CatWrite(path, reader)
}

func (h *FsHandler) Resolve(path string) string {
	return h.fs.Resolve(path)
}

func (h *FsHandler) AtomicWrite(path, data string) error {
	return h.fs.AtomicWrite(path, data)
}

func (h *FsHandler) Shred(path string, passes int) error {
	return h.fs.Shred(path, passes)
}

func (h *FsHandler) Tail(path string, lines int) ([]string, error) {
	return h.fs.Tail(path, lines)
}

func (h *FsHandler) Patch(path, search, replace string) (bool, error) {
	return h.fs.Patch(path, search, replace)
}

func (h *FsHandler) Split(path string, bytesPerChunk int, outDir string) ([]string, error) {
	return h.fs.Split(path, bytesPerChunk, outDir)
}

func (h *FsHandler) Merge(sourceFiles []string, destFile string) error {
	return h.fs.Merge(sourceFiles, destFile)
}

func (h *FsHandler) Lock(path string) (bool, error) {
	return h.fs.LockFileMethod(path)
}

func (h *FsHandler) Unlock(path string) error {
	return h.fs.UnlockFileMethod(path)
}

func (h *FsHandler) WriteSecure(path, data, mode string) error {
	return h.fs.WriteSecure(path, data, mode)
}

func (h *FsHandler) Encrypt(path, key string) error {
	return h.fs.Encrypt(path, key)
}

func (h *FsHandler) Decrypt(path, key string) error {
	return h.fs.Decrypt(path, key)
}

func (h *FsHandler) DiffFiles(fileA, fileB string) ([]fs.DiffResult, error) {
	return h.fs.DiffFiles(fileA, fileB)
}

func (h *FsHandler) TopBigFiles(dir string, limit int) ([]fs.TopFile, error) {
	return h.fs.TopBigFiles(dir, limit)
}

func (h *FsHandler) Open(path string, flags int, mode os.FileMode) (uint32, error) {
	// fmt.Fprintf(os.Stderr, "[DEBUG] CLI IPC Path: %s\n", os.Getenv("XYPRISS_IPC_PATH"))
	// Try delegation if IPC is available
	if id, err := h.delegateOpenToIPC(path, flags, mode); err == nil {
		return id, nil
	}

	f, err := os.OpenFile(h.fs.Resolve(path), flags, mode)
	if err != nil {
		return 0, err
	}
	return GetRegistry().Register(f), nil
}

func (h *FsHandler) Close(id uint32) error {
	// Try delegation if IPC is available
	if err := h.delegateCloseToIPC(id); err == nil {
		return nil
	}

	f, err := GetRegistry().Unregister(id)
	if err != nil {
		return err
	}
	return f.Close()
}

func (h *FsHandler) ReadHandle(id uint32, length int) ([]byte, error) {
	if res, err := h.delegateHandleOpToIPC("handle-read", map[string]interface{}{"handle": id, "length": length}); err == nil {
		var data struct {
			Content string `json:"content"`
		}
		json.Unmarshal(res, &data)
		return hex.DecodeString(data.Content)
	}

	f, ok := GetRegistry().Get(id)
	if !ok {
		return nil, fmt.Errorf("invalid handle: %d", id)
	}

	buf := make([]byte, length)
	n, err := f.Read(buf)
	if err != nil && err != io.EOF {
		return nil, err
	}
	return buf[:n], nil
}

func (h *FsHandler) WriteHandle(id uint32, data []byte) (int, error) {
	if res, err := h.delegateHandleOpToIPC("handle-write", map[string]interface{}{"handle": id, "data": hex.EncodeToString(data)}); err == nil {
		var d struct {
			N int `json:"n"`
		}
		json.Unmarshal(res, &d)
		return d.N, nil
	}

	f, ok := GetRegistry().Get(id)
	if !ok {
		return 0, fmt.Errorf("invalid handle: %d", id)
	}

	return f.Write(data)
}

func (h *FsHandler) SeekHandle(id uint32, offset int64, whence int) (int64, error) {
	if res, err := h.delegateHandleOpToIPC("handle-seek", map[string]interface{}{"handle": id, "offset": offset, "whence": whence}); err == nil {
		var data struct {
			Pos int64 `json:"pos"`
		}
		json.Unmarshal(res, &data)
		return data.Pos, nil
	}

	f, ok := GetRegistry().Get(id)
	if !ok {
		return 0, fmt.Errorf("invalid handle: %d", id)
	}

	return f.Seek(offset, whence)
}

func (h *FsHandler) StatHandle(id uint32) (fs.FileStats, error) {
	if res, err := h.delegateHandleOpToIPC("handle-stat", map[string]interface{}{"handle": id}); err == nil {
		var stats fs.FileStats
		json.Unmarshal(res, &stats)
		return stats, nil
	}

	f, ok := GetRegistry().Get(id)
	if !ok {
		return fs.FileStats{}, fmt.Errorf("invalid handle: %d", id)
	}

	info, err := f.Stat()
	if err != nil {
		return fs.FileStats{}, err
	}

	return fs.FileStats{
		Size:        info.Size(),
		Permissions: uint32(info.Mode().Perm()),
		Modified:    info.ModTime().Unix(),
		IsDir:       info.IsDir(),
		IsFile:      !info.IsDir(),
	}, nil
}

func (h *FsHandler) delegateHandleOpToIPC(action string, params map[string]interface{}) (json.RawMessage, error) {
	ipcPath := os.Getenv("XYPRISS_IPC_PATH")
	if ipcPath == "" {
		return nil, fmt.Errorf("no IPC path")
	}

	res, err := h.sendIpcCommand(ipcPath, "fs", action, params)
	if err != nil {
		// fmt.Fprintf(os.Stderr, "[DEBUG] IPC delegation error for %s: %v\n", action, err)
		return nil, err
	}
	return res, nil
}

func (h *FsHandler) delegateOpenToIPC(path string, flags int, mode os.FileMode) (uint32, error) {
	ipcPath := os.Getenv("XYPRISS_IPC_PATH")
	if ipcPath == "" {
		return 0, fmt.Errorf("no IPC path")
	}

	res, err := h.sendIpcCommand(ipcPath, "fs", "open", map[string]interface{}{
		"path":  path,
		"flags": flags,
		"mode":  fmt.Sprintf("%o", mode),
	})

	if err != nil {
		// fmt.Fprintf(os.Stderr, "[DEBUG] IPC open delegation error: %v\n", err)
		return 0, err
	}

	var data struct {
		Handle uint32 `json:"handle"`
	}
	if err := json.Unmarshal(res, &data); err != nil {
		return 0, err
	}
	return data.Handle, nil
}

func (h *FsHandler) delegateCloseToIPC(id uint32) error {
	socket := os.Getenv("XYPRISS_IPC_PATH")
	if socket == "" {
		return fmt.Errorf("no IPC available")
	}

	_, err := h.sendIpcCommand(socket, "fs", "close", map[string]interface{}{
		"handle": id,
	})
	return err
}

func (h *FsHandler) sendIpcCommand(socketPath, module, action string, params map[string]interface{}) ([]byte, error) {
	conn, err := net.DialTimeout("unix", socketPath, 2*time.Second)
	if err != nil {
		return nil, err
	}
	defer conn.Close()

	msg := map[string]interface{}{
		"type": "CoreCommand",
		"payload": map[string]interface{}{
			"module": module,
			"action": action,
			"params": params,
		},
	}

	payload, _ := json.Marshal(msg)
	size := uint32(len(payload))
	binary.Write(conn, binary.BigEndian, size)
	conn.Write(payload)

	// Read response
	if err := binary.Read(conn, binary.BigEndian, &size); err != nil {
		return nil, err
	}
	resPayload := make([]byte, size)
	if _, err := io.ReadFull(conn, resPayload); err != nil {
		return nil, err
	}

	var res struct {
		Status string          `json:"status"`
		Data   json.RawMessage `json:"data"`
		Error  string          `json:"error"`
	}
	if err := json.Unmarshal(resPayload, &res); err != nil {
		return nil, err
	}

	if res.Status == "error" {
		return nil, fmt.Errorf("%s", res.Error)
	}
	return res.Data, nil
}
