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
	"compress/gzip"
	"compress/zlib"
	"fmt"
	"io"
	"log"
	"net/http"
	"strings"
	"sync/atomic"
	"time"

	"github.com/andybalholm/brotli"
	"github.com/klauspost/compress/zstd"
	"github.com/ulule/limiter/v3"
	"github.com/ulule/limiter/v3/drivers/store/memory"
)

func RateLimitMiddleware(next http.Handler, s *ServerState) http.Handler {
	rate := limiter.Rate{
		Period: s.RateLimit.Window,
		Limit:  int64(s.RateLimit.Max),
	}
	store := memory.NewStore()
	lmt := limiter.New(store, rate)

	var msg []byte
	contentType := "application/json; charset=utf-8"

	rawMsg := s.RateLimit.Message
	if rawMsg == "" {
		msg = []byte("{\"error\": \"Too many requests. Rate limit exceeded (XHSC).\"}")
	} else {
		trimmed := strings.TrimSpace(rawMsg)
		if strings.HasPrefix(trimmed, "{") || strings.HasPrefix(trimmed, "[") {
			msg = []byte(rawMsg)
		} else {
			msg = []byte(fmt.Sprintf("{\"error\": \"%s\"}", strings.ReplaceAll(rawMsg, "\"", "\\\"")))
		}
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.RateLimit.Enabled {
			next.ServeHTTP(w, r)
			return
		}

		path := r.URL.Path
		for _, re := range s.RateLimit.CompiledExclude {
			if re.MatchString(path) {
				next.ServeHTTP(w, r)
				return
			}
		}
		for _, exclude := range s.RateLimit.ExcludePaths {
			if exclude != "" && !strings.HasPrefix(exclude, "RE:") {
				if path == exclude || strings.HasPrefix(path, exclude) {
					next.ServeHTTP(w, r)
					return
				}
			}
		}

		ip := s.extractRealIP(r)

		context, err := lmt.Get(r.Context(), ip)
		if err != nil {
			log.Printf("[ERROR] Rate limit check failed: %v", err)
			next.ServeHTTP(w, r)
			return
		}

		if s.RateLimit.StandardHeaders {
			w.Header().Set("RateLimit-Limit", fmt.Sprintf("%d", context.Limit))
			w.Header().Set("RateLimit-Remaining", fmt.Sprintf("%d", context.Remaining))
			resetDelta := context.Reset - time.Now().Unix()
			if resetDelta < 0 {
				resetDelta = 0
			}
			w.Header().Set("RateLimit-Reset", fmt.Sprintf("%d", resetDelta))
		}

		if s.RateLimit.LegacyHeaders {
			w.Header().Set("X-RateLimit-Limit", fmt.Sprintf("%d", context.Limit))
			w.Header().Set("X-RateLimit-Remaining", fmt.Sprintf("%d", context.Remaining))
			w.Header().Set("X-RateLimit-Reset", fmt.Sprintf("%d", context.Reset))
		}

		if context.Reached {
			w.Header().Set("Content-Type", contentType)
			w.WriteHeader(http.StatusTooManyRequests)
			w.Write(msg)
			return
		}

		next.ServeHTTP(w, r)
	})
}

func ConcurrencyMiddleware(next http.Handler, s *ServerState) http.Handler {
	var semaphore chan struct{}
	if s.Concurrency.MaxConcurrent > 0 {
		semaphore = make(chan struct{}, s.Concurrency.MaxConcurrent)
	}

	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if s.Concurrency.MaxConcurrent <= 0 && s.Concurrency.MaxPerIP <= 0 {
			next.ServeHTTP(w, r)
			return
		}

		ip := s.extractRealIP(r)

		if s.Concurrency.MaxPerIP > 0 {
			val, _ := s.Concurrency.IPMap.LoadOrStore(ip, new(int32))
			ipCounter := val.(*int32)
			if atomic.LoadInt32(ipCounter) >= int32(s.Concurrency.MaxPerIP) {
				http.Error(w, "Too many concurrent requests from your IP (XHSC)", http.StatusTooManyRequests)
				return
			}
			atomic.AddInt32(ipCounter, 1)
			defer atomic.AddInt32(ipCounter, -1)
		}

		if semaphore != nil {
			active := atomic.AddInt32(&s.Concurrency.ActiveRequests, 1)
			defer atomic.AddInt32(&s.Concurrency.ActiveRequests, -1)

			if s.Concurrency.MaxQueueSize > 0 && int(active) > s.Concurrency.MaxConcurrent+s.Concurrency.MaxQueueSize {
				http.Error(w, "Server too busy (Queue full - XHSC)", http.StatusServiceUnavailable)
				return
			}

			timeout := s.Concurrency.QueueTimeout
			if timeout == 0 {
				timeout = 30 * time.Second
			}

			select {
			case semaphore <- struct{}{}:
				defer func() { <-semaphore }()
			default:
				timer := time.NewTimer(timeout)
				defer timer.Stop()

				select {
				case semaphore <- struct{}{}:
					defer func() { <-semaphore }()
				case <-timer.C:
					http.Error(w, "Request timed out in queue (XHSC)", http.StatusServiceUnavailable)
					return
				case <-r.Context().Done():
					return
				}
			}
		}

		next.ServeHTTP(w, r)
	})
}

type qualityResponseWriter struct {
	http.ResponseWriter
	bytesSent int64
	startTime time.Time
	status    int
}

func (w *qualityResponseWriter) WriteHeader(code int) {
	w.status = code
	w.ResponseWriter.WriteHeader(code)
}

func (w *qualityResponseWriter) Write(b []byte) (int, error) {
	n, err := w.ResponseWriter.Write(b)
	w.bytesSent += int64(n)
	return n, err
}

