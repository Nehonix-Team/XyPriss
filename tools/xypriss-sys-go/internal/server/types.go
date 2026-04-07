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
	"fmt"
	"log"
	"net"
	"net/http"
	"os/exec"
	"regexp"
	"strings"
	"sync"
	"sync/atomic"
	"time"

	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/cluster"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/ipc"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/proxy"
	"github.com/Nehonix-Team/XyPriss/tools/xypriss-sys-go/internal/router"
)

type ServerState struct {
	Router       *router.XyRouter
	Ipc          *ipc.IpcBridge
	Root         string
	Metrics      *MetricsCollector
	MaxBodySize  int64
	TimeoutSec   uint64
	MaxUrlLength int
	Intelligence *cluster.IntelligenceManager
	Performance  struct {
		Compression       bool
		CompressionAlgs    []string
		CompressionLevel   int
		CompressionMinSize int
		CompressionTypes   []string
		BatchSize         int
		ConnectionPooling bool
		PoolTimeout       time.Duration
		PoolIdleTimeout   time.Duration
	}
	Connection struct {
		HTTP2MaxConcurrent uint32
		KeepAliveTimeout   time.Duration
		KeepAliveMaxReqs   int
	}
	Proxy *proxy.ProxyManager
	Firewall struct {
		Enabled  bool
		AutoOpen bool
		Allowed  []string
	}
	TrustProxy []string
	RateLimit  struct {
		Enabled         bool
		Strategy        string // fixed-window, sliding-window, token-bucket
		Max             int
		Window          time.Duration
		Message         string
		StandardHeaders bool
		LegacyHeaders   bool
		ExcludePaths    []string
		CompiledExclude []*regexp.Regexp
	}
	Concurrency struct {
		MaxConcurrent  int
		MaxPerIP       int
		MaxQueueSize   int
		QueueTimeout   time.Duration
		ActiveRequests int32
		IPMap          sync.Map // map[string]*int32
	}
	Resilience struct {
		BreakerEnabled   bool
		BreakerThreshold uint32
		BreakerTimeout   time.Duration
		RetryMax         int
		RetryDelay       time.Duration
		BreakerFailures  int32
		BreakerOpenUntil time.Time
		BreakerMutex     sync.RWMutex
	}
	Quality struct {
		Enabled    bool
		RejectPoor bool
		MinBW      int
		MaxLat     int
	}
	FileUpload struct {
		Dir          string
		TempDir      string
		UseTempFiles bool
		MaxFileSize  int64
		AllowedMimes []string
		MaxFiles     int
		UseSubDir    bool
	}
}

type MetricsCollector struct {
	RequestsTotal uint64
	ErrorsTotal   uint64
}

func (m *MetricsCollector) IncrementRequests() {
	atomic.AddUint64(&m.RequestsTotal, 1)
}

func (m *MetricsCollector) IncrementErrors() {
	atomic.AddUint64(&m.ErrorsTotal, 1)
}

var (
	loopbackCIDRs    = []string{"127.0.0.0/8", "::1/128"}
	linklocalCIDRs   = []string{"169.254.0.0/16", "fe80::/10"}
	uniquelocalCIDRs = []string{"10.0.0.0/8", "172.16.0.0/12", "192.168.0.0/16", "fc00::/7"}
)

func matchCIDRList(ip net.IP, cidrList []string) bool {
	for _, cidrStr := range cidrList {
		_, cidrNet, err := net.ParseCIDR(cidrStr)
		if err == nil && cidrNet.Contains(ip) {
			return true
		}
	}
	return false
}

func (s *ServerState) extractRealIP(r *http.Request) string {
	remoteAddr, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		remoteAddr = r.RemoteAddr
	}

	if len(s.TrustProxy) == 0 {
		return remoteAddr
	}

	ip := net.ParseIP(remoteAddr)

	isTrusted := false
	for _, trusted := range s.TrustProxy {
		if trusted == "*" {
			isTrusted = true
			break
		}

		if ip != nil {
			if trusted == "loopback" {
				if matchCIDRList(ip, loopbackCIDRs) {
					isTrusted = true
					break
				}
				continue
			}
			if trusted == "linklocal" {
				if matchCIDRList(ip, linklocalCIDRs) {
					isTrusted = true
					break
				}
				continue
			}
			if trusted == "uniquelocal" {
				if matchCIDRList(ip, uniquelocalCIDRs) {
					isTrusted = true
					break
				}
				continue
			}
			
			// CIDR check
			if strings.Contains(trusted, "/") {
				_, cidrNet, err := net.ParseCIDR(trusted)
				if err == nil && cidrNet.Contains(ip) {
					isTrusted = true
					break
				}
				continue
			}
		}

		// Exact IP or hostname fallback
		if remoteAddr == trusted {
			isTrusted = true
			break
		}
	}

	if !isTrusted {
		return remoteAddr
	}

	if xfwd := r.Header.Get("X-Forwarded-For"); xfwd != "" {
		return xfwd
	}
	if xreal := r.Header.Get("X-Real-Ip"); xreal != "" {
		return xreal
	}

	return remoteAddr
}

func (s *ServerState) autoConfigureFirewall(port uint16) {
	log.Printf("[Firewall] Auto-tuning firewall for port %d...", port)

	// Check for UFW
	if _, err := exec.LookPath("ufw"); err == nil {
		log.Printf("[Firewall] UFW detected, ensuring port %d is open", port)
		cmd := exec.Command("sudo", "ufw", "allow", fmt.Sprintf("%d/tcp", port))
		if err := cmd.Run(); err != nil {
			log.Printf("[Firewall] ERROR: Failed to allow port %d via ufw: %v", port, err)
		} else {
			log.Printf("[Firewall] Port %d allowed successfully via UFW", port)
		}

		// Also allow common web ports if it's 80/443
		if port == 80 || port == 443 {
			_ = exec.Command("sudo", "ufw", "allow", "80/tcp").Run()
			_ = exec.Command("sudo", "ufw", "allow", "443/tcp").Run()
		}
	} else if _, err := exec.LookPath("iptables"); err == nil {
		log.Printf("[Firewall] iptables detected, ensuring port %d is open", port)
		_ = exec.Command("sudo", "iptables", "-A", "INPUT", "-p", "tcp", "--dport", fmt.Sprintf("%d", port), "-j", "ACCEPT").Run()
	} else {
		log.Printf("[Firewall] WARNING: No known firewall manager found (ufw/iptables). Please open port %d manually.", port)
	}
}
