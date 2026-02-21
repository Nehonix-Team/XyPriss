/* *****************************************************************************
 * Nehonix XyPriss System CLI
 *
 * Proxy Package - Modular High-Performance Reverse Proxy
 * ***************************************************************************** */

package proxy

import (
	"context"
	"crypto/tls"
	"errors"
	"fmt"
	"hash/fnv"
	"log"
	"net"
	"net/http"
	"net/http/httputil"
	"net/url"
	"sync"
	"sync/atomic"
	"time"
)

// ─── Constants & defaults ────────────────────────────────────────────────────

const (
	defaultMaxIdleConns        = 512
	defaultMaxIdleConnsPerHost = 64
	defaultIdleConnTimeout     = 90 * time.Second
	defaultTLSHandshakeTimeout = 10 * time.Second
	defaultDialTimeout         = 5 * time.Second
	defaultResponseTimeout     = 30 * time.Second
	defaultHealthCheckInterval = 10 * time.Second
	defaultHealthCheckPath     = "/health"
	defaultHealthCheckTimeout  = 3 * time.Second
)

// ─── Upstream ────────────────────────────────────────────────────────────────

// Upstream represents a single backend server.
type Upstream struct {
	Target *url.URL
	Weight int

	// healthy is 1 when the upstream is considered healthy, 0 otherwise.
	healthy     int32 // atomic
	activeConns int64 // atomic — used by LeastConn balancer
	failures    int64 // atomic — consecutive health-check failures

	// reverseProxy is pre-built and reused across requests to avoid
	// re-allocating the Director closure on every request.
	reverseProxy *httputil.ReverseProxy
}

// IsHealthy reports whether the upstream is currently marked healthy.
func (u *Upstream) IsHealthy() bool {
	return atomic.LoadInt32(&u.healthy) == 1
}

func (u *Upstream) markHealthy() {
	atomic.StoreInt32(&u.healthy, 1)
	atomic.StoreInt64(&u.failures, 0)
}

func (u *Upstream) markUnhealthy() {
	atomic.StoreInt32(&u.healthy, 0)
}

func (u *Upstream) incActive() { atomic.AddInt64(&u.activeConns, 1) }
func (u *Upstream) decActive() { atomic.AddInt64(&u.activeConns, -1) }
func (u *Upstream) active() int64 { return atomic.LoadInt64(&u.activeConns) }

// ─── Balancer interface ───────────────────────────────────────────────────────

// Balancer selects a healthy upstream for an incoming request.
// Implementations must be safe for concurrent use.
type Balancer interface {
	Select(upstreams []*Upstream, r *http.Request) *Upstream
}

// ─── ProxyConfig ─────────────────────────────────────────────────────────────

// ProxyConfig holds all tunable parameters for the ProxyManager.
type ProxyConfig struct {
	// Upstreams is the list of backend addresses (e.g. "http://127.0.0.1:3001").
	Upstreams []string

	// Strategy selects the load-balancing algorithm.
	// Supported: "round-robin" (default), "ip-hash", "least-conn", "weighted".
	Strategy string

	// HealthCheck enables periodic active health checks.
	HealthCheck         bool
	HealthCheckPath     string
	HealthCheckInterval time.Duration
	HealthCheckTimeout  time.Duration

	// Transport tuning
	MaxIdleConns        int
	MaxIdleConnsPerHost int
	IdleConnTimeout     time.Duration
	TLSHandshakeTimeout time.Duration
	DialTimeout         time.Duration
	ResponseTimeout     time.Duration

	// InsecureSkipVerify disables TLS certificate verification (dev only).
	InsecureSkipVerify bool
}

func (c *ProxyConfig) applyDefaults() {
	if c.Strategy == "" {
		c.Strategy = "round-robin"
	}
	if c.HealthCheckPath == "" {
		c.HealthCheckPath = defaultHealthCheckPath
	}
	if c.HealthCheckInterval == 0 {
		c.HealthCheckInterval = defaultHealthCheckInterval
	}
	if c.HealthCheckTimeout == 0 {
		c.HealthCheckTimeout = defaultHealthCheckTimeout
	}
	if c.MaxIdleConns == 0 {
		c.MaxIdleConns = defaultMaxIdleConns
	}
	if c.MaxIdleConnsPerHost == 0 {
		c.MaxIdleConnsPerHost = defaultMaxIdleConnsPerHost
	}
	if c.IdleConnTimeout == 0 {
		c.IdleConnTimeout = defaultIdleConnTimeout
	}
	if c.TLSHandshakeTimeout == 0 {
		c.TLSHandshakeTimeout = defaultTLSHandshakeTimeout
	}
	if c.DialTimeout == 0 {
		c.DialTimeout = defaultDialTimeout
	}
	if c.ResponseTimeout == 0 {
		c.ResponseTimeout = defaultResponseTimeout
	}
}

