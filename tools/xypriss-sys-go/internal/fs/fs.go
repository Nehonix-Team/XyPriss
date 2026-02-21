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

package fs

import (
	"archive/tar"
	"archive/zip"
	"bufio"
	"compress/gzip"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"strconv"
	"strings"
	"time"
)

type FileStats struct {
	Size        int64  `json:"size"`
	Created     int64  `json:"created"`
	Modified    int64  `json:"modified"`
	Accessed    int64  `json:"accessed"`
	IsDir       bool   `json:"is_dir"`
	IsFile      bool   `json:"is_file"`
	IsSymlink   bool   `json:"is_symlink"`
	Permissions uint32 `json:"permissions"`
}

type XyPrissFS struct {
	Root string
}

func NewXyPrissFS(root string) *XyPrissFS {
	absRoot, _ := filepath.Abs(root)
	return &XyPrissFS{Root: absRoot}
}

func (fs *XyPrissFS) Resolve(path string) string {
	if filepath.IsAbs(path) {
		return path
	}
	return filepath.Join(fs.Root, path)
}

func (fs *XyPrissFS) Exists(path string) bool {
	_, err := os.Stat(fs.Resolve(path))
	return err == nil
}

func (fs *XyPrissFS) Stats(path string) (FileStats, error) {
	fullPath := fs.Resolve(path)
	info, err := os.Lstat(fullPath)
	if err != nil {
		return FileStats{}, err
	}

	return FileStats{
		Size:        info.Size(),
		Modified:    info.ModTime().Unix(),
		IsDir:       info.IsDir(),
		IsFile:      !info.IsDir(),
		IsSymlink:   info.Mode()&os.ModeSymlink != 0,
		Permissions: uint32(info.Mode().Perm()),
	}, nil
}

func (fs *XyPrissFS) Ls(path string) ([]string, error) {
	entries, err := os.ReadDir(fs.Resolve(path))
	if err != nil {
		return nil, err
	}

	var names []string
	for _, entry := range entries {
		names = append(names, entry.Name())
	}
	return names, nil
}

func (fs *XyPrissFS) RecursiveSize(path string) (int64, error) {
	var size int64
	err := filepath.Walk(fs.Resolve(path), func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}
		if !info.IsDir() {
			size += info.Size()
		}
		return nil
	})
	return size, err
}

func (fs *XyPrissFS) ReadFile(path string) (string, error) {
	data, err := os.ReadFile(fs.Resolve(path))
	if err != nil {
		return "", err
	}
	return string(data), nil
}

func (fs *XyPrissFS) WriteFile(path string, data string) error {
	fullPath := fs.Resolve(path)
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(fullPath, []byte(data), 0644)
}

func (fs *XyPrissFS) Remove(path string) error {
	return os.RemoveAll(fs.Resolve(path))
}

// ============ SEARCH & FILTER ============

func (fs *XyPrissFS) Find(path, pattern string) ([]string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}

	var results []string
	err = filepath.Walk(fs.Resolve(path), func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return nil // Skip errors
		}
		if re.MatchString(info.Name()) {
			rel, _ := filepath.Rel(fs.Root, p)
			results = append(results, rel)
		}
		return nil
	})
	return results, err
}

func (fs *XyPrissFS) FindByExtension(path, ext string) []string {
	var results []string
	ext = "." + strings.TrimPrefix(ext, ".")
	_ = filepath.Walk(fs.Resolve(path), func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() && filepath.Ext(p) == ext {
			rel, _ := filepath.Rel(fs.Root, p)
			results = append(results, rel)
		}
		return nil
	})
	return results
}

func (fs *XyPrissFS) Grep(path, pattern string) (map[string][]string, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return nil, err
	}

	results := make(map[string][]string)
	err = filepath.Walk(fs.Resolve(path), func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			file, err := os.Open(p)
			if err != nil {
				return nil
			}
			defer file.Close()

			scanner := bufio.NewScanner(file)
			var matches []string
			for scanner.Scan() {
				line := scanner.Text()
				if re.MatchString(line) {
					matches = append(matches, line)
				}
			}
			if len(matches) > 0 {
				rel, _ := filepath.Rel(fs.Root, p)
				results[rel] = matches
			}
		}
		return nil
	})
	return results, err
}