func QualityMiddleware(next http.Handler, s *ServerState) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.Quality.Enabled {
			next.ServeHTTP(w, r)
			return
		}

		startTime := time.Now()
		qw := &qualityResponseWriter{
			ResponseWriter: w,
			startTime:      startTime,
			status:         http.StatusOK,
		}

		next.ServeHTTP(qw, r)

		duration := time.Since(startTime)
		
		if s.Quality.MaxLat > 0 && duration > time.Duration(s.Quality.MaxLat)*time.Millisecond {
			log.Printf("[WARN] Request exceeded max latency: %v > %dms", duration, s.Quality.MaxLat)
		}

		if s.Quality.MinBW > 0 && duration.Seconds() > 1 {
			bw := float64(qw.bytesSent) / duration.Seconds()
			if bw < float64(s.Quality.MinBW) {
				log.Printf("[WARN] Request bandwidth too low: %.2f B/s < %d B/s", bw, s.Quality.MinBW)
			}
		}
	})
}

func CompressionMiddleware(next http.Handler, s *ServerState) http.Handler {
	return http.HandlerFunc(func(w http.ResponseWriter, r *http.Request) {
		if !s.Performance.Compression {
			next.ServeHTTP(w, r)
			return
		}

		acceptEncoding := r.Header.Get("Accept-Encoding")
		algorithms := s.Performance.CompressionAlgs

		enabled := make(map[string]bool)
		for _, alg := range algorithms {
			enabled[strings.TrimSpace(alg)] = true
		}

		cw := &compressionResponseWriter{ResponseWriter: w, writer: w}

		if enabled["zstd"] && strings.Contains(acceptEncoding, "zstd") {
			cw.encoding = "zstd"
		} else if enabled["br"] && strings.Contains(acceptEncoding, "br") {
			cw.encoding = "br"
		} else if enabled["gzip"] && strings.Contains(acceptEncoding, "gzip") {
			cw.encoding = "gzip"
		} else if enabled["deflate"] && strings.Contains(acceptEncoding, "deflate") {
			cw.encoding = "deflate"
		}

		cw.s = s
		next.ServeHTTP(cw, r)

		if cw.closer != nil {
			cw.closer.Close()
		}
	})
}

type compressionResponseWriter struct {
	http.ResponseWriter
	writer          io.Writer
	closer          io.Closer
	encoding        string
	negotiated      bool
	status          int
	s               *ServerState
	shouldCompress bool
}

func (w *compressionResponseWriter) WriteHeader(status int) {
	if w.negotiated {
		w.ResponseWriter.WriteHeader(status)
		return
	}

	w.status = status
	w.negotiated = true

	if w.encoding == "" || w.Header().Get("Content-Encoding") != "" {
		w.ResponseWriter.WriteHeader(status)
		return
	}

	contentType := w.Header().Get("Content-Type")
	if len(w.s.Performance.CompressionTypes) > 0 {
		allowed := false
		ct := strings.Split(contentType, ";")[0]
		for _, t := range w.s.Performance.CompressionTypes {
			if t == ct || strings.HasPrefix(ct, t) {
				allowed = true
				break
			}
		}
		if !allowed {
			w.ResponseWriter.WriteHeader(status)
			return
		}
	} else {
		defaultTypes := []string{"text/", "application/json", "application/javascript", "application/xml"}
		allowed := false
		for _, t := range defaultTypes {
			if strings.HasPrefix(contentType, t) {
				allowed = true
				break
			}
		}
		if !allowed {
			w.ResponseWriter.WriteHeader(status)
			return
		}
	}

	contentLength := w.Header().Get("Content-Length")
	if contentLength != "" && w.s.Performance.CompressionMinSize > 0 {
		var size int64
		fmt.Sscanf(contentLength, "%d", &size)
		if size < int64(w.s.Performance.CompressionMinSize) {
			w.ResponseWriter.WriteHeader(status)
			return
		}
	}

	w.shouldCompress = true
	switch w.encoding {
	case "zstd":
		zw, _ := zstd.NewWriter(w.ResponseWriter)
		w.writer = zw
		w.closer = zw
	case "br":
		bw := brotli.NewWriter(w.ResponseWriter)
		w.writer = bw
		w.closer = bw
	case "gzip":
		gw := gzip.NewWriter(w.ResponseWriter)
		w.writer = gw
		w.closer = gw
	case "deflate":
		zw := zlib.NewWriter(w.ResponseWriter)
		w.writer = zw
		w.closer = zw
	}

	if w.shouldCompress {
		w.Header().Set("Content-Encoding", w.encoding)
		w.Header().Del("Content-Length")
		vary := w.Header().Get("Vary")
		if vary == "" {
			w.Header().Set("Vary", "Accept-Encoding")
		} else if !strings.Contains(strings.ToLower(vary), "accept-encoding") {
			w.Header().Add("Vary", "Accept-Encoding")
		}
	}

	w.ResponseWriter.WriteHeader(status)
}

func (w *compressionResponseWriter) Write(b []byte) (int, error) {
	if !w.negotiated {
		w.WriteHeader(http.StatusOK)
	}
	if w.shouldCompress && w.writer != nil {
		return w.writer.Write(b)
	}
	return w.ResponseWriter.Write(b)
}

func (w *compressionResponseWriter) Flush() {
	if f, ok := w.writer.(interface{ Flush() }); ok {
		f.Flush()
	} else if f, ok := w.writer.(interface{ Flush() error }); ok {
		_ = f.Flush()
	}
	if f, ok := w.ResponseWriter.(http.Flusher); ok {
		f.Flush()
	}
}