// ─── ProxyManager ────────────────────────────────────────────────────────────

// ProxyManager handles reverse-proxy routing and upstream lifecycle.
type ProxyManager struct {
	upstreams []*Upstream
	balancer  Balancer
	transport *http.Transport
	config    ProxyConfig

	// healthClient is a dedicated HTTP client used only for health checks.
	healthClient *http.Client

	// stopHealth closes this channel to stop the health-check loop.
	stopHealth chan struct{}
	stopOnce   sync.Once
}

// NewProxyManager builds a ProxyManager from the provided configuration.
func NewProxyManager(cfg ProxyConfig) (*ProxyManager, error) {
	cfg.applyDefaults()

	if len(cfg.Upstreams) == 0 {
		return nil, errors.New("proxy: at least one upstream is required")
	}

	transport := &http.Transport{
		DialContext: (&net.Dialer{
			Timeout:   cfg.DialTimeout,
			KeepAlive: 30 * time.Second,
		}).DialContext,
		MaxIdleConns:          cfg.MaxIdleConns,
		MaxIdleConnsPerHost:   cfg.MaxIdleConnsPerHost,
		IdleConnTimeout:       cfg.IdleConnTimeout,
		TLSHandshakeTimeout:   cfg.TLSHandshakeTimeout,
		ExpectContinueTimeout: 1 * time.Second,
		TLSClientConfig:       &tls.Config{InsecureSkipVerify: cfg.InsecureSkipVerify}, //nolint:gosec
	}

	balancer, err := newBalancer(cfg.Strategy)
	if err != nil {
		return nil, err
	}

	upstreams, err := buildUpstreams(cfg.Upstreams, transport)
	if err != nil {
		return nil, err
	}

	m := &ProxyManager{
		upstreams:  upstreams,
		balancer:   balancer,
		transport:  transport,
		config:     cfg,
		stopHealth: make(chan struct{}),
		healthClient: &http.Client{
			Timeout:   cfg.HealthCheckTimeout,
			Transport: transport,
		},
	}

	if cfg.HealthCheck {
		go m.runHealthChecks()
	}

	return m, nil
}

// Close gracefully shuts down the proxy manager and stops background goroutines.
func (m *ProxyManager) Close() {
	m.stopOnce.Do(func() {
		close(m.stopHealth)
	})
	m.transport.CloseIdleConnections()
}

// ServeHTTP implements http.Handler.
func (m *ProxyManager) ServeHTTP(w http.ResponseWriter, r *http.Request) {
	upstream := m.balancer.Select(m.upstreams, r)
	if upstream == nil {
		http.Error(w, "503 Service Unavailable — no healthy upstreams", http.StatusServiceUnavailable)
		return
	}

	upstream.incActive()
	defer upstream.decActive()

	// Apply a per-request timeout to the outgoing context.
	ctx, cancel := context.WithTimeout(r.Context(), m.config.ResponseTimeout)
	defer cancel()

	upstream.reverseProxy.ServeHTTP(w, r.WithContext(ctx))
}

// Upstreams returns a snapshot of the current upstream list.
// Callers must not mutate the returned slice.
func (m *ProxyManager) Upstreams() []*Upstream {
	return m.upstreams
}

// ─── Health checks ───────────────────────────────────────────────────────────

func (m *ProxyManager) runHealthChecks() {
	ticker := time.NewTicker(m.config.HealthCheckInterval)
	defer ticker.Stop()

	// Run an immediate check on startup so upstreams are marked before
	// the first real request arrives.
	m.checkAll()

	for {
		select {
		case <-ticker.C:
			m.checkAll()
		case <-m.stopHealth:
			return
		}
	}
}

func (m *ProxyManager) checkAll() {
	var wg sync.WaitGroup
	for _, u := range m.upstreams {
		wg.Add(1)
		go func(u *Upstream) {
			defer wg.Done()
			m.checkUpstream(u)
		}(u)
	}
	wg.Wait()
}