func (fs *XyPrissFS) BatchRename(path, pattern, replacement string) (int, error) {
	re, err := regexp.Compile(pattern)
	if err != nil {
		return 0, err
	}

	count := 0
	err = filepath.Walk(fs.Resolve(path), func(p string, info os.FileInfo, err error) error {
		if err == nil {
			newName := re.ReplaceAllString(info.Name(), replacement)
			if newName != info.Name() {
				newPath := filepath.Join(filepath.Dir(p), newName)
				if err := os.Rename(p, newPath); err == nil {
					count++
				}
			}
		}
		return nil
	})
	return count, err
}

// ============ COMPRESSION ============

func (fs *XyPrissFS) CompressGzip(src, dest string) error {
	f, err := os.Open(fs.Resolve(src))
	if err != nil {
		return err
	}
	defer f.Close()

	out, err := os.Create(fs.Resolve(dest))
	if err != nil {
		return err
	}
	defer out.Close()

	gw := gzip.NewWriter(out)
	defer gw.Close()

	_, err = io.Copy(gw, f)
	return err
}

func (fs *XyPrissFS) DecompressGzip(src, dest string) error {
	f, err := os.Open(fs.Resolve(src))
	if err != nil {
		return err
	}
	defer f.Close()

	gr, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gr.Close()

	out, err := os.Create(fs.Resolve(dest))
	if err != nil {
		return err
	}
	defer out.Close()

	_, err = io.Copy(out, gr)
	return err
}

func (fs *XyPrissFS) Copy(src, dest string) error {
	data, err := os.ReadFile(fs.Resolve(src))
	if err != nil {
		return err
	}
	return os.WriteFile(fs.Resolve(dest), data, 0644)
}

func (fs *XyPrissFS) Move(src, dest string) error {
	return os.Rename(fs.Resolve(src), fs.Resolve(dest))
}

func (fs *XyPrissFS) Mkdir(path string) error {
	return os.MkdirAll(fs.Resolve(path), 0755)
}

func (fs *XyPrissFS) Touch(path string) error {
	fullPath := fs.Resolve(path)
	f, err := os.OpenFile(fullPath, os.O_RDONLY|os.O_CREATE, 0644)
	if err != nil {
		return err
	}
	f.Close()
	return os.Chtimes(fullPath, time.Now(), time.Now())
}

func (fs *XyPrissFS) Hash(path string) (string, error) {
	data, err := os.ReadFile(fs.Resolve(path))
	if err != nil {
		return "", err
	}
	sum := sha256.Sum256(data)
	return hex.EncodeToString(sum[:]), nil
}

func (fs *XyPrissFS) CreateTar(dest string, srcPaths []string) error {
	out, err := os.Create(fs.Resolve(dest))
	if err != nil {
		return err
	}
	defer out.Close()

	gw := gzip.NewWriter(out)
	defer gw.Close()

	tw := tar.NewWriter(gw)
	defer tw.Close()

	for _, src := range srcPaths {
		fullPath := fs.Resolve(src)
		baseDir := filepath.Dir(fullPath)
		_ = filepath.Walk(fullPath, func(p string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			header, err := tar.FileInfoHeader(info, info.Name())
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(baseDir, p)
			header.Name = rel

			if err := tw.WriteHeader(header); err != nil {
				return err
			}
			if !info.IsDir() {
				f, err := os.Open(p)
				if err != nil {
					return err
				}
				defer f.Close()
				_, err = io.Copy(tw, f)
				return err
			}
			return nil
		})
	}
	return nil
}

func (fs *XyPrissFS) ExtractTar(src, dest string) error {
	f, err := os.Open(fs.Resolve(src))
	if err != nil {
		return err
	}
	defer f.Close()

	gr, err := gzip.NewReader(f)
	if err != nil {
		return err
	}
	defer gr.Close()

	tr := tar.NewReader(gr)
	fullDest := fs.Resolve(dest)
	for {
		header, err := tr.Next()
		if err == io.EOF {
			break
		}
		if err != nil {
			return err
		}

		target := filepath.Join(fullDest, header.Name)
		switch header.Typeflag {
		case tar.TypeDir:
			if err := os.MkdirAll(target, 0755); err != nil {
				return err
			}
		case tar.TypeReg:
			if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
				return err
			}
			f, err := os.OpenFile(target, os.O_CREATE|os.O_RDWR, os.FileMode(header.Mode))
			if err != nil {
				return err
			}
			if _, err := io.Copy(f, tr); err != nil {
				f.Close()
				return err
			}
			f.Close()
		}
	}
	return nil
}

