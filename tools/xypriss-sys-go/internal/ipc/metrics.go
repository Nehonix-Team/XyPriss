package ipc

import (
	"regexp"
	"strings"
	"sync"
	"time"
)

type RouteMetrics struct {
	Count       uint64        `json:"count"`
	TotalTime   time.Duration `json:"total_time"`
	MinTime     time.Duration `json:"min_time"`
	MaxTime     time.Duration `json:"max_time"`
	AverageTime time.Duration `json:"average_time"`
}

type MetricsManager struct {
	routeMetrics map[string]*RouteMetrics
	mu           sync.RWMutex
	
	// Pre-compiled regex for normalization
	idRegex      *regexp.Regexp
	uuidRegex    *regexp.Regexp
	objectIdRegex *regexp.Regexp
}

func NewMetricsManager() *MetricsManager {
	return &MetricsManager{
		routeMetrics:  make(map[string]*RouteMetrics),
		idRegex:       regexp.MustCompile(`/\d+`),
		uuidRegex:     regexp.MustCompile(`/[a-f0-9-]{36}`),
		objectIdRegex: regexp.MustCompile(`/[a-f0-9]{24}`),
	}
}

func (m *MetricsManager) NormalizeRoute(path string) string {
	// Remove query params
	if idx := strings.Index(path, "?"); idx != -1 {
		path = path[:idx]
	}

	// Normalize dynamic segments
	path = m.idRegex.ReplaceAllString(path, "/:id")
	path = m.uuidRegex.ReplaceAllString(path, "/:uuid")
	path = m.objectIdRegex.ReplaceAllString(path, "/:objectId")

	return path
}

func (m *MetricsManager) Record(path string, duration time.Duration) {
	route := m.NormalizeRoute(path)

	m.mu.Lock()
	defer m.mu.Unlock()

	metrics, ok := m.routeMetrics[route]
	if !ok {
		metrics = &RouteMetrics{
			MinTime: duration,
		}
		m.routeMetrics[route] = metrics
	}

	metrics.Count++
	metrics.TotalTime += duration
	if duration < metrics.MinTime {
		metrics.MinTime = duration
	}
	if duration > metrics.MaxTime {
		metrics.MaxTime = duration
	}
	metrics.AverageTime = metrics.TotalTime / time.Duration(metrics.Count)
}

func (m *MetricsManager) GetSummary() map[string]RouteMetrics {
	m.mu.RLock()
	defer m.mu.RUnlock()

	summary := make(map[string]RouteMetrics)
	for k, v := range m.routeMetrics {
		summary[k] = *v
	}
	return summary
}