func (m *ProxyManager) checkUpstream(u *Upstream) {
	checkURL := *u.Target
	checkURL.Path = m.config.HealthCheckPath

	resp, err := m.healthClient.Get(checkURL.String())
	if err != nil {
		failures := atomic.AddInt64(&u.failures, 1)
		if failures >= 2 { // require two consecutive failures before marking unhealthy
			if u.IsHealthy() {
				log.Printf("[Proxy] upstream %s marked UNHEALTHY (failures=%d): %v",
					u.Target, failures, err)
				u.markUnhealthy()
			}
		}
		return
	}
	_ = resp.Body.Close()

	if resp.StatusCode >= 200 && resp.StatusCode < 400 {
		wasUnhealthy := !u.IsHealthy()
		u.markHealthy()
		if wasUnhealthy {
			log.Printf("[Proxy] upstream %s recovered (HEALTHY)", u.Target)
		}
	} else {
		failures := atomic.AddInt64(&u.failures, 1)
		if failures >= 2 && u.IsHealthy() {
			log.Printf("[Proxy] upstream %s marked UNHEALTHY (status=%d)", u.Target, resp.StatusCode)
			u.markUnhealthy()
		}
	}
}

// ─── Upstream builders ───────────────────────────────────────────────────────

func buildUpstreams(addrs []string, transport http.RoundTripper) ([]*Upstream, error) {
	out := make([]*Upstream, 0, len(addrs))
	for _, addr := range addrs {
		if addr == "" {
			return nil, errors.New("proxy: upstream address must not be empty")
		}
		target, err := url.Parse(addr)
		if err != nil {
			return nil, fmt.Errorf("proxy: invalid upstream %q: %w", addr, err)
		}
		if target.Scheme == "" || target.Host == "" {
			return nil, fmt.Errorf("proxy: upstream %q must include scheme and host", addr)
		}

		u := &Upstream{
			Target:  target,
			Weight:  1,
			healthy: 1, // assume healthy until first check
		}
		u.reverseProxy = buildReverseProxy(u, transport)
		out = append(out, u)
	}
	return out, nil
}

// buildReverseProxy creates a reusable httputil.ReverseProxy for the upstream.
// The Director is set once and reused, avoiding a closure allocation per request.
func buildReverseProxy(u *Upstream, transport http.RoundTripper) *httputil.ReverseProxy {
	rp := httputil.NewSingleHostReverseProxy(u.Target)
	rp.Transport = transport
	rp.ErrorHandler = func(w http.ResponseWriter, r *http.Request, err error) {
		if errors.Is(err, context.Canceled) {
			// Client disconnected — not an upstream fault.
			return
		}
		log.Printf("[Proxy] upstream %s error: %v", u.Target, err)
		http.Error(w, "502 Bad Gateway", http.StatusBadGateway)
	}

	// Wrap the default director to inject our telemetry headers for tracing.
	// Wrap the default director to inject our telemetry headers for tracing.
	base := rp.Director
	rp.Director = func(req *http.Request) {
		base(req)
		req.Header.Set("X-Proxied-By", "XyPriss-Go")
		req.Header.Set("X-Upstream", u.Target.Host)

		// Forward client IP
		if ip, _, err := net.SplitHostPort(req.RemoteAddr); err == nil {
			if req.Header.Get("X-Real-IP") == "" {
				req.Header.Set("X-Real-IP", ip)
			}
			if req.Header.Get("X-Forwarded-For") == "" {
				req.Header.Set("X-Forwarded-For", ip)
			}
		}
	}

	rp.ModifyResponse = func(res *http.Response) error {
		res.Header.Set("X-Proxied-By", "XyPriss-Go")
		res.Header.Set("X-Upstream", u.Target.Host)
		return nil
	}

	return rp
}

// ─── Balancer factory ────────────────────────────────────────────────────────

func newBalancer(strategy string) (Balancer, error) {
	switch strategy {
	case "round-robin", "":
		return &RoundRobinBalancer{}, nil
	case "ip-hash":
		return &IPHashBalancer{}, nil
	case "least-conn":
		return &LeastConnBalancer{}, nil
	case "weighted":
		return &WeightedRoundRobinBalancer{}, nil
	default:
		return nil, fmt.Errorf("proxy: unknown balancing strategy %q", strategy)
	}
}

