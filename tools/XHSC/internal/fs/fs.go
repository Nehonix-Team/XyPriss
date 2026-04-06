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
	"crypto/aes"
	"crypto/cipher"
	"crypto/rand"
	"crypto/sha256"
	"encoding/hex"
	"fmt"
	"io"
	"os"
	"path/filepath"
	"regexp"
	"sort"
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

	stats := FileStats{
		Size:        info.Size(),
		Created:     info.ModTime().Unix(),
		Modified:    info.ModTime().Unix(),
		Accessed:    info.ModTime().Unix(),
		IsDir:       info.IsDir(),
		IsFile:      !info.IsDir(),
		IsSymlink:   info.Mode()&os.ModeSymlink != 0,
		Permissions: uint32(info.Mode().Perm()),
	}

	return stats, nil
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
				Created:   info.ModTime().Unix(),
				Modified:  info.ModTime().Unix(),
				Accessed:  info.ModTime().Unix(),
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
				Created:   info.ModTime().Unix(),
				Modified:  info.ModTime().Unix(),
				Accessed:  info.ModTime().Unix(),
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

func (fs *XyPrissFS) Cat(path string, writer io.Writer, offset, length int64) error {
	f, err := os.Open(fs.Resolve(path))
	if err != nil {
		return err
	}
	defer f.Close()

	if offset > 0 {
		if _, err := f.Seek(offset, io.SeekStart); err != nil {
			return err
		}
	}

	if length > 0 {
		_, err = io.CopyN(writer, f, length)
	} else {
		_, err = io.Copy(writer, f)
	}
	return err
}

// CatWrite pipes raw bytes from an io.Reader (usually os.Stdin) to a file.
func (fs *XyPrissFS) CatWrite(path string, reader io.Reader) error {
	f, err := os.OpenFile(fs.Resolve(path), os.O_CREATE|os.O_WRONLY|os.O_TRUNC, 0644)
	if err != nil {
		return err
	}
	defer f.Close()

	_, err = io.Copy(f, reader)
	return err
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

// ============ ADVANCED FILE MANAGEMENT ============

func (fs *XyPrissFS) AtomicWrite(path, data string) error {
	fullPath := fs.Resolve(path)
	tmpPath := fmt.Sprintf("%s.%d.tmp", fullPath, time.Now().UnixNano())
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}
	if err := os.WriteFile(tmpPath, []byte(data), 0644); err != nil {
		return err
	}
	return os.Rename(tmpPath, fullPath)
}

func (fs *XyPrissFS) Shred(path string, passes int) error {
	fullPath := fs.Resolve(path)
	info, err := os.Stat(fullPath)
	if err != nil {
		return err
	}
	if info.IsDir() {
		return fmt.Errorf("cannot shred a directory")
	}

	size := info.Size()
	for i := 0; i < passes; i++ {
		f, err := os.OpenFile(fullPath, os.O_WRONLY, 0)
		if err != nil {
			return err
		}

		// Write random bytes in chunks
		buffer := make([]byte, 1024*64)
		var written int64 = 0
		for written < size {
			_, _ = rand.Read(buffer)
			writeSize := int64(len(buffer))
			if size-written < writeSize {
				writeSize = size - written
			}
			f.Write(buffer[:writeSize])
			written += writeSize
		}
		f.Sync()
		f.Close()
	}
	return os.Remove(fullPath)
}

func (fs *XyPrissFS) Tail(path string, lines int) ([]string, error) {
	fullPath := fs.Resolve(path)
	file, err := os.Open(fullPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	stat, err := file.Stat()
	if err != nil {
		return nil, err
	}

	var result []string
	var position = stat.Size()
	chunkSize := int64(64 * 1024)
	if chunkSize > position {
		chunkSize = position
	}
	buffer := make([]byte, chunkSize)

	var trailingData string
	lineCount := 0

	for position > 0 && lineCount < lines {
		var readSize = chunkSize
		if position < chunkSize {
			readSize = position
		}
		position -= readSize

		_, err := file.ReadAt(buffer[:readSize], position)
		if err != nil && err != io.EOF {
			return nil, err
		}

		chunkData := string(buffer[:readSize]) + trailingData
		splitLines := strings.Split(chunkData, "\n")

		trailingData = splitLines[0]

		for i := len(splitLines) - 1; i > 0; i-- {
			result = append([]string{splitLines[i]}, result...)
			lineCount++
			if lineCount >= lines {
				break
			}
		}
	}

	if lineCount < lines && trailingData != "" {
		result = append([]string{trailingData}, result...)
	}

	return result, nil
}

func (fs *XyPrissFS) Patch(path, search, replace string) (bool, error) {
	fullPath := fs.Resolve(path)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return false, err
	}

	re, err := regexp.Compile(search)
	if err != nil {
		// Literal fallback if regex invalid
		content := string(data)
		if !strings.Contains(content, search) {
			return false, nil
		}
		newContent := strings.ReplaceAll(content, search, replace)
		return true, fs.AtomicWrite(path, newContent)
	}

	content := string(data)
	newContent := re.ReplaceAllString(content, replace)
	if content != newContent {
		return true, fs.AtomicWrite(path, newContent)
	}

	return false, nil
}