func (fs *XyPrissFS) CreateZip(dest string, srcPaths []string) error {
	out, err := os.Create(fs.Resolve(dest))
	if err != nil {
		return err
	}
	defer out.Close()

	zw := zip.NewWriter(out)
	defer zw.Close()

	for _, src := range srcPaths {
		fullPath := fs.Resolve(src)
		_ = filepath.Walk(fullPath, func(p string, info os.FileInfo, err error) error {
			if err != nil {
				return err
			}
			header, err := zip.FileInfoHeader(info)
			if err != nil {
				return err
			}
			rel, _ := filepath.Rel(filepath.Dir(fullPath), p)
			header.Name = rel
			if info.IsDir() {
				header.Name += "/"
			} else {
				header.Method = zip.Deflate
			}

			writer, err := zw.CreateHeader(header)
			if err != nil {
				return err
			}
			if !info.IsDir() {
				f, err := os.Open(p)
				if err != nil {
					return err
				}
				defer f.Close()
				_, err = io.Copy(writer, f)
				return err
			}
			return nil
		})
	}
	return nil
}

func (fs *XyPrissFS) ExtractZip(src, dest string) error {
	reader, err := zip.OpenReader(fs.Resolve(src))
	if err != nil {
		return err
	}
	defer reader.Close()

	fullDest := fs.Resolve(dest)
	for _, f := range reader.File {
		target := filepath.Join(fullDest, f.Name)
		if f.FileInfo().IsDir() {
			_ = os.MkdirAll(target, 0755)
			continue
		}

		if err := os.MkdirAll(filepath.Dir(target), 0755); err != nil {
			return err
		}

		outFile, err := os.OpenFile(target, os.O_WRONLY|os.O_CREATE|os.O_TRUNC, f.Mode())
		if err != nil {
			return err
		}

		rc, err := f.Open()
		if err != nil {
			outFile.Close()
			return err
		}

		_, err = io.Copy(outFile, rc)
		rc.Close()
		outFile.Close()
		if err != nil {
			return err
		}
	}
	return nil
}
func (fs *XyPrissFS) LsExtended(path string, recursive, includeStats bool) (interface{}, error) {
	fullPath := fs.Resolve(path)
	
	if !recursive {
		entries, err := os.ReadDir(fullPath)
		if err != nil {
			return nil, err
		}

		if !includeStats {
			var names []string
			for _, entry := range entries {
				names = append(names, entry.Name())
			}
			return names, nil
		}

		var results [][2]interface{}
		for _, entry := range entries {
			info, _ := entry.Info()
			stats := FileStats{
				Size:      info.Size(),
				Modified:  info.ModTime().Unix(),
				IsDir:     info.IsDir(),
				IsFile:    !info.IsDir(),
				IsSymlink: info.Mode()&os.ModeSymlink != 0,
			}
			results = append(results, [2]interface{}{entry.Name(), stats})
		}
		return results, nil
	}

	// Recursive implementation
	var names []string
	var statsResults [][2]interface{}

	err := filepath.Walk(fullPath, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		rel, _ := filepath.Rel(fullPath, p)
		if rel == "." {
			return nil
		}

		if includeStats {
			stats := FileStats{
				Size:      info.Size(),
				Modified:  info.ModTime().Unix(),
				IsDir:     info.IsDir(),
				IsFile:    !info.IsDir(),
				IsSymlink: info.Mode()&os.ModeSymlink != 0,
			}
			statsResults = append(statsResults, [2]interface{}{rel, stats})
		} else {
			names = append(names, rel)
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	if includeStats {
		return statsResults, nil
	}
	return names, nil
}

func (fs *XyPrissFS) Sync(src, dest string) error {
	fullSrc := fs.Resolve(src)
	fullDest := fs.Resolve(dest)

	return filepath.Walk(fullSrc, func(p string, info os.FileInfo, err error) error {
		if err != nil {
			return err
		}

		rel, _ := filepath.Rel(fullSrc, p)
		target := filepath.Join(fullDest, rel)

		if info.IsDir() {
			return os.MkdirAll(target, 0755)
		}

		// Check if target exists and has same mod time/size
		targetInfo, err := os.Stat(target)
		if err == nil {
			if targetInfo.Size() == info.Size() && targetInfo.ModTime().Equal(info.ModTime()) {
				return nil // Skip
			}
		}

		// Copy file
		data, err := os.ReadFile(p)
		if err != nil {
			return err
		}
		return os.WriteFile(target, data, info.Mode())
	})
}

type DedupeGroup struct {
	Hash  string   `json:"hash"`
	Paths []string `json:"paths"`
	Size  int64    `json:"size"`
}

func (fs *XyPrissFS) Dedupe(path string) ([]DedupeGroup, error) {
	groups := make(map[string][]string)
	sizes := make(map[string]int64)

	err := filepath.Walk(fs.Resolve(path), func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			h, _ := fs.Hash(p)
			groups[h] = append(groups[h], p)
			sizes[h] = info.Size()
		}
		return nil
	})

	if err != nil {
		return nil, err
	}

	var results []DedupeGroup
	for h, p := range groups {
		if len(p) > 1 {
			results = append(results, DedupeGroup{
				Hash:  h,
				Paths: p,
				Size:  sizes[h],
			})
		}
	}
	return results, nil
}

