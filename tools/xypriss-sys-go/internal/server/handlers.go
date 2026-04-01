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

package server

import (
	"encoding/json"
	"fmt"
	"io"
	"log"
	"mime"
	"net/http"
	"os"
	"path/filepath"
	"strings"
	"sync/atomic"
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/ipc"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/router"
	"github.com/google/uuid"
)

func (s *ServerState) statusHandler(w http.ResponseWriter, r *http.Request) {
	json.NewEncoder(w).Encode(map[string]interface{}{
		"status":         "online",
		"service":        "XyPriss Hyper-System Core (XHSC)",
		"uptime_seconds": time.Now().Unix(),
		"ipc_enabled":    s.Ipc != nil,
		"requests_total": atomic.LoadUint64(&s.Metrics.RequestsTotal),
		"errors_total":   atomic.LoadUint64(&s.Metrics.ErrorsTotal),
		// "powered_by":     "Nehonix",
	})
}

func (s *ServerState) healthHandler(w http.ResponseWriter, r *http.Request) {
	w.WriteHeader(http.StatusOK)
	json.NewEncoder(w).Encode(map[string]interface{}{"status": "healthy"})
}

func (s *ServerState) fallbackHandler(w http.ResponseWriter, r *http.Request) {
	s.Metrics.IncrementRequests()

	if s.MaxUrlLength > 0 && len(r.RequestURI) > s.MaxUrlLength {
		http.Error(w, "URI Too Long", http.StatusRequestURITooLong)
		return
	}

	method := r.Method
	path := r.URL.Path

	rt, params := s.Router.MatchRoute(method, path)
	if rt == nil && method == "HEAD" {
		rt, params = s.Router.MatchRoute("GET", path)
	}

	if rt != nil {
		switch rt.Target.Type {
		case router.TargetJsWorker:
			s.handleJsWorker(w, r, params)
		case router.TargetStaticFile:
			http.ServeFile(w, r, rt.Target.Path)
		case router.TargetRedirect:
			http.Redirect(w, r, rt.Target.Destination, int(rt.Target.Code))
		default:
		}
		return
	}

	if s.Proxy != nil {
		s.Proxy.ServeHTTP(w, r)
		return
	}

	if s.Ipc != nil {
		s.handleJsWorker(w, r, nil)
	} else {
		log.Printf("✗ Route not found: %s %s", method, path)
		s.Metrics.IncrementErrors()
		http.NotFound(w, r)
	}
}

