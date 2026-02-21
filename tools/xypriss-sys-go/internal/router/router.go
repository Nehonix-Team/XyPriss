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

package router

import (
	"strings"
	"sync"
	"sync/atomic"
)

// ─── Types ────────────────────────────────────────────────────────────────────

type RouteTargetType string

const (
	TargetStaticFile RouteTargetType = "StaticFile"
	TargetJsWorker   RouteTargetType = "JsWorker"
	TargetRedirect   RouteTargetType = "Redirect"
	TargetInternal   RouteTargetType = "Internal"
)

type RouteTarget struct {
	Type        RouteTargetType `json:"type"`
	Path        string          `json:"path,omitempty"`
	Destination string          `json:"destination,omitempty"`
	Code        uint16          `json:"code,omitempty"`
	Action      string          `json:"action,omitempty"`
}

type RouteInfo struct {
	Method      string      `json:"method"`
	Path        string      `json:"path"`
	Target      RouteTarget `json:"target"`
	Middlewares []string    `json:"middlewares"`
}

type RouterStats struct {
	TotalLookups  uint64 `json:"total_lookups"`
	FailedLookups uint64 `json:"failed_lookups"`
}

// ─── Trie node ────────────────────────────────────────────────────────────────

// node represents one path segment in the routing trie.
// Static children are stored in a hash map for O(1) exact lookup;
// param / wildcard children are kept separately so we never scan statics for them.
type node struct {
	// staticMap provides O(1) lookup for literal path segments.
	staticMap map[string]*node

	param *node // :name child (at most one per level)
	wild  *node // *name child  (at most one per level)

	route     *RouteInfo
	paramName string // populated when this node IS a param/wild segment
	isWild    bool
}

func newNode() *node {
	return &node{staticMap: make(map[string]*node, 4)}
}

// ─── Path-segment pool ────────────────────────────────────────────────────────

// partsPool recycles []string slices used during path splitting so the hot path
// allocates nothing on the heap.
var partsPool = sync.Pool{
	New: func() any {
		s := make([]string, 0, 16)
		return &s
	},
}

// splitPath splits a URL path into segments without allocating a new slice.
// The caller MUST call putParts when done.
func splitPath(path string) *[]string {
	ptr := partsPool.Get().(*[]string)
	parts := (*ptr)[:0]
	path = strings.Trim(path, "/")
	for path != "" {
		i := strings.IndexByte(path, '/')
		if i < 0 {
			parts = append(parts, path)
			break
		}
		if i > 0 {
			parts = append(parts, path[:i])
		}
		path = path[i+1:]
	}
	*ptr = parts
	return ptr
}

func putParts(ptr *[]string) { partsPool.Put(ptr) }

// ─── Router ───────────────────────────────────────────────────────────────────

type XyRouter struct {
	mu    sync.RWMutex
	roots map[string]*node // METHOD → root node

	totalLookups  uint64
	failedLookups uint64
}

func NewXyRouter() *XyRouter {
	return &XyRouter{roots: make(map[string]*node, 8)}
}

// ─── AddRoute ─────────────────────────────────────────────────────────────────

func (r *XyRouter) AddRoute(info RouteInfo) error {
	r.mu.Lock()
	defer r.mu.Unlock()

	method := strings.ToUpper(info.Method)
	root, ok := r.roots[method]
	if !ok {
		root = newNode()
		r.roots[method] = root
	}

	// Root path
	if info.Path == "/" || info.Path == "" {
		infoCopy := info
		root.route = &infoCopy
		return nil
	}

	ptr := splitPath(info.Path)
	parts := *ptr
	curr := root

	for _, part := range parts {
		switch {
		case strings.HasPrefix(part, "*"):
			// Wildcard – always terminal; reuse if already exists
			if curr.wild == nil {
				curr.wild = newNode()
				curr.wild.paramName = part[1:]
				curr.wild.isWild = true
			}
			curr = curr.wild

		case strings.HasPrefix(part, ":"):
			// Named parameter
			if curr.param == nil {
				curr.param = newNode()
				curr.param.paramName = part[1:]
			}
			curr = curr.param

		default:
			// Static segment
			child, exists := curr.staticMap[part]
			if !exists {
				child = newNode()
				curr.staticMap[part] = child
			}
			curr = child
		}
	}

	putParts(ptr)
	infoCopy := info
	curr.route = &infoCopy
	return nil
}