func (fs *XyPrissFS) StreamContent(path string, chunkSize int, hexOutput bool) (string, error) {
	f, err := os.Open(fs.Resolve(path))
	if err != nil {
		return "", err
	}
	defer f.Close()

	var output strings.Builder
	buf := make([]byte, chunkSize)
	for {
		n, err := f.Read(buf)
		if n > 0 {
			if hexOutput {
				output.WriteString(hex.EncodeToString(buf[:n]))
			} else {
				output.Write(buf[:n])
			}
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return "", err
		}
	}
	return output.String(), nil
}

func (fs *XyPrissFS) CreateLink(src, dest string) error {
	return os.Symlink(fs.Resolve(src), fs.Resolve(dest))
}

func (fs *XyPrissFS) Chmod(path string, mode string) error {
	m, err := strconv.ParseUint(mode, 8, 32)
	if err != nil {
		return err
	}
	return os.Chmod(fs.Resolve(path), os.FileMode(m))
}

type SizeInfo struct {
	Bytes     int64  `json:"bytes"`
	Formatted string `json:"formatted"`
}

func (fs *XyPrissFS) GetSize(path string, human bool) (SizeInfo, error) {
	info, err := os.Lstat(fs.Resolve(path))
	if err != nil {
		return SizeInfo{}, err
	}

	var size int64
	if info.IsDir() {
		size, _ = fs.RecursiveSize(path)
	} else {
		size = info.Size()
	}

	formatted := fmt.Sprintf("%d B", size)
	if human {
		const unit = 1024
		if size < unit {
			formatted = fmt.Sprintf("%d B", size)
		} else {
			div, exp := int64(unit), 0
			for n := size / unit; n >= unit; n /= unit {
				div *= unit
				exp++
			}
			formatted = fmt.Sprintf("%.2f %cB", float64(size)/float64(div), "KMGTPE"[exp])
		}
	}

	return SizeInfo{Bytes: size, Formatted: formatted}, nil
}

type CheckStatus struct {
	Exists   bool `json:"exists"`
	Readable bool `json:"readable"`
	Writable bool `json:"writable"`
}

func (fs *XyPrissFS) Check(path string) CheckStatus {
	full := fs.Resolve(path)
	status := CheckStatus{}

	info, err := os.Stat(full)
	if err != nil {
		return status
	}
	status.Exists = true

	// Basic check for readability/writability based on permissions
	// In Go, actual bit check depends on the process user.
	// For simplicity, we check the permission bits.
	mode := info.Mode()
	status.Readable = mode&0444 != 0
	status.Writable = mode&0222 != 0

	return status
}

type DirUsage struct {
	Path      string `json:"path"`
	Size      int64  `json:"size"`
	FileCount int    `json:"file_count"`
	DirCount  int    `json:"dir_count"`
}

func (fs *XyPrissFS) Du(path string) (DirUsage, error) {
	var usage DirUsage
	usage.Path = path

	err := filepath.Walk(fs.Resolve(path), func(_ string, info os.FileInfo, err error) error {
		if err != nil {
			return nil
		}
		if info.IsDir() {
			usage.DirCount++
		} else {
			usage.FileCount++
			usage.Size += info.Size()
		}
		return nil
	})

	return usage, err
}
func (fs *XyPrissFS) ModifiedSince(path string, hours uint64) ([]string, error) {
	var results []string
	cutoff := time.Now().Add(-time.Duration(hours) * time.Hour)

	err := filepath.Walk(fs.Resolve(path), func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			if info.ModTime().After(cutoff) {
				rel, _ := filepath.Rel(fs.Root, p)
				results = append(results, rel)
			}
		}
		return nil
	})
	return results, err
}