func (s *ServerState) handleJsWorker(w http.ResponseWriter, r *http.Request, params map[string]string) {
	if s.Ipc == nil {
		http.Error(w, "IPC Bridge not configured", http.StatusServiceUnavailable)
		return
	}

	if s.Resilience.BreakerEnabled {
		s.Resilience.BreakerMutex.RLock()
		if !s.Resilience.BreakerOpenUntil.IsZero() && time.Now().Before(s.Resilience.BreakerOpenUntil) {
			s.Resilience.BreakerMutex.RUnlock()
			http.Error(w, "Circuit Breaker Open (XHSC)", http.StatusServiceUnavailable)
			return
		}
		s.Resilience.BreakerMutex.RUnlock()
	}

	var body []byte
	var jsFiles []ipc.JsFile
	var uploadErrors []ipc.UploadError

	contentType := r.Header.Get("Content-Type")
	if strings.Contains(contentType, "multipart/form-data") {
		if err := r.ParseMultipartForm(s.MaxBodySize); err != nil {
			s.Metrics.IncrementErrors()
			http.Error(w, "Failed to parse multipart form", http.StatusBadRequest)
			return
		}

		baseDir := s.FileUpload.Dir
		if s.FileUpload.UseTempFiles {
			baseDir = s.FileUpload.TempDir
		}
		if err := os.MkdirAll(baseDir, 0755); err != nil {
			log.Printf("[ERROR] Failed to create upload base dir: %v", err)
		}

		for fieldName, fileHeaders := range r.MultipartForm.File {
			for _, fileHeader := range fileHeaders {
				if s.FileUpload.MaxFileSize > 0 && fileHeader.Size > s.FileUpload.MaxFileSize {
					log.Printf("[WARN] File upload rejected: %s size %d exceeds limit %d", fileHeader.Filename, fileHeader.Size, s.FileUpload.MaxFileSize)
					uploadErrors = append(uploadErrors, ipc.UploadError{
						FieldName: fieldName,
						FileName:  fileHeader.Filename,
						Message:   fmt.Sprintf("File size %d exceeds limit %d", fileHeader.Size, s.FileUpload.MaxFileSize),
						Type:      "LIMIT_FILE_SIZE",
					})
					continue
				}

				if len(s.FileUpload.AllowedMimes) > 0 {
					allowed := false
					contentType := fileHeader.Header.Get("Content-Type")
					pureMime, _, _ := mime.ParseMediaType(contentType)
					for _, m := range s.FileUpload.AllowedMimes {
						if m == pureMime {
							allowed = true
							break
						}
					}
					if !allowed {
						log.Printf("[WARN] File upload rejected: %s MIME type %s not allowed", fileHeader.Filename, pureMime)
						uploadErrors = append(uploadErrors, ipc.UploadError{
							FieldName: fieldName,
							FileName:  fileHeader.Filename,
							Message:   fmt.Sprintf("MIME type %s not allowed", pureMime),
							Type:      "INVALID_MIME_TYPE",
						})
						continue
					}
				}

				file, err := fileHeader.Open()
				if err != nil {
					continue
				}
				defer file.Close()

				targetDir := baseDir
				if s.FileUpload.UseSubDir {
					targetDir = filepath.Join(baseDir, fieldName)
					if err := os.MkdirAll(targetDir, 0755); err != nil {
						log.Printf("[ERROR] Failed to create subdirectory %s: %v", targetDir, err)
						targetDir = baseDir
					}
				}

				tempName := fmt.Sprintf("up-%s-%s", uuid.NewString(), fileHeader.Filename)
				tempPath := filepath.Join(targetDir, tempName)

				out, err := os.Create(tempPath)
				if err != nil {
					log.Printf("[ERROR] Failed to create temp upload file: %v", err)
					continue
				}

				size, err := io.Copy(out, file)
				out.Close()
				if err != nil {
					continue
				}

				finalPath := tempPath
				if s.FileUpload.UseTempFiles && s.FileUpload.Dir != "" {
					finalPath = filepath.Join(s.FileUpload.Dir, fileHeader.Filename)
					if err := os.Rename(tempPath, finalPath); err != nil {
						log.Printf("[ERROR] Failed to move temp file to final destination: %v. Keeping in temp: %s", err, tempPath)
						finalPath = tempPath
					}
				}

				jsFiles = append(jsFiles, ipc.JsFile{
					FieldName:    fieldName,
					OriginalName: fileHeader.Filename,
					Filename:     filepath.Base(finalPath),
					Path:         finalPath,
					Size:         size,
					MimeType:     fileHeader.Header.Get("Content-Type"),
					Encoding:     "7bit",
					Destination:  filepath.Dir(finalPath),
				})
			}
		}

		formValues := make(map[string]interface{})
		for k, v := range r.MultipartForm.Value {
			if len(v) == 1 {
				formValues[k] = v[0]
			} else {
				formValues[k] = v
			}
		}
		body, _ = json.Marshal(formValues)
	} else {
		var err error
		body, err = io.ReadAll(io.LimitReader(r.Body, s.MaxBodySize))
		if err != nil {
			s.Metrics.IncrementErrors()
			http.Error(w, "Failed to read body", http.StatusBadRequest)
			return
		}
	}

	headers := make(map[string]ipc.HeaderValue)
	for k, v := range r.Header {
		if len(v) == 1 {
			headers[k] = ipc.HeaderValue{Single: v[0]}
		} else {
			headers[k] = ipc.HeaderValue{Multiple: v}
		}
	}

	query := make(map[string]string)
	for k, v := range r.URL.Query() {
		if len(v) > 0 {
			query[k] = v[0]
		}
	}

	method := r.Method
	if method == "HEAD" {
		method = "GET"
	}

	jsReq := ipc.JsRequest{
		ID:           uuid.NewString(),
		Method:       method,
		URL:          r.URL.String(),
		Headers:      headers,
		Query:        query,
		Params:       params,
		RemoteAddr:   s.extractRealIP(r),
		LocalAddr:    r.Host,
		Body:         body,
		Files:        jsFiles,
		UploadErrors: uploadErrors,
	}

	var res ipc.JsResponse
	var err error

	maxAttempts := 1
	if s.Resilience.RetryMax > 0 {
		maxAttempts = 1 + s.Resilience.RetryMax
	}

	startTime := time.Now()
	for i := 0; i < maxAttempts; i++ {
		res, err = s.Ipc.Dispatch(jsReq)
		if err == nil {
			if s.Resilience.BreakerEnabled {
				atomic.StoreInt32(&s.Resilience.BreakerFailures, 0)
			}
			break
		}

		log.Printf("[ERROR] IPC Dispatch failed (attempt %d/%d): %v", i+1, maxAttempts, err)

		if i < maxAttempts-1 {
			time.Sleep(s.Resilience.RetryDelay)
			continue
		}

		s.Metrics.IncrementErrors()

		if s.Resilience.BreakerEnabled {
			failures := atomic.AddInt32(&s.Resilience.BreakerFailures, 1)
			if uint32(failures) >= s.Resilience.BreakerThreshold {
				s.Resilience.BreakerMutex.Lock()
				s.Resilience.BreakerOpenUntil = time.Now().Add(s.Resilience.BreakerTimeout)
				s.Resilience.BreakerMutex.Unlock()
				log.Printf("[WARN] Circuit Breaker OPENED for %v due to repeated failures", s.Resilience.BreakerTimeout)
			}
		}

		workerCount := s.Ipc.GetWorkerCount()
		if s.Intelligence != nil && s.Intelligence.Config.RescueMode && workerCount == 0 {
			s.Intelligence.SetRescueActive(true)
			http.Error(w, "Rescue Mode: System is rebooting... (Rapid Recovery)", http.StatusServiceUnavailable)
			return
		}

		http.Error(w, err.Error(), http.StatusInternalServerError)
		return
	}
	duration := time.Since(startTime)

	w.Header().Set("X-Response-Time", fmt.Sprintf("%.2fms", float64(duration.Microseconds())/1000.0))

	for k, v := range res.Headers {
		if strings.EqualFold(k, "content-length") {
			continue
		}
		if v.Single != "" {
			w.Header().Set(k, v.Single)
		} else {
			for _, val := range v.Multiple {
				w.Header().Add(k, val)
			}
		}
	}
	w.WriteHeader(int(res.Status))
	w.Write(res.Body)
}