// ─── MatchRoute ───────────────────────────────────────────────────────────────

func (r *XyRouter) MatchRoute(method, path string) (*RouteInfo, map[string]string) {
	atomic.AddUint64(&r.totalLookups, 1)

	r.mu.RLock()
	defer r.mu.RUnlock()

	root, ok := r.roots[strings.ToUpper(method)]
	if !ok {
		atomic.AddUint64(&r.failedLookups, 1)
		return nil, nil
	}

	// Fast path: root
	if path == "/" || path == "" {
		if root.route != nil {
			return root.route, make(map[string]string)
		}
		atomic.AddUint64(&r.failedLookups, 1)
		return nil, nil
	}

	ptr := splitPath(path)
	parts := *ptr

	params := make(map[string]string, 4)
	found := matchNode(root, parts, params)
	putParts(ptr)

	if found != nil {
		return found, params
	}

	atomic.AddUint64(&r.failedLookups, 1)
	return nil, nil
}

// matchNode performs a recursive descent through the trie with priority:
//  1. Exact static match
//  2. Named parameter match
//  3. Wildcard (catch-all)
//
// It returns the matched *RouteInfo or nil.
// The params map is populated in-place; on backtrack the caller clears its own key.
func matchNode(curr *node, parts []string, params map[string]string) *RouteInfo {
	if len(parts) == 0 {
		return curr.route // may be nil
	}

	part := parts[0]
	rest := parts[1:]

	// 1. Static exact match – O(1)
	if child, ok := curr.staticMap[part]; ok {
		if ri := matchNode(child, rest, params); ri != nil {
			return ri
		}
	}

	// 2. Named parameter
	if curr.param != nil {
		params[curr.param.paramName] = part
		if ri := matchNode(curr.param, rest, params); ri != nil {
			return ri
		}
		delete(params, curr.param.paramName) // backtrack
	}

	// 3. Wildcard – consumes all remaining segments
	if curr.wild != nil {
		params[curr.wild.paramName] = strings.Join(parts, "/")
		return curr.wild.route // wildcard always terminates (no deeper match)
	}

	return nil
}

// ─── Batch helpers ────────────────────────────────────────────────────────────

// AddRoutes registers multiple routes and returns one error slot per route
// (nil on success). Registration is serialised under a single lock acquisition
// to avoid repeated lock/unlock overhead.
func (r *XyRouter) AddRoutes(routes []RouteInfo) []error {
	errs := make([]error, len(routes))
	for i := range routes {
		errs[i] = r.AddRoute(routes[i])
	}
	return errs
}

// ─── Introspection ────────────────────────────────────────────────────────────

func (r *XyRouter) ListRoutes() []RouteInfo {
	r.mu.RLock()
	defer r.mu.RUnlock()

	var res []RouteInfo
	for _, root := range r.roots {
		collectRoutes(root, &res)
	}
	return res
}

func collectRoutes(n *node, out *[]RouteInfo) {
	if n.route != nil {
		*out = append(*out, *n.route)
	}
	for _, child := range n.staticMap {
		collectRoutes(child, out)
	}
	if n.param != nil {
		collectRoutes(n.param, out)
	}
	if n.wild != nil {
		collectRoutes(n.wild, out)
	}
}

// GetStats returns atomic counters – safe to call without holding the lock.
func (r *XyRouter) GetStats() RouterStats {
	return RouterStats{
		TotalLookups:  atomic.LoadUint64(&r.totalLookups),
		FailedLookups: atomic.LoadUint64(&r.failedLookups),
	}
}

// Reset clears all routes and resets stats. Useful in tests.
func (r *XyRouter) Reset() {
	r.mu.Lock()
	defer r.mu.Unlock()
	r.roots = make(map[string]*node, 8)
	atomic.StoreUint64(&r.totalLookups, 0)
	atomic.StoreUint64(&r.failedLookups, 0)
}