func (fs *XyPrissFS) Split(path string, bytesPerChunk int, outDir string) ([]string, error) {
	fullPath := fs.Resolve(path)
	file, err := os.Open(fullPath)
	if err != nil {
		return nil, err
	}
	defer file.Close()

	outputDirectory := fs.Resolve(outDir)
	if outDir == "" {
		outputDirectory = filepath.Dir(fullPath)
	}
	os.MkdirAll(outputDirectory, 0755)

	baseName := filepath.Base(fullPath)
	buffer := make([]byte, bytesPerChunk)
	var paths []string
	chunkIndex := 1

	for {
		n, err := file.Read(buffer)
		if n > 0 {
			chunkName := fmt.Sprintf("%s.%03d", baseName, chunkIndex)
			chunkPath := filepath.Join(outputDirectory, chunkName)
			if err := os.WriteFile(chunkPath, buffer[:n], 0644); err != nil {
				return nil, err
			}
			rel, _ := filepath.Rel(fs.Root, chunkPath)
			paths = append(paths, rel)
			chunkIndex++
		}
		if err == io.EOF {
			break
		}
		if err != nil {
			return nil, err
		}
	}

	return paths, nil
}

func (fs *XyPrissFS) Merge(sourceFiles []string, destFile string) error {
	fullDest := fs.Resolve(destFile)
	os.MkdirAll(filepath.Dir(fullDest), 0755)

	out, err := os.Create(fullDest)
	if err != nil {
		return err
	}
	defer out.Close()

	for _, src := range sourceFiles {
		fullSrc := fs.Resolve(src)
		in, err := os.Open(fullSrc)
		if err != nil {
			return err
		}
		_, copyErr := io.Copy(out, in)
		in.Close()
		if copyErr != nil {
			return copyErr
		}
	}
	return nil
}

func (fs *XyPrissFS) LockFileMethod(path string) (bool, error) {
	lockPath := fs.Resolve(path) + ".lock"
	f, err := os.OpenFile(lockPath, os.O_CREATE|os.O_EXCL|os.O_WRONLY, 0644)
	if err != nil {
		if os.IsExist(err) {
			return false, nil
		}
		return false, err
	}
	f.WriteString(fmt.Sprintf("%d", os.Getpid()))
	f.Close()
	return true, nil
}

func (fs *XyPrissFS) UnlockFileMethod(path string) error {
	lockPath := fs.Resolve(path) + ".lock"
	return os.Remove(lockPath)
}

// ============ NOVEL SECURITY & ANALYTICAL APIS ============

func (fs *XyPrissFS) WriteSecure(path, data, mode string) error {
	fullPath := fs.Resolve(path)
	m, err := strconv.ParseUint(mode, 8, 32)
	if err != nil {
		return err
	}
	if err := os.MkdirAll(filepath.Dir(fullPath), 0755); err != nil {
		return err
	}
	return os.WriteFile(fullPath, []byte(data), os.FileMode(m))
}

func getAESKey(key string) []byte {
	hash := sha256.Sum256([]byte(key))
	return hash[:]
}

func (fs *XyPrissFS) Encrypt(path, key string) error {
	fullPath := fs.Resolve(path)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return err
	}
	block, err := aes.NewCipher(getAESKey(key))
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	nonce := make([]byte, gcm.NonceSize())
	if _, err := io.ReadFull(rand.Reader, nonce); err != nil {
		return err
	}
	ciphertext := gcm.Seal(nonce, nonce, data, nil)
	return fs.AtomicWrite(path, string(ciphertext))
}

func (fs *XyPrissFS) Decrypt(path, key string) error {
	fullPath := fs.Resolve(path)
	data, err := os.ReadFile(fullPath)
	if err != nil {
		return err
	}
	block, err := aes.NewCipher(getAESKey(key))
	if err != nil {
		return err
	}
	gcm, err := cipher.NewGCM(block)
	if err != nil {
		return err
	}
	nonceSize := gcm.NonceSize()
	if len(data) < nonceSize {
		return fmt.Errorf("ciphertext too short")
	}
	nonce, ciphertext := data[:nonceSize], data[nonceSize:]
	plaintext, err := gcm.Open(nil, nonce, ciphertext, nil)
	if err != nil {
		return err
	}
	return fs.AtomicWrite(path, string(plaintext))
}

type DiffResult struct {
	Line  int    `json:"line"`
	FileA string `json:"file_a"`
	FileB string `json:"file_b"`
}

func (fs *XyPrissFS) DiffFiles(pathA, pathB string) ([]DiffResult, error) {
	fullA := fs.Resolve(pathA)
	fullB := fs.Resolve(pathB)

	bytesA, err := os.ReadFile(fullA)
	if err != nil {
		return nil, err
	}
	bytesB, err := os.ReadFile(fullB)
	if err != nil {
		return nil, err
	}

	linesA := strings.Split(string(bytesA), "\n")
	linesB := strings.Split(string(bytesB), "\n")

	var diffs []DiffResult
	maxLines := len(linesA)
	if len(linesB) > maxLines {
		maxLines = len(linesB)
	}

	for i := 0; i < maxLines; i++ {
		la, lb := "", ""
		if i < len(linesA) {
			la = linesA[i]
		}
		if i < len(linesB) {
			lb = linesB[i]
		}
		if la != lb {
			diffs = append(diffs, DiffResult{
				Line:  i + 1,
				FileA: la,
				FileB: lb,
			})
		}
	}
	return diffs, nil
}

type TopFile struct {
	Path string `json:"path"`
	Size int64  `json:"size"`
}

func (fs *XyPrissFS) TopBigFiles(dir string, limit int) ([]TopFile, error) {
	var files []TopFile
	fullPath := fs.Resolve(dir)
	err := filepath.Walk(fullPath, func(p string, info os.FileInfo, err error) error {
		if err == nil && !info.IsDir() {
			rel, _ := filepath.Rel(fs.Root, p)
			files = append(files, TopFile{Path: rel, Size: info.Size()})
		}
		return nil
	})
	if err != nil {
		return nil, err
	}
	sort.Slice(files, func(i, j int) bool {
		return files[i].Size > files[j].Size
	})
	if len(files) > limit {
		files = files[:limit]
	}
	return files, nil
}