// selectHealthy filters upstreams to only healthy ones and delegates to fn.
// If no healthy upstreams exist, it falls back to all upstreams (degraded mode).
func selectHealthy(upstreams []*Upstream, fn func([]*Upstream) *Upstream) *Upstream {
	healthy := make([]*Upstream, 0, len(upstreams))
	for _, u := range upstreams {
		if u.IsHealthy() {
			healthy = append(healthy, u)
		}
	}
	if len(healthy) == 0 {
		// Degraded mode: try all upstreams rather than returning nil immediately.
		log.Printf("[Proxy] WARNING: no healthy upstreams — using all %d in degraded mode", len(upstreams))
		return fn(upstreams)
	}
	return fn(healthy)
}

// ─── Round-Robin ─────────────────────────────────────────────────────────────

// RoundRobinBalancer distributes requests evenly across healthy upstreams.
type RoundRobinBalancer struct {
	counter uint64
}

func (b *RoundRobinBalancer) Select(upstreams []*Upstream, _ *http.Request) *Upstream {
	return selectHealthy(upstreams, func(pool []*Upstream) *Upstream {
		if len(pool) == 0 {
			return nil
		}
		n := atomic.AddUint64(&b.counter, 1)
		return pool[(n-1)%uint64(len(pool))]
	})
}

// ─── IP-Hash ─────────────────────────────────────────────────────────────────

// IPHashBalancer routes a given client IP consistently to the same upstream.
type IPHashBalancer struct{}

func (b *IPHashBalancer) Select(upstreams []*Upstream, r *http.Request) *Upstream {
	return selectHealthy(upstreams, func(pool []*Upstream) *Upstream {
		if len(pool) == 0 {
			return nil
		}
		ip := clientIP(r)
		h := fnv.New64a()
		_, _ = h.Write([]byte(ip))
		return pool[h.Sum64()%uint64(len(pool))]
	})
}

// ─── Least-Connections ───────────────────────────────────────────────────────

// LeastConnBalancer routes each request to the upstream with fewest active connections.
type LeastConnBalancer struct{}

func (b *LeastConnBalancer) Select(upstreams []*Upstream, _ *http.Request) *Upstream {
	return selectHealthy(upstreams, func(pool []*Upstream) *Upstream {
		if len(pool) == 0 {
			return nil
		}
		best := pool[0]
		min := best.active()
		for _, u := range pool[1:] {
			if c := u.active(); c < min {
				min = c
				best = u
			}
		}
		return best
	})
}

// ─── Weighted Round-Robin ────────────────────────────────────────────────────

// WeightedRoundRobinBalancer distributes requests proportional to each upstream's Weight.
type WeightedRoundRobinBalancer struct {
	mu      sync.Mutex
	current int // index into expanded pool
	pool    []*Upstream
	built   bool
}

func (b *WeightedRoundRobinBalancer) Select(upstreams []*Upstream, _ *http.Request) *Upstream {
	return selectHealthy(upstreams, func(pool []*Upstream) *Upstream {
		if len(pool) == 0 {
			return nil
		}

		b.mu.Lock()
		defer b.mu.Unlock()

		// Rebuild the weighted pool whenever the healthy set changes.
		if !b.built || len(b.pool) == 0 {
			b.pool = expandWeighted(pool)
			b.current = 0
			b.built = true
		}
		if len(b.pool) == 0 {
			return nil
		}

		u := b.pool[b.current%len(b.pool)]
		b.current++
		return u
	})
}

// expandWeighted builds a flat slice where each upstream appears Weight times.
func expandWeighted(upstreams []*Upstream) []*Upstream {
	var out []*Upstream
	for _, u := range upstreams {
		w := u.Weight
		if w <= 0 {
			w = 1
		}
		for i := 0; i < w; i++ {
			out = append(out, u)
		}
	}
	return out
}

// ─── Helpers ─────────────────────────────────────────────────────────────────

// clientIP extracts the real client IP, honouring X-Real-IP and X-Forwarded-For.
func clientIP(r *http.Request) string {
	if ip := r.Header.Get("X-Real-IP"); ip != "" {
		return ip
	}
	if ip := r.Header.Get("X-Forwarded-For"); ip != "" {
		// X-Forwarded-For may be a comma-separated list; take the first entry.
		for i := 0; i < len(ip); i++ {
			if ip[i] == ',' {
				return ip[:i]
			}
		}
		return ip
	}
	host, _, err := net.SplitHostPort(r.RemoteAddr)
	if err != nil {
		return r.RemoteAddr
	}
	return host
